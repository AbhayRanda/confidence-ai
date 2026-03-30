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
      {/* Hero Section */}
      <div style={styles.heroSection}>
        <div style={styles.heroContent}>
          <div style={styles.purposeBadge}>🚀 AI-Powered Confidence Analysis Platform</div>
          <h1 style={styles.heroTitle}>Master Your Confidence with AI</h1>
          <p style={styles.heroTagline}>
            Unlock your potential through intelligent video and speech analysis
          </p>
          <p style={styles.heroDescription}>
            Track eye contact, posture, and speech patterns in real-time. Get personalized 
            insights backed by AI to build unshakeable confidence.
          </p>
          <div style={styles.purposeHighlights}>
            <span style={styles.highlight}>✓ Real-time Video Analysis</span>
            <span style={styles.highlight}>✓ Speech Pattern Tracking</span>
            <span style={styles.highlight}>✓ Personalized Feedback</span>
          </div>
        </div>
      </div>

      {/* Features Preview */}
      <div style={styles.featuresSection}>
        <div style={styles.sectionLabel}>Core Features</div>
        <div style={styles.featureGrid}>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📹</div>
            <h3 style={styles.featureTitle}>Video Analysis</h3>
            <p style={styles.featureText}>Monitor facial expressions, eye contact, and body language</p>
            <span style={styles.badge}>Real-time Detection</span>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🎤</div>
            <h3 style={styles.featureTitle}>Speech Analytics</h3>
            <p style={styles.featureText}>Analyze speech rate, filler words, and presentation quality</p>
            <span style={styles.badge}>Pattern Recognition</span>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📊</div>
            <h3 style={styles.featureTitle}>Smart Insights</h3>
            <p style={styles.featureText}>Receive actionable feedback and improvement suggestions</p>
            <span style={styles.badge}>AI-Generated</span>
          </div>
        </div>
      </div>

      {/* Login Container */}
      <div style={styles.container}>
        <h2 style={styles.title}>Get Started</h2>
        <p style={styles.subtitle}>Sign in to access your personalized dashboard</p>

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
            Don't have an account? <Link to="/signup" style={styles.link}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "0",
    background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
  },
  heroSection: {
    minHeight: "50vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    textAlign: "center",
    color: "white",
  },
  heroContent: {
    maxWidth: "700px",
    animation: "fadeIn 0.8s ease",
  },
  heroTitle: {
    fontSize: "56px",
    fontWeight: "800",
    margin: "0 0 16px 0",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    letterSpacing: "-1px",
    lineHeight: "1.2",
  },
  heroTagline: {
    fontSize: "24px",
    fontWeight: "600",
    margin: "0 0 20px 0",
    color: "#e0f7fa",
    letterSpacing: "0.5px",
  },
  heroDescription: {
    fontSize: "16px",
    opacity: 0.85,
    margin: "0",
    lineHeight: "1.8",
    maxWidth: "600px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  featuresSection: {
    padding: "40px 20px",
    background: "rgba(0, 0, 0, 0.2)",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
    maxWidth: "1000px",
    margin: "0 auto",
  },
  featureCard: {
    background: "rgba(255, 255, 255, 0.06)",
    backdropFilter: "blur(10px)",
    padding: "30px 24px",
    borderRadius: "15px",
    border: "1px solid rgba(0, 245, 255, 0.1)",
    color: "white",
    textAlign: "center",
    transition: "all 0.3s ease",
    cursor: "pointer",
    ":hover": {
      transform: "translateY(-5px)",
      boxShadow: "0 12px 24px rgba(0, 245, 255, 0.1)",
    },
  },
  featureIcon: {
    fontSize: "40px",
    marginBottom: "12px",
  },
  featureTitle: {
    fontSize: "18px",
    fontWeight: "700",
    margin: "0 0 8px 0",
    color: "#00f5ff",
  },
  featureText: {
    fontSize: "14px",
    opacity: 0.75,
    margin: "0",
    lineHeight: "1.6",
  },
  purposeBadge: {
    display: "inline-block",
    background: "rgba(0, 245, 255, 0.15)",
    border: "1px solid rgba(0, 245, 255, 0.4)",
    color: "#00f5ff",
    padding: "8px 16px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    marginBottom: "24px",
    textTransform: "uppercase",
  },
  purposeHighlights: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "24px",
    padding: "16px",
    background: "rgba(0, 245, 255, 0.08)",
    borderRadius: "12px",
    border: "1px solid rgba(0, 245, 255, 0.1)",
  },
  highlight: {
    fontSize: "14px",
    color: "#e0f7fa",
    fontWeight: "500",
  },
  sectionLabel: {
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#00f5ff",
    textAlign: "center",
    marginBottom: "40px",
  },
  badge: {
    display: "inline-block",
    background: "rgba(0, 245, 255, 0.1)",
    color: "#00f5ff",
    padding: "4px 12px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.5px",
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
    margin: "40px auto",
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
