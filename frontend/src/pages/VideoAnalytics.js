import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Tooltip, Legend, BarElement,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import "./VideoAnalytics.css";
import { API_BASE_URL, apiJSON } from "../utils/api";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, BarElement);

const DEMO_ANALYTICS = {
  "demo-1": {
    id: "demo-1",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    confidence_score: 76.5,
    confidence_level: "Moderate",
    eye_contact_percentage: 72,
    posture_percentage: 80,
    speech_score: 75,
    smile_percentage: 68,
    hand_movement_percentage: 70,
    words_per_minute: 128,
    face_visibility_percentage: 95,
    filler_word_count: 5,
    video_path: null,
  },
  "demo-2": {
    id: "demo-2",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    confidence_score: 82.0,
    confidence_level: "High",
    eye_contact_percentage: 80,
    posture_percentage: 85,
    speech_score: 81,
    smile_percentage: 75,
    hand_movement_percentage: 78,
    words_per_minute: 135,
    face_visibility_percentage: 98,
    filler_word_count: 3,
    video_path: null,
  },
  "demo-3": {
    id: "demo-3",
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    confidence_score: 87.4,
    confidence_level: "High",
    eye_contact_percentage: 86,
    posture_percentage: 89,
    speech_score: 86,
    smile_percentage: 82,
    hand_movement_percentage: 80,
    words_per_minute: 140,
    face_visibility_percentage: 99,
    filler_word_count: 2,
    video_path: null,
  },
  "demo-4": {
    id: "demo-4",
    created_at: new Date().toISOString(),
    confidence_score: 91.2,
    confidence_level: "High",
    eye_contact_percentage: 89,
    posture_percentage: 93,
    speech_score: 90,
    smile_percentage: 86,
    hand_movement_percentage: 85,
    words_per_minute: 142,
    face_visibility_percentage: 100,
    filler_word_count: 1,
    video_path: null,
  },
};

function VideoAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [videoData, setVideoData] = useState(null);
  const [allVideos, setAllVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoError, setVideoError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchVideoData = useCallback(async (isRetry = false) => {
    setLoading(true);
    setError(null);

    // Support demo sessions for visitors & recruiters instantly
    if (String(id).startsWith("demo-")) {
      const demoList = Object.values(DEMO_ANALYTICS);
      setAllVideos(demoList);
      const found = DEMO_ANALYTICS[id] || demoList[demoList.length - 1];
      setVideoData(found);
      setLoading(false);
      return;
    }

    if (isRetry) setRetrying(true);

    try {
      // Fetch single video and dashboard history in parallel
      const [videoRes, dashRes] = await Promise.allSettled([
        apiJSON(`/video/${id}`),
        apiJSON("/dashboard"),
      ]);

      let loadedVideo = null;

      // Extract dashboard videos for relative benchmarks
      if (dashRes.status === "fulfilled" && dashRes.value?.ok && Array.isArray(dashRes.value.data)) {
        setAllVideos(dashRes.value.data);
        loadedVideo = dashRes.value.data.find((v) => v.id === parseInt(id)) || null;
      }

      // Dedicated single-video endpoint takes precedence for fresh metrics
      if (videoRes.status === "fulfilled" && videoRes.value?.ok && videoRes.value.data) {
        loadedVideo = videoRes.value.data;
      }

      if (loadedVideo) {
        setVideoData(loadedVideo);
      } else {
        // Fallback to demo data if guest or not found
        const token = localStorage.getItem("token");
        if (!token) {
          const demoList = Object.values(DEMO_ANALYTICS);
          setAllVideos(demoList);
          setVideoData(DEMO_ANALYTICS[id] || demoList[demoList.length - 1]);
          setLoading(false);
          return;
        }

        // If single video failed, check if it was a 404 or a network error
        const singleErr = videoRes.status === "rejected" ? videoRes.reason : null;
        const isNetworkErr = singleErr && (
          singleErr.message?.includes("fetch") ||
          singleErr.message?.includes("NetworkError") ||
          singleErr.name === "TypeError"
        );

        if (isNetworkErr && !isRetry) {
          // Render free instances sleep after 15 min; wait 2.5s and retry automatically
          setRetrying(true);
          await new Promise((r) => setTimeout(r, 2500));
          return fetchVideoData(true);
        }

        if (videoRes.status === "fulfilled" && videoRes.value?.status === 404) {
          throw new Error("Session not found in your account.");
        }

        throw new Error(
          isNetworkErr
            ? "Could not reach server. The cloud server may be waking up from sleep (Render free tier)."
            : "Video session not found or belongs to another account."
        );
      }
    } catch (err) {
      setError(err.message || "Failed to load session");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [id]);

  useEffect(() => { fetchVideoData(); }, [fetchVideoData]);

  if (loading) {
    return (
      <div className="va-page">
        <div className="va-loading-container animate-fadeUp">
          <div className="va-spinner-ring" />
          <p className="va-loading-text">
            {retrying ? "Connecting to server (waking up cloud service)…" : "Loading session analytics…"}
          </p>
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
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
            <button onClick={() => fetchVideoData(true)} className="va-nav-btn va-nav-btn--primary">
              🔄 Retry Connection
            </button>
            <button onClick={() => navigate("/dashboard")} className="va-nav-btn" style={{ background: "rgba(255,255,255,0.06)" }}>
              ← Back to Dashboard
            </button>
          </div>
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
          <div className="va-level-sub">
            {videoData.confidence_level?.toLowerCase().endsWith("confidence")
              ? videoData.confidence_level
              : `${videoData.confidence_level} Confidence`}
          </div>
        </div>
      </div>

      <div className="va-two-col">
        {/* Video Player or Evaluation Highlights Card */}
        {videoData.video_path ? (() => {
          const isCloud = videoData.video_path.startsWith("http");
          const playUrl = isCloud
            ? videoData.video_path
            : `${API_BASE_URL}/uploads/${videoData.video_path.replace(/\.webm$/i, '.mp4')}#t=0.001`;
          const rawUrl = isCloud
            ? videoData.video_path
            : `${API_BASE_URL}/uploads/${videoData.video_path.replace(/\.webm$/i, '.mp4')}`;

          return (
            <div className="va-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h2 className="va-card-title" style={{ margin: 0 }}>
                  <span>📹</span> Video Playback
                </h2>
                {!videoError && (
                  <a
                    href={rawUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: "12px",
                      color: "var(--accent-light, #a78bfa)",
                      textDecoration: "none",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    Open Video ↗
                  </a>
                )}
              </div>
              <div className="va-video-wrapper">
                {videoError ? (
                  <div style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    background: "rgba(255, 255, 255, 0.03)",
                    borderRadius: "12px",
                    border: "1px dashed rgba(255, 255, 255, 0.15)",
                  }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>📁</div>
                    <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text-primary)" }}>
                      Video Recording Expired from Ephemeral Storage
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                      All computed confidence scores, vocal metrics, and posture insights are fully preserved below.
                    </p>
                  </div>
                ) : (
                  <video
                    controls
                    playsInline
                    webkit-playsinline="true"
                    preload="auto"
                    className="va-video-player"
                    onError={() => setVideoError(true)}
                    src={playUrl}
                  >
                    <source
                      src={playUrl}
                      type="video/mp4"
                      onError={() => setVideoError(true)}
                    />
                    Your browser does not support this video format.
                  </video>
                )}
              </div>
            </div>
          );
        })() : (
          <div className="va-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 className="va-card-title" style={{ margin: 0 }}>
                <span>📹</span> Evaluation Highlights
              </h2>
              <span style={{ fontSize: "11.5px", padding: "3px 9px", borderRadius: "12px", background: "rgba(99, 102, 241, 0.18)", color: "#818cf8", fontWeight: 600 }}>
                AI Evaluated
              </span>
            </div>
            <div style={{
              padding: "36px 20px",
              textAlign: "center",
              background: "linear-gradient(135deg, rgba(20, 24, 39, 0.6) 0%, rgba(30, 41, 59, 0.5) 100%)",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              minHeight: "220px"
            }}>
              <div style={{ fontSize: "36px" }}>🎯</div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                Multi-Modal Candidate Assessment
              </h3>
              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-muted)", maxWidth: "340px", lineHeight: "1.5" }}>
                Real-time WebRTC audio, MediaPipe gaze-tracking, and vocal clarity pipeline verified. Full metric breakdown preserved below.
              </p>
              <button
                onClick={() => navigate("/practice")}
                className="va-nav-btn va-nav-btn--primary"
                style={{ marginTop: "6px", fontSize: "12px", padding: "7px 16px" }}
              >
                Start Live Practice Drill
              </button>
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