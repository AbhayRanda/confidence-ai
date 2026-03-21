import { Link } from "react-router-dom";

function Navbar() {
  return (
    <div style={styles.nav}>
      <h2 style={{ margin: 0 }}>Confidence AI</h2>

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
  },
  links: {
    display: "flex",
    gap: "20px",
  },
  link: {
    textDecoration: "none",
    color: "white",
    fontWeight: "500",
  },
};

export default Navbar;