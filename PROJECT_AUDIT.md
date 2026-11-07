# PROJECT AUDIT — Confidence AI
*Generated: 2026-11-07 | Auditor: AI Senior Architect*

---

## 1. PROJECT OVERVIEW

**Confidence AI** is an AI-powered personality and communication coaching platform.

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Frontend | React (CRA) | 18.2.0 | ✅ Working |
| Routing | react-router-dom | 7.13.0 | ✅ Working |
| Charting | chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 | ✅ Working |
| 3D Avatar | three + @react-three/fiber + @pixiv/three-vrm | 0.169.0 | ✅ Working |
| Notifications | react-toastify | 11.0.5 | ✅ Working |
| Icons | lucide-react | 1.7.0 | ✅ Working |
| Backend | FastAPI (Python) | 2.0 | ✅ Working |
| Database | SQLite (dev) / PostgreSQL (prod) | - | ✅ Working |
| ORM | SQLAlchemy | - | ✅ Working |
| Auth | JWT (python-jose) + Argon2 | - | ✅ Working |
| AI Chat | Google Gemini API | gemini-3.5-flash-lite | ✅ Working |
| TTS | ElevenLabs API (optional) | - | ✅ Working |
| Vision | MediaPipe + OpenCV | 0.10.14 | ✅ Working |
| Deployment | Render (backend) + Netlify (frontend) | - | ✅ Working |

---

## 2. PAGES & ROUTES INVENTORY

| Route | File | Status |
|-------|------|--------|
| `/login` | Login.js | ✅ Working |
| `/signup` | Signup.js | ✅ Working |
| `/verify` | VerifyOTP.js | ✅ Working |
| `/auth/callback` | GoogleCallback.js | ✅ Working |
| `/dashboard` | Dashboard.js | ✅ Working |
| `/ai` | AIDashboard.js | ✅ Working |
| `/live` | LiveAvatarChat.js | ✅ Working |
| `/resources` | Resources.js | ✅ Working |
| `/video/:id` | VideoAnalytics.js | ✅ Working |
| `/` (Landing) | ❌ MISSING | No public marketing page |
| `/settings` | ❌ MISSING | No dedicated settings page |
| `/progress` | ❌ MISSING | No dedicated progress analytics |
| `/practice` | ❌ MISSING | No dedicated practice studio |

---

## 3. BACKEND API ENDPOINTS

| Method | Route | Auth | Status |
|--------|-------|------|--------|
| POST | /signup | No | ✅ |
| POST | /login | No | ✅ |
| POST | /logout | No | ✅ |
| GET | /auth/google | No | ✅ |
| GET | /auth/google/callback | No | ✅ |
| POST | /verify-otp | No | ✅ |
| POST | /analyze | JWT | ✅ (synchronous!) |
| GET | /dashboard | JWT | ✅ |
| GET | /progress | JWT | ✅ |
| GET | /storage | JWT | ✅ |
| DELETE | /delete/{id} | JWT | ✅ |
| GET | /video/{id} | JWT | ✅ |
| POST | /chat | JWT | ✅ |
| GET | /chat/stream | JWT | ✅ |
| POST | /tts | No auth! | ⚠️ |
| GET | /tts/status | No | ✅ |
| WS | /ws/progress/{job_id} | No auth! | ⚠️ |
| GET | /profile | JWT | ✅ |
| POST | /profile | JWT | ✅ |
| GET | / | No | ✅ |

---

## 4. CRITICAL ISSUES FOUND

### 🔴 HIGH PRIORITY

**Issue 1: Synchronous Video Analysis Blocks Server**
- File: ai-service/main.py (/analyze endpoint)
- Problem: Runs in `asyncio.to_thread()` but with --workers 1, the entire uvicorn process
  is occupied. All other user requests queue behind a single video analysis.
- Fix: Use FastAPI BackgroundTasks + polling endpoint, or background job system.

**Issue 2: Overly Permissive CORS**
- File: ai-service/main.py lines 121-128
- Problem: `allow_origin_regex=r"^https?://.*"` allows ANY origin including malicious sites.
- Fix: Remove the regex; rely only on the explicit allowed_origins list from environment.

**Issue 3: Videos Served Without Authentication**
- File: ai-service/main.py line 118
- Problem: `app.mount("/uploads", StaticFiles(...))` — any URL-guesser can download any user's video.
- Fix: Remove static mount; serve via authenticated `/video-file/{id}` endpoint.

**Issue 4: No File Upload Size Limit at HTTP Layer**
- Problem: Backend accepts arbitrarily large uploads without HTTP-layer size enforcement.
- Fix: Add `Content-Length` check before processing; configure uvicorn limit.

**Issue 5: JWT Secret Default Value Risk**
- File: ai-service/config.py line 55
- Problem: `jwt_secret_key: str = "change-me-in-production"` — if env var not set, all JWTs use a known key.
- Fix: Raise ValueError on startup if key equals default and DATABASE_URL is PostgreSQL.

**Issue 6: TTS Endpoint Has No Authentication**
- File: ai-service/main.py /tts endpoint
- Problem: Anyone can use the ElevenLabs API key without logging in.
- Fix: Add JWT auth dependency to /tts endpoint.

**Issue 7: Gmail-Only Login Restriction**
- File: ai-service/main.py + frontend/src/pages/Login.js
- Problem: Regex enforces @gmail.com only — excludes corporate, school, and other email users.
- Fix: Accept any valid RFC 5322 email address.

---

### 🟡 MEDIUM PRIORITY

**Issue 8: No Pagination on /dashboard**
- Returns ALL analysis results for a user. 500+ sessions = huge response.
- Fix: Add limit/offset query params.

**Issue 9: window.confirm() Used for Destructive Actions**
- File: frontend/src/pages/Dashboard.js line 201
- Fix: Replace with custom modal dialog component.

**Issue 10: VideoAnalytics Fetches ALL Sessions to Find One**
- File: frontend/src/pages/VideoAnalytics.js lines 25-35
- Problem: Calls /dashboard (all sessions) then client-side filters by ID.
- Fix: Call GET /video/{id} directly.

**Issue 11: Chart Colors Hardcoded in Dark Mode Values**
- File: frontend/src/pages/Dashboard.js (chart options)
- Problem: Colors are hardcoded hex values, not theme-aware CSS variables.
- Fix: Dynamically read CSS variables or use theme-aware color computation.

**Issue 12: No Error Boundary on Lazy-Loaded Routes**
- File: frontend/src/App.js
- Fix: Wrap Suspense in React ErrorBoundary with friendly fallback UI.

**Issue 13: Direct fetch() Used Instead of apiFetch() in Some Pages**
- Files: Dashboard.js, VideoAnalytics.js
- Problem: Inconsistent API call patterns; 401 handling not centralized.
- Fix: Replace all `fetch()` calls with `apiFetch()` from utils/api.js.

**Issue 14: No Loading Skeletons**
- Problem: Blank state or single spinner shown during data loading.
- Fix: Add skeleton placeholder cards for all data-heavy pages.

---

### 🟢 LOW PRIORITY

- No Landing/Marketing page for unauthenticated users
- No Settings page for profile management
- No dedicated Progress Analytics page
- No dedicated Presentation Practice / Mock Interview pages (exist as modes inside LiveAvatarChat)
- No offline / PWA support
- react-scripts / CRA is deprecated (migrate to Vite in future)
- Tests are mostly boilerplate stubs with no meaningful coverage

---

## 5. DATABASE SCHEMA ASSESSMENT

**Current Tables:**
- `users` — Good. OAuth fields, profile columns, OTP.
- `analysis_results` — Good. All video metrics, FK to users.

**Missing Tables:**
- `practice_sessions` — structured practice sessions
- `interview_sessions` — Q&A pairs and scores
- `ai_conversations` — persistent chat history
- `processing_jobs` — async video processing state

**Schema Issues:**
- `weaknesses` stored as JSON text string (no normalization)
- No DB-level indexes beyond PK and unique constraints
- No `updated_at` timestamps
- `video_path` stores relative paths (needs cloud URL support for production S3/Cloudinary)

---

## 6. WHAT'S ALREADY EXCELLENT

✅ Multi-theme CSS variable design system (3 themes: cyber-violet, peak-emerald, obsidian)
✅ 3D Avatar system (VRM + RPM + Abstract) with real-time lip-sync and spring physics
✅ WebSocket real-time analysis progress
✅ JWT + Argon2 auth with proper 401 handling
✅ Google OAuth2 (full server-side flow)
✅ ElevenLabs TTS with graceful fallback to browser Web Speech API
✅ Code-split lazy loading on heavy pages
✅ Per-user rate limiting via SlowAPI with JWT key
✅ Rule-based coaching fallback when Gemini API is unavailable
✅ Multi-model Gemini cascade (falls through on quota)
✅ LiveAvatarChat with MediaPipe real-time vision
✅ Resources page with skill library and exercises
✅ UserOnboarding modal for personalized coaching
✅ VideoAnalytics per-session charts
✅ Dashboard with multi-chart trends and streaks
✅ Per-user 500MB storage quota with display
✅ WebM→MP4 remux via FFmpeg
✅ Responsive Navbar (desktop sidebar + mobile bottom tabs)

---

## 7. IMPLEMENTATION PLAN

### Phase 1 — Critical Security Fixes
1. Fix CORS (remove overly permissive regex)
2. Add auth to /tts endpoint
3. Add /video-file/{id} authenticated endpoint (remove public static mount)
4. Add startup JWT secret validation
5. Broaden email validation to any valid email

### Phase 2 — New Pages
1. Landing page (/) — public marketing
2. Settings page (/settings) — profile + theme + account
3. Progress Analytics (/progress) — dedicated analytics
4. Practice Studio (/practice) — structured practice modes

### Phase 3 — UI Polish
1. Loading skeletons
2. Replace window.confirm() with ConfirmModal component
3. Fix chart.js theme-awareness
4. Add error boundaries
5. Add /dashboard pagination + virtual scroll

### Phase 4 — Backend Improvements
1. Move video analysis to background tasks
2. Add pagination to /dashboard
3. Add interview_sessions and practice_sessions tables

### Phase 5 — Enhanced AI Features
1. Persistent chat history (DB-backed)
2. Structured interview question bank
3. Personalized daily recommendations

### Phase 6 — Testing + Production Readiness
1. Component tests for key pages
2. API integration tests
3. E2E test for auth flow

---

*Audit complete. 7 critical issues + 7 medium priority + 6 low priority identified.*
*Existing functionality fully preserved. All changes are additive.*

