import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Left — hero */}
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={styles.heroBadge}>AI-Powered Platform</div>
          <h1 style={styles.heroTitle}>
            AI Based Personality<br />Development App
          </h1>
          <p style={styles.heroSub}>
            Your intelligent AI mentor for confidence, communication &amp; body language.
          </p>

          <div style={styles.pillsRow}>
            {["Master Body Language", "Eye Contact", "Confidence"].map((t) => (
              <span key={t} style={styles.pill}>{t}</span>
            ))}
          </div>

          <div style={styles.tipsGrid}>
            {[
              { icon: "👁️", title: "Eye Contact", desc: "Learn perfect eye contact techniques" },
              { icon: "🧍", title: "Posture", desc: "Correct sitting & standing posture" },
              { icon: "😊", title: "Facial Expression", desc: "Improve face confidence & smile" },
              { icon: "📊", title: "AI Dashboard", desc: "Track your progress" },
            ].map((tip) => (
              <div key={tip.title} style={styles.tipCard}>
                <span style={styles.tipIcon}>{tip.icon}</span>
                <div>
                  <div style={styles.tipTitle}>{tip.title}</div>
                  <div style={styles.tipDesc}>{tip.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div style={styles.formSide}>
        <div style={styles.formBox}>
          <div style={styles.formLogo}>
            <div style={styles.formLogoIcon}>CA</div>
            <span style={styles.formLogoText}>ConfidenceAI</span>
          </div>
          <h2 style={styles.formTitle}>Welcome back</h2>
          <p style={styles.formSub}>Sign in to continue your journey</p>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠️ {error}</span>
              <button onClick={() => setError("")} style={styles.errorClose}>✕</button>
            </div>
          )}

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email address</label>
              <input
                type="email"
                className="login-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                disabled={loading}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="login-btn"
              style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? "Signing in…" : "Get Started"}
            </button>
          </form>

          <p style={styles.switchText}>
            Don't have an account?{" "}
            <Link to="/signup" style={styles.switchLink}>Sign up</Link>
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
    position: "relative",
    overflow: "hidden",
  },
  heroInner: {
    maxWidth: "480px",
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
    fontSize: "clamp(26px, 4vw, 38px)",
    fontWeight: "800",
    color: "#fff",
    lineHeight: "1.2",
    margin: "0 0 16px 0",
    letterSpacing: "-0.5px",
  },
  heroSub: {
    fontSize: "14.5px",
    color: "rgba(255,255,255,0.82)",
    lineHeight: "1.7",
    margin: "0 0 28px 0",
  },
  pillsRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "32px",
  },
  pill: {
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "#fff",
    padding: "5px 14px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
  },
  tipsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  tipCard: {
    background: "rgba(255,255,255,0.12)",
    borderRadius: "10px",
    padding: "12px 14px",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  tipIcon: {
    fontSize: "18px",
    marginTop: "1px",
  },
  tipTitle: {
    fontSize: "12.5px",
    fontWeight: "700",
    color: "#fff",
    marginBottom: "2px",
  },
  tipDesc: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.7)",
    lineHeight: "1.4",
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
    fontSize: "13.5px",
    color: "#888",
    margin: "0 0 24px 0",
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
    gap: "16px",
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
    letterSpacing: "0.2px",
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
};

export default Login;