import os
import asyncio
import shutil
import uuid
import random
from datetime import datetime, timedelta, timezone as tz
from typing import List, Optional
from pathlib import Path
import httpx

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
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
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

# Reliable ElevenLabs voices (always available on free tier):
#   Rachel  → 21m00Tcm4TlvDq8ikWAM  (warm, clear female)
#   Adam    → pNInz6obpgDQGcFmaJgB   (confident male)
DEFAULT_VOICE_ID  = "21m00Tcm4TlvDq8ikWAM"   # Rachel — reliable on all plans
DEFAULT_TTS_MODEL = "eleven_turbo_v2_5"        # Fast, current ElevenLabs model

# Track quota exhaustion in memory (resets on server restart)
_tts_quota_exhausted = False


class TTSRequest(BaseModel):
    text:     str
    voice_id: str = DEFAULT_VOICE_ID


@app.get("/tts/status")
def tts_status() -> dict:
    """Report whether backend TTS (ElevenLabs) is available."""
    available = bool(settings.elevenlabs_api_key) and not _tts_quota_exhausted
    reason = "quota_exhausted" if _tts_quota_exhausted else (None if available else "no_api_key")
    return {"available": available, "provider": "elevenlabs" if available else None, "reason": reason}


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
            "stability":        0.45,
            "similarity_boost": 0.80,
            "style":            0.0,
            "use_speaker_boost": True,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, headers=headers, json=payload)

        if resp.status_code != 200:
            err_body = resp.text[:400]
            logger.warning(f"ElevenLabs TTS {resp.status_code}: {err_body}")

            # Mark quota as exhausted so future calls skip the backend immediately
            if resp.status_code in (401, 429) and "quota" in err_body.lower():
                _tts_quota_exhausted = True
                logger.warning("ElevenLabs quota exhausted — disabling backend TTS for this session")
                raise HTTPException(status_code=503, detail="ElevenLabs quota exhausted")

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

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"Video saved: {file_path}")

        # Build the progress callback (no-op when no job_id)
        def _on_progress(stage: str, percent: int, message: str) -> None:
            if job_id:
                progress_manager.send_sync(job_id, stage, percent, message)

        # Run CPU-bound analysis in a thread so we don't block the event loop
        loop = asyncio.get_event_loop()
        analysis_result = await loop.run_in_executor(
            None,
            lambda: video_analyzer.analyze_video(file_path, on_progress=_on_progress),
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
                video_path=unique_filename,
            )
            db.add(db_result)
            db.commit()
            db.refresh(db_result)
            logger.info(f"Analysis result stored with ID: {db_result.id}")

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

class SignupRequest(BaseModel):
    """Request body for /signup — credentials in JSON body, never in URL"""
    email: str
    password: str


@app.post("/signup")
def signup(req: SignupRequest) -> dict:
    """Register a new user with email and password"""
    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.email == req.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        otp        = str(random.randint(100000, 999999))
        otp_expiry = datetime.utcnow() + timedelta(minutes=5)
        new_user   = User(
            email=req.email, password=hash_password(req.password),
            otp=otp, otp_expiry=otp_expiry, is_verified=False,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info(f"New user registered: {req.email}")
        return {"message": "User created", "dev_otp": otp}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during signup: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error creating user")
    finally:
        db.close()


class VerifyOTPRequest(BaseModel):
    """Request body for /verify-otp"""
    email: str
    otp: str


@app.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest) -> dict:
    """Verify OTP for email confirmation"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == req.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.otp != req.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")
        if not user.otp_expiry or datetime.utcnow() > user.otp_expiry:
            raise HTTPException(status_code=400, detail="OTP expired")

        user.is_verified = True
        user.otp         = None
        user.otp_expiry  = None
        db.commit()
        logger.info(f"User verified: {req.email}")
        return {"message": "Email verified successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during OTP verification: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error verifying OTP")
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

        access_token = create_access_token(data={"sub": str(user.id)})
        logger.info(f"User logged in: {req.email}")
        return {
            "access_token": access_token,
            "token_type":   "bearer",
            "email":        user.email,
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
        logger.info(f"Chat response — emotion: {result.get('emotion')}, llm: {bool(settings.gemini_api_key)}")
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