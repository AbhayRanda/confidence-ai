import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import "./Auth.css";
import { API_BASE_URL } from "../utils/api";

const FEATURES = [
  { icon: "👁️", title: "Eye Contact Analysis",  desc: "AI tracks your gaze patterns in real time" },
  { icon: "🧍", title: "Posture Detection",      desc: "Identify and correct body language instantly" },
  { icon: "😊", title: "Facial Confidence",      desc: "Measure and improve your facial expressions" },
  { icon: "📊", title: "Progress Tracking",      desc: "Watch your confidence score grow over time" },
];

const ERROR_MESSAGES = {
  google_denied:         "You cancelled the Google sign-in. Try again when ready.",
  token_exchange_failed: "Google authentication failed. Please try again.",
  incomplete_profile:    "Google did not return your profile. Please try again.",
  network_error:         "A network error occurred. Please check your connection.",
  db_error:              "A server error occurred. Please try again in a moment.",
};

function Login() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState("");

  // Show error from OAuth callback (e.g. ?error=google_denied)
  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(ERROR_MESSAGES[oauthError] || "Authentication failed. Please try again.");
    }
  }, [searchParams]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const gmailRegex = /^(?!.*\.\.)[a-zA-Z0-9][a-zA-Z0-9.]{4,28}[a-zA-Z0-9]@gmail\.com$/;
    if (!gmailRegex.test(cleanEmail)) {
      setError("Please enter a valid Gmail address (e.g. yourname@gmail.com)");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", data.email);
        if (data.profile) {
          localStorage.setItem("userProfile", JSON.stringify(data.profile));
        }
        navigate("/dashboard");
      } else {
        if (data.detail === "Email not verified") {
          setError("Email not verified. Redirecting to verification code entry…");
          setTimeout(() => navigate("/verify", { state: { email } }), 2000);
        } else {
          setError(data.detail || "Invalid email or password");
        }
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    setError("");
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <div className="auth-page">
      {/* Left hero panel */}
      <div className="auth-hero">
        <div className="auth-hero-bg" />
        <div className="auth-hero-inner animate-fadeUp">
          <div className="auth-badge">AI-Powered Platform</div>
          <h1 className="auth-hero-title">
            Build Unshakeable<br />
            <span className="auth-hero-title-accent">Confidence</span>
          </h1>
          <p className="auth-hero-sub">
            Your intelligent AI mentor for body language, communication, and self-expression.
          </p>

          <div className="auth-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="auth-feature-card">
                <span className="auth-feature-icon">{f.icon}</span>
                <div>
                  <div className="auth-feature-title">{f.title}</div>
                  <div className="auth-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Floating orbs */}
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-form-side">
        <div className="auth-form-box animate-fadeUp" style={{ animationDelay: "0.1s" }}>
          <div className="auth-form-logo">
            <div className="auth-form-logo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L22 8.5v7L12 22 2 15.5v-7L12 2Z" fill="url(#lGrad)" />
                <defs>
                  <linearGradient id="lGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor="#7c5cfc"/>
                    <stop offset="100%" stopColor="#5b8def"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="auth-form-logo-text">ConfidenceAI</span>
          </div>

          <h2 className="auth-form-title">Welcome back</h2>
          <p className="auth-form-sub">Sign in to continue your journey</p>

          {error && (
            <div className="auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
              <button onClick={() => setError("")} className="auth-error-close">✕</button>
            </div>
          )}

          {/* Google Sign-In button */}
          <button
            id="google-login-btn"
            type="button"
            className="google-btn"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <>
                <span className="auth-spinner" />
                Redirecting to Google…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          <div className="auth-divider">
            <span>or sign in with email</span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailLogin} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email address</label>
              <input
                id="login-email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || googleLoading}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                id="login-password"
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || googleLoading}
                required
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              className="auth-submit"
              disabled={loading || googleLoading}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account?{" "}
            <Link to="/signup" className="auth-switch-link">Sign up</Link>
          </p>

          <div className="auth-trust-badges" style={{ marginTop: "24px" }}>
            <span className="auth-trust-badge">🔒 SSL Encrypted</span>
            <span className="auth-trust-badge">🛡️ Secure Passwords</span>
            <span className="auth-trust-badge">✅ Verified by Google</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Google "G" logo SVG
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default Login;
