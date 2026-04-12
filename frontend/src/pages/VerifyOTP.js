import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function VerifyOTP() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .otp-input:focus {
        outline: none;
        border-color: #6c47ff !important;
        box-shadow: 0 0 0 3px rgba(108,71,255,0.12);
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp) { setError("Please enter the OTP"); return; }
    if (otp.length !== 6 || isNaN(otp)) { setError("OTP must be 6 digits"); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`,
        { method: "POST" }
      );
      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError(data.detail || "Invalid OTP. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2 style={{ ...styles.title, color: "#c0392b" }}>Invalid Access</h2>
          <p style={styles.sub}>Please sign up again to receive a verification code.</p>
          <button onClick={() => navigate("/signup")} style={styles.btn}>Go to Signup</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.title}>Email Verified!</h2>
          <p style={styles.sub}>Your account is ready. Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={styles.heroBadge}>Email Verification</div>
          <h1 style={styles.heroTitle}>One last step</h1>
          <p style={styles.heroSub}>
            We sent a 6-digit verification code to your email. Enter it to activate your account.
          </p>
          <div style={styles.infoBox}>
            <div style={styles.infoRow}>
              <span style={styles.infoIcon}>📧</span>
              <div>
                <div style={styles.infoTitle}>Check your inbox</div>
                <div style={styles.infoDesc}>Look for an email from ConfidenceAI</div>
              </div>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoIcon}>🔒</span>
              <div>
                <div style={styles.infoTitle}>Secure your account</div>
                <div style={styles.infoDesc}>Code expires in 10 minutes</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.formSide}>
        <div style={styles.card}>
          <div style={styles.formLogo}>
            <div style={styles.formLogoIcon}>CA</div>
            <span style={styles.formLogoText}>ConfidenceAI</span>
          </div>

          <h2 style={styles.title}>Verify your email</h2>
          <p style={styles.sub}>Enter the code sent to:</p>
          <div style={styles.emailBadge}>{email}</div>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠️ {error}</span>
              <button onClick={() => setError("")} style={styles.errorClose}>✕</button>
            </div>
          )}

          <form onSubmit={handleVerify} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Verification code</label>
              <input
                type="text"
                className="otp-input"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={styles.otpInput}
                disabled={loading}
                maxLength="6"
              />
            </div>
            <button
              type="submit"
              style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? "Verifying…" : "Verify Code"}
            </button>
          </form>

          <p style={styles.helpText}>
            Didn't receive a code? Check your spam folder.
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
    maxWidth: "420px",
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
    fontSize: "clamp(26px, 4vw, 36px)",
    fontWeight: "800",
    color: "#fff",
    lineHeight: "1.2",
    margin: "0 0 14px 0",
    letterSpacing: "-0.4px",
  },
  heroSub: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.8)",
    lineHeight: "1.7",
    margin: "0 0 32px 0",
  },
  infoBox: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  infoRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "10px",
    padding: "14px 16px",
  },
  infoIcon: { fontSize: "20px", marginTop: "1px" },
  infoTitle: { fontSize: "13px", fontWeight: "700", color: "#fff", marginBottom: "2px" },
  infoDesc: { fontSize: "11.5px", color: "rgba(255,255,255,0.65)" },
  formSide: {
    width: "420px",
    minWidth: "380px",
    background: "#f7f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 32px",
  },
  card: {
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
  formLogoText: { fontSize: "15px", fontWeight: "700", color: "#1a1a2e" },
  title: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#1a1a2e",
    margin: "0 0 6px 0",
    letterSpacing: "-0.3px",
  },
  sub: { fontSize: "13px", color: "#888", margin: "0 0 12px 0" },
  emailBadge: {
    display: "inline-block",
    background: "rgba(108,71,255,0.08)",
    border: "1px solid rgba(108,71,255,0.2)",
    color: "#6c47ff",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "600",
    marginBottom: "22px",
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
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  otpInput: {
    padding: "14px",
    border: "1.5px solid #e0e0e0",
    borderRadius: "9px",
    fontSize: "22px",
    fontFamily: "'Courier New', monospace",
    textAlign: "center",
    letterSpacing: "10px",
    color: "#1a1a2e",
    background: "#fff",
    transition: "all 0.2s ease",
  },
  btn: {
    padding: "12px",
    background: "linear-gradient(135deg, #6c47ff, #4f8ef7)",
    color: "#fff",
    border: "none",
    borderRadius: "9px",
    fontSize: "14.5px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
    width: "100%",
  },
  helpText: { textAlign: "center", fontSize: "12px", color: "#aaa", marginTop: "16px" },
  successIcon: {
    fontSize: "48px",
    color: "#27ae60",
    textAlign: "center",
    marginBottom: "12px",
  },
};

export default VerifyOTP;
