import { Link, useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "⊞" },
  { to: "/ai", label: "Practice", icon: "◉" },
  { to: "/resources", label: "Resources", icon: "☰" },
];

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = localStorage.getItem("user");

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("user_id");
    navigate("/login");
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.brandIcon}>
          <span style={styles.brandIconText}>CA</span>
        </div>
        <span style={styles.brandName}>ConfidenceAI</span>
      </div>

      <nav style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span style={styles.navLabel}>{item.label}</span>
              {active && <div style={styles.activeBar} />}
            </Link>
          );
        })}
      </nav>

      <div style={styles.bottom}>
        {user && (
          <div style={styles.userRow}>
            <div style={styles.avatar}>
              {user.charAt(0).toUpperCase()}
            </div>
            <span style={styles.userEmail} title={user}>
              {user.length > 16 ? user.slice(0, 14) + "…" : user}
            </span>
          </div>
        )}
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "200px",
    minWidth: "200px",
    height: "100vh",
    background: "#fff",
    borderRight: "1px solid #ebebeb",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    fontFamily: "'Segoe UI', sans-serif",
    zIndex: 100,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "22px 20px 18px",
    borderBottom: "1px solid #f0f0f0",
  },
  brandIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #6c47ff, #4f8ef7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  brandIconText: {
    color: "#fff",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.5px",
  },
  brandName: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#1a1a2e",
    letterSpacing: "-0.2px",
  },
  nav: {
    flex: 1,
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "9px 10px",
    borderRadius: "8px",
    textDecoration: "none",
    color: "#666",
    fontSize: "13.5px",
    fontWeight: "500",
    transition: "all 0.15s ease",
    position: "relative",
    cursor: "pointer",
  },
  navItemActive: {
    background: "rgba(108, 71, 255, 0.09)",
    color: "#6c47ff",
  },
  navIcon: {
    fontSize: "15px",
    width: "18px",
    textAlign: "center",
  },
  navLabel: {
    flex: 1,
  },
  activeBar: {
    width: "3px",
    height: "100%",
    background: "#6c47ff",
    borderRadius: "2px",
    position: "absolute",
    right: 0,
    top: 0,
  },
  bottom: {
    padding: "14px 14px 20px",
    borderTop: "1px solid #f0f0f0",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  avatar: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6c47ff, #4f8ef7)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  },
  userEmail: {
    fontSize: "11.5px",
    color: "#888",
    overflow: "hidden",
  },
  logoutBtn: {
    width: "100%",
    padding: "8px",
    background: "#fff1f0",
    color: "#d4290d",
    border: "1px solid #ffd8d4",
    borderRadius: "8px",
    fontSize: "12.5px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
};

export default Navbar;
