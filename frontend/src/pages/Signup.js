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
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const validateForm = () => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return false;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email");
      return false;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

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
        setTimeout(() => {
          navigate("/verify", { state: { email } });
        }, 2000);
      } else {
        setError(data.detail || "Signup failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (otp) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.title}>Account Created! ✓</h1>
          <div style={styles.otpBox}>
            <p style={styles.otpLabel}>Your verification code:</p>
            <p style={styles.otpCode}>{otp}</p>
            <p style={styles.otpInfo}>Redirecting to verification page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={styles.title}>Join Confidence AI</h2>
        <p style={styles.subtitle}>Start analyzing and improving your confidence today</p>

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
        <form onSubmit={handleSignup} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
            <p style={styles.hint}>At least 6 characters</p>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            style={styles.button}
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {/* Sign In Link */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Already have an account? <Link to="/login" style={styles.link}>Sign in</Link>
          </p>
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
    fontSize: "28px",
    fontWeight: "700",
    margin: "0 0 8px 0",
    color: "#fff",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "14px",
    opacity: 0.7,
    margin: "0 0 20px 0",
    fontWeight: "500",
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
  hint: {
    fontSize: "12px",
    opacity: 0.6,
    margin: "0",
    marginTop: "-4px",
  },
  input: {
    padding: "14px 16px",
    borderRadius: "10px",
    border: "2px solid rgba(0, 245, 255, 0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontSize: "15px",
    fontFamily: "inherit",
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
  otpBox: {
    background: "rgba(0, 245, 255, 0.15)",
    border: "2px solid rgba(0, 245, 255, 0.4)",
    padding: "24px",
    borderRadius: "12px",
    textAlign: "center",
    animation: "slideDown 0.5s ease",
  },
  otpLabel: {
    fontSize: "14px",
    opacity: 0.8,
    margin: "0 0 12px 0",
  },
  otpCode: {
    fontSize: "28px",
    fontWeight: "700",
    fontFamily: "'Courier New', monospace",
    color: "#00f5ff",
    margin: "12px 0",
    letterSpacing: "4px",
  },
  otpInfo: {
    fontSize: "12px",
    opacity: 0.7,
    margin: "12px 0 0 0",
  },
  footer: {
    textAlign: "center",
    marginTop: "12px",
  },
  footerText: {
    fontSize: "14px",
    margin: 0,
    opacity: 0.9,
  },
  link: {
    color: "#00f5ff",
    textDecoration: "none",
    fontWeight: "700",
    transition: "all 0.3s ease",
    cursor: "pointer",
  },
};

export default Signup;
