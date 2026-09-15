import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Navbar.css";
import { useUserProfile } from "../hooks/useUserProfile";
import { UserOnboardingModal } from "./UserOnboardingModal";

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
    to: "/live",
    label: "Live Call",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" />
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
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
  const { profile } = useUserProfile();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const displayName = profile?.name || (user ? user.split('@')[0] : null);

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
            <div className="navbar-avatar" style={profile?.name ? { background: 'linear-gradient(135deg, #7c5cfc, #5b8def)' } : {}}>
              {profile?.name ? profile.name.charAt(0).toUpperCase() : userInitial}
            </div>
            <div className="navbar-user-info">
              <span className="navbar-user-name" title={displayName}>
                {displayName && displayName.length > 16 ? displayName.slice(0, 14) + "…" : (displayName || user)}
              </span>
              <span className="navbar-user-role">
                {profile?.goal === 'interview'  ? '💼 Interview Prep'
                : profile?.goal === 'speaking'  ? '🎤 Public Speaking'
                : profile?.goal === 'leadership'? '🚀 Leadership'
                : profile?.goal === 'casual'    ? '💬 Free Chat'
                : 'Member'}
              </span>
            </div>
            {/* Edit profile button */}
            <button
              className="navbar-edit-profile-btn"
              onClick={() => setShowEditProfile(true)}
              title="Edit Profile"
            >
              ✏️
            </button>
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

      {/* Edit profile modal */}
      {showEditProfile && (
        <UserOnboardingModal onComplete={() => setShowEditProfile(false)} />
      )}
    </aside>
  );
}

export default Navbar;
