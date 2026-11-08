# INTEGRATION_PLAN.md — Step-by-Step Execution Plan

## 1. Objectives & Quality Standards

Transform the existing Confidence AI application into a premium SaaS product with:
- Zero loss of existing features or database data.
- Strict security boundaries (authenticated media, verified email, JWT-gated TTS, scoped CORS).
- Full suite of 15 SaaS application pages.
- Native CSS variable design system (`cyber-violet`, `peak-emerald`, `obsidian`).
- Robust testing and verification at each step.

---

## 2. Phased Rollout Matrix

### Phase 1: Core Security & Backend Hardening
- [x] Audit codebase (`PROJECT_AUDIT.md`)
- [x] Research 40+ open source repositories (`GITHUB_RESEARCH.md`)
- [x] Document System Architecture (`ARCHITECTURE.md`)
- [ ] **Fix Signup Email Restriction**: Support standard RFC 5322 email validation, not just Gmail.
- [ ] **Fix SMTP Fallback**: Ensure signup succeeds cleanly when host network blocks outbound SMTP (Render free tier), preventing 400 errors for new accounts.
- [ ] **Secure Video Access**: Replace unauthenticated `/uploads` static file mount with `GET /video-file/{result_id}` authenticated streaming route.
- [ ] **Secure TTS Proxy**: Add JWT authentication dependency to `/tts`, `/tts/status`, and `/tts/reset`.
- [ ] **Harden CORS Configuration**: Remove overly permissive `allow_origin_regex=r"^https?://.*"` and strictly enforce verified origin domains.
- [ ] **Add Dashboard Pagination**: Add `limit` and `offset` query parameters to prevent unbounded memory usage as user history grows.

### Phase 2: Missing Application Pages & Core Components
- [ ] **`ConfirmModal.js`**: Accessible, elegant confirmation dialog replacing all disruptive `window.confirm()` calls.
- [ ] **`Skeleton.js`**: Smooth animated skeleton loading cards and stats placeholders for zero layout shifts.
- [ ] **`Landing.js` (`/`)**: High-converting public landing page featuring interactive hero, feature showcase, 3D coach preview, testimonials, and CTA triggers.
- [ ] **`Settings.js` (`/settings`)**: Dedicated settings page for user profile editing, career goals, theme switching, and account security.
- [ ] **`Progress.js` (`/progress`)**: Longitudinal progress analytics page with score evolution charts, metric breakdowns, and personalized growth insights.
- [ ] **`Practice.js` (`/practice`)**: Dedicated practice hub offering structured drills (Presentation, 30s Speed Drill, Read Aloud).
- [ ] **Update Navigation (`Navbar.js`)**: Add Progress link, Settings shortcut, and modern avatar user menu dropdown.

### Phase 3: UI Modernization & Design System Alignment
- [ ] Upgrade `Dashboard.js` to use `apiFetch()` with unified error handling and `ConfirmModal` for deletes.
- [ ] Upgrade `VideoAnalytics.js` to fetch single session directly via `GET /video/{id}` instead of querying all sessions.
- [ ] Add Error Boundary (`ErrorBoundary.js`) to capture unhandled React rendering errors gracefully.
- [ ] Add theme-aware dynamic chart colors matching active CSS tokens (`--accent`, `--text-muted`, `--border-subtle`).

### Phase 4: Video Processing & AI Coaching Refinements
- [ ] Add speech structure and pause analysis helpers to `video_analyzer.py`.
- [ ] Ensure non-blocking async video remuxing and analysis pipeline.
- [ ] Enhance AI coaching response generation with actionable, objective feedback criteria.

### Phase 5: Testing, Documentation & Deployment Guide
- [ ] Execute frontend build (`npm run build`) to ensure zero TypeScript/JSX errors.
- [ ] Execute backend syntax and import checks using `.venv\Scripts\python.exe`.
- [ ] Generate `CHANGELOG.md`, `TEST_REPORT.md`, and `DEPLOYMENT_GUIDE.md`.
- [ ] Commit and verify clean repository status.

