import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const STEPS = [
  { n: "01", t: "Create account", d: "Sign up in under 30 seconds" },
  { n: "02", t: "Record a session", d: "Up to 30 seconds of video" },
  { n: "03", t: "Get AI feedback", d: "Detailed confidence breakdown" },
  { n: "04", t: "Track progress", d: "Watch yourself improve over time" },
];

function Signup() {
  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [otp, setOtp]                         = useState(null);
  const navigate = useNavigate();

  const validateForm = () => {
    if (!email || !password || !confirmPassword) { setError("Please fill in all fields"); return false; }
    if (!email.includes("@")) { setError("Please enter a valid email"); return false; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return false; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return false; }
    return true;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/signup?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );
      const data = await response.json();
      if (response.ok) {
        setOtp(data.dev_otp);
        setTimeout(() => navigate("/verify", { state: { email } }), 2500);
      } else {
        setError(data.detail || "Signup failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (otp) {
    return (
      <div className="auth-page">
        <div className="auth-otp-screen animate-fadeUp">
          <div className="auth-otp-box">
            <div className="auth-otp-icon">🎉</div>
            <div className="auth-otp-title">Account created!</div>
            <p className="auth-otp-label">Your verification code:</p>
            <div className="auth-otp-code">{otp}</div>
            <p className="auth-otp-info">Redirecting to verification…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      {/* Left hero */}
      <div className="auth-hero">
        <div className="auth-hero-bg" />
        <div className="auth-hero-inner animate-fadeUp">
          <div className="auth-badge">Join ConfidenceAI</div>
          <h1 className="auth-hero-title">
            Start your confidence<br />
            <span className="auth-hero-title-accent">journey today</span>
          </h1>
          <p className="auth-hero-sub">
            Get AI analysis of your eye contact, posture, facial expressions, and speech — completely free.
          </p>

          <div className="auth-step-list">
            {STEPS.map((s) => (
              <div key={s.n} className="auth-step">
                <div className="auth-step-num">{s.n}</div>
                <div>
                  <div className="auth-step-title">{s.t}</div>
                  <div className="auth-step-desc">{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
        </div>
      </div>

      {/* Right form */}
      <div className="auth-form-side">
        <div className="auth-form-box animate-fadeUp" style={{ animationDelay: "0.1s" }}>
          <div className="auth-form-logo">
            <div className="auth-form-logo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L22 8.5v7L12 22 2 15.5v-7L12 2Z" fill="url(#sGrad)" />
                <defs>
                  <linearGradient id="sGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7c5cfc"/>
                    <stop offset="100%" stopColor="#5b8def"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="auth-form-logo-text">ConfidenceAI</span>
          </div>

          <h2 className="auth-form-title">Create account</h2>
          <p className="auth-form-sub">Free forever — no credit card needed</p>

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

          <form onSubmit={handleSignup} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email address</label>
              <input type="email" className="auth-input" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} id="signup-email" />
            </div>
            <div className="auth-field">
              <label className="auth-label">
                Password <span className="auth-hint">(min. 6 characters)</span>
              </label>
              <input type="password" className="auth-input" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} id="signup-password" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Confirm password</label>
              <input type="password" className="auth-input" placeholder="••••••••"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} id="signup-confirm" />
            </div>
            <button type="submit" className="auth-submit" disabled={loading} id="signup-submit">
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Creating account…
                </>
              ) : (
                <>
                  Create Account
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/login" className="auth-switch-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
