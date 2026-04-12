import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale,
  CategoryScale, Tooltip, Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const AUTO_REFRESH_INTERVAL = 5000;

function Dashboard() {
  const navigate = useNavigate();
  const [dataPoints, setDataPoints] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const refreshIntervalRef = useRef(null);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError(null);
    const userId = localStorage.getItem("user_id");
    fetch(`${API_BASE_URL}/dashboard`, { headers: { "X-User-ID": userId || "" } })
      .then((res) => { if (!res.ok) throw new Error("Failed to fetch dashboard"); return res.json(); })
      .then((data) => {
        const sorted = Array.isArray(data) ? [...data].reverse() : [];
        setDataPoints(sorted);
        setLastUpdate(new Date().toLocaleTimeString());
        setLoading(false);
      })
      .catch((err) => { setError("Failed to load dashboard. Please refresh."); setLoading(false); });
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
    refreshIntervalRef.current = setInterval(() => { fetchDashboard(); fetchStorage(); }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(refreshIntervalRef.current);
  }, [fetchDashboard, fetchStorage]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this session?")) return;
    const userId = localStorage.getItem("user_id");
    try {
      const res = await fetch(`${API_BASE_URL}/delete/${id}`, { method: "DELETE", headers: { "X-User-ID": userId || "" } });
      if (!res.ok) throw new Error();
      fetchDashboard();
    } catch { setError("Failed to delete session."); }
  };

  const latest = dataPoints[dataPoints.length - 1];
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
      borderColor: "#6c47ff",
      backgroundColor: "rgba(108,71,255,0.08)",
      tension: 0.4,
      fill: true,
      pointBackgroundColor: "#6c47ff",
      pointRadius: 4,
      pointHoverRadius: 6,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1a1a2e",
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.7)",
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#aaa", font: { size: 11 } } },
      y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { color: "#aaa", font: { size: 11 } }, min: 0, max: 100 },
    },
  };

  const quickActions = [
    { icon: "◉", label: "AI Practice", desc: "Start real-time training", onClick: () => navigate("/ai") },
    { icon: "☰", label: "Resources", desc: "Browse tips & guides", onClick: () => navigate("/resources") },
  ];

  return (
    <div style={styles.page}>
      {/* Header bar */}
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.pageTitle}>Dashboard</h1>
          <p style={styles.pageSubtitle}>Welcome back — here's your progress overview</p>
        </div>
        <div style={styles.topBarRight}>
          {lastUpdate && <span style={styles.updateLabel}>Updated {lastUpdate}</span>}
          <button
            onClick={fetchDashboard}
            disabled={loading}
            style={{ ...styles.refreshBtn, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={styles.errorClose}>✕</button>
        </div>
      )}

      {/* Storage bar */}
      {storageInfo && (
        <div style={styles.storageBar}>
          <div style={styles.storageLeft}>
            <span style={styles.storageLabel}>Storage</span>
            <div style={styles.storageTrack}>
              <div style={{
                ...styles.storageFill,
                width: `${Math.min(storageInfo.percentage, 100)}%`,
                background: storageInfo.percentage >= 90 ? "#e74c3c" : storageInfo.percentage >= 70 ? "#f39c12" : "#6c47ff",
              }} />
            </div>
          </div>
          <span style={styles.storageText}>
            {storageInfo.used_mb} / {storageInfo.limit_mb} MB
          </span>
        </div>
      )}

      {/* Hero metric banner — matches reference purple banner */}
      {latest && (
        <div style={styles.heroBanner}>
          <div style={styles.bannerLeft}>
            <div style={styles.bannerScore}>
              {Number(latest.confidence_score).toFixed(1)}
              <span style={styles.bannerScoreUnit}>/100</span>
            </div>
            <div style={styles.bannerLabel}>Confidence Score</div>
            <div style={{ ...styles.bannerLevel, background: latest.confidence_level === "High" ? "#27ae60" : latest.confidence_level === "Medium" ? "#f39c12" : "#e74c3c" }}>
              {latest.confidence_level} Confidence
            </div>
          </div>
          <div style={styles.bannerMetrics}>
            {[
              { label: "Posture", val: latest.posture_percentage },
              { label: "Voice", val: latest.speech_score * 10 },
              { label: "Eye Contact", val: latest.eye_contact_percentage },
              { label: "Confidence", val: latest.confidence_score },
            ].map((m) => (
              <div key={m.label} style={styles.bannerMetric}>
                <div style={styles.bannerMetricVal}>{Number(m.val).toFixed(0)}%</div>
                <div style={styles.bannerMetricLabel}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={styles.statGrid}>
        {[
          { label: "Latest Score", val: latest ? Number(latest.confidence_score).toFixed(1) : "—", color: "#6c47ff" },
          { label: "Average Score", val: average, color: "#4f8ef7" },
          { label: "Best Score", val: best, color: "#27ae60" },
          { label: "Total Sessions", val: dataPoints.length, color: "#f39c12" },
        ].map((s) => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ ...styles.statDot, background: s.color }} />
            <div style={styles.statLabel}>{s.label}</div>
            <div style={{ ...styles.statVal, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Quick Actions</h2>
        <div style={styles.actionsGrid}>
          {quickActions.map((a) => (
            <button key={a.label} onClick={a.onClick} style={styles.actionCard}>
              <div style={styles.actionIcon}>{a.icon}</div>
              <div style={styles.actionLabel}>{a.label}</div>
              <div style={styles.actionDesc}>{a.desc}</div>
            </button>
          ))}
          <button onClick={() => navigate("/ai")} style={styles.primaryActionCard}>
            <div style={styles.actionIcon}>⬆</div>
            <div style={styles.actionLabel}>Upload Video</div>
            <div style={styles.actionDesc}>Analyze an existing recording</div>
          </button>
        </div>
      </div>

      {/* Chart */}
      {dataPoints.length > 1 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Confidence Growth</h2>
            <span style={styles.sectionBadge}>{dataPoints.length} sessions</span>
          </div>
          <div style={styles.chartWrap}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Session history table */}
      {dataPoints.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Session History</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["#", "Score", "Level", "Eye Contact", "Posture", "Smile", "Date", "Video", "Actions"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataPoints.map((d, i) => (
                  <tr key={d.id} style={i % 2 === 0 ? styles.trEven : {}}>
                    <td style={styles.td}>#{dataPoints.length - i}</td>
                    <td style={styles.td}><strong style={{ color: "#6c47ff" }}>{d.confidence_score?.toFixed(1)}</strong></td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.levelBadge,
                        background: d.confidence_level === "High" ? "#eafaf1" : d.confidence_level === "Medium" ? "#fef9e7" : "#fdf2f2",
                        color: d.confidence_level === "High" ? "#1e8449" : d.confidence_level === "Medium" ? "#b7770d" : "#c0392b",
                      }}>
                        {d.confidence_level}
                      </span>
                    </td>
                    <td style={styles.td}>{d.eye_contact_percentage?.toFixed(0)}%</td>
                    <td style={styles.td}>{d.posture_percentage?.toFixed(0)}%</td>
                    <td style={styles.td}>{d.smile_percentage?.toFixed(0)}%</td>
                    <td style={styles.td}>{new Date(d.created_at).toLocaleDateString()}</td>
                    <td style={styles.td}>
                      {d.video_path ? (
                        <video width="90" height="60" controls style={styles.videoThumb}>
                          <source src={`${API_BASE_URL}/uploads/${d.video_path}`} />
                        </video>
                      ) : <span style={styles.noVideo}>—</span>}
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: "6px", flexDirection: "column" }}>
                        <button style={styles.analyticsBtn} onClick={() => navigate(`/video/${d.id}`)}>Analytics</button>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(d.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dataPoints.length === 0 && !loading && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📹</div>
          <h3 style={styles.emptyTitle}>No sessions yet</h3>
          <p style={styles.emptyDesc}>Record your first session to get AI confidence feedback.</p>
          <button onClick={() => navigate("/ai")} style={styles.emptyBtn}>Start Recording</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    flex: 1,
    padding: "32px 36px",
    background: "#f7f8fc",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', sans-serif",
    overflowY: "auto",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  pageTitle: { fontSize: "22px", fontWeight: "800", color: "#1a1a2e", margin: "0 0 4px 0", letterSpacing: "-0.3px" },
  pageSubtitle: { fontSize: "13px", color: "#999", margin: 0 },
  topBarRight: { display: "flex", alignItems: "center", gap: "10px" },
  updateLabel: { fontSize: "11.5px", color: "#bbb" },
  refreshBtn: {
    padding: "8px 16px",
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#555",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  errorBanner: {
    background: "#fff1f0",
    border: "1px solid #ffd8d4",
    color: "#c0392b",
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  errorClose: { background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: "14px" },
  storageBar: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "10px",
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
  },
  storageLeft: { display: "flex", alignItems: "center", gap: "12px", flex: 1 },
  storageLabel: { fontSize: "12px", fontWeight: "600", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" },
  storageTrack: { flex: 1, height: "6px", background: "#f0f0f0", borderRadius: "3px", overflow: "hidden" },
  storageFill: { height: "100%", borderRadius: "3px", transition: "width 0.3s ease" },
  storageText: { fontSize: "12px", color: "#999", whiteSpace: "nowrap" },
  heroBanner: {
    background: "linear-gradient(135deg, #5c2fff 0%, #7e57ff 50%, #4f8ef7 100%)",
    borderRadius: "14px",
    padding: "24px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "20px",
  },
  bannerLeft: { display: "flex", flexDirection: "column", gap: "6px" },
  bannerScore: { fontSize: "42px", fontWeight: "800", color: "#fff", lineHeight: 1, letterSpacing: "-1px" },
  bannerScoreUnit: { fontSize: "18px", fontWeight: "400", opacity: 0.7, marginLeft: "2px" },
  bannerLabel: { fontSize: "13px", color: "rgba(255,255,255,0.75)", fontWeight: "500" },
  bannerLevel: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "11.5px",
    fontWeight: "700",
    color: "#fff",
    marginTop: "4px",
    width: "fit-content",
  },
  bannerMetrics: { display: "flex", gap: "8px", flexWrap: "wrap" },
  bannerMetric: {
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "10px",
    padding: "12px 18px",
    textAlign: "center",
    minWidth: "80px",
  },
  bannerMetricVal: { fontSize: "20px", fontWeight: "800", color: "#fff", lineHeight: 1 },
  bannerMetricLabel: { fontSize: "11px", color: "rgba(255,255,255,0.7)", marginTop: "4px" },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
    marginBottom: "24px",
  },
  statCard: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "12px",
    padding: "18px 20px",
  },
  statDot: { width: "6px", height: "6px", borderRadius: "50%", marginBottom: "10px" },
  statLabel: { fontSize: "11.5px", color: "#999", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: "600", marginBottom: "6px" },
  statVal: { fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px" },
  section: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "14px",
    padding: "22px 24px",
    marginBottom: "20px",
  },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 16px 0" },
  sectionBadge: {
    fontSize: "11px",
    fontWeight: "600",
    background: "rgba(108,71,255,0.08)",
    color: "#6c47ff",
    padding: "3px 10px",
    borderRadius: "20px",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
  },
  actionCard: {
    background: "#f7f8fc",
    border: "1px solid #ebebeb",
    borderRadius: "12px",
    padding: "18px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    fontFamily: "'Segoe UI', sans-serif",
  },
  primaryActionCard: {
    background: "linear-gradient(135deg, #6c47ff, #4f8ef7)",
    border: "none",
    borderRadius: "12px",
    padding: "18px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    fontFamily: "'Segoe UI', sans-serif",
  },
  actionIcon: { fontSize: "20px", marginBottom: "8px", display: "block", color: "#6c47ff" },
  actionLabel: { fontSize: "13.5px", fontWeight: "700", color: "#1a1a2e", marginBottom: "2px" },
  actionDesc: { fontSize: "11.5px", color: "#999" },
  chartWrap: { height: "200px" },
  tableWrap: { overflowX: "auto", WebkitOverflowScrolling: "touch" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "2px solid #f0f0f0",
    fontSize: "11px",
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
  },
  td: { padding: "12px 12px", borderBottom: "1px solid #f5f5f5", color: "#333", verticalAlign: "middle" },
  trEven: { background: "#fafafa" },
  levelBadge: { padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" },
  videoThumb: { borderRadius: "6px", display: "block" },
  noVideo: { color: "#ccc", fontSize: "14px" },
  analyticsBtn: {
    padding: "5px 10px",
    background: "rgba(108,71,255,0.08)",
    color: "#6c47ff",
    border: "1px solid rgba(108,71,255,0.2)",
    borderRadius: "6px",
    fontSize: "11.5px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  deleteBtn: {
    padding: "5px 10px",
    background: "#fff1f0",
    color: "#e74c3c",
    border: "1px solid #ffd8d4",
    borderRadius: "6px",
    fontSize: "11.5px",
    fontWeight: "600",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    background: "#fff",
    borderRadius: "14px",
    border: "1px solid #ebebeb",
  },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  emptyTitle: { fontSize: "18px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 8px 0" },
  emptyDesc: { fontSize: "14px", color: "#999", margin: "0 0 24px 0" },
  emptyBtn: {
    padding: "12px 28px",
    background: "linear-gradient(135deg, #6c47ff, #4f8ef7)",
    color: "#fff",
    border: "none",
    borderRadius: "9px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
  },
};

export default Dashboard;
