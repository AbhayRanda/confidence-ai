import { Link } from "react-router-dom";

function Navbar() {
  return (
    <div style={styles.nav}>
      <div style={styles.brand}>
        <h2 style={styles.logo}>🎯 Confidence AI</h2>
        <p style={styles.tagline}>Master Your Presence</p>
      </div>

      <div style={styles.links}>
        <Link to="/dashboard" style={styles.link}>Dashboard</Link>
        <Link to="/ai" style={styles.link}>AI Trainer</Link>
        <Link to="/resources" style={styles.link}>Resources</Link>
      </div>
    </div>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 30px",
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(0, 245, 255, 0.1)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logo: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  tagline: {
    margin: 0,
    fontSize: "11px",
    opacity: 0.6,
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  links: {
    display: "flex",
    gap: "20px",
  },
  link: {
    textDecoration: "none",
    color: "white",
    fontWeight: "500",
    transition: "all 0.3s ease",
    fontSize: "14px",
  },
};

export default Navbar;