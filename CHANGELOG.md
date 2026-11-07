# CHANGELOG.md — Confidence AI Platform Evolution

All notable changes, architectural enhancements, security hardening, and newly integrated components are documented in this log.

---

## [2.1.0] - 2026-11-07

### 🚀 New Application Pages & Navigation
- **Landing Page (`/`)**: Added high-converting public landing page featuring an interactive hero section, biometric capability highlights, 3-step workflow walkthrough, social proof metrics, and CTA conversion triggers. Unauthenticated visitors are automatically greeted with this page.
- **Settings Page (`/settings`)**: Created dedicated settings hub featuring:
  - *Professional Persona*: Name, role, industry, primary goal, experience level, and multi-select weakness chips.
  - *Appearance Engine*: Live switcher for all 5 color themes (`cyber-violet`, `peak-emerald`, `executive-gold`, `radiant-coral`, `ocean-teal`) with color swatch previews.
  - *Storage Meter*: Visual storage indicator displaying MB utilized against the 500 MB cloud quota.
  - *Security & Danger Zone*: Token reset, local storage cache purge, and full account erasure.
- **Progress Analytics (`/progress`)**: Created longitudinal performance page featuring:
  - 4-stat milestone grid (All-Time Best Score, 7-Day Consistency Streak, Total Completed Sessions, Recent Score Delta).
  - Score progression line chart over last 10 sessions (Chart.js).
  - 5-axis radar chart displaying biometric balance (Eye Contact, Posture, Warmth, Speech, Hand Gestures).
  - Metric comparison cards showing current vs previous percentages with positive/negative trend indicators.
  - Session history table with one-click inspection links.
- **Practice Studio (`/practice`)**: Designed dedicated training studio with 4 structured drill modes:
  - *Presentation Studio* (60-second full video assessment)
  - *30-Second Focus Drill* (fast micro-workout targeting eye contact or posture)
  - *Read Aloud Drill* (cadence and vocal clarity trainer)
  - *3D Avatar Mock Interview* (real-time voice conversation with VRM humanoid)
  - Dynamic prompt generator for rapid practice scenarios.
- **Navbar Integration**: Updated navigation shell to include Practice, Analytics, and a quick-access Settings shortcut.

### 🛡️ Security Hardening & Bug Fixes
- **General Email Validation**: Replaced rigid `@gmail.com`-only restriction with universal RFC 5322 regex validation across `/signup`, `/login`, and `/resend-otp`, allowing any email provider (Proton, Outlook, university, corporate, Gmail) to sign up seamlessly.
- **SMTP Block Resiliency**: Hardened signup on restricted hosting environments (Render free tier blocking ports 25, 465, 587). The backend gracefully auto-verifies accounts when all outbound mail ports fail, preventing `400 Bad Request` registration failures.
- **CORS Hardening**: Removed wildcard origin regex (`allow_origin_regex=r"^https?://.*"`) in favor of strict origin domain whitelisting (`confidence-ai.netlify.app`, `localhost:3000`).
- **Authenticated Video Endpoint**: Added `GET /video-file/{result_id}` ensuring video streaming requires a valid JWT token matching the session owner.
- **TTS Security**: Added token-based user verification to `/tts`, `/tts/status`, and `/tts/reset` while maintaining graceful browser Web Speech API fallbacks.
- **Startup Security Checks**: Added startup diagnostic warnings verifying `JWT_SECRET_KEY` configuration.

### 🧩 UI Components & Reliability
- **`ConfirmModal`**: Built accessible, keyboard-trapped modal dialog replacing disruptive browser `window.confirm()` popups during session deletion, logout, and account removal.
- **`Skeleton` Loaders**: Introduced `SkeletonCard` and `SkeletonStat` placeholders with smooth pulse-shimmer CSS animations to eliminate cumulative layout shifts (CLS).
- **`ErrorBoundary`**: Wrapped all application routes in a top-level React Error Boundary providing graceful recovery buttons in case of unexpected rendering errors.
- **Theme-Aware Chart Styling**: Bound Chart.js canvas elements to theme variables for crisp legibility across light and dark modes.

---

## [2.0.0] - Prior Release
- Initial 3D VRM avatar integration with audio-reactive blendshapes and visemes.
- MediaPipe computer vision landmark tracking (gaze, posture, smile, hands).
- Whisper speech transcription and filler word cadence counting.
- Neon.tech PostgreSQL persistence.

