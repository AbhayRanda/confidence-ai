import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Tooltip, Legend, BarElement,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import "./VideoAnalytics.css";

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
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch session data"); return r.json(); })
      .then((data) => {
        const videos = Array.isArray(data) ? data : [];
        setAllVideos(videos);
        const video = videos.find((v) => v.id === parseInt(id));
        if (!video) throw new Error("Video session not found");
        setVideoData(video);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id]);

  useEffect(() => { fetchVideoData(); }, [fetchVideoData]);

  if (loading) {
    return (
      <div className="va-page">
        <div className="va-loading-container animate-fadeUp">
          <div className="va-spinner-ring" />
          <p className="va-loading-text">Loading session analytics…</p>
        </div>
      </div>
    );
  }

  if (error || !videoData) {
    return (
      <div className="va-page">
        <div className="va-error-card animate-fadeUp">
          <div className="va-error-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="va-error-title">Unable to Load Session</h3>
          <p className="va-error-msg">{error || "Session not found"}</p>
          <button onClick={() => navigate("/dashboard")} className="va-nav-btn va-nav-btn--primary">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const videoIndex = allVideos.findIndex((v) => v.id === videoData.id);
  const currentNum = allVideos.length - videoIndex;

  const getQuality = (score) => {
    if (score >= 80) return { label: "Excellent", color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)", bannerClass: "va-score-banner--high" };
    if (score >= 60) return { label: "Good", color: "#5b8def", bg: "rgba(91, 141, 239, 0.15)", bannerClass: "va-score-banner--moderate" };
    if (score >= 40) return { label: "Fair", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", bannerClass: "va-score-banner--moderate" };
    return { label: "Needs Work", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", bannerClass: "va-score-banner--low" };
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
      legend: { position: "top", labels: { font: { size: 12, family: "'Inter', sans-serif" }, color: "#8b92b5", boxWidth: 12 } },
      tooltip: { backgroundColor: "#141827", padding: 12, cornerRadius: 8, titleColor: "#f0f2ff", bodyColor: "#f0f2ff", borderColor: "rgba(255,255,255,0.08)", borderWidth: 1 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#8b92b5", font: { size: 11.5, family: "'Inter', sans-serif" } } },
      y: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#8b92b5", font: { size: 11.5, family: "'Inter', sans-serif" } }, min: 0, max: 100 },
    },
  };

  const strongest = metrics.reduce((a, b) => a.val > b.val ? a : b);
  const weakest = metrics.reduce((a, b) => a.val < b.val ? a : b);

  return (
    <div className="va-page animate-fadeUp">
      {/* Top Navigation */}
      <div className="va-topnav">
        <button onClick={() => navigate("/dashboard")} className="va-back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Dashboard
        </button>
        <div className="va-session-pill">
          Session #{currentNum} of {allVideos.length}
        </div>
      </div>

      {/* Header */}
      <div className="va-header">
        <h1 className="va-title">Session Analytics</h1>
        <p className="va-date">{new Date(videoData.created_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}</p>
      </div>

      {/* Hero Score Banner */}
      <div className={`va-score-banner ${q.bannerClass}`}>
        <div className="va-score-left">
          <div className="va-score-number">{Number(videoData.confidence_score).toFixed(1)}</div>
          <div className="va-score-max">/100</div>
          <div className="va-score-label">Confidence Score</div>
        </div>
        <div className="va-score-right">
          <div className="va-level-badge" style={{ color: q.color }}>{q.label}</div>
          <div className="va-level-sub">{videoData.confidence_level} Confidence</div>
        </div>
      </div>

      <div className="va-two-col">
        {/* Video Player */}
        {videoData.video_path && (
          <div className="va-card">
            <h2 className="va-card-title">
              <span>📹</span> Video Playback
            </h2>
            <div className="va-video-wrapper">
              <video controls className="va-video-player">
                <source src={`${API_BASE_URL}/uploads/${videoData.video_path}`} />
              </video>
            </div>
          </div>
        )}

        {/* Key Insights */}
        <div className="va-card">
          <h2 className="va-card-title">
            <span>💡</span> Key Insights
          </h2>
          <div className="va-insight-grid">
            {[
              { icon: "🏆", label: "Strongest metric", val: strongest.label, color: "#22c55e" },
              { icon: "⚠️", label: "Needs improvement", val: weakest.label, color: "#ef4444" },
              { icon: "📊", label: "Overall rating", val: q.label, color: q.color },
              { icon: "💬", label: "Filler words", val: `${videoData.filler_word_count ?? 0} detected`, color: (videoData.filler_word_count ?? 0) < 3 ? "#22c55e" : "#ef4444" },
            ].map((ins) => (
              <div key={ins.label} className="va-insight-card">
                <div className="va-insight-icon">{ins.icon}</div>
                <div className="va-insight-label">{ins.label}</div>
                <div className="va-insight-val" style={{ color: ins.color }}>{ins.val}</div>
              </div>
            ))}
          </div>

          <div className="va-speech-row">
            <div className="va-speech-item">
              <div className="va-speech-label">Words / Minute</div>
              <div className="va-speech-val">{Number(videoData.words_per_minute || 0).toFixed(0)}</div>
              <div className="va-speech-sub">Ideal: 120–150 WPM</div>
            </div>
            <div className="va-speech-item">
              <div className="va-speech-label">Speech Score</div>
              <div className="va-speech-val" style={{ color: Number(videoData.speech_score || 0) >= 70 ? "#22c55e" : "#f59e0b" }}>
                {Number(videoData.speech_score || 0).toFixed(1)}%
              </div>
            </div>
            <div className="va-speech-item">
              <div className="va-speech-label">Face Visibility</div>
              <div className="va-speech-val">{Number(videoData.face_visibility_percentage || 0).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics Breakdown */}
      <div className="va-card">
        <h2 className="va-card-title">
          <span>📈</span> Detailed Breakdown
        </h2>
        <div className="va-metrics-grid">
          {metrics.map((m) => {
            const mq = getQuality(m.val);
            return (
              <div key={m.label} className="va-metric-card">
                <div className="va-metric-icon">{m.icon}</div>
                <div className="va-metric-label">{m.label}</div>
                <div className="va-metric-val" style={{ color: mq.color }}>{Number(m.val).toFixed(0)}%</div>
                <div className="va-metric-bar-bg">
                  <div className="va-metric-bar-fill" style={{ width: `${m.val}%`, background: mq.color }} />
                </div>
                <div className="va-metric-badge" style={{ background: mq.bg, color: mq.color }}>{mq.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison Chart */}
      {allVideos.length > 1 && (
        <div className="va-card">
          <h2 className="va-card-title">
            <span>📊</span> Session vs. Your Historical Average
          </h2>
          <div className="va-chart-wrap">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="va-nav-row">
        <button
          onClick={() => { const prev = allVideos[videoIndex + 1]; if (prev) navigate(`/video/${prev.id}`); }}
          disabled={videoIndex === allVideos.length - 1}
          className="va-nav-btn"
        >
          ← Previous Session
        </button>
        <button onClick={() => navigate("/dashboard")} className="va-nav-btn va-nav-btn--primary">
          Dashboard Overview
        </button>
        <button
          onClick={() => { const next = allVideos[videoIndex - 1]; if (next) navigate(`/video/${next.id}`); }}
          disabled={videoIndex === 0}
          className="va-nav-btn"
        >
          Next Session →
        </button>
      </div>
    </div>
  );
}

export default VideoAnalytics;