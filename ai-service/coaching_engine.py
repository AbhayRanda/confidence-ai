"""
coaching_engine.py  v2
─────────────────────────────────────────────────────────────
AI coaching engine for the confidence character.

Steps implemented:
  1  — Google Gemini 2.0 Flash LLM with graceful rule-based fallback
  3  — generate_analysis_report(): rich post-session coaching report
  4  — Conversation history passed to Gemini for multi-turn context
  8  — Emotion self-tagging via [EMOTION:xxx] at end of LLM response
  9  — Per-metric 30-second practice exercises

No external API is required: if GEMINI_API_KEY is absent or quota
is exceeded, the original rule-based engine runs instead.
─────────────────────────────────────────────────────────────
"""

import re
import random
import logging
from typing import Any, Optional, List, Dict

logger = logging.getLogger(__name__)

# ── Try to import Gemini SDK ─────────────────────────────────
genai: Any = None
try:
    import google.generativeai as genai  # type: ignore[import-untyped, import-not-found]
    _GENAI_AVAILABLE = True
except ImportError:
    genai = None
    _GENAI_AVAILABLE = False
    logger.warning("google-generativeai not installed — using rule-based fallback")


# ── Coaching knowledge base (rule-based fallback) ─────────────

EYE_CONTACT_TIPS = [
    "Look directly at the camera lens — it represents eye contact for the viewer. Treat it like a person's eyes.",
    "Practice the 5-second rule: hold eye contact for 5 seconds, then naturally glance away for 1–2 seconds before returning.",
    "Place a small sticker or dot right next to your camera lens to remind you where to look.",
    "Avoid looking at your own face preview — it pulls your gaze down and off the camera.",
    "When speaking to a group, distribute your gaze in a triangle pattern: left, center, right, repeat.",
    "Good eye contact builds trust. Aim for 70–80% of the time while speaking.",
]

SMILE_TIPS = [
    "Think of a happy memory just before you start speaking — a genuine smile takes 2 seconds to naturally form.",
    "Smiling while speaking actually changes your vocal tone to sound warmer and more confident.",
    "Relax your jaw first. Tension in the jaw prevents natural smiling. Try dropping your jaw slightly before speaking.",
    "Let the smile reach your eyes — the Duchenne smile (eyes crinkle slightly) is perceived as far more authentic.",
    "Practice your opening line with a smile. First impressions are set in the first 7 seconds.",
]

POSTURE_TIPS = [
    "Sit or stand with your spine tall — imagine a string pulling the top of your head toward the ceiling.",
    "Roll your shoulders back and down before speaking. Hunched shoulders signal low confidence.",
    "Position the camera at eye level or slightly above — looking up at a camera creates poor posture.",
    "Your feet should be firmly planted — on the floor if sitting, hip-width apart if standing.",
    "The 'power posture': chest open, shoulders back, chin level. Hold it for 2 minutes before speaking to boost confidence.",
]

HAND_MOVEMENT_TIPS = [
    "Keep your hands visible within the camera frame — hidden hands reduce trust.",
    "Use open-palm gestures when explaining — they signal honesty and openness.",
    "Avoid fidgeting, pen-clicking, or touching your face — these signal nervousness.",
    "Gesture to emphasize key words, not constantly — purposeful gestures are 3x more impactful.",
    "Rest your hands naturally on the desk or in your lap when not gesturing — not crossed or clasped.",
]

SPEECH_TIPS = [
    "Speak at 130–160 words per minute for conversational clarity. Too fast loses your audience; too slow loses interest.",
    "Pause deliberately after key points — a 1-second pause is perceived as confidence, not weakness.",
    "Replace filler words (um, uh, like) with silence. Record yourself and count how many you use.",
    "Vary your pitch and pace — monotone speech causes listeners to lose focus within 60 seconds.",
    "Start sentences with energy — the first 3 words set the tone for the entire sentence.",
    "Breathe from your diaphragm (belly) not your chest — this gives your voice projection and steadiness.",
]

GENERAL_CONFIDENCE_TIPS = [
    "Confidence is a skill, not a trait — the more you practice, the more natural it becomes.",
    "Record yourself speaking for 1 minute every day and watch it back. You'll improve 3x faster.",
    "The 'fake it till you make it' technique works: your body posture affects your mindset within 2 minutes.",
    "Preparation eliminates most anxiety. Know your first 30 seconds perfectly — the rest flows naturally.",
    "Nervousness and excitement feel the same physiologically. Tell yourself you're excited, not nervous.",
    "Join a speaking group like Toastmasters or practice with a friend weekly for rapid improvement.",
]

FILLER_WORD_TIPS = [
    "Filler words (um, uh, like) are usually caused by fear of silence. Silence is actually powerful — embrace it.",
    "Identify your personal filler words by recording yourself, then consciously replace them with a breath.",
    "Slow down slightly when you feel a filler word coming — it gives your brain time to find the right word.",
    "Prepare transitions between points: 'First... Second... Finally...' removes the need for filler words.",
]

WPM_TIPS = [
    "Ideal speaking pace is 130–160 WPM for conversational speech, 110–130 WPM for complex topics.",
    "Practice reading aloud — it trains your brain to produce words at a controlled, steady pace.",
    "Record yourself and use a WPM counter app to get precise feedback on your pacing.",
    "Use pauses strategically — a 1–2 second pause feels natural to listeners but gives your brain extra processing time.",
]

# ── Step 9: 30-second exercises per metric ────────────────────
EXERCISES: Dict[str, Dict] = {
    "eye_contact": {
        "title": "Camera Lock Exercise",
        "instruction": "Record a 30-second introduction of yourself. Your only goal: keep your eyes on the camera lens the entire time. Don't look away — not even once.",
        "metric": "Eye Contact",
        "icon": "👁️",
    },
    "smile": {
        "title": "Warm-Up Smile Drill",
        "instruction": "Before hitting record, spend 10 seconds thinking of your happiest memory. Then record 30 seconds speaking about anything. Notice how your tone changes when you're genuinely smiling.",
        "metric": "Smile",
        "icon": "😊",
    },
    "posture": {
        "title": "Power Posture Check",
        "instruction": "Stand up, roll your shoulders back, chin level. Hold for 2 minutes — this primes your brain for confidence. Then record 30 seconds speaking from this posture.",
        "metric": "Posture",
        "icon": "🧍",
    },
    "hand_movement": {
        "title": "Open Hands Drill",
        "instruction": "Record 30 seconds explaining something you know well (your job, a hobby). Consciously use open-palm gestures to emphasize every key point. Keep hands visible in frame.",
        "metric": "Hand Movement",
        "icon": "🤚",
    },
    "speech": {
        "title": "Pause & Breathe",
        "instruction": "Record 30 seconds on any topic. After every sentence, pause for a full breath before continuing. This trains deliberate pacing and eliminates rushed speech.",
        "metric": "Speech",
        "icon": "🎤",
    },
    "filler_words": {
        "title": "Silent Pause Replace",
        "instruction": "Record 30 seconds introducing yourself. Every time you feel an 'um' or 'uh' coming — stay silent for 1 second instead. Silence sounds confident; fillers don't.",
        "metric": "Filler Words",
        "icon": "💬",
    },
}

# ── Keyword → topic mapping ──────────────────────────────────
TOPIC_PATTERNS = {
    "eye":        ("eye_contact",    EYE_CONTACT_TIPS),
    "look":       ("eye_contact",    EYE_CONTACT_TIPS),
    "contact":    ("eye_contact",    EYE_CONTACT_TIPS),
    "camera":     ("eye_contact",    EYE_CONTACT_TIPS),
    "gaze":       ("eye_contact",    EYE_CONTACT_TIPS),
    "smile":      ("smile",          SMILE_TIPS),
    "happy":      ("smile",          SMILE_TIPS),
    "expression": ("smile",          SMILE_TIPS),
    "face":       ("smile",          SMILE_TIPS),
    "posture":    ("posture",        POSTURE_TIPS),
    "sit":        ("posture",        POSTURE_TIPS),
    "stand":      ("posture",        POSTURE_TIPS),
    "body":       ("posture",        POSTURE_TIPS),
    "shoulder":   ("posture",        POSTURE_TIPS),
    "straight":   ("posture",        POSTURE_TIPS),
    "hand":       ("hand_movement",  HAND_MOVEMENT_TIPS),
    "gesture":    ("hand_movement",  HAND_MOVEMENT_TIPS),
    "arm":        ("hand_movement",  HAND_MOVEMENT_TIPS),
    "fidget":     ("hand_movement",  HAND_MOVEMENT_TIPS),
    "speech":     ("speech",         SPEECH_TIPS),
    "speak":      ("speech",         SPEECH_TIPS),
    "talk":       ("speech",         SPEECH_TIPS),
    "voice":      ("speech",         SPEECH_TIPS),
    "word":       ("speech",         SPEECH_TIPS),
    "pace":       ("speech",         WPM_TIPS),
    "speed":      ("speech",         WPM_TIPS),
    "fast":       ("speech",         WPM_TIPS),
    "slow":       ("speech",         WPM_TIPS),
    "filler":     ("filler",         FILLER_WORD_TIPS),
    "um":         ("filler",         FILLER_WORD_TIPS),
    "uh":         ("filler",         FILLER_WORD_TIPS),
    "like":       ("filler",         FILLER_WORD_TIPS),
    "basically":  ("filler",         FILLER_WORD_TIPS),
    "confident":  ("general",        GENERAL_CONFIDENCE_TIPS),
    "confidence": ("general",        GENERAL_CONFIDENCE_TIPS),
    "improve":    ("general",        GENERAL_CONFIDENCE_TIPS),
    "better":     ("general",        GENERAL_CONFIDENCE_TIPS),
    "practice":   ("general",        GENERAL_CONFIDENCE_TIPS),
    "tip":        ("general",        GENERAL_CONFIDENCE_TIPS),
    "help":       ("general",        GENERAL_CONFIDENCE_TIPS),
    "advice":     ("general",        GENERAL_CONFIDENCE_TIPS),
    "suggest":    ("general",        GENERAL_CONFIDENCE_TIPS),
}

GREETING_RESPONSES = [
    "Hello! I'm your AI confidence coach. Ask me anything — about your scores, specific skills, or general tips!",
    "Hey there! Great to see you practicing. What would you like to work on today?",
    "Hi! I'm here to help you become a more confident communicator. What's on your mind?",
    "Welcome! I can give you tips on eye contact, posture, speech, hand gestures — just ask!",
]

THANKS_RESPONSES = [
    "You're welcome! Keep practicing — consistency is the real secret. 💪",
    "Anytime! Remember, every session makes you a little better. 🚀",
    "Happy to help! You're doing great by putting in the work.",
    "Of course! Now go practice that tip and see the difference yourself.",
]

ENCOURAGEMENT_RESPONSES = [
    "You've got this! Every expert was once a beginner. Just keep showing up.",
    "Progress over perfection — you're already ahead of 90% of people just by practicing.",
    "Believe in the process! It takes 21 days to build a habit. You're on your way.",
    "Remember: confidence is built one practice session at a time. You're doing exactly the right thing.",
]

UNKNOWN_RESPONSES = [
    "Great question! I can help with that. Let me think...",
    "Interesting! Here's what I know about that...",
    "Happy to chat about that! And feel free to ask me about your confidence or speaking skills anytime too.",
    "Sure, let's talk about it!",
]

SCORE_UNKNOWN = [
    "I don't have your latest results yet. Record or upload a video and click Analyze — then I can give you personalised feedback!",
    "No analysis data yet! Upload a short video and I'll tell you exactly where to focus.",
]


def _pick(lst: list) -> str:
    return random.choice(lst)


def _metric_label(key: str) -> str:
    return {
        "eye_contact_percentage":   "Eye Contact",
        "smile_percentage":         "Smile",
        "posture_percentage":       "Posture",
        "hand_movement_percentage": "Hand Movement",
        "speech_score":             "Speech",
        "filler_word_count":        "Filler Words",
    }.get(key, key)


def _score_label(score: float) -> str:
    if score >= 80: return "excellent"
    if score >= 60: return "good"
    if score >= 40: return "fair"
    return "needs improvement"


# ── Step 8: Parse emotion tag from LLM response ───────────────
_EMOTION_TAG_RE = re.compile(r'\[EMOTION:(\w+)\]\s*$', re.IGNORECASE)
_VALID_EMOTIONS  = {"happy", "encouraging", "gesture", "thinking", "greeting", "idle"}

def _parse_emotion_tag(text: str):
    """
    Extract [EMOTION:xxx] tag from end of LLM response.
    Returns (clean_text, emotion_str).
    """
    m = _EMOTION_TAG_RE.search(text.strip())
    if m:
        emotion = m.group(1).lower()
        clean   = text[:m.start()].strip()
        return clean, emotion if emotion in _VALID_EMOTIONS else "gesture"
    return text.strip(), "gesture"


# ── Step 1: Gemini system prompt builder ────────────────────────────────────
def _build_system_prompt(context: Optional[dict], system_prompt_override: Optional[str] = None) -> str:
    # If the caller provides a full system prompt (from live chat mode), use it as the
    # base but still append metric context and emotion-tagging instructions.
    if system_prompt_override:
        base = system_prompt_override
    else:
        base = (
            "You are a highly intelligent, knowledgeable AI assistant and confidence coach. "
            "You have broad knowledge across all topics: science, technology, history, culture, "
            "current events, coding, mathematics, philosophy, arts, health, relationships, career advice, "
            "and much more — just like a brilliant, well-read friend. "
            "You NEVER refuse to answer a question by saying it's outside your scope. "
            "You always engage helpfully with whatever the user brings up. "
            "You ALSO specialise in confidence coaching: public speaking, eye contact, posture, "
            "body language, interview prep, reducing filler words, and vocal delivery. "
            "When the user asks about confidence or speaking skills, lean into your coaching expertise. "
            "Your tone is warm, encouraging, curious, and natural — like a brilliant knowledgeable friend. "
            "Keep responses concise (2-4 sentences) unless the user asks for more detail."
        )

    lines = [base]

    if context:
        score = context.get("confidence_score")
        if score is not None:
            lines.append(f"\nUser's latest session metrics:")
            lines.append(f"  Overall confidence score: {score:.1f}/100")
            metric_map = {
                "Eye Contact":   context.get("eye_contact_percentage"),
                "Smile":         context.get("smile_percentage"),
                "Posture":       context.get("posture_percentage"),
                "Hand Movement": context.get("hand_movement_percentage"),
                "Speech Score":  context.get("speech_score"),
                "Filler Words":  context.get("filler_word_count"),
                "Words/Min":     context.get("words_per_minute"),
            }
            for k, v in metric_map.items():
                if v is not None:
                    lines.append(f"  {k}: {v}")
            lines.append("Use these metrics to personalise your advice when relevant.")

        # Live vision context
        live_parts = []
        if context.get("smiling") is not None:
            live_parts.append(f"user is {'smiling' if context['smiling'] else 'not smiling'}")
        if context.get("eye_contact") is not None:
            live_parts.append(f"user {'has' if context['eye_contact'] else 'lacks'} eye contact")
        if context.get("gesture"):
            live_parts.append(f"user is making a {context['gesture']} gesture")
        if context.get("detected_objects"):
            live_parts.append(f"visible objects: {', '.join(context['detected_objects'])}")
        if live_parts:
            lines.append(f"\nLive camera context: {'; '.join(live_parts)}.")

    # Emotion tag — always LAST, AFTER all content (including any required interview question).
    # It is a trailing annotation only, never a substitute for required content.
    lines.append(
        "\nEMOTION TAG (append after your full response, on its own line): "
        "End every reply with exactly one of: [EMOTION:happy] [EMOTION:encouraging] "
        "[EMOTION:gesture] [EMOTION:thinking] [EMOTION:greeting]. "
        "Pick the tag that matches your tone. This tag comes AFTER all other content."
    )

    return "\n".join(lines)


# ── Step 1+4: Gemini LLM call ──────────────────────────────────────────
def _llm_response(
    message:       str,
    context:       Optional[dict]       = None,
    history:       Optional[List[dict]] = None,
    api_key:       str                  = "",
    system_prompt: Optional[str]        = None,
) -> Optional[dict]:
    """
    Call Gemini 2.0 Flash. Returns { response, emotion } or None on failure.
    """
    if not _GENAI_AVAILABLE or not api_key:
        return None

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=_build_system_prompt(context, system_prompt),
        )

        # Step 4: Build multi-turn history for Gemini
        chat_history = []
        if history:
            for msg in history[-6:]:   # last 6 messages max
                role    = "user" if msg.get("role") == "user" else "model"
                content = msg.get("content", msg.get("text", ""))
                if content:
                    chat_history.append({"role": role, "parts": [content]})

        chat   = model.start_chat(history=chat_history)
        result = chat.send_message(message)
        text   = result.text.strip()

        clean, emotion = _parse_emotion_tag(text)
        return {"response": clean, "emotion": emotion}

    except Exception as e:
        logger.warning(f"Gemini call failed ({type(e).__name__}): {e} — using fallback")
        return None


# ── Step 1+4: Streaming Gemini generator ───────────────────────────────────
def _llm_stream(
    message:       str,
    context:       Optional[dict]       = None,
    history:       Optional[List[dict]] = None,
    api_key:       str                  = "",
    system_prompt: Optional[str]        = None,
):
    """
    Generator that yields text chunks from Gemini stream.
    Falls back to yielding the full rule-based response if unavailable.
    """
    if not _GENAI_AVAILABLE or not api_key:
        result = _rule_based_response(message, context)
        yield result["response"]
        return

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=_build_system_prompt(context, system_prompt),
        )

        chat_history = []
        if history:
            for msg in history[-6:]:
                role    = "user" if msg.get("role") == "user" else "model"
                content = msg.get("content", msg.get("text", ""))
                if content:
                    chat_history.append({"role": role, "parts": [content]})

        chat   = model.start_chat(history=chat_history)
        stream = chat.send_message(message, stream=True)
        for chunk in stream:
            if chunk.text:
                yield chunk.text

    except Exception as e:
        logger.warning(f"Gemini stream failed ({type(e).__name__}): {e} — using fallback")
        result = _rule_based_response(message, context)
        yield result["response"]


# ── Step 3: Rich analysis report generator ────────────────────
def generate_analysis_report(
    metrics:  dict,
    history:  Optional[List[dict]] = None,
    api_key:  str = "",
) -> dict:
    """
    Generate a structured post-session coaching report.

    Args:
        metrics:  { confidence_score, eye_contact_percentage, smile_percentage,
                    posture_percentage, hand_movement_percentage, speech_score,
                    filler_word_count, words_per_minute }
        history:  list of previous session dicts (same shape as metrics), newest first
        api_key:  Gemini API key (optional)

    Returns:
        {
          "summary":         str,          # 1-sentence overall assessment
          "strengths":       list[str],    # "What you did well" bullets
          "priority_fixes":  list[dict],   # [{metric, value, tip}] worst-first
          "practice_plan":   list[dict],   # 7-day plan [{day, focus, exercise}]
          "exercise":        dict,         # today's 30s drill (Step 9)
          "trend":           dict,         # {metric: {current, previous, delta}} if history
        }
    """
    score = metrics.get("confidence_score", 0)

    # ── Metric ranking ────────────────────────────────────────
    scored_metrics = {
        "eye_contact":    metrics.get("eye_contact_percentage", 0),
        "smile":          metrics.get("smile_percentage", 0),
        "posture":        metrics.get("posture_percentage", 0),
        "hand_movement":  metrics.get("hand_movement_percentage", 0),
        "speech":         metrics.get("speech_score", 0),
    }
    ranked = sorted(scored_metrics.items(), key=lambda x: x[1])  # worst first

    # ── Strengths (≥60%) ──────────────────────────────────────
    tip_pools = {
        "eye_contact":   EYE_CONTACT_TIPS,
        "smile":         SMILE_TIPS,
        "posture":       POSTURE_TIPS,
        "hand_movement": HAND_MOVEMENT_TIPS,
        "speech":        SPEECH_TIPS,
    }
    label_map = {
        "eye_contact":   "Eye Contact",
        "smile":         "Smile",
        "posture":       "Posture",
        "hand_movement": "Hand Movement",
        "speech":        "Speech",
    }

    strengths = [
        f"{label_map[k]} ({v:.0f}%) — keep it up!"
        for k, v in scored_metrics.items() if v >= 60
    ]
    if not strengths:
        strengths = ["You showed up and practiced — that's the most important step!"]

    # ── Priority fixes ────────────────────────────────────────
    priority_fixes = []
    for k, v in ranked[:3]:           # top 3 weakest
        priority_fixes.append({
            "metric": label_map[k],
            "value":  round(v, 1),
            "tip":    _pick(tip_pools.get(k, GENERAL_CONFIDENCE_TIPS)),
        })

    # ── 7-day practice plan ───────────────────────────────────
    days = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"]
    practice_plan = []
    for i, day in enumerate(days):
        focus_key = ranked[i % len(ranked)][0]
        ex        = EXERCISES.get(focus_key, EXERCISES["speech"])
        practice_plan.append({
            "day":      day,
            "focus":    label_map[focus_key],
            "exercise": ex["instruction"],
            "icon":     ex["icon"],
        })

    # ── Step 9: Today's 30s exercise ─────────────────────────
    worst_key = ranked[0][0]

    # Add filler word check
    filler_count = metrics.get("filler_word_count", 0)
    if filler_count and filler_count > 3:
        worst_key = "filler_words"

    exercise = EXERCISES.get(worst_key, EXERCISES["speech"])

    # ── Trend comparison ──────────────────────────────────────
    trend = {}
    if history and len(history) >= 1:
        prev = history[0]   # most recent previous session
        for k in scored_metrics:
            curr_val  = scored_metrics[k]
            prev_key  = k + "_percentage" if k != "speech" else "speech_score"
            prev_val  = prev.get(prev_key, 0) or 0
            delta     = curr_val - prev_val
            trend[label_map[k]] = {
                "current":  round(curr_val, 1),
                "previous": round(prev_val, 1),
                "delta":    round(delta, 1),
                "direction": "up" if delta > 1 else "down" if delta < -1 else "same",
            }

    # ── Summary sentence ─────────────────────────────────────
    label = _score_label(score)
    if score >= 80:
        summary = f"Outstanding session! Your confidence score of {score:.1f}/100 is {label} — you're on the right track."
    elif score >= 60:
        summary = f"Good work — {score:.1f}/100 ({label}). A few targeted improvements will take you to the next level."
    elif score >= 40:
        summary = f"Solid effort — {score:.1f}/100 ({label}). Focus on the priority fixes below for rapid improvement."
    else:
        summary = f"Every journey starts somewhere — {score:.1f}/100 right now. Consistency beats perfection. Let's build from here."

    # Optionally use Gemini for a richer summary
    if api_key and _GENAI_AVAILABLE:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            prompt = (
                f"Write a single encouraging sentence (max 25 words) summarising a coaching session. "
                f"Confidence score: {score:.1f}/100. Weakest area: {label_map[ranked[0][0]]} at {ranked[0][1]:.0f}%. "
                f"Best area: {label_map[ranked[-1][0]]} at {ranked[-1][1]:.0f}%."
            )
            result  = model.generate_content(prompt)
            summary = result.text.strip().rstrip(".")
        except Exception:
            pass   # keep local summary

    return {
        "summary":        summary,
        "strengths":      strengths,
        "priority_fixes": priority_fixes,
        "practice_plan":  practice_plan,
        "exercise":       exercise,
        "trend":          trend,
    }


# ── Rule-based response (fallback / offline) ──────────────────
def _extract_name_from_system_prompt(system_prompt: Optional[str]) -> str:
    """Pull 'Name: <value>' from the injected profile block, or return empty string."""
    if not system_prompt:
        return ""
    for line in system_prompt.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("name:"):
            return stripped[5:].strip()
    return ""


def _rule_based_response(message: str, context: Optional[dict] = None, name: str = "") -> dict:
    msg_lower = message.lower().strip()
    greeting_name = f", {name}" if name else ""

    # Greeting
    greeting_words = ["hi", "hello", "hey", "howdy", "good morning", "good afternoon", "sup", "yo"]
    if any(msg_lower.startswith(w) for w in greeting_words) or msg_lower in greeting_words:
        responses = [
            f"Hello{greeting_name}! I'm your AI confidence coach. Ask me anything — about your scores, specific skills, or general tips!",
            f"Hey{greeting_name}! Great to see you practicing. What would you like to work on today?",
            f"Hi{greeting_name}! I'm here to help you become a more confident communicator. What's on your mind?",
            f"Welcome{greeting_name}! I can give you tips on eye contact, posture, speech, hand gestures — just ask!",
        ]
        return {"response": _pick(responses), "emotion": "greeting"}

    # Thanks
    thanks_words = ["thank", "thanks", "thx", "ty", "cheers", "great", "awesome", "cool", "perfect"]
    if any(w in msg_lower for w in thanks_words) and len(msg_lower) < 40:
        return {"response": _pick(THANKS_RESPONSES), "emotion": "happy"}

    # Encouragement
    enc_words = ["motivate", "motivat", "encourage", "inspire", "i can do", "i'm nervous", "nervous",
                 "anxious", "scared", "afraid", "worried", "difficult", "hard", "struggling"]
    if any(w in msg_lower for w in enc_words):
        return {"response": _pick(ENCOURAGEMENT_RESPONSES), "emotion": "encouraging"}

    # Score inquiry
    score_words = ["score", "result", "how did", "my result", "analysis", "metric", "performance",
                   "how was", "what was my", "rate me", "rate", "feedback"]
    if any(w in msg_lower for w in score_words):
        if not context or context.get("confidence_score") is None:
            return {"response": _pick(SCORE_UNKNOWN), "emotion": "gesture"}

        score = context["confidence_score"]
        label = _score_label(score)
        metrics = {
            "eye_contact_percentage":   context.get("eye_contact_percentage", 0),
            "smile_percentage":         context.get("smile_percentage", 0),
            "posture_percentage":       context.get("posture_percentage", 0),
            "hand_movement_percentage": context.get("hand_movement_percentage", 0),
            "speech_score":             context.get("speech_score", 0),
        }
        weakest_key   = min(metrics, key=lambda k: metrics[k])
        weakest_val   = metrics[weakest_key]
        weakest_label = _metric_label(weakest_key)
        strongest_key   = max(metrics, key=lambda k: metrics[k])
        strongest_label = _metric_label(strongest_key)
        strongest_val   = metrics[strongest_key]
        filler = context.get("filler_word_count", 0)
        wpm    = context.get("words_per_minute", 0)

        parts = [
            f"Your latest confidence score is {score:.1f}/100 — that's {label}! 🎯",
            f"Your strongest area was {strongest_label} at {strongest_val:.0f}%.",
            f"Your biggest opportunity is {weakest_label} at {weakest_val:.0f}% — that's where to focus.",
        ]
        if filler > 0:
            parts.append(f"You used {filler} filler word{'s' if filler != 1 else ''} — try replacing them with brief pauses.")
        if wpm > 0:
            if wpm > 170:
                parts.append(f"You were speaking at {wpm:.0f} WPM — slightly fast. Aim for 130–160 WPM.")
            elif wpm < 100:
                parts.append(f"You were speaking at {wpm:.0f} WPM — try picking up the pace a little.")
            else:
                parts.append(f"Your speaking pace of {wpm:.0f} WPM is right in the ideal range — great job!")

        emotion = "happy" if score >= 70 else "encouraging"
        return {"response": " ".join(parts), "emotion": emotion}

    # Weakest metric inquiry
    if context and any(w in msg_lower for w in ["weakest", "worst", "lowest", "focus on", "work on"]):
        metrics = {
            "eye_contact_percentage":   context.get("eye_contact_percentage", 0),
            "smile_percentage":         context.get("smile_percentage", 0),
            "posture_percentage":       context.get("posture_percentage", 0),
            "hand_movement_percentage": context.get("hand_movement_percentage", 0),
            "speech_score":             context.get("speech_score", 0),
        }
        weakest_key   = min(metrics, key=lambda k: metrics[k])
        weakest_label = _metric_label(weakest_key)
        weakest_val   = metrics[weakest_key]
        topic_tips    = {
            "eye_contact_percentage":   EYE_CONTACT_TIPS,
            "smile_percentage":         SMILE_TIPS,
            "posture_percentage":       POSTURE_TIPS,
            "hand_movement_percentage": HAND_MOVEMENT_TIPS,
            "speech_score":             SPEECH_TIPS,
        }.get(weakest_key, GENERAL_CONFIDENCE_TIPS)
        tip = _pick(topic_tips)
        return {
            "response": f"Based on your last session, your weakest area is {weakest_label} at {weakest_val:.0f}%. Here's a targeted tip: {tip}",
            "emotion": "gesture",
        }

    # Topic keyword matching
    matched_topic = None
    matched_tips  = None
    for keyword, (topic, tips) in TOPIC_PATTERNS.items():
        if keyword in msg_lower:
            if matched_topic is None or topic != "general":
                matched_topic = topic
                matched_tips  = tips

    if matched_tips:
        tip = _pick(matched_tips)
        if context:
            topic_metric_map = {
                "eye_contact":   ("eye_contact_percentage",   "Eye Contact"),
                "smile":         ("smile_percentage",         "Smile"),
                "posture":       ("posture_percentage",       "Posture"),
                "hand_movement": ("hand_movement_percentage", "Hand Movement"),
                "speech":        ("speech_score",             "Speech"),
                "filler":        None,
            }
            metric_info = topic_metric_map.get(matched_topic or "")
            if metric_info:
                metric_key, metric_name = metric_info
                val = context.get(metric_key, None)
                if val is not None:
                    if val >= 70:
                        return {"response": f"Your {metric_name} score is already strong at {val:.0f}%! To keep it up: {tip}", "emotion": "happy"}
                    elif val >= 45:
                        return {"response": f"Your {metric_name} is at {val:.0f}% — room to grow. Here's a great tip: {tip}", "emotion": "gesture"}
                    else:
                        return {"response": f"Your {metric_name} needs attention — it's at {val:.0f}%. Let me help: {tip}", "emotion": "encouraging"}
        return {"response": tip, "emotion": "gesture"}

    return {"response": _pick(UNKNOWN_RESPONSES), "emotion": "thinking"}


# ── Main entry point ─────────────────────────────────────────
def generate_response(
    message:       str,
    context:       Optional[dict]       = None,
    history:       Optional[List[dict]] = None,
    api_key:       str                  = "",
    system_prompt: Optional[str]        = None,
) -> dict:
    """
    Generate a coaching response for a user message.
    Tries Gemini LLM first; falls back to rule-based engine.

    Args:
        message:       The user's input text
        context:       Optional dict with analysis metrics / live vision context
        history:       Optional list of recent messages [{"role": "user"|"mentor", "text": str}]
        api_key:       Gemini API key (from settings)
        system_prompt: Optional override (live chat mode persona)

    Returns:
        { "response": str, "emotion": str }
    """
    # Step 1+8: Try LLM first
    llm_result = _llm_response(message, context, history, api_key, system_prompt)
    if llm_result:
        return llm_result

    # Fallback to rule-based — extract name from injected profile block
    name = _extract_name_from_system_prompt(system_prompt)
    return _rule_based_response(message, context, name=name)


# Expose streaming generator for /chat/stream endpoint
def generate_response_stream(
    message:       str,
    context:       Optional[dict]       = None,
    history:       Optional[List[dict]] = None,
    api_key:       str                  = "",
    system_prompt: Optional[str]        = None,
):
    """Generator version for SSE streaming."""
    yield from _llm_stream(message, context, history, api_key, system_prompt)
