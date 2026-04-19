import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const FEATURES = [
  { icon: "👁️", title: "Eye Contact Analysis", desc: "AI tracks your gaze patterns in real time" },
  { icon: "🧍", title: "Posture Detection", desc: "Identify and correct body language instantly" },
  { icon: "😊", title: "Facial Confidence", desc: "Measure and improve your facial expressions" },
  { icon: "📊", title: "Progress Tracking", desc: "Watch your confidence score grow over time" },
];

function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields"); return; }
    if (!email.includes("@")) { setError("Please enter a valid email"); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("user", data.email);
        localStorage.setItem("user_id", data.user_id);
        navigate("/dashboard");
      } else {
        setError(data.detail || "Login failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
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
                    <stop offset="0%" stopColor="#7c5cfc"/>
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

          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email address</label>
              <input
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                id="login-email"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                id="login-password"
              />
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
              id="login-submit"
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
            <Link to="/signup" className="auth-switch-link">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;