# ARCHITECTURE.md — Confidence AI System Architecture

## 1. System Overview

Confidence AI is an AI-powered personality development, speech analysis, and mock interview coaching platform. It integrates real-time computer vision, automated speech recognition, multi-modal LLM coaching, and 3D humanoid avatar animation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (React 18 SPA)                     │
│                                                                        │
│  ┌───────────────┐  ┌────────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │  Landing Page │  │ Auth (JWT/OAuth│  │  Dashboard  │  │ Practice │  │
│  └───────┬───────┘  └───────┬────────┘  └──────┬──────┘  └────┬─────┘  │
│          │                  │                  │              │        │
│  ┌───────┴──────────────────┴──────────────────┴──────────────┴─────┐  │
│  │                    App Shell & Router (App.js)                   │  │
│  │       Theme Engine (Cyber-Violet / Peak-Emerald / Obsidian)      │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────┴───────────────────────────────┐  │
│  │                     3D AVATAR SYSTEM (Three.js)                   │  │
│  │   • VRM Humanoid (@pixiv/three-vrm) • Lip-sync Visemes (A/I/U/E/O)│  │
│  │   • Procedural Eye Gaze Tracking   • Speech Synthesis (TTS/Proxy)│  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────┴───────────────────────────────┐  │
│  │                  Client-Side Vision (@mediapipe/tasks)           │  │
│  │   • Face Landmarks (468 pts)       • Live Gaze Angle             │  │
│  │   • Head Pitch / Yaw / Roll        • Live Pose Tracking          │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │ HTTPS / WSS
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       BACKEND API (FastAPI + Python 3.10)              │
│                                                                        │
│  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────┐  │
│  │  Auth & Security  │  │  Session Analysis │  │  Coaching Engine   │  │
│  │  • JWT Auth       │  │  • FFmpeg Remux   │  │  • Gemini 1.5/2.0  │  │
│  │  • Google OAuth   │  │  • OpenCV Vision  │  │  • Script Clean    │  │
│  │  • Argon2 Hashing │  │  • Whisper Speech │  │  • Actionable Plan │  │
│  │  • SlowAPI Limits │  │  • Timeline Stats │  │  • Rule Fallback   │  │
│  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬──────────┘  │
│            │                      │                      │             │
│            ▼                      ▼                      ▼             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Data Access & ORM (SQLAlchemy)               │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        STORAGE & INFRASTRUCTURE                        │
│                                                                        │
│  ┌───────────────────────────────┐    ┌─────────────────────────────┐  │
│  │     Neon.tech PostgreSQL      │    │    Authenticated Storage    │  │
│  │   • users table               │    │   • uploads/{uuid}.mp4      │  │
│  │   • analysis_results table    │    │   • private stream /video/  │  │
│  │   • practice_sessions (V2)    │    │   • storage quota (500MB)   │  │
│  └───────────────────────────────┘    └─────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Modules & Responsibilities

### Frontend Modules (`frontend/src/`)
1. **`pages/Landing.js`**: Public acquisition funnel explaining core value propositions (Eye Contact, Posture, Speech Clarity, 3D Interactive Mentorship).
2. **`pages/Dashboard.js`**: Core analytical overview with score history, confidence trend graphs, and recent session drill-downs.
3. **`pages/Progress.js`**: Deep longitudinal analytics tracking metrics over 7-day, 30-day, and all-time windows with radar balance metrics.
4. **`pages/Practice.js`**: Interactive practice studio supporting 3 structured drills: Presentation Practice, Quick 30-Second Drill, and Read Aloud.
5. **`pages/Settings.js`**: Account management, professional goal configuration, theme selector, and secure credential handling.
6. **`pages/LiveAvatarChat.js`**: Real-time conversation with the 3D VRM coach across 4 modes (Coach, Interview, Free Chat, Vision).
7. **`components/ai-character/VRMAvatar.jsx`**: 3D humanoid rendering engine with Three.js WebGL canvas, spring bones, blinking, and audio-reactive phoneme lip-sync.
8. **`utils/api.js`**: Unified HTTP client interceptor handling JWT token injection, automated 401 redirection, and API error normalization.

### Backend Modules (`ai-service/`)
1. **`main.py`**: ASGI FastAPI application lifecycle, route handlers, rate limiting, and CORS configuration.
2. **`models.py`**: SQLAlchemy relational models (`User`, `AnalysisResult`).
3. **`database.py`**: Thread-safe SQLAlchemy database engine and connection pool for PostgreSQL/SQLite.
4. **`auth.py`**: Cryptographic password hashing (Argon2id), JWT generation, and dependency injection for token verification (`get_current_user`).
5. **`video_analyzer.py`**: High-throughput multi-modal pipeline:
   - Video demuxing/remuxing (FFmpeg H.264)
   - MediaPipe face, pose, and hand landmark extraction
   - Audio extraction, transcription (Whisper), filler word detection, WPM calculation
   - Frame-by-frame confidence scoring
6. **`coaching_engine.py`**: AI intelligence layer providing adaptive suggestions, interview evaluation, and script refinement via Gemini with deterministic rule fallbacks.

---

## 3. Database Schema

### `users` Table
| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto-increment |
| `email` | `VARCHAR(255)` | Unique, Indexed, Lowercase |
| `password` | `VARCHAR(255)` | Argon2id hash (Nullable for OAuth users) |
| `name` | `VARCHAR(255)` | User full name |
| `profession` | `VARCHAR(100)` | Professional domain |
| `industry` | `VARCHAR(100)` | Target industry |
| `goal` | `VARCHAR(255)` | Primary communication goal |
| `experience_level`| `VARCHAR(50)` | Beginner, Intermediate, Advanced |
| `weaknesses` | `TEXT` | Identified target weaknesses |
| `auth_provider` | `VARCHAR(50)` | "email" or "google" |
| `google_id` | `VARCHAR(255)` | Unique Google Subject ID |
| `is_verified` | `BOOLEAN` | Email verification flag |
| `otp` | `VARCHAR(6)` | 6-digit verification code |
| `otp_expiry` | `TIMESTAMP` | OTP expiration timestamp |
| `created_at` | `TIMESTAMP` | Registration date |
| `last_login` | `TIMESTAMP` | Most recent login |

### `analysis_results` Table
| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto-increment |
| `user_id` | `INTEGER` | Foreign Key -> `users.id`, Indexed |
| `video_path` | `VARCHAR(500)` | Internal file path to saved MP4 |
| `confidence_score`| `FLOAT` | Overall calculated confidence (0-100) |
| `eye_contact_percentage` | `FLOAT` | Sustained direct gaze metric (0-100) |
| `smile_percentage` | `FLOAT` | Positive facial expression metric (0-100) |
| `posture_percentage` | `FLOAT` | Upright shoulder/head alignment (0-100) |
| `hand_movement_percentage` | `FLOAT` | Expressive gesture presence (0-100) |
| `speech_score` | `FLOAT` | Vocal clarity and pacing metric (0-100) |
| `filler_word_count` | `INTEGER` | Detected filler count ("um", "like", etc.) |
| `words_per_minute` | `FLOAT` | Speaking cadence |
| `speech_text` | `TEXT` | Full transcribed speech text |
| `suggestions` | `TEXT` | Serialized JSON array of actionable advice |
| `timeline_data` | `TEXT` | Serialized JSON array of frame-level metrics |
| `created_at` | `TIMESTAMP` | Session timestamp |

---

## 4. Security & Privacy Architecture

1. **Authentication**: Stateless HMAC-SHA256 JWT tokens with 7-day expiration.
2. **Password Security**: Argon2id cryptographic hashing with memory-hard parameters.
3. **Protected Media Storage**: Videos are stored in an isolated filesystem directory and served strictly through authenticated endpoints (`/video-file/{id}`) verifying record ownership.
4. **Rate Limiting**: Tiered IP and User-ID rate limiting via `slowapi` to prevent API abuse and denial of service.
5. **CORS Hardening**: Strict origin whitelist matching production domains (`confidence-ai.netlify.app`, `localhost:3000`), disallowing arbitrary open origins.
