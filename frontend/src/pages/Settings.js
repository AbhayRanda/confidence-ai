import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Palette,
  HardDrive,
  Shield,
  Trash2,
  Save,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { apiJSON, apiFetch } from "../utils/api";
import ConfirmModal from "../components/ConfirmModal";
import "./Settings.css";

const GOAL_OPTIONS = [
  "Ace Upcoming Job Interviews",
  "Deliver Confident Executive Presentations",
  "Improve Everyday Conversations & Social Ease",
  "Overcome Public Speaking Anxiety & Stage Fright",
  "Master Active Listening & Warm Body Language",
];

const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"];

const WEAKNESS_OPTIONS = [
  "Lack of steady eye contact",
  "Excessive filler words (um, uh, like)",
  "Slouched or rigid posture",
  "Speaking too fast or breathlessly",
  "Monotone or nervous vocal pitch",
  "Fidgeting hands or frozen posture",
  "Difficulty structuring quick answers",
];

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, themes } = useTheme();

  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  // Profile Form state
  const [profile, setProfile] = useState({
    name: "",
    profession: "",
    industry: "",
    goal: GOAL_OPTIONS[0],
    experienceLevel: "Intermediate",
    weaknesses: [],
    email: "",
    memberSince: null,
    totalSessions: 0,
  });

  // Storage state
  const [storage, setStorage] = useState({
    used_mb: 0,
    limit_mb: 500,
    percentage: 0,
    available_mb: 500,
  });

  // Danger zone modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [profRes, dashRes] = await Promise.all([
          apiJSON("/profile"),
          apiJSON("/dashboard?limit=1"),
        ]);

        if (profRes.ok && profRes.data) {
          setProfile((prev) => ({
            ...prev,
            ...profRes.data,
            weaknesses: Array.isArray(profRes.data.weaknesses) ? profRes.data.weaknesses : [],
          }));
        }

        // Compute approximate storage if user has sessions
        if (dashRes.ok && Array.isArray(dashRes.data)) {
          const count = profRes.data?.totalSessions || dashRes.data.length;
          const estimatedMb = Math.round(count * 6.5 * 10) / 10;
          setStorage({
            used_mb: estimatedMb,
            limit_mb: 500,
            percentage: Math.min(100, Math.round((estimatedMb / 500) * 100)),
            available_mb: Math.max(0, 500 - estimatedMb),
          });
        }
      } catch (err) {
        console.error("Failed to load settings data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleWeaknessToggle = (item) => {
    setProfile((prev) => {
      const exists = prev.weaknesses.includes(item);
      const updated = exists
        ? prev.weaknesses.filter((w) => w !== item)
        : [...prev.weaknesses, item];
      return { ...prev, weaknesses: updated };
    });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg({ type: "", text: "" });

    try {
      const res = await apiJSON("/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: profile.name,
          profession: profile.profession,
          industry: profile.industry,
          goal: profile.goal,
          experienceLevel: profile.experienceLevel,
          weaknesses: profile.weaknesses,
        }),
      });

      if (res.ok) {
        setStatusMsg({ type: "success", text: "Settings saved successfully!" });
        // Update local cached profile
        localStorage.setItem(
          "userProfile",
          JSON.stringify({
            name: profile.name,
            profession: profile.profession,
            industry: profile.industry,
            goal: profile.goal,
            experienceLevel: profile.experienceLevel,
            weaknesses: profile.weaknesses,
          })
        );
      } else {
        setStatusMsg({ type: "error", text: res.data?.detail || "Failed to update profile." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch("/account", { method: "DELETE" });
      if (res.ok) {
        localStorage.clear();
        navigate("/signup");
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete account");
      }
    } catch {
      alert("Error contacting server. Please try again.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        {/* Header */}
        <div className="settings-header animate-fadeUp">
          <div className="settings-badge">
            <Sparkles size={14} /> Personalization
          </div>
          <h1 className="settings-title">Account & Preferences</h1>
          <p className="settings-subtitle">
            Configure your AI coaching persona, interface theme, and privacy settings.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="settings-nav-tabs animate-fadeUp">
          <button
            type="button"
            className={`settings-tab ${activeTab === "profile" ? "settings-tab--active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={16} /> Profile & Focus
          </button>
          <button
            type="button"
            className={`settings-tab ${activeTab === "appearance" ? "settings-tab--active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >
            <Palette size={16} /> Appearance & Theme
          </button>
          <button
            type="button"
            className={`settings-tab ${activeTab === "storage" ? "settings-tab--active" : ""}`}
            onClick={() => setActiveTab("storage")}
          >
            <HardDrive size={16} /> Storage Quota
          </button>
          <button
            type="button"
            className={`settings-tab ${activeTab === "security" ? "settings-tab--active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            <Shield size={16} /> Security & Privacy
          </button>
        </div>

        {/* Status Alerts */}
        {loading && (
          <div className="settings-alert animate-fadeUp" style={{ background: "rgba(124, 92, 252, 0.12)", color: "#c4b5fd" }}>
            <span>Loading preferences…</span>
          </div>
        )}
        {statusMsg.text && (
          <div className={`settings-alert settings-alert--${statusMsg.type} animate-fadeUp`}>
            {statusMsg.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tab 1: Profile & Focus */}
        {activeTab === "profile" && (
          <form onSubmit={handleSaveProfile} className="settings-card animate-fadeUp">
            <h2 className="settings-card-title">Professional Persona</h2>
            <p className="settings-card-desc">
              The AI personality coach tailors interview questions and mock scenarios to your target industry.
            </p>

            <div className="settings-grid-2">
              <div className="settings-field">
                <label className="settings-label">Full Name</label>
                <input
                  type="text"
                  className="settings-input"
                  value={profile.name || ""}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="e.g. Alex Johnson"
                />
              </div>

              <div className="settings-field">
                <label className="settings-label">Registered Email</label>
                <input
                  type="email"
                  className="settings-input"
                  value={profile.email || localStorage.getItem("user") || ""}
                  disabled
                  title="Email cannot be changed directly."
                />
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="settings-field">
                <label className="settings-label">Current Role / Profession</label>
                <input
                  type="text"
                  className="settings-input"
                  value={profile.profession || ""}
                  onChange={(e) => setProfile({ ...profile, profession: e.target.value })}
                  placeholder="e.g. Senior Software Engineer / Product Manager"
                />
              </div>

              <div className="settings-field">
                <label className="settings-label">Industry Domain</label>
                <input
                  type="text"
                  className="settings-input"
                  value={profile.industry || ""}
                  onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                  placeholder="e.g. Technology, Healthcare, Finance"
                />
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-label">Primary Communication Goal</label>
              <select
                className="settings-select"
                value={profile.goal || GOAL_OPTIONS[0]}
                onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
              >
                {GOAL_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label">Experience Level</label>
              <div className="settings-radio-group">
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <label
                    key={lvl}
                    className={`settings-radio-card ${profile.experienceLevel === lvl ? "settings-radio-card--active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="experienceLevel"
                      value={lvl}
                      checked={profile.experienceLevel === lvl}
                      onChange={() => setProfile({ ...profile, experienceLevel: lvl })}
                    />
                    <span>{lvl}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-label">Priority Growth Areas (Select all that apply)</label>
              <div className="settings-chips-grid">
                {WEAKNESS_OPTIONS.map((w) => {
                  const selected = profile.weaknesses.includes(w);
                  return (
                    <button
                      key={w}
                      type="button"
                      className={`settings-chip ${selected ? "settings-chip--selected" : ""}`}
                      onClick={() => handleWeaknessToggle(w)}
                    >
                      {selected && <CheckCircle size={14} />}
                      <span>{w}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="settings-card-footer">
              <button type="submit" className="settings-btn settings-btn--primary" disabled={saving}>
                <Save size={16} /> {saving ? "Saving..." : "Save Profile Changes"}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Appearance & Theme */}
        {activeTab === "appearance" && (
          <div className="settings-card animate-fadeUp">
            <h2 className="settings-card-title">Studio Interface Theme</h2>
            <p className="settings-card-desc">
              Choose your preferred high-contrast color palette. All components adapt dynamically.
            </p>

            <div className="settings-themes-grid">
              {themes.map((t) => {
                const isCurrent = theme === t.id;
                return (
                  <div
                    key={t.id}
                    className={`settings-theme-card ${isCurrent ? "settings-theme-card--active" : ""}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <div className="settings-theme-header">
                      <span className="settings-theme-icon">{t.icon}</span>
                      <span className="settings-theme-name">{t.name}</span>
                      {isCurrent && <span className="settings-theme-badge">Active</span>}
                    </div>
                    <p className="settings-theme-tagline">{t.tagline}</p>
                    <div className="settings-theme-swatches">
                      <div className="settings-swatch" style={{ background: t.accent }} title="Accent" />
                      <div className="settings-swatch" style={{ background: t.secondary }} title="Secondary" />
                      <div className="settings-swatch" style={{ background: t.bgBase }} title="Background" />
                      <div className="settings-swatch" style={{ background: t.bgCard }} title="Card Surface" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Storage */}
        {activeTab === "storage" && (
          <div className="settings-card animate-fadeUp">
            <h2 className="settings-card-title">Video Storage & Recordings</h2>
            <p className="settings-card-desc">
              Each user account includes 500 MB of encrypted private video storage on our high-speed media cluster.
            </p>

            <div className="settings-storage-meter-box">
              <div className="settings-storage-labels">
                <span className="settings-storage-used">{storage.used_mb} MB used</span>
                <span className="settings-storage-total">{storage.limit_mb} MB limit</span>
              </div>
              <div className="settings-progress-track">
                <div
                  className="settings-progress-fill"
                  style={{
                    width: `${storage.percentage}%`,
                    background: storage.percentage > 85 ? "#ef4444" : "var(--accent, #7c5cfc)",
                  }}
                />
              </div>
              <p className="settings-storage-hint">
                {storage.available_mb} MB remaining. Old sessions can be safely removed anytime from the session analytics page.
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Security & Danger Zone */}
        {activeTab === "security" && (
          <div className="settings-card animate-fadeUp">
            <h2 className="settings-card-title">Session & Privacy Management</h2>
            <p className="settings-card-desc">
              Your biometric data is encrypted. You have absolute ownership of your personal recordings.
            </p>

            <div className="settings-field-group">
              <div className="settings-security-row">
                <div>
                  <h3 className="settings-sec-title">Authentication Token</h3>
                  <p className="settings-sec-desc">Active 7-day HMAC-SHA256 authenticated session.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("token");
                    navigate("/login");
                  }}
                  className="settings-btn settings-btn--secondary"
                >
                  Sign Out This Device
                </button>
              </div>

              <div className="settings-security-row">
                <div>
                  <h3 className="settings-sec-title">Local Cache</h3>
                  <p className="settings-sec-desc">Clear cached avatar textures and session drafts.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("userProfile");
                    localStorage.removeItem("avatar");
                    setStatusMsg({ type: "success", text: "Local storage cache cleared." });
                  }}
                  className="settings-btn settings-btn--secondary"
                >
                  Clear Cache
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="settings-danger-zone">
              <div className="settings-danger-header">
                <h3 className="settings-danger-title">Danger Zone</h3>
                <p className="settings-danger-desc">
                  Permanently delete your account, practice recordings, biometric history, and AI coaching notes.
                  This action is irreversible.
                </p>
              </div>
              <button
                type="button"
                className="settings-btn settings-btn--danger"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 size={16} /> Delete Account & All Data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Permanently Delete Account?"
        message="This will instantly erase your entire profile, all video recordings, transcripts, and longitudinal score history. This action cannot be undone."
        confirmText="Yes, Permanently Delete"
        cancelText="Cancel"
        danger={true}
        loading={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
