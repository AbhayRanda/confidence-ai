# Confidence AI Backend Service
import os
import asyncio
import shutil
import uuid
import random
from datetime import datetime, timedelta, timezone as tz
from typing import List, Optional
from pathlib import Path
import httpx
import re

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from database import engine, SessionLocal
from models import AnalysisResult, User
from database import Base
from config import get_settings
from logger import logger
from video_analyzer import VideoAnalyzer
from coaching_engine import generate_response, generate_response_stream, generate_analysis_report
from auth import create_access_token, get_current_user  # JWT auth
from progress_manager import progress_manager             # WebSocket progress
from email_service import send_otp_email, check_gmail_exists  # Real Gmail OTP sender & MX verification


# ── Pydantic models ───────────────────────────────────────────

class ChatContext(BaseModel):
    """Optional analysis context passed with a chat message"""
    confidence_score:         Optional[float] = None
    eye_contact_percentage:   Optional[float] = None
    smile_percentage:         Optional[float] = None
    posture_percentage:       Optional[float] = None
    hand_movement_percentage: Optional[float] = None
    speech_score:             Optional[float] = None
    filler_word_count:        Optional[int]   = None
    words_per_minute:         Optional[float] = None
    # Live vision context (sent by /live page)
    smiling:                  Optional[bool]  = None
    eye_contact:              Optional[bool]  = None
    gesture:                  Optional[str]   = None
    detected_objects:         Optional[List[str]] = None


class HistoryMessage(BaseModel):
    """A single turn in the conversation history"""
    role:    str   # "user" | "mentor"
    content: str


class ChatRequest(BaseModel):
    """Request body for the /chat and /chat/stream endpoints"""
    message:       str
    context:       Optional[ChatContext]          = None
    history:       Optional[List[HistoryMessage]] = None   # Step 4: conversation history
    system_prompt: Optional[str]                  = None   # Live mode override (Coach / Interview / Free Chat / Vision)


# Initialize settings
settings = get_settings()

# Create tables
Base.metadata.create_all(bind=engine)

# Create necessary directories
if not os.path.exists(settings.upload_folder):
    os.makedirs(settings.upload_folder)
    logger.info(f"Created upload folder: {settings.upload_folder}")

if not os.path.exists(os.path.dirname(settings.log_file)):
    os.makedirs(os.path.dirname(settings.log_file), exist_ok=True)

# Initialize FastAPI app
app = FastAPI(
    title="Confidence AI Service",
    description="AI-powered confidence analysis system",
    version="2.0.0"
)


# ── Rate limiting ─────────────────────────────────────────────
# Key function: use JWT user id so each user has their own bucket.
# Falls back to IP address for unauthenticated routes.
def _rate_key(request: Request) -> str:
    """Return the authenticated user's id, or client IP as fallback."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        from jose import jwt as _jwt, JWTError
        try:
            payload = _jwt.decode(
                auth_header[7:],
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
            sub = payload.get("sub")
            if sub:
                return f"user:{sub}"
        except JWTError:
            pass
    return get_remote_address(request)  # fallback: IP


limiter = Limiter(key_func=_rate_key)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

# Mount uploads folder
app.mount("/uploads", StaticFiles(directory=settings.upload_folder), name="uploads")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins.split(',')],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Initialize video analyzer
video_analyzer = VideoAnalyzer()

# Storage limit configuration
STORAGE_LIMIT_MB    = 500
STORAGE_LIMIT_BYTES = STORAGE_LIMIT_MB * 1024 * 1024


def get_user_storage_usage(user_id: int) -> dict:
    """Calculate total storage usage for a user"""
    db = SessionLocal()
    try:
        results = db.query(AnalysisResult).filter(AnalysisResult.user_id == user_id).all()
        total_bytes = 0
        for result in results:
            video_path = os.path.join(settings.upload_folder, result.video_path)
            if os.path.exists(video_path):
                total_bytes += os.path.getsize(video_path)
        used_mb       = total_bytes / (1024 * 1024)
        available_bytes = max(0, STORAGE_LIMIT_BYTES - total_bytes)
        available_mb  = available_bytes / (1024 * 1024)
        percentage    = (total_bytes / STORAGE_LIMIT_BYTES * 100) if STORAGE_LIMIT_BYTES > 0 else 0
        return {
            "used_bytes":    total_bytes,
            "used_mb":       round(used_mb, 2),
            "limit_mb":      STORAGE_LIMIT_MB,
            "available_mb":  round(available_mb, 2),
            "percentage":    round(percentage, 1),
        }
    finally:
        db.close()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ═══════════════ HEALTH CHECK ════════════════════════════════

@app.get("/")
def home() -> dict:
    """Health check endpoint"""
    return {
        "message": "AI Confidence Service Running Successfully",
        "gemini_enabled": bool(settings.gemini_api_key),
    }


# ═══════════════ TTS PROXY (ElevenLabs) ══════════════════════

# ElevenLabs voice IDs available on ALL plans (including free):
#   Sarah   → EXAVITQu4vr4xnSDxMaL   (clear, expressive female — free-tier supported)
#   Adam    → pNInz6obpgDQGcFmaJgB   (confident male — free-tier supported)
#   Alice   → Xb7hH8MSUJpSbSDYk0k2   (natural British/clear female — free-tier supported)
# Note: Rachel was migrated to library voices and requires a paid plan via API.
DEFAULT_VOICE_ID  = "EXAVITQu4vr4xnSDxMaL"   # Sarah — available on all plans including free
DEFAULT_TTS_MODEL = "eleven_flash_v2_5"      # Free-tier compatible, low-latency model

# Track quota exhaustion in memory (resets on server restart, but startup probe re-validates)
_tts_quota_exhausted = False
_tts_probe_done      = False  # avoid probing more than once


async def _probe_elevenlabs() -> None:
    """Validate ElevenLabs API key on startup using the subscription endpoint (no credits used)."""
    global _tts_quota_exhausted, _tts_probe_done
    if _tts_probe_done:
        return
    _tts_probe_done = True
    api_key = settings.elevenlabs_api_key
    if not api_key:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.elevenlabs.io/v1/user/subscription",
                headers={"xi-api-key": api_key},
            )
        if resp.status_code == 401:
            try:
                err_data = resp.json()
                # If key is valid but created without the granular user_read permission scope
                if isinstance(err_data.get("detail"), dict) and err_data["detail"].get("status") == "missing_permissions":
                    logger.info("[TTS Probe] ElevenLabs API key is active (granular permissions enabled) [OK]")
                    return
            except Exception:
                pass
            _tts_quota_exhausted = True
            logger.warning("[TTS Probe] ElevenLabs API key is invalid (401) -- backend TTS disabled.")
            return
        if resp.status_code != 200:
            logger.warning(f"[TTS Probe] Subscription check returned {resp.status_code} -- TTS will try anyway.")
            return
        data = resp.json()
        tier            = data.get("tier", "unknown")
        char_remaining  = data.get("character_limit", 0) - data.get("character_count", 0)
        logger.info(f"[TTS Probe] ElevenLabs plan='{tier}' chars_remaining={char_remaining} [OK]")
        if char_remaining <= 0:
            _tts_quota_exhausted = True
            logger.warning("[TTS Probe] ElevenLabs character quota exhausted -- backend TTS disabled.")
    except Exception as e:
        logger.warning(f"[TTS Probe] Could not reach ElevenLabs: {e}")


@app.on_event("startup")
async def startup_event():
    """Run ElevenLabs probe on server startup."""
    await _probe_elevenlabs()


class TTSRequest(BaseModel):
    text:     str
    voice_id: str = DEFAULT_VOICE_ID


@app.get("/tts/status")
def tts_status() -> dict:
    """Report whether backend TTS (ElevenLabs) is available."""
    available = bool(settings.elevenlabs_api_key) and not _tts_quota_exhausted
    reason = "quota_exhausted" if _tts_quota_exhausted else (None if available else "no_api_key")
    return {"available": available, "provider": "elevenlabs" if available else None, "reason": reason}


@app.post("/tts/reset")
def tts_reset() -> dict:
    """Re-enable ElevenLabs TTS (useful after upgrading a plan). Dev use only."""
    global _tts_quota_exhausted, _tts_probe_done
    _tts_quota_exhausted = False
    _tts_probe_done      = False
    return {"message": "TTS quota flag reset. Next request will attempt ElevenLabs again."}


@app.post("/tts")
async def tts_proxy(body: TTSRequest) -> StreamingResponse:
    """
    Proxy TTS requests to ElevenLabs and return audio/mpeg.
    The frontend (useSpeech.js) calls this when backendTtsRef is True.
    Falls back gracefully: if the key is missing or quota is exhausted, returns 503.
    """
    global _tts_quota_exhausted

    api_key = settings.elevenlabs_api_key
    if not api_key:
        raise HTTPException(status_code=503, detail="TTS not configured (no ElevenLabs API key)")

    if _tts_quota_exhausted:
        raise HTTPException(status_code=503, detail="ElevenLabs quota exhausted — using browser TTS")

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    # Truncate very long strings to avoid excessive ElevenLabs charges
    if len(text) > 1000:
        text = text[:997] + "..."

    voice_id = body.voice_id or DEFAULT_VOICE_ID
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key":   api_key,
        "Content-Type": "application/json",
        "Accept":       "audio/mpeg",
    }
    payload = {
        "text":     text,
        "model_id": DEFAULT_TTS_MODEL,
        "voice_settings": {
            "stability":        0.50,
            "similarity_boost": 0.75,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, headers=headers, json=payload)

        if resp.status_code != 200:
            err_body = resp.text[:400]
            logger.warning(f"ElevenLabs TTS {resp.status_code}: {err_body}")

            # Mark quota/plan as exhausted so future calls skip the backend immediately
            is_plan_error = resp.status_code in (401, 402) or \
                            "quota" in err_body.lower() or \
                            "paid_plan" in err_body.lower() or \
                            "library_voice" in err_body.lower()
            if is_plan_error or resp.status_code == 429:
                _tts_quota_exhausted = True
                logger.info("ElevenLabs TTS disabled for this session -- falling back to browser Web Speech API")
                raise HTTPException(status_code=503, detail="ElevenLabs unavailable — using browser TTS")

            raise HTTPException(
                status_code=resp.status_code,
                detail=f"ElevenLabs error {resp.status_code}: {err_body}",
            )

        return StreamingResponse(
            iter([resp.content]),
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-cache", "Content-Length": str(len(resp.content))},
        )

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="TTS request timed out")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"TTS proxy error: {exc}")
        raise HTTPException(status_code=500, detail="TTS proxy error")


# ═══════════════ WEBSOCKET PROGRESS ═════════════════════════

@app.websocket("/ws/progress/{job_id}")
async def ws_progress(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time analysis progress.

    Flow:
      1. Frontend connects here with a self-generated job_id BEFORE uploading.
      2. Frontend POSTs /analyze?job_id={job_id} with the video file.
      3. The /analyze handler registers the same job_id with progress_manager
         and fires progress events as each analysis stage completes.
      4. This handler forwards those events to the WebSocket client.
      5. When analysis ends (success or error), a final event is sent and
         the connection closes cleanly.

    Event format: { "stage": str, "percent": int, "message": str }
    """
    await websocket.accept()
    loop = asyncio.get_event_loop()
    progress_manager.register(job_id, websocket, loop)
    logger.info(f"WS progress connected: job={job_id}")
    try:
        await progress_manager.pump(job_id)   # blocks until analysis done
    except WebSocketDisconnect:
        logger.info(f"WS progress disconnected early: job={job_id}")
    finally:
        progress_manager.unregister(job_id)
        try:
            await websocket.close()
        except Exception:
            pass



# ═══════════════ VIDEO ANALYSIS ══════════════════════════════

def _remux_to_mp4(webm_path: str) -> str:
    """
    Re-mux a WebM (or MKV) file into a clean MP4 using FFmpeg.

    Chrome's MediaRecorder produces WebM files where the EBML cluster headers
    are malformed ("Truncating packet of size N to 14").  FFmpeg's standard
    demuxer rejects these, but with lenient input flags it can still read
    the packets and write a clean, standards-compliant MP4.

    Args:
        webm_path: Absolute or relative path to the source WebM file.

    Returns:
        Path to the remuxed MP4 file (original WebM is deleted on success).
        If remuxing fails, the original path is returned unchanged.
    """
    import subprocess, shutil as _shutil

    mp4_path  = str(Path(webm_path).with_suffix(".mp4"))
    ffmpeg_bin = _shutil.which("ffmpeg") or "ffmpeg"

    cmd = [
        ffmpeg_bin,
        "-y",                           # overwrite output
        # Lenient input flags — handle truncated/broken EBML clusters
        "-fflags", "+genpts+igndts+discardcorrupt",
        "-analyzeduration", "100M",     # scan more data for stream info
        "-probesize",       "100M",
        "-i", webm_path,                # input WebM
        # Encode with H.264 (yuv420p) for 100% iOS Safari and universal mobile playback
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",                  # re-encode audio: webm opus → aac
        "-b:a", "128k",
        "-movflags", "+faststart",      # move moov atom to front of MP4 for instant mobile playback
        mp4_path,
    ]

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
        )
        if proc.returncode == 0 and os.path.exists(mp4_path) and os.path.getsize(mp4_path) > 0:
            logger.info(f"[Remux] WebM -> MP4 succeeded: {mp4_path}")
            # Remove the original WebM to save space
            try:
                os.remove(webm_path)
            except OSError:
                pass
            return mp4_path
        else:
            stderr_txt = proc.stderr.decode("utf-8", errors="replace")[:400]
            logger.warning(f"[Remux] FFmpeg returned {proc.returncode}: {stderr_txt}")
    except Exception as exc:
        logger.warning(f"[Remux] Remux failed ({exc}); using original file")

    # Clean up incomplete output if present
    if os.path.exists(mp4_path):
        try:
            os.remove(mp4_path)
        except OSError:
            pass

    return webm_path   # fall back to original


@app.post("/analyze")
@limiter.limit(lambda: settings.rate_limit_analyze)
async def analyze_video(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    job_id: Optional[str] = Query(None, description="Optional WebSocket progress job ID"),
) -> dict:
    """
    Analyze a video file for confidence metrics.
    Step 3: Also returns a rich coaching report with strengths,
    priority fixes, 7-day plan, exercise, and trend data.

    If job_id is provided, real-time progress events are pushed over
    /ws/progress/{job_id}.  Omitting job_id is fully supported.
    """
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Invalid filename")

        storage_info = get_user_storage_usage(current_user.id)
        if storage_info["available_mb"] <= 0:
            raise HTTPException(
                status_code=413,
                detail="Storage limit reached (500 MB). Please delete old videos to upload new ones.",
            )

        logger.info(f"Processing video: {file.filename}  job_id={job_id}")

        file_extension  = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path       = os.path.join(settings.upload_folder, unique_filename)
        loop            = asyncio.get_event_loop()

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"Video saved: {file_path}")

        # ── WebM repair: remux to MP4 before analysis ─────────────
        # Chrome's MediaRecorder writes WebM files with broken EBML cluster
        # headers ("Truncating packet … to 14") that crash FFmpeg, OpenCV,
        # and MoviePy.  We fix this by re-muxing to MP4 with lenient flags.
        if file_extension.lower() in (".webm", ".mkv"):
            _webm_path = file_path
            file_path = await loop.run_in_executor(
                None, lambda: _remux_to_mp4(_webm_path)
            )

        # Build the progress callback (no-op when no job_id)
        def _on_progress(stage: str, percent: int, message: str) -> None:
            if job_id:
                progress_manager.send_sync(job_id, stage, percent, message)

        # Run CPU-bound analysis in a thread so we don't block the event loop
        _analysis_path = file_path
        analysis_result = await loop.run_in_executor(
            None,
            lambda: video_analyzer.analyze_video(_analysis_path, on_progress=_on_progress),
        )


        # Store in database
        db = SessionLocal()
        try:
            db_result = AnalysisResult(
                user_id=current_user.id,
                confidence_score=analysis_result["confidence_score"],
                confidence_level=analysis_result["confidence_level"],
                eye_contact_percentage=analysis_result["eye_contact_percentage"],
                face_visibility_percentage=analysis_result["face_visibility_percentage"],
                smile_percentage=analysis_result["smile_percentage"],
                posture_percentage=analysis_result["posture_percentage"],
                speech_score=analysis_result["speech_score"],
                filler_word_count=analysis_result["filler_word_count"],
                words_per_minute=analysis_result["words_per_minute"],
                hand_movement_percentage=analysis_result["hand_movement_percentage"],
                video_path=os.path.basename(file_path),
            )
            db.add(db_result)
            db.commit()
            db.refresh(db_result)
            logger.info(f"Analysis result stored with ID: {db_result.id}")

            # Video is kept in uploads directory for session playback and preview
            # Storage limit is managed via user quota (500MB) and delete endpoint

            # Step 3+6: Fetch previous sessions for trend data
            previous_sessions = db.query(AnalysisResult).filter(
                AnalysisResult.user_id == current_user.id,
                AnalysisResult.id != db_result.id,
            ).order_by(AnalysisResult.created_at.desc()).limit(5).all()

            prev_history = [
                {
                    "eye_contact_percentage":   r.eye_contact_percentage,
                    "smile_percentage":         r.smile_percentage,
                    "posture_percentage":       r.posture_percentage,
                    "hand_movement_percentage": r.hand_movement_percentage,
                    "speech_score":             r.speech_score,
                    "confidence_score":         r.confidence_score,
                }
                for r in previous_sessions
            ]
        finally:
            db.close()

        # Generate rich AI coaching report
        _on_progress("report", 90, "Generating AI coaching report…")
        report = generate_analysis_report(
            metrics=analysis_result,
            history=prev_history,
            api_key=settings.gemini_api_key,
        )


        # Signal completion over WebSocket
        if job_id:
            progress_manager.complete_sync(job_id)

        logger.info(f"Analysis result: score={analysis_result['confidence_score']:.1f}")

        return {
            "id":                         db_result.id,
            "speech_text":                analysis_result["speech_text"],
            "eye_contact_percentage":     round(analysis_result["eye_contact_percentage"], 2),
            "face_visibility_percentage": round(analysis_result["face_visibility_percentage"], 2),
            "smile_percentage":           round(analysis_result["smile_percentage"], 2),
            "posture_percentage":         round(analysis_result["posture_percentage"], 2),
            "speech_score":               round(analysis_result["speech_score"], 2),
            "filler_word_count":          analysis_result["filler_word_count"],
            "words_per_minute":           round(analysis_result["words_per_minute"], 2),
            "confidence_score":           analysis_result["confidence_score"],
            "hand_movement_percentage":   round(analysis_result["hand_movement_percentage"], 2),
            "confidence_level":           analysis_result["confidence_level"],
            "suggestions":                analysis_result["suggestions"],
            "report": report,
        }

    except HTTPException:
        if job_id:
            progress_manager.complete_sync(job_id, error=True)
        raise
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}", exc_info=True)
        if job_id:
            progress_manager.complete_sync(job_id, error=True)
        raise HTTPException(status_code=500, detail="Error processing video")


# ═══════════════ IDEAL PERFORMANCE SCRIPT ════════════════════

class IdealScriptRequest(BaseModel):
    """Metrics from the user's latest analysis session."""
    confidence_score:         float = 50.0
    eye_contact_percentage:   float = 50.0
    smile_percentage:         float = 50.0
    posture_percentage:       float = 50.0
    hand_movement_percentage: float = 50.0
    speech_score:             float = 50.0
    filler_word_count:        int   = 0
    words_per_minute:         float = 130.0
    speech_text:              str   = ""


def _clean_and_improve_speech_fallback(speech_text: str, body: IdealScriptRequest) -> str:
    """
    Cleans and elevates the user's spoken transcript when Gemini LLM is unavailable.
    Removes filler words, cleans sentence structure, removes timid hedges,
    and formats into an articulate, confident script.
    """
    raw = (speech_text or "").strip()
    if not raw or len(raw) < 5:
        # User did not speak or audio was empty; use default demo speech
        weak = []
        if body.eye_contact_percentage < 60: weak.append("sustained eye contact")
        if body.smile_percentage       < 60: weak.append("a warm, genuine smile")
        if body.posture_percentage     < 60: weak.append("confident upright posture")
        if body.speech_score           < 60: weak.append("clear, deliberate pacing")
        if body.filler_word_count      > 3:  weak.append("eliminating filler words")

        focus_line = (
            f"I have been focusing especially on {', '.join(weak[:2])}. "
            if weak else ""
        )
        return (
            "Good morning, everyone. Thank you for giving me this opportunity to speak with you today. "
            "I want to start by saying how genuinely excited I am about what we are building together — "
            "and I want to make sure that excitement comes through clearly in everything I share. "
            f"{focus_line}"
            "Every great achievement begins with clarity of purpose and the courage to communicate it boldly. "
            "Today I will walk you through our vision, our strategy, and the concrete steps we are taking "
            "to turn this opportunity into lasting impact. "
            "I will be direct, I will be clear, and I will leave time for your questions — "
            "because your perspective matters deeply to us. "
            "Thank you for your attention, and I look forward to a great conversation."
        )

    # 1. Regex filler words cleanup
    filler_patterns = [
        r'\b(um|uh|er|ah|like|you know|so yeah|sort of|kind of|basically|literally|i mean)\b',
        r'^\s*(so|well|okay|ok|actually|right)\b[\s,]*',
    ]
    cleaned = raw
    for pat in filler_patterns:
        cleaned = re.sub(pat, ' ', cleaned, flags=re.IGNORECASE)

    # 2. Replace timid hedges with assertive phrasing
    hedges = {
        r'\bi think maybe\b': 'I believe',
        r'\bi guess\b': 'I know',
        r'\bi sort of\b': 'I',
        r'\bi kind of\b': 'I',
        r'\bmaybe we can\b': 'we will',
        r'\bi just wanted to\b': 'I am here to',
        r'\bhopefully\b': 'confidently',
    }
    for hedge, strong in hedges.items():
        cleaned = re.sub(hedge, strong, cleaned, flags=re.IGNORECASE)

    # Clean whitespace and repeated punctuation
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    cleaned = re.sub(r'[,;\s]+,', ',', cleaned)

    # Split into sentences or clauses
    raw_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', cleaned) if s.strip()]
    if not raw_sentences:
        raw_sentences = [cleaned]

    # Capitalize and punctuate each sentence
    formatted_sentences = []
    for s in raw_sentences:
        if not s:
            continue
        s = s[0].upper() + s[1:]
        if not s.endswith(('.', '!', '?')):
            s += '.'
        formatted_sentences.append(s)

    result = " ".join(formatted_sentences)

    # If the user's speech was very short (< 25 words), give it a professional opening & closing
    word_count = len(result.split())
    if word_count < 25:
        result = (
            f"Hello and thank you for your time. {result} "
            f"I am deeply committed to driving strong results, communicating with purpose, "
            f"and delivering meaningful value at every step."
        )
    elif not result.endswith('.'):
        result += '.'

    return result


@app.post("/generate-ideal-script")
@limiter.limit("10/minute")
async def generate_ideal_script(
    request: Request,
    body: IdealScriptRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Generate an ideal/improved presentation script based directly on the user's
    spoken speech transcript (or tailored to their performance metrics if silent).
    Voiced by the 3D avatar in the Ideal Performance Demo modal.

    Returns:
        {
            "script": str,
            "original_speech": str,
            "used_user_speech": bool
        }
    """
    user_speech = (body.speech_text or "").strip()
    has_user_speech = len(user_speech) >= 5

    metrics_summary = (
        f"Confidence score: {body.confidence_score:.0f}/100\n"
        f"Eye contact: {body.eye_contact_percentage:.0f}%\n"
        f"Smile / warmth: {body.smile_percentage:.0f}%\n"
        f"Posture: {body.posture_percentage:.0f}%\n"
        f"Hand movement: {body.hand_movement_percentage:.0f}%\n"
        f"Speech fluency score: {body.speech_score:.0f}%\n"
        f"Filler words detected: {body.filler_word_count}\n"
        f"Pacing: {body.words_per_minute:.0f} WPM\n"
    )

    if has_user_speech:
        prompt = (
            "You are a world-class executive communication coach and speechwriter.\n"
            "A user just completed a speaking practice session (such as an interview, pitch, or presentation).\n"
            "Here is the EXACT speech transcript recorded from the user:\n"
            f'"""\n{user_speech[:2500]}\n"""\n\n'
            f"User analysis metrics to improve:\n{metrics_summary}\n"
            "YOUR TASK:\n"
            "Take the user's EXACT speech above and rewrite it into an IDEAL, high-confidence, articulate delivery of THE SAME SPEECH.\n"
            "A realistic 3D AI avatar will speak this improved speech aloud to show the user:\n"
            "'This is how you could deliver your exact same talk with commanding presence, poise, and zero filler words.'\n\n"
            "CRITICAL RULES:\n"
            "1. PRESERVE THE USER'S ACTUAL TOPIC & CONTENT: Keep the user's exact subject, key arguments, stories, and answers. Do NOT replace what they said with a generic speech.\n"
            "2. ZERO FILLER WORDS: Eliminate every 'um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'basically', and false starts.\n"
            "3. CONFIDENT & ARTICULATE VOCABULARY: Replace timid or uncertain phrasing ('I think maybe', 'I guess') with decisive, clear language.\n"
            "4. NATURAL CADENCE: Structure into clean, punchy sentences (around 100–180 words) that flow beautifully when spoken aloud.\n"
            "5. OUTPUT FORMAT: Return ONLY the spoken text. No intro, no markdown asterisks, no quotes, no headings, no bracketed stage directions."
        )
    else:
        prompt = (
            "You are a world-class executive communication coach.\n"
            "A user recorded a practice presentation video without audible speech (or microphone was muted).\n"
            f"User visual metrics:\n{metrics_summary}\n"
            "Write a short, polished, highly confident 120–150 word demonstration presentation on leadership presence, "
            "clarity of thought, and persuasive communication. "
            "The 3D avatar will voice this to demonstrate ideal pacing, eye contact, and confidence.\n"
            "Output ONLY the spoken words — no headings, no stage directions, no quotes."
        )

    # ── Try Gemini ────────────────────────────────────────────
    api_key = settings.gemini_api_key
    script  = ""

    if api_key:
        models_to_try = [
            "gemini-robotics-er-2-preview",
            "gemini-3.5-flash",
            "gemini-3.8-flash",
            "gemini-flash-latest",
        ]
        for model in models_to_try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model}:generateContent?key={api_key}"
            )
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(url, json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature":    0.75,
                            "maxOutputTokens": 380,
                        },
                    })
                if resp.status_code == 200:
                    data  = resp.json()
                    parts = (data.get("candidates", [{}])[0]
                                  .get("content", {})
                                  .get("parts", []))
                    text = "".join(p.get("text", "") for p in parts).strip()
                    # Strip any surrounding quotes or markdown headers if model returned them
                    text = re.sub(r'^["\']|["\']$', '', text).strip()
                    if text and len(text) > 40:
                        script = text
                        logger.info(f"[IdealScript] Successfully generated with Gemini ({model}) using user_speech={has_user_speech}")
                        break
            except Exception as exc:
                logger.warning(f"[IdealScript] Gemini {model} failed: {exc}")
                continue

    # ── Fallback script (no API key or all models failed) ─────
    if not script:
        script = _clean_and_improve_speech_fallback(user_speech, body)
        logger.info(f"[IdealScript] Used rule-based fallback generator (user_speech={has_user_speech})")

    logger.info(f"[IdealScript] Generated {len(script)} chars for user {current_user.id} (used_user_speech={has_user_speech})")
    return {
        "script": script,
        "original_speech": user_speech,
        "used_user_speech": has_user_speech,
    }



# ═══════════════ DASHBOARD ════════════════════════════════════


@app.get("/dashboard")
def get_dashboard(current_user: User = Depends(get_current_user)) -> List[dict]:
    """Get analysis results for current user"""
    db = SessionLocal()
    try:
        results = db.query(AnalysisResult).filter(
            AnalysisResult.user_id == current_user.id
        ).order_by(AnalysisResult.created_at.desc()).all()

        return [
            {
                "id":                         r.id,
                "confidence_score":           r.confidence_score,
                "confidence_level":           r.confidence_level,
                "eye_contact_percentage":     r.eye_contact_percentage,
                "face_visibility_percentage": r.face_visibility_percentage,
                "smile_percentage":           r.smile_percentage,
                "posture_percentage":         r.posture_percentage,
                "speech_score":               r.speech_score,
                "filler_word_count":          r.filler_word_count,
                "words_per_minute":           r.words_per_minute,
                "hand_movement_percentage":   r.hand_movement_percentage,
                "video_path":                 r.video_path,
                "created_at":                 r.created_at.isoformat(),
            }
            for r in results
        ]
    finally:
        db.close()


# ═══════════════ STEP 6: PROGRESS TRACKING ═══════════════════

@app.get("/progress")
def get_progress(current_user: User = Depends(get_current_user)) -> dict:
    """
    Return per-metric trends, streak, and full time-series for charts.

    Returns:
        {
          "has_data": bool,
          "sessions_count": int,
          "overall_delta": float,
          "streak": int,                    # sessions in last 7 days
          "best_score": float,
          "metrics": {
            "Eye Contact": { current, previous, delta, direction },
            ...
          },
          "series": {                       # last 10 sessions, oldest first
            "labels":        [...date strings],
            "confidence":    [...floats],
            "eye_contact":   [...floats],
            "posture":       [...floats],
            "speech":        [...floats],
            "smile":         [...floats],
            "hand_movement": [...floats],
          }
        }
    """
    db = SessionLocal()
    try:
        results = db.query(AnalysisResult).filter(
            AnalysisResult.user_id == current_user.id
        ).order_by(AnalysisResult.created_at.desc()).limit(10).all()

        sessions_count = len(results)

        # ── Streak: how many of the last 7 days had at least one session ──
        now      = datetime.now(tz.utc)
        week_ago = now - timedelta(days=7)
        streak   = sum(
            1 for r in results
            if (r.created_at.replace(tzinfo=tz.utc) if r.created_at.tzinfo is None
                else r.created_at) >= week_ago
        )

        best_score = max((r.confidence_score for r in results), default=0.0)

        if sessions_count < 2:
            # Build whatever series we have (may be 0 or 1 point)
            ordered = list(reversed(results))
            series = {
                "labels":        [r.created_at.strftime("%b %d") for r in ordered],
                "confidence":    [r.confidence_score          for r in ordered],
                "eye_contact":   [r.eye_contact_percentage    for r in ordered],
                "posture":       [r.posture_percentage        for r in ordered],
                "speech":        [r.speech_score              for r in ordered],
                "smile":         [r.smile_percentage          for r in ordered],
                "hand_movement": [r.hand_movement_percentage  for r in ordered],
            }
            return {
                "has_data":       sessions_count > 0,
                "sessions_count": sessions_count,
                "overall_delta":  0.0,
                "streak":         streak,
                "best_score":     round(best_score, 1),
                "metrics":        {},
                "series":         series,
            }

        curr = results[0]
        prev = results[1]

        def delta(c, p):
            return round((c or 0) - (p or 0), 1)

        def direction(d):
            return "up" if d > 1 else "down" if d < -1 else "same"

        metric_pairs = {
            "Eye Contact":   (curr.eye_contact_percentage,   prev.eye_contact_percentage),
            "Smile":         (curr.smile_percentage,         prev.smile_percentage),
            "Posture":       (curr.posture_percentage,       prev.posture_percentage),
            "Hand Movement": (curr.hand_movement_percentage, prev.hand_movement_percentage),
            "Speech":        (curr.speech_score,             prev.speech_score),
        }

        metrics_out = {}
        for label, (c, p) in metric_pairs.items():
            d = delta(c, p)
            metrics_out[label] = {
                "current":   round(c or 0, 1),
                "previous":  round(p or 0, 1),
                "delta":     d,
                "direction": direction(d),
            }

        ordered   = list(reversed(results))
        overall_d = delta(curr.confidence_score, prev.confidence_score)
        series = {
            "labels":        [r.created_at.strftime("%b %d") for r in ordered],
            "confidence":    [r.confidence_score          for r in ordered],
            "eye_contact":   [r.eye_contact_percentage    for r in ordered],
            "posture":       [r.posture_percentage        for r in ordered],
            "speech":        [r.speech_score              for r in ordered],
            "smile":         [r.smile_percentage          for r in ordered],
            "hand_movement": [r.hand_movement_percentage  for r in ordered],
        }
        return {
            "has_data":       True,
            "sessions_count": len(results),
            "overall_delta":  overall_d,
            "streak":         streak,
            "best_score":     round(best_score, 1),
            "metrics":        metrics_out,
            "series":         series,
        }
    finally:
        db.close()


# ═══════════════ STORAGE INFO ═════════════════════════════════

@app.get("/storage")
def get_storage_info(current_user: User = Depends(get_current_user)) -> dict:
    """Get storage usage information for current user"""
    try:
        info = get_user_storage_usage(current_user.id)
        return {
            "used_mb":     info["used_mb"],
            "limit_mb":    info["limit_mb"],
            "available_mb": info["available_mb"],
            "percentage":  info["percentage"],
            "message":     (
                f"You've used {info['used_mb']} MB / {info['limit_mb']} MB"
                if info["percentage"] < 100 else "Storage limit reached"
            ),
        }
    except Exception as e:
        logger.error(f"Error getting storage info: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error getting storage info")


# ═══════════════ VIDEO DELETION ═══════════════════════════════

@app.delete("/delete/{video_id}")
def delete_video(video_id: int, current_user: User = Depends(get_current_user)) -> dict:
    """Delete a video and its analysis result — only if user is owner"""
    db = SessionLocal()
    try:
        result = db.query(AnalysisResult).filter(AnalysisResult.id == video_id).first()
        if not result:
            raise HTTPException(status_code=404, detail="Video not found")
        if result.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this video")

        video_path = os.path.join(settings.upload_folder, result.video_path)
        if os.path.exists(video_path):
            try:
                os.remove(video_path)
                logger.info(f"Deleted video file: {video_path}")
            except Exception as e:
                logger.warning(f"Failed to delete video file {video_path}: {str(e)}")

        db.delete(result)
        db.commit()
        logger.info(f"Deleted analysis result {video_id}")
        return {"message": "Video deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting video {video_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error deleting video")
    finally:
        db.close()


# ═══════════════ USER AUTHENTICATION ═════════════════════════

# Google Gmail rules: 6-30 characters, letters/numbers/dots, no consecutive dots
GMAIL_REGEX = re.compile(r"^(?!.*\.\.)[a-z0-9][a-z0-9.]{4,28}[a-z0-9]@gmail\.com$", re.IGNORECASE)


class SignupRequest(BaseModel):
    """Request body for /signup — credentials in JSON body, never in URL"""
    email: str
    password: str


@app.post("/signup")
def signup(req: SignupRequest) -> dict:
    """Register a new user with real Gmail and send 6-digit OTP to their inbox"""
    # ── 1. Strictly enforce real Google Gmail format (6-30 chars) ──
    email = (req.email or "").strip().lower()
    if not email or not GMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Gmail address (6–30 characters, e.g. yourname@gmail.com).",
        )
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    # ── 2. Live verification directly with Google MX servers ───────
    exists, err_msg = check_gmail_exists(email)
    if not exists:
        raise HTTPException(status_code=400, detail=err_msg)

    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user and existing_user.is_verified:
            raise HTTPException(status_code=400, detail="This Gmail is already registered. Please sign in.")

        otp = str(random.randint(100000, 999999))
        otp_expiry = datetime.utcnow() + timedelta(minutes=10)

        # ── 3. Deliver OTP directly to the user's Gmail inbox ─────
        email_sent = send_otp_email(email, otp)
        if not email_sent:
            raise HTTPException(
                status_code=400,
                detail="Could not deliver verification email to this Gmail address. Please check that the Gmail address is active and spelled correctly.",
            )

        # ── 4. Only save account after email delivery succeeds ─────
        if existing_user:
            existing_user.password = hash_password(req.password)
            existing_user.otp = otp
            existing_user.otp_expiry = otp_expiry
        else:
            new_user = User(
                email=email,
                password=hash_password(req.password),
                otp=otp,
                otp_expiry=otp_expiry,
                is_verified=False,
            )
            db.add(new_user)

        db.commit()
        logger.info(f"New user registered, verification OTP delivered to inbox: {email}")

        res = {
            "message": f"Verification code sent to {email}. Please check your Gmail inbox.",
            "email": email,
        }
        if settings.api_reload:
            res["dev_otp"] = otp
        return res

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during signup: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error creating user account.")
    finally:
        db.close()


class ResendOTPRequest(BaseModel):
    """Request body for /resend-otp"""
    email: str


@app.post("/resend-otp")
def resend_otp(req: ResendOTPRequest) -> dict:
    """Resend a fresh 6-digit verification code to the user's Gmail"""
    email = (req.email or "").strip().lower()
    if not email or not GMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Only valid @gmail.com addresses are allowed.")

    # ── Live verification directly with Google MX servers ───────
    exists, err_msg = check_gmail_exists(email)
    if not exists:
        raise HTTPException(status_code=400, detail=err_msg)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="Account not found. Please sign up first.")
        if user.is_verified:
            raise HTTPException(status_code=400, detail="This account is already verified. Please sign in.")

        otp = str(random.randint(100000, 999999))
        email_sent = send_otp_email(email, otp)
        if not email_sent:
            raise HTTPException(
                status_code=400,
                detail="Could not deliver verification email. Please ensure this Gmail address exists and is active.",
            )

        user.otp = otp
        user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
        db.commit()

        logger.info(f"Verification OTP resent to: {email}")
        return {"message": f"A new verification code was sent to {email}."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during resend OTP: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error resending verification code.")
    finally:
        db.close()


class VerifyOTPRequest(BaseModel):
    """Request body for /verify-otp"""
    email: str
    otp: str


@app.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest) -> dict:
    """Verify OTP for email confirmation"""
    email = (req.email or "").strip().lower()
    otp = (req.otp or "").strip()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        if user.otp != otp:
            raise HTTPException(status_code=400, detail="Invalid verification code. Please check your Gmail.")
        if not user.otp_expiry or datetime.utcnow() > user.otp_expiry:
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

        user.is_verified = True
        user.otp         = None
        user.otp_expiry  = None
        db.commit()
        logger.info(f"User verified: {email}")
        return {"message": "Email verified successfully!"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during OTP verification: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error verifying code.")
    finally:
        db.close()


class LoginRequest(BaseModel):
    """Request body for /login — credentials in JSON body, never in URL"""
    email: str
    password: str


@app.post("/login")
def login(req: LoginRequest) -> dict:
    """
    Login user with email and password.
    Returns a signed JWT access token.
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == req.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.is_verified:
            raise HTTPException(status_code=400, detail="Email not verified")
        if not verify_password(req.password, user.password):
            raise HTTPException(status_code=401, detail="Incorrect password")

        # Update last login timestamp
        user.last_login = datetime.utcnow()
        db.commit()

        import json as _json
        access_token = create_access_token(data={"sub": str(user.id)})
        logger.info(f"User logged in: {req.email}")
        return {
            "access_token": access_token,
            "token_type":   "bearer",
            "email":        user.email,
            # Return profile so frontend can sync localStorage immediately
            "profile": {
                "name":            user.name,
                "profession":      user.profession,
                "industry":        user.industry,
                "goal":            user.goal,
                "experienceLevel": user.experience_level,
                "weaknesses":      _json.loads(user.weaknesses) if user.weaknesses else [],
            } if user.name else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error logging in")
    finally:
        db.close()


@app.post("/logout")
def logout() -> dict:
    """
    Stateless JWT logout.
    The client must discard its access_token on receipt of this response.
    """
    return {"message": "Logged out successfully"}


# ═══════════════ GOOGLE OAUTH2 ════════════════════════════════

from fastapi.responses import RedirectResponse
import urllib.parse

GOOGLE_AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL  = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_SCOPES     = "openid email profile"


@app.get("/auth/google")
def google_auth_redirect():
    """
    Step 1 — Redirect the browser to Google's OAuth consent screen.
    Called by the frontend when the user clicks "Sign in with Google".
    """
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env"
        )

    redirect_uri = f"{settings.frontend_url.rstrip('/')}/auth/callback".replace(
        "localhost:3000", "localhost:8000"
    )
    # The redirect_uri must point to OUR backend callback, not the frontend
    backend_redirect_uri = f"http://localhost:8000/auth/google/callback"

    params = {
        "client_id":     settings.google_client_id,
        "redirect_uri":  backend_redirect_uri,
        "response_type": "code",
        "scope":         GOOGLE_SCOPES,
        "access_type":   "offline",
        "prompt":        "select_account",  # always show account picker
    }
    url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    logger.info("Redirecting to Google OAuth consent screen")
    return RedirectResponse(url=url)


@app.get("/auth/google/callback")
async def google_auth_callback(code: Optional[str] = Query(None), error: Optional[str] = Query(None)):
    """
    Step 2 — Google redirects back here with an authorization code.
    We exchange the code for an access token, fetch the user's profile,
    upsert a User row, issue our own JWT, and redirect to the frontend.
    """
    frontend_base = settings.frontend_url.rstrip("/")

    if error:
        logger.warning(f"Google OAuth error: {error}")
        return RedirectResponse(url=f"{frontend_base}/login?error=google_denied")

    if not code:
        logger.warning("Google OAuth callback called without code")
        return RedirectResponse(url=f"{frontend_base}/login?error=missing_code")

    backend_redirect_uri = "http://localhost:8000/auth/google/callback"

    # ── Exchange code for tokens ───────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code":          code,
                    "client_id":     settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri":  backend_redirect_uri,
                    "grant_type":    "authorization_code",
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_resp.json()

        if "error" in token_data:
            logger.error(f"Google token exchange failed: {token_data}")
            return RedirectResponse(url=f"{frontend_base}/login?error=token_exchange_failed")

        google_access_token = token_data.get("access_token")

        # ── Fetch user profile ─────────────────────────────────
        async with httpx.AsyncClient(timeout=15.0) as client:
            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {google_access_token}"},
            )
            userinfo = userinfo_resp.json()

    except Exception as exc:
        logger.error(f"Google OAuth network error: {exc}", exc_info=True)
        return RedirectResponse(url=f"{frontend_base}/login?error=network_error")

    google_id  = userinfo.get("sub")
    email      = (userinfo.get("email") or "").lower()
    name       = userinfo.get("name")
    avatar_url = userinfo.get("picture")

    if not google_id or not email:
        logger.error(f"Google returned incomplete userinfo: {userinfo}")
        return RedirectResponse(url=f"{frontend_base}/login?error=incomplete_profile")

    # ── Upsert user in database ───────────────────────────────
    db = SessionLocal()
    try:
        # Try to find by google_id first, then by email
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()

        if user:
            # Existing user — update Google fields if this is their first Google login
            if not user.google_id:
                user.google_id     = google_id
                user.auth_provider = "google"
            if avatar_url:
                user.avatar_url = avatar_url
            if name and not user.name:
                user.name = name
            user.is_verified  = True  # Google accounts are pre-verified
            user.last_login   = datetime.utcnow()
            db.commit()
            logger.info(f"Existing user signed in via Google: {email}")
        else:
            # New user — create account (no password needed)
            user = User(
                email=email,
                password=None,
                google_id=google_id,
                auth_provider="google",
                avatar_url=avatar_url,
                name=name,
                is_verified=True,
                last_login=datetime.utcnow(),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"New Google user created: {email}")

        # Issue our own JWT
        import json as _json
        access_token = create_access_token(data={"sub": str(user.id)})

        # Build profile payload for frontend
        profile_json = ""
        if user.name:
            profile = {
                "name":            user.name,
                "profession":      user.profession,
                "industry":        user.industry,
                "goal":            user.goal,
                "experienceLevel": user.experience_level,
                "weaknesses":      _json.loads(user.weaknesses) if user.weaknesses else [],
            }
            profile_json = urllib.parse.quote(_json.dumps(profile))

        # Redirect to frontend with token in URL (frontend picks it up and stores in localStorage)
        redirect_url = (
            f"{frontend_base}/auth/callback"
            f"?token={access_token}"
            f"&email={urllib.parse.quote(email)}"
            f"&avatar={urllib.parse.quote(avatar_url or '')}"
            + (f"&profile={profile_json}" if profile_json else "")
        )
        return RedirectResponse(url=redirect_url)

    except Exception as exc:
        db.rollback()
        logger.error(f"Google OAuth DB error: {exc}", exc_info=True)
        return RedirectResponse(url=f"{frontend_base}/login?error=db_error")
    finally:
        db.close()



# ═══════════════ USER PROFILE ═════════════════════════════

import json as _json

class ProfileUpdateRequest(BaseModel):
    name:            Optional[str]       = None
    profession:      Optional[str]       = None
    industry:        Optional[str]       = None
    goal:            Optional[str]       = None
    experienceLevel: Optional[str]       = None
    weaknesses:      Optional[List[str]] = None


@app.get("/profile")
def get_profile(current_user: User = Depends(get_current_user)) -> dict:
    """Return the authenticated user's profile from the database."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user.id).first() or current_user
        total_sessions = db.query(AnalysisResult).filter(
            AnalysisResult.user_id == current_user.id
        ).count()
        return {
            "name":            user.name,
            "profession":      user.profession,
            "industry":        user.industry,
            "goal":            user.goal,
            "experienceLevel": user.experience_level,
            "weaknesses":      _json.loads(user.weaknesses) if user.weaknesses else [],
            "email":           user.email,
            "memberSince":     user.created_at.isoformat() if user.created_at else None,
            "lastLogin":       user.last_login.isoformat() if user.last_login else None,
            "totalSessions":   total_sessions,
        }
    finally:
        db.close()


@app.put("/profile")
def update_profile(
    req: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Save user profile fields to the database."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if req.name            is not None: user.name             = req.name.strip()
        if req.profession      is not None: user.profession        = req.profession.strip()
        if req.industry        is not None: user.industry          = req.industry.strip()
        if req.goal            is not None: user.goal              = req.goal
        if req.experienceLevel is not None: user.experience_level  = req.experienceLevel
        if req.weaknesses      is not None: user.weaknesses        = _json.dumps(req.weaknesses)

        db.commit()
        logger.info(f"Profile updated for user id={user.id}")
        return {"message": "Profile saved", "name": user.name}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Profile update error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error saving profile")
    finally:
        db.close()

# ═══════════════ AI COACHING CHAT ════════════════════════════

@app.post("/chat")
@limiter.limit(lambda: settings.rate_limit_chat)
def chat(request: Request, req: ChatRequest) -> dict:
    """
    AI coaching chat endpoint (non-streaming).
    Steps 1, 4, 8: Gemini LLM + conversation history + emotion self-tagging.

    Returns: { "response": str, "emotion": str }
    """
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        context_dict = req.context.model_dump() if req.context else None
        history_list = (
            [{"role": m.role, "content": m.content} for m in req.history]
            if req.history else None
        )
        result = generate_response(
            req.message.strip(),
            context=context_dict,
            history=history_list,
            api_key=settings.gemini_api_key,
            system_prompt=req.system_prompt or None,
        )
        logger.info(f"Chat response -- emotion: {result.get('emotion')}, llm: {bool(settings.gemini_api_key)}")
        return result
    except Exception as e:
        logger.error(f"Error generating chat response: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating response")


# ── Step 2: SSE streaming endpoint ───────────────────────────

@app.post("/chat/stream")
@limiter.limit(lambda: settings.rate_limit_chat)
async def chat_stream(request: Request, req: ChatRequest):
    """
    Step 2: Server-Sent Events streaming chat endpoint.
    Streams tokens from Gemini progressively so the frontend
    can render them with a typewriter effect.

    Response format: text/event-stream
    Each chunk: "data: <token text>\\n\\n"
    Final event: "data: [DONE]\\n\\n"
    """
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    context_dict = req.context.model_dump() if req.context else None
    history_list = (
        [{"role": m.role, "content": m.content} for m in req.history]
        if req.history else None
    )

    def event_generator():
        try:
            for chunk in generate_response_stream(
                req.message.strip(),
                context=context_dict,
                history=history_list,
                api_key=settings.gemini_api_key,
                system_prompt=req.system_prompt or None,
            ):
                if chunk:
                    # Escape newlines so SSE format is valid
                    safe = chunk.replace("\n", "\\n")
                    yield f"data: {safe}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Stream error: {str(e)}", exc_info=True)
            yield "data: [ERROR]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on {settings.api_host}:{settings.api_port}")
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
    )