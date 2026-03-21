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

  // Inject keyframe animations
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!otp) {
      setError("Please enter the OTP");
      return;
    }

    if (otp.length !== 6 || isNaN(otp)) {
      setError("OTP must be 6 digits");
      return;
    }

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
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(data.detail || "Invalid OTP. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h2 style={styles.errorTitle}>⚠️ Invalid Access</h2>
          <p style={styles.errorText}>Please sign up again to receive a verification code.</p>
          <button
            onClick={() => navigate("/signup")}
            style={styles.button}
          >
            Go to Signup
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.successTitle}>Email Verified!</h1>
          <p style={styles.successText}>Your account is ready. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Verify Your Email</h1>
        <p style={styles.subtitle}>Enter the code sent to your email</p>

        {/* Email Display */}
        <div style={styles.emailBox}>
          <p style={styles.emailLabel}>Verification code sent to:</p>
          <p style={styles.emailAddress}>{email}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={styles.errorMessage}>
            ⚠️ {error}
            <button
              onClick={() => setError("")}
              style={styles.closeButton}
            >
              ✕
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleVerify} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>OTP Code</label>
            <input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={styles.input}
              disabled={loading}
              maxLength="6"
            />
          </div>

          <button
            type="submit"
            style={styles.button}
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        {/* Help Text */}
        <div style={styles.helpText}>
          <p>Didn't receive a code? Check your spam folder.</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "20px",
    background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    width: "100%",
    maxWidth: "420px",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    padding: "40px",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
    color: "white",
    animation: "fadeIn 0.5s ease",
  },
  title: {
    fontSize: "32px",
    fontWeight: "700",
    margin: "0 0 8px 0",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "14px",
    opacity: 0.7,
    margin: "0 0 20px 0",
    fontWeight: "500",
  },
  emailBox: {
    background: "rgba(0, 245, 255, 0.12)",
    border: "1px solid rgba(0, 245, 255, 0.3)",
    padding: "16px",
    borderRadius: "10px",
    textAlign: "center",
    animation: "slideDown 0.4s ease",
  },
  emailLabel: {
    fontSize: "12px",
    opacity: 0.8,
    margin: "0 0 8px 0",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  emailAddress: {
    fontSize: "16px",
    fontWeight: "700",
    margin: "0",
    color: "#00f5ff",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    opacity: 0.9,
  },
  input: {
    padding: "16px",
    borderRadius: "10px",
    border: "2px solid rgba(0, 245, 255, 0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontSize: "20px",
    fontFamily: "'Courier New', monospace",
    textAlign: "center",
    letterSpacing: "8px",
    transition: "all 0.3s ease",
  },
  button: {
    padding: "14px 24px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    color: "#000",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 4px 15px rgba(0, 245, 255, 0.3)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginTop: "8px",
  },
  errorMessage: {
    background: "rgba(255, 77, 77, 0.15)",
    border: "1px solid rgba(255, 77, 77, 0.5)",
    color: "#ff9999",
    padding: "14px 16px",
    borderRadius: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backdropFilter: "blur(10px)",
    animation: "slideDown 0.3s ease",
    fontSize: "14px",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "#ff9999",
    cursor: "pointer",
    fontSize: "18px",
    fontWeight: "bold",
    padding: "0 8px",
    transition: "all 0.2s ease",
  },
  helpText: {
    textAlign: "center",
    fontSize: "12px",
    opacity: 0.6,
    marginTop: "8px",
  },
  errorContainer: {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    padding: "40px",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.12)",
    textAlign: "center",
    maxWidth: "420px",
    animation: "fadeIn 0.5s ease",
  },
  errorTitle: {
    fontSize: "24px",
    fontWeight: "700",
    margin: "0 0 16px 0",
    color: "#ff9999",
  },
  errorText: {
    fontSize: "14px",
    opacity: 0.8,
    marginBottom: "24px",
  },
  successIcon: {
    fontSize: "60px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #00ff99, #00f5ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    animation: "fadeIn 0.5s ease",
  },
  successTitle: {
    fontSize: "32px",
    fontWeight: "700",
    margin: "16px 0 8px 0",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  successText: {
    fontSize: "14px",
    opacity: 0.7,
    animation: "pulse 1.5s ease-in-out infinite",
  },
};

export default VerifyOTP;
