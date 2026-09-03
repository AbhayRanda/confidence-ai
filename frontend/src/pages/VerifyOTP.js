import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Auth.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function VerifyOTP() {
  const [otp, setOtp]         = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp) { setError("Please enter the OTP"); return; }
    if (otp.length !== 6 || isNaN(otp)) { setError("OTP must be 6 digits"); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError(data.detail || "Invalid OTP. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="auth-page">
        <div style={{ margin: "auto", textAlign: "center", padding: "40px" }}>
          <div className="auth-otp-box" style={{ maxWidth: "360px" }}>
            <div className="auth-otp-icon">⚠️</div>
            <div className="auth-otp-title" style={{ color: "#f87171" }}>Invalid Access</div>
            <p className="auth-otp-label">Please sign up again to receive a verification code.</p>
            <button onClick={() => navigate("/signup")} className="auth-submit" style={{ width: "100%", marginTop: "16px" }}>
              Go to Signup
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page">
        <div style={{ margin: "auto", textAlign: "center", padding: "40px" }}>
          <div className="auth-otp-box animate-fadeUp" style={{ maxWidth: "360px" }}>
            <div className="auth-otp-icon">✅</div>
            <div className="auth-otp-title">Email Verified!</div>
            <p className="auth-otp-label">Your account is ready. Redirecting to login…</p>
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
          <div className="auth-badge">Email Verification</div>
          <h1 className="auth-hero-title">
            One last<br />
            <span className="auth-hero-title-accent">step</span>
          </h1>
          <p className="auth-hero-sub">
            We sent a 6-digit verification code to your email. Enter it below to activate your account.
          </p>

          {/* Info cards */}
          <div className="auth-step-list">
            <div className="auth-step">
              <div className="auth-step-num">📧</div>
              <div>
                <div className="auth-step-title">Check your inbox</div>
                <div className="auth-step-desc">Look for an email from ConfidenceAI</div>
              </div>
            </div>
            <div className="auth-step">
              <div className="auth-step-num">🔒</div>
              <div>
                <div className="auth-step-title">Secure your account</div>
                <div className="auth-step-desc">Code expires in 10 minutes</div>
              </div>
            </div>
            <div className="auth-step">
              <div className="auth-step-num">✓</div>
              <div>
                <div className="auth-step-title">Verify and start</div>
                <div className="auth-step-desc">Unlock your AI confidence journey</div>
              </div>
            </div>
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
                <path d="M12 2L22 8.5v7L12 22 2 15.5v-7L12 2Z" fill="url(#vGrad)" />
                <defs>
                  <linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7c5cfc"/>
                    <stop offset="100%" stopColor="#5b8def"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="auth-form-logo-text">ConfidenceAI</span>
          </div>

          <h2 className="auth-form-title">Verify your email</h2>
          <p className="auth-form-sub">Code sent to:</p>
          <div style={{
            display: "inline-block",
            background: "rgba(124,92,252,0.1)",
            border: "1px solid rgba(124,92,252,0.25)",
            color: "#a78bfa",
            padding: "6px 16px",
            borderRadius: "999px",
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "24px",
          }}>
            {email}
          </div>

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

          <form onSubmit={handleVerify} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Verification Code</label>
              <input
                type="text"
                className="auth-input"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={loading}
                maxLength="6"
                id="otp-input"
                style={{
                  fontSize: "24px",
                  textAlign: "center",
                  letterSpacing: "10px",
                  fontFamily: "'Courier New', monospace",
                  fontWeight: "800",
                }}
              />
            </div>
            <button type="submit" className="auth-submit" disabled={loading} id="verify-btn">
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Verifying…
                </>
              ) : (
                <>
                  Verify Code
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="auth-switch" style={{ fontSize: "12px", marginTop: "16px" }}>
            Didn't receive a code? Check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
}

export default VerifyOTP;
