import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale,
  CategoryScale, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "./Dashboard.css";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const AUTO_REFRESH_INTERVAL = 5000;

function ScoreRing({ score, size = 80, strokeWidth = 7 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease, stroke 0.3s ease" }}
      />
    </svg>
  );
}

function StatCard({ label, value, color, icon, delay = 0 }) {
  return (
    <div className="dash-stat-card animate-fadeUp" style={{ animationDelay: `${delay}s` }}>
      <div className="dash-stat-icon" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="dash-stat-val" style={{ color }}>{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [dataPoints, setDataPoints] = useState([]);
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const refreshIntervalRef = useRef(null);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError(null);
    const userId = localStorage.getItem("user_id");
    fetch(`${API_BASE_URL}/dashboard`, { headers: { "X-User-ID": userId || "" } })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        setDataPoints(Array.isArray(data) ? [...data].reverse() : []);
        setLastUpdate(new Date().toLocaleTimeString());
        setLoading(false);
      })
      .catch(() => { setError("Failed to load dashboard."); setLoading(false); });
  }, []);

  const fetchStorage = useCallback(() => {
    const userId = localStorage.getItem("user_id");
    fetch(`${API_BASE_URL}/storage`, { headers: { "X-User-ID": userId || "" } })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setStorageInfo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchStorage();
    refreshIntervalRef.current = setInterval(() => {
      fetchDashboard();
      fetchStorage();
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(refreshIntervalRef.current);
  }, [fetchDashboard, fetchStorage]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this session?")) return;
    const userId = localStorage.getItem("user_id");
    try {
      const res = await fetch(`${API_BASE_URL}/delete/${id}`, {
        method: "DELETE",
        headers: { "X-User-ID": userId || "" },
      });
      if (!res.ok) throw new Error();
      fetchDashboard();
    } catch { setError("Failed to delete session."); }
  };

  const latest  = dataPoints[dataPoints.length - 1];
  const average = dataPoints.length > 0
    ? (dataPoints.reduce((s, d) => s + d.confidence_score, 0) / dataPoints.length).toFixed(1)
    : "—";
  const best = dataPoints.length > 0
    ? Math.max(...dataPoints.map((d) => d.confidence_score)).toFixed(1)
    : "—";

  const chartData = {
    labels: dataPoints.map((d) => new Date(d.created_at).toLocaleDateString()),
    datasets: [{
      label: "Confidence Score",
      data: dataPoints.map((d) => d.confidence_score),
      borderColor: "#7c5cfc",
      backgroundColor: "rgba(124,92,252,0.1)",
      tension: 0.45,
      fill: true,
      pointBackgroundColor: "#7c5cfc",
      pointBorderColor: "#1a1f35",
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 8,
      pointHoverBackgroundColor: "#a78bfa",
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0e1220",
        titleColor: "#f0f2ff",
        bodyColor: "#8b92b5",
        padding: 12,
        cornerRadius: 10,
        borderColor: "rgba(124,92,252,0.3)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#50587a", font: { size: 11, family: "Inter" } },
        border: { color: "transparent" },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: { color: "#50587a", font: { size: 11, family: "Inter" } },
        border: { color: "transparent" },
        min: 0,
        max: 100,
      },
    },
  };

  const levelColor = (lvl) =>
    lvl === "High" ? "#22c55e" : lvl === "Medium" ? "#f59e0b" : "#ef4444";

  return (
    <div className="dash-page">
      {/* Header */}
      <div className="dash-header animate-fadeUp">
        <div>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-subtitle">Welcome back — here's your progress overview</p>
        </div>
        <div className="dash-header-right">
          {lastUpdate && <span className="dash-update-label">Updated {lastUpdate}</span>}
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className={`dash-refresh-btn${loading ? " dash-refresh-btn--loading" : ""}`}
            id="refresh-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="dash-error animate-fadeUp">
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Storage bar */}
      {storageInfo && (
        <div className="dash-storage animate-fadeUp">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          <span className="dash-storage-label">Storage</span>
          <div className="dash-storage-track">
            <div
              className="dash-storage-fill"
              style={{
                width: `${Math.min(storageInfo.percentage, 100)}%`,
                background: storageInfo.percentage >= 90
                  ? "#ef4444"
                  : storageInfo.percentage >= 70
                  ? "#f59e0b"
                  : "var(--accent-gradient)",
              }}
            />
          </div>
          <span className="dash-storage-text">
            {storageInfo.used_mb} / {storageInfo.limit_mb} MB
          </span>
        </div>
      )}

      {/* Hero banner */}
      {latest && (
        <div className="dash-hero-banner animate-fadeUp">
          <div className="dash-hero-left">
            <div className="dash-hero-ring-wrap">
              <ScoreRing score={latest.confidence_score} size={90} strokeWidth={8} />
              <div className="dash-hero-ring-text">
                <div className="dash-hero-score">{Number(latest.confidence_score).toFixed(0)}</div>
                <div className="dash-hero-score-sub">/100</div>
              </div>
            </div>
            <div>
              <div className="dash-hero-score-label">Confidence Score</div>
              <span
                className="dash-hero-level"
                style={{
                  background: `${levelColor(latest.confidence_level)}20`,
                  color: levelColor(latest.confidence_level),
                  borderColor: `${levelColor(latest.confidence_level)}40`,
                }}
              >
                {latest.confidence_level}
              </span>
            </div>
          </div>
          <div className="dash-hero-metrics">
            {[
              { label: "Posture", val: latest.posture_percentage },
              { label: "Voice", val: latest.speech_score * 10 },
              { label: "Eye Contact", val: latest.eye_contact_percentage },
              { label: "Confidence", val: latest.confidence_score },
            ].map((m) => (
              <div key={m.label} className="dash-hero-metric">
                <div className="dash-hero-metric-val">{Number(m.val).toFixed(0)}%</div>
                <div className="dash-hero-metric-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="dash-stats-grid">
        <StatCard
          label="Latest Score"
          value={latest ? Number(latest.confidence_score).toFixed(1) : "—"}
          color="#7c5cfc"
          delay={0}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
          }
        />
        <StatCard
          label="Average Score"
          value={average}
          color="#5b8def"
          delay={0.05}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          }
        />
        <StatCard
          label="Best Score"
          value={best}
          color="#22c55e"
          delay={0.1}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          }
        />
        <StatCard
          label="Total Sessions"
          value={dataPoints.length}
          color="#f59e0b"
          delay={0.15}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div className="dash-section animate-fadeUp">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Quick Actions</h2>
        </div>
        <div className="dash-actions-grid">
          <button className="dash-action-card" onClick={() => navigate("/ai")} id="start-practice-btn">
            <div className="dash-action-icon" style={{ background: "rgba(124,92,252,0.15)", color: "#7c5cfc" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            </div>
            <div className="dash-action-label">AI Practice</div>
            <div className="dash-action-desc">Start real-time training</div>
          </button>
          <button className="dash-action-card" onClick={() => navigate("/resources")} id="resources-btn">
            <div className="dash-action-icon" style={{ background: "rgba(91,141,239,0.15)", color: "#5b8def" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div className="dash-action-label">Resources</div>
            <div className="dash-action-desc">Browse tips & guides</div>
          </button>
          <button className="dash-action-card dash-action-card--primary" onClick={() => navigate("/ai")} id="upload-btn">
            <div className="dash-action-icon" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div className="dash-action-label" style={{ color: "#fff" }}>Upload Video</div>
            <div className="dash-action-desc" style={{ color: "rgba(255,255,255,0.65)" }}>Analyze a recording</div>
          </button>
        </div>
      </div>

      {/* Chart */}
      {dataPoints.length > 1 && (
        <div className="dash-section animate-fadeUp">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Confidence Growth</h2>
            <span className="dash-section-badge">{dataPoints.length} sessions</span>
          </div>
          <div className="dash-chart-wrap">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Session history */}
      {dataPoints.length > 0 && (
        <div className="dash-section animate-fadeUp">
          <h2 className="dash-section-title">Session History</h2>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  {["#", "Score", "Level", "Eye Contact", "Posture", "Smile", "Date", "Video", "Actions"].map((h) => (
                    <th key={h} className="dash-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataPoints.map((d, i) => (
                  <tr key={d.id} className="dash-tr">
                    <td className="dash-td">
                      <span className="dash-row-num">#{dataPoints.length - i}</span>
                    </td>
                    <td className="dash-td">
                      <span className="dash-score-val">{d.confidence_score?.toFixed(1)}</span>
                    </td>
                    <td className="dash-td">
                      <span
                        className="dash-level-badge"
                        style={{
                          background: `${levelColor(d.confidence_level)}18`,
                          color: levelColor(d.confidence_level),
                          borderColor: `${levelColor(d.confidence_level)}35`,
                        }}
                      >
                        {d.confidence_level}
                      </span>
                    </td>
                    <td className="dash-td">{d.eye_contact_percentage?.toFixed(0)}%</td>
                    <td className="dash-td">{d.posture_percentage?.toFixed(0)}%</td>
                    <td className="dash-td">{d.smile_percentage?.toFixed(0)}%</td>
                    <td className="dash-td">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="dash-td">
                      {d.video_path ? (
                        <video width="88" height="56" controls className="dash-video-thumb">
                          <source src={`${API_BASE_URL}/uploads/${d.video_path}`} />
                        </video>
                      ) : <span className="dash-no-video">—</span>}
                    </td>
                    <td className="dash-td">
                      <div className="dash-row-actions">
                        <button className="dash-analytics-btn" onClick={() => navigate(`/video/${d.id}`)}>
                          Analytics
                        </button>
                        <button className="dash-delete-btn" onClick={() => handleDelete(d.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {dataPoints.length === 0 && !loading && (
        <div className="dash-empty animate-fadeUp">
          <div className="dash-empty-icon animate-float">📹</div>
          <h3 className="dash-empty-title">No sessions yet</h3>
          <p className="dash-empty-desc">Record your first session to get AI confidence feedback.</p>
          <button onClick={() => navigate("/ai")} className="dash-empty-btn" id="start-recording-btn">
            Start Recording
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
