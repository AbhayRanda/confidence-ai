import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

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
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Sign In</h1>
        <p style={styles.subtitle}>Access your AI Confidence Dashboard</p>

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
        <form onSubmit={handleLogin} style={styles.form}>
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
          </div>

          <button
            type="submit"
            style={styles.button}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Sign Up Link */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Don't have an account? <Link to="/signup" style={styles.link}>Sign up</Link>
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

export default Login;
