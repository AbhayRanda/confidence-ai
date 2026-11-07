# DEPLOYMENT_GUIDE.md — Production Deployment Runbook

## 1. Hosting Architecture Overview

Confidence AI is architected as a decoupled, cloud-native full-stack application:

| Layer | Provider | Primary URL | Production Build Command |
| :--- | :--- | :--- | :--- |
| **Frontend** | Netlify | `https://confidence-ai.netlify.app` | `npm run build` |
| **Backend API** | Render | `https://confidence-ai-1.onrender.com` | `uvicorn main:app --host 0.0.0.0 --port 10000 --workers 1` |
| **Database** | Neon.tech | Managed PostgreSQL 16 | Automatic pooling |

---

## 2. Environment Variables Configuration

### Backend (`ai-service/.env` or Render Dashboard)
```env
# Database Connection (Neon.tech PostgreSQL)
DATABASE_URL=postgresql://user:password@ep-cool-sample.us-east-2.aws.neon.tech/neondb?sslmode=require

# JWT Cryptographic Signing
JWT_SECRET_KEY=generate-a-secure-random-256-bit-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# CORS Whitelist (Comma-separated)
ALLOWED_ORIGINS=https://confidence-ai.netlify.app,http://localhost:3000,http://127.0.0.1:3000

# Backend Public Origin
BACKEND_URL=https://confidence-ai-1.onrender.com

# AI Inference Keys
GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# SMTP Mail Server (Optional; falls back to auto-verify if blocked)
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

### Frontend (`frontend/.env` or Netlify Dashboard)
```env
# Backend API Base Endpoint
REACT_APP_API_URL=https://confidence-ai-1.onrender.com

# Real-time WebSocket Endpoint
REACT_APP_WS_URL=wss://confidence-ai-1.onrender.com
```

---

## 3. Render Deployment Protocol

1. **Memory & Concurrency Tuning**:
   - On the Render Free tier (512 MB RAM limit), run with `--workers 1` to prevent out-of-memory (OOM) process termination during video remuxing and MediaPipe processing.
   - Start command:
     ```bash
     uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
     ```

2. **FFmpeg Binary**:
   - Ensure Render's native Linux environment includes `ffmpeg`. Render's standard Python 3.10 environment provides pre-compiled `ffmpeg` in `/usr/bin/ffmpeg`.

3. **Storage Persistence**:
   - On free tier instances, disk storage in `/uploads` is ephemeral. In production with a Render disk mount, set `UPLOAD_FOLDER=/var/data/uploads` to persist user recordings across instance restarts.

---

## 4. Netlify Deployment Protocol

1. **Build Settings**:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `build`

2. **Single Page Application (SPA) Redirects**:
   - Netlify requires redirect rules so deep links (e.g. `/practice`, `/settings`, `/progress`, `/video/:id`) route to `index.html`:
   - Ensure `frontend/public/_redirects` contains:
     ```
     /*    /index.html   200
     ```

---

## 5. Post-Deployment Verification Checklist

- [ ] Visit `https://confidence-ai.netlify.app` in an incognito window — verify the new public Landing Page renders.
- [ ] Create a new test user account with a non-Gmail address (e.g. `@outlook.com` or `@example.com`) — verify smooth auto-verification or OTP flow without 400 Bad Request.
- [ ] Log in and navigate to the **Practice Studio** (`/practice`) and **Progress Analytics** (`/progress`).
- [ ] Navigate to **Settings** (`/settings`), change the theme to Peak Emerald or Executive Gold, and verify instant theme adaptation.
- [ ] Verify that video recordings stream through authenticated `/video-file/{id}` endpoints.
