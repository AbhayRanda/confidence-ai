import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .login-input:focus {
        outline: none;
        border-color: #6c47ff !important;
        box-shadow: 0 0 0 3px rgba(108,71,255,0.12);
      }
      .login-btn:hover { opacity: 0.88; }
      .login-btn:active { transform: scale(0.98); }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

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
        setTimeout(() => navigate("/verify", { state: { email } }), 2000);
      } else {
        setError(data.detail || "Signup failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (otp) {
    return (
      <div style={styles.page}>
        <div style={styles.otpScreen}>
          <div style={styles.formBox}>
            <h2 style={styles.formTitle}>Account created! ✓</h2>
            <div style={styles.otpBox}>
              <p style={styles.otpLabel}>Your verification code:</p>
              <p style={styles.otpCode}>{otp}</p>
              <p style={styles.otpInfo}>Redirecting to verification…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Left hero */}
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={styles.heroBadge}>Join ConfidenceAI</div>
          <h1 style={styles.heroTitle}>Start your confidence journey today</h1>
          <p style={styles.heroSub}>
            Get instant AI analysis of your eye contact, posture, facial expressions, and speech patterns.
          </p>
          <div style={styles.stepList}>
            {[
              { n: "01", t: "Create account", d: "Sign up in under 30 seconds" },
              { n: "02", t: "Record a session", d: "Up to 30 seconds of video" },
              { n: "03", t: "Get AI feedback", d: "Detailed confidence breakdown" },
              { n: "04", t: "Track progress", d: "Watch yourself improve" },
            ].map((s) => (
              <div key={s.n} style={styles.step}>
                <div style={styles.stepNum}>{s.n}</div>
                <div>
                  <div style={styles.stepTitle}>{s.t}</div>
                  <div style={styles.stepDesc}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div style={styles.formSide}>
        <div style={styles.formBox}>
          <div style={styles.formLogo}>
            <div style={styles.formLogoIcon}>CA</div>
            <span style={styles.formLogoText}>ConfidenceAI</span>
          </div>
          <h2 style={styles.formTitle}>Create your account</h2>
          <p style={styles.formSub}>Free to get started, no credit card needed</p>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠️ {error}</span>
              <button onClick={() => setError("")} style={styles.errorClose}>✕</button>
            </div>
          )}

          <form onSubmit={handleSignup} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email address</label>
              <input type="email" className="login-input" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                style={styles.input} disabled={loading} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password <span style={styles.hint}>(min. 6 characters)</span></label>
              <input type="password" className="login-input" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={styles.input} disabled={loading} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Confirm password</label>
              <input type="password" className="login-input" placeholder="••••••••"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input} disabled={loading} />
            </div>
            <button type="submit" className="login-btn"
              style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p style={styles.switchText}>
            Already have an account?{" "}
            <Link to="/login" style={styles.switchLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', sans-serif",
  },
  hero: {
    flex: 1,
    background: "linear-gradient(150deg, #5c2fff 0%, #7e57ff 40%, #4f8ef7 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 48px",
  },
  heroInner: {
    maxWidth: "440px",
    animation: "fadeUp 0.6s ease both",
  },
  heroBadge: {
    display: "inline-block",
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    padding: "4px 14px",
    borderRadius: "20px",
    fontSize: "11.5px",
    fontWeight: "600",
    letterSpacing: "0.5px",
    marginBottom: "20px",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: "clamp(24px, 3.5vw, 34px)",
    fontWeight: "800",
    color: "#fff",
    lineHeight: "1.25",
    margin: "0 0 14px 0",
    letterSpacing: "-0.4px",
  },
  heroSub: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.8)",
    lineHeight: "1.7",
    margin: "0 0 32px 0",
  },
  stepList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  step: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
  },
  stepNum: {
    fontSize: "11px",
    fontWeight: "800",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.5px",
    minWidth: "28px",
    paddingTop: "1px",
  },
  stepTitle: {
    fontSize: "13.5px",
    fontWeight: "700",
    color: "#fff",
    marginBottom: "1px",
  },
  stepDesc: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.65)",
  },
  otpScreen: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f7f8fc",
  },
  formSide: {
    width: "420px",
    minWidth: "380px",
    background: "#f7f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 32px",
  },
  formBox: {
    width: "100%",
    maxWidth: "340px",
    animation: "fadeUp 0.7s ease 0.1s both",
  },
  formLogo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "28px",
  },
  formLogoIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #6c47ff, #4f8ef7)",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  formLogoText: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#1a1a2e",
  },
  formTitle: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#1a1a2e",
    margin: "0 0 6px 0",
    letterSpacing: "-0.3px",
  },
  formSub: {
    fontSize: "13px",
    color: "#888",
    margin: "0 0 22px 0",
  },
  errorBox: {
    background: "#fff1f0",
    border: "1px solid #ffd8d4",
    color: "#c0392b",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  errorClose: {
    background: "none",
    border: "none",
    color: "#c0392b",
    cursor: "pointer",
    fontSize: "14px",
    padding: "0 4px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  hint: {
    fontWeight: "400",
    textTransform: "none",
    letterSpacing: "0",
    color: "#aaa",
    fontSize: "11px",
  },
  input: {
    padding: "11px 14px",
    border: "1.5px solid #e0e0e0",
    borderRadius: "9px",
    fontSize: "14px",
    color: "#1a1a2e",
    background: "#fff",
    transition: "all 0.2s ease",
    fontFamily: "'Segoe UI', sans-serif",
  },
  submitBtn: {
    padding: "12px",
    background: "linear-gradient(135deg, #6c47ff, #4f8ef7)",
    color: "#fff",
    border: "none",
    borderRadius: "9px",
    fontSize: "14.5px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "4px",
    transition: "all 0.2s ease",
  },
  switchText: {
    textAlign: "center",
    fontSize: "13px",
    color: "#888",
    marginTop: "20px",
  },
  switchLink: {
    color: "#6c47ff",
    fontWeight: "700",
    textDecoration: "none",
  },
  otpBox: {
    background: "rgba(108,71,255,0.08)",
    border: "1px solid rgba(108,71,255,0.2)",
    padding: "24px",
    borderRadius: "12px",
    textAlign: "center",
    marginTop: "16px",
  },
  otpLabel: {
    fontSize: "13px",
    color: "#666",
    margin: "0 0 10px 0",
  },
  otpCode: {
    fontSize: "32px",
    fontWeight: "800",
    fontFamily: "'Courier New', monospace",
    color: "#6c47ff",
    margin: "0 0 10px 0",
    letterSpacing: "6px",
  },
  otpInfo: {
    fontSize: "12px",
    color: "#999",
    margin: "0",
  },
};

export default Signup;
