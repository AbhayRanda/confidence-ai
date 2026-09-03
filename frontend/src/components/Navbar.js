import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Navbar.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    to: "/ai",
    label: "Practice",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
    ),
  },
  {
    to: "/resources",
    label: "Resources",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
];

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = localStorage.getItem("user");
  const userInitial = user ? user.charAt(0).toUpperCase() : "U";

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await fetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
        });
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <aside className="navbar">
      {/* Brand */}
      <div className="navbar-brand">
        <div className="navbar-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L22 8.5v7L12 22 2 15.5v-7L12 2Z" fill="url(#logoGrad)" />
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c5cfc"/>
                <stop offset="100%" stopColor="#5b8def"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="navbar-brand-name">ConfidenceAI</span>
      </div>

      {/* Nav label */}
      <div className="navbar-section-label">NAVIGATION</div>

      {/* Nav links */}
      <nav className="navbar-nav">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`navbar-item${active ? " navbar-item--active" : ""}`}
            >
              <span className="navbar-item-icon">{item.icon}</span>
              <span className="navbar-item-label">{item.label}</span>
              {active && <span className="navbar-item-indicator" />}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="navbar-spacer" />

      {/* User section */}
      <div className="navbar-footer">
        {user && (
          <div className="navbar-user">
            <div className="navbar-avatar">{userInitial}</div>
            <div className="navbar-user-info">
              <span className="navbar-user-name" title={user}>
                {user.length > 16 ? user.slice(0, 14) + "…" : user}
              </span>
              <span className="navbar-user-role">Member</span>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="navbar-logout">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default Navbar;
