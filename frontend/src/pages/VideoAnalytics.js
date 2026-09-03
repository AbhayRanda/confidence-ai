import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Tooltip, Legend, BarElement,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, BarElement);

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function VideoAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [videoData, setVideoData] = useState(null);
  const [allVideos, setAllVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchVideoData = useCallback(() => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("token");
    fetch(`${API_BASE_URL}/dashboard`, { headers: { "Authorization": `Bearer ${token || ""}` } })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((data) => {
        const videos = Array.isArray(data) ? data : [];
        setAllVideos(videos);
        const video = videos.find((v) => v.id === parseInt(id));
        if (!video) throw new Error("Video not found");
        setVideoData(video);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id]);

  useEffect(() => { fetchVideoData(); }, [fetchVideoData]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingState}>
          <div style={styles.spinner}>⏳</div>
          <p style={styles.loadingText}>Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (error || !videoData) {
    return (
      <div style={styles.page}>
        <div style={styles.errorState}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
          <h3 style={styles.errorTitle}>{error || "Video not found"}</h3>
          <button onClick={() => navigate("/dashboard")} style={styles.backBtn}>← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const videoIndex = allVideos.findIndex((v) => v.id === videoData.id);
  const currentNum = allVideos.length - videoIndex;

  const getQuality = (score) => {
    if (score >= 80) return { label: "Excellent", color: "#27ae60", bg: "#eafaf1" };
    if (score >= 60) return { label: "Good", color: "#2980b9", bg: "#ebf5fb" };
    if (score >= 40) return { label: "Fair", color: "#f39c12", bg: "#fef9e7" };
    return { label: "Needs Work", color: "#e74c3c", bg: "#fdf2f2" };
  };

  const q = getQuality(videoData.confidence_score);
  const avgOf = (key) => allVideos.length > 0
    ? allVideos.reduce((s, v) => s + (v[key] || 0), 0) / allVideos.length
    : 0;

  const metrics = [
    { label: "Eye Contact", icon: "👁️", val: videoData.eye_contact_percentage || 0, avg: avgOf("eye_contact_percentage") },
    { label: "Posture", icon: "🧍", val: videoData.posture_percentage || 0, avg: avgOf("posture_percentage") },
    { label: "Smile", icon: "😊", val: videoData.smile_percentage || 0, avg: avgOf("smile_percentage") },
    { label: "Hand Movement", icon: "🤚", val: videoData.hand_movement_percentage || 0, avg: avgOf("hand_movement_percentage") },
    { label: "Speech", icon: "🎤", val: (videoData.speech_score || 0) , avg: avgOf("speech_score") },
  ];

  const chartData = {
    labels: metrics.map((m) => m.label),
    datasets: [
      {
        label: "This session",
        data: metrics.map((m) => Number(m.val.toFixed(1))),
        backgroundColor: "rgba(124, 92, 252, 0.8)",
        borderRadius: 6,
      },
      {
        label: "Your average",
        data: metrics.map((m) => Number(m.avg.toFixed(1))),
        backgroundColor: "rgba(91, 141, 239, 0.6)",
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { font: { size: 11 }, color: "#8b92b5", boxWidth: 12 } },
      tooltip: { backgroundColor: "#141827", padding: 10, cornerRadius: 8, titleColor: "#f0f2ff", bodyColor: "#f0f2ff" },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#50587a", font: { size: 11 } } },
      y: { grid: { color: "rgba(255, 255, 255, 0.04)" }, ticks: { color: "#50587a", font: { size: 11 } }, min: 0, max: 100 },
    },
  };

  const strongest = metrics.reduce((a, b) => a.val > b.val ? a : b);
  const weakest = metrics.reduce((a, b) => a.val < b.val ? a : b);

  return (
    <div style={styles.page}>
      {/* Top nav */}
      <div style={styles.topNav}>
        <button onClick={() => navigate("/dashboard")} style={styles.backLink}>← Back to Dashboard</button>
        <div style={styles.sessionPill}>Session #{currentNum} of {allVideos.length}</div>
      </div>

      <h1 style={styles.pageTitle}>Session Analytics</h1>
      <p style={styles.pageDate}>{new Date(videoData.created_at).toLocaleString()}</p>

      {/* Score banner */}
      <div style={{ ...styles.scoreBanner, background: `linear-gradient(135deg, ${q.color}dd, ${q.color}99)` }}>
        <div style={styles.scoreBannerLeft}>
          <div style={styles.scoreBig}>{Number(videoData.confidence_score).toFixed(1)}</div>
          <div style={styles.scoreBigUnit}>/100</div>
          <div style={styles.scoreBannerLabel}>Confidence Score</div>
        </div>
        <div style={styles.scoreBannerRight}>
          <div style={styles.levelTag}>{q.label}</div>
          <div style={styles.levelSub}>{videoData.confidence_level} Confidence</div>
        </div>
      </div>

      <div style={styles.twoCol}>
        {/* Video player */}
        {videoData.video_path && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📹 Recording</h2>
            <video controls style={styles.videoPlayer}>
              <source src={`${API_BASE_URL}/uploads/${videoData.video_path}`} />
            </video>
          </div>
        )}

        {/* Insights */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>💡 Insights</h2>
          <div style={styles.insightGrid}>
            {[
              { icon: "🏆", label: "Strongest metric", val: strongest.label, color: "#27ae60" },
              { icon: "⚠️", label: "Needs improvement", val: weakest.label, color: "#e74c3c" },
              { icon: "📊", label: "Overall rating", val: q.label, color: q.color },
              { icon: "💬", label: "Filler words", val: `${videoData.filler_word_count ?? 0} detected`, color: (videoData.filler_word_count ?? 0) < 3 ? "#27ae60" : "#e74c3c" },
            ].map((ins) => (
              <div key={ins.label} style={styles.insightCard}>
                <div style={styles.insightIcon}>{ins.icon}</div>
                <div style={styles.insightLabel}>{ins.label}</div>
                <div style={{ ...styles.insightVal, color: ins.color }}>{ins.val}</div>
              </div>
            ))}
          </div>

          <div style={styles.speechRow}>
            <div style={styles.speechItem}>
              <div style={styles.speechLabel}>Words per minute</div>
              <div style={styles.speechVal}>{Number(videoData.words_per_minute || 0).toFixed(0)}</div>
              <div style={styles.speechSub}>Ideal: 120–150 WPM</div>
            </div>
            <div style={styles.speechItem}>
              <div style={styles.speechLabel}>Speech score</div>
              <div style={styles.speechVal}>{Number(videoData.speech_score || 0).toFixed(1)}%</div>
            </div>
            <div style={styles.speechItem}>
              <div style={styles.speechLabel}>Face visible</div>
              <div style={styles.speechVal}>{Number(videoData.face_visibility_percentage || 0).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics breakdown */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>📈 Detailed Metrics</h2>
        <div style={styles.metricsGrid}>
          {metrics.map((m) => {
            const mq = getQuality(m.val);
            return (
              <div key={m.label} style={styles.metricCard}>
                <div style={styles.metricCardIcon}>{m.icon}</div>
                <div style={styles.metricCardLabel}>{m.label}</div>
                <div style={{ ...styles.metricCardVal, color: mq.color }}>{Number(m.val).toFixed(0)}%</div>
                <div style={styles.metricBarBg}>
                  <div style={{ ...styles.metricBarFill, width: `${m.val}%`, background: mq.color }} />
                </div>
                <div style={{ ...styles.metricBadge, background: mq.bg, color: mq.color }}>{mq.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison chart */}
      {allVideos.length > 1 && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📊 vs. Your Average</h2>
          <div style={styles.chartWrap}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={styles.navRow}>
        <button
          onClick={() => { const prev = allVideos[videoIndex + 1]; if (prev) navigate(`/video/${prev.id}`); }}
          disabled={videoIndex === allVideos.length - 1}
          style={{ ...styles.navBtn, opacity: videoIndex === allVideos.length - 1 ? 0.4 : 1 }}
        >
          ← Previous
        </button>
        <button onClick={() => navigate("/dashboard")} style={styles.centerNavBtn}>
          Dashboard
        </button>
        <button
          onClick={() => { const next = allVideos[videoIndex - 1]; if (next) navigate(`/video/${next.id}`); }}
          disabled={videoIndex === 0}
          style={{ ...styles.navBtn, opacity: videoIndex === 0 ? 0.4 : 1 }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    flex: 1,
    padding: "32px 36px",
    background: "var(--bg-base)",
    minHeight: "100vh",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    overflowY: "auto",
    color: "var(--text-primary)",
  },
  loadingState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", gap: "16px" },
  spinner: { fontSize: "48px" },
  loadingText: { fontSize: "14px", color: "var(--text-muted)" },
  errorState: { textAlign: "center", padding: "80px 20px" },
  errorTitle: { fontSize: "18px", color: "var(--danger)", marginBottom: "20px" },
  backBtn: {
    padding: "10px 20px",
    background: "var(--accent-gradient)",
    color: "var(--text-primary)",
    border: "none",
    borderRadius: "9px",
    fontSize: "13.5px",
    fontWeight: "700",
    cursor: "pointer",
  },
  topNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  backLink: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: "13.5px",
    fontWeight: "600",
    cursor: "pointer",
    padding: 0,
  },
  sessionPill: {
    padding: "4px 12px",
    background: "var(--accent-010)",
    color: "var(--accent)",
    border: "1px solid var(--accent-020)",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },
  pageTitle: { fontSize: "22px", fontWeight: "800", color: "var(--text-primary)", margin: "0 0 4px 0", letterSpacing: "-0.3px" },
  pageDate: { fontSize: "13px", color: "var(--text-muted)", margin: "0 0 24px 0" },
  scoreBanner: {
    borderRadius: "14px",
    padding: "24px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "16px",
  },
  scoreBannerLeft: { display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" },
  scoreBig: { fontSize: "52px", fontWeight: "800", color: "var(--text-primary)", lineHeight: 1, letterSpacing: "-2px" },
  scoreBigUnit: { fontSize: "20px", color: "var(--text-overlay-50)", fontWeight: "400" },
  scoreBannerLabel: { fontSize: "13px", color: "var(--text-overlay-60)", alignSelf: "flex-end", paddingBottom: "6px", marginLeft: "6px" },
  scoreBannerRight: { textAlign: "right" },
  levelTag: { fontSize: "20px", fontWeight: "800", color: "var(--text-primary)", marginBottom: "4px" },
  levelSub: { fontSize: "13px", color: "var(--text-overlay-50)" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "22px",
    marginBottom: "16px",
  },
  cardTitle: { fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 16px 0" },
  videoPlayer: { width: "100%", borderRadius: "10px", display: "block" },
  insightGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" },
  insightCard: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-light)",
    borderRadius: "10px",
    padding: "14px",
    textAlign: "center",
  },
  insightIcon: { fontSize: "22px", marginBottom: "6px" },
  insightLabel: { fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600", marginBottom: "4px" },
  insightVal: { fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" },
  speechRow: { display: "flex", gap: "12px", borderTop: "1px solid var(--border-light)", paddingTop: "14px" },
  speechItem: { flex: 1, textAlign: "center" },
  speechLabel: { fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600", marginBottom: "4px" },
  speechVal: { fontSize: "22px", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-0.5px" },
  speechSub: { fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" },
  metricCard: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-light)",
    borderRadius: "12px",
    padding: "16px",
    textAlign: "center",
  },
  metricCardIcon: { fontSize: "20px", marginBottom: "6px" },
  metricCardLabel: { fontSize: "11.5px", color: "var(--text-muted)", fontWeight: "600", marginBottom: "6px" },
  metricCardVal: { fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px", marginBottom: "8px", color: "var(--text-primary)" },
  metricBarBg: { height: "5px", background: "var(--bg-hover)", borderRadius: "3px", overflow: "hidden", marginBottom: "8px" },
  metricBarFill: { height: "100%", borderRadius: "3px", transition: "width 0.5s ease" },
  metricBadge: { display: "inline-block", padding: "2px 10px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700" },
  chartWrap: { height: "220px" },
  navRow: { display: "flex", justifyContent: "center", gap: "12px", marginTop: "8px", marginBottom: "32px" },
  navBtn: {
    padding: "10px 22px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "9px",
    fontSize: "13.5px",
    fontWeight: "600",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  centerNavBtn: {
    padding: "10px 22px",
    background: "var(--accent-gradient)",
    color: "var(--text-primary)",
    border: "none",
    borderRadius: "9px",
    fontSize: "13.5px",
    fontWeight: "700",
    cursor: "pointer",
  },
};

export default VideoAnalytics;