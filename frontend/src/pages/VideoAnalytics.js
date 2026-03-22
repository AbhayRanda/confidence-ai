import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  BarElement,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  BarElement
);

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function VideoAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allVideos, setAllVideos] = useState([]);

  const fetchVideoData = useCallback(() => {
    setLoading(true);
    setError(null);
    const userId = localStorage.getItem("user_id");

    fetch(`${API_BASE_URL}/dashboard`, {
      headers: {
        "X-User-ID": userId || "",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch videos");
        return res.json();
      })
      .then((data) => {
        const videos = Array.isArray(data) ? data : [];
        setAllVideos(videos);
        const video = videos.find((v) => v.id === parseInt(id));
        if (!video) throw new Error("Video not found");
        setVideoData(video);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to load video analytics");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    fetchVideoData();
  }, [fetchVideoData]);

  const getMetricColor = (value, threshold1 = 60, threshold2 = 80) => {
    if (value >= threshold2) return "#00ff99";
    if (value >= threshold1) return "#00f5ff";
    return "#ff6b9d";
  };

  const getScoreLevel = (score) => {
    if (score >= 85) return { level: "Excellent", color: "#00ff99", icon: "🌟" };
    if (score >= 70) return { level: "Good", color: "#00f5ff", icon: "👍" };
    if (score >= 50) return { level: "Average", color: "#ffd166", icon: "📊" };
    return { level: "Needs Work", color: "#ff6b9d", icon: "💪" };
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}>⏳</div>
          <p>Loading video analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate("/dashboard")} style={styles.backButton}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!videoData) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h2>Video not found</h2>
          <button onClick={() => navigate("/dashboard")} style={styles.backButton}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const scoreLevel = getScoreLevel(videoData.confidence_score);
  const videosWithoutCurrent = allVideos.filter((v) => v.id !== videoData.id);
  const videoIndex = allVideos.findIndex((v) => v.id === videoData.id);
  const currentVideoNum = allVideos.length - videoIndex;

  // Metrics comparison data
  const metricsComparisonData = {
    labels: ["Eye Contact", "Posture", "Smile", "Hand Mov.", "Speech"],
    datasets: [
      {
        label: "Current Video",
        data: [
          videoData.eye_contact_percentage || 0,
          videoData.posture_percentage || 0,
          videoData.smile_percentage || 0,
          videoData.hand_movement_percentage || 0,
          (videoData.speech_score || 0) / 10, // Scale to percentage
        ],
        backgroundColor: "rgba(0, 245, 255, 0.7)",
        borderColor: "#00f5ff",
        borderWidth: 2,
      },
      {
        label: "Average All Videos",
        data: [
          (
            allVideos.reduce((sum, v) => sum + (v.eye_contact_percentage || 0), 0) /
            allVideos.length
          ).toFixed(1),
          (
            allVideos.reduce((sum, v) => sum + (v.posture_percentage || 0), 0) /
            allVideos.length
          ).toFixed(1),
          (
            allVideos.reduce((sum, v) => sum + (v.smile_percentage || 0), 0) /
            allVideos.length
          ).toFixed(1),
          (
            allVideos.reduce((sum, v) => sum + (v.hand_movement_percentage || 0), 0) /
            allVideos.length
          ).toFixed(1),
          (
            allVideos.reduce((sum, v) => sum + (v.speech_score || 0), 0) /
            allVideos.length /
            10
          ).toFixed(1),
        ],
        backgroundColor: "rgba(0, 255, 153, 0.5)",
        borderColor: "#00ff99",
        borderWidth: 2,
      },
    ],
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button
          onClick={() => navigate("/dashboard")}
          style={styles.backButtonHeader}
          title="Back to Dashboard"
        >
          ← Back
        </button>
        <h1 style={styles.title}>📊 Video Analytics</h1>
        <div style={styles.videoNumber}>
          Video #{currentVideoNum} of {allVideos.length}
        </div>
      </div>

      {/* Main Score Card */}
      <div style={styles.mainScoreCard}>
        <div style={styles.scoreCircle}>
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>
            {scoreLevel.icon}
          </div>
          <div style={styles.scoreValue}>{videoData.confidence_score?.toFixed(2)}</div>
          <div style={{ ...styles.scoreLevel, color: scoreLevel.color }}>
            {scoreLevel.level}
          </div>
        </div>
        <div style={styles.sessionInfo}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Date</span>
            <span style={styles.infoValue}>
              {new Date(videoData.created_at).toLocaleDateString()}
            </span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Time</span>
            <span style={styles.infoValue}>
              {new Date(videoData.created_at).toLocaleTimeString()}
            </span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Confidence Level</span>
            <span
              style={{
                ...styles.infoValue,
                color: getMetricColor(videoData.confidence_score),
              }}
            >
              {videoData.confidence_level}
            </span>
          </div>
        </div>
      </div>

      {/* Video Player */}
      {videoData.video_path && (
        <div style={styles.videoPlayerCard}>
          <h2 style={styles.cardTitle}>📹 Video Recording</h2>
          <div style={styles.videoContainer}>
            <video
              width="100%"
              height="auto"
              controls
              style={{ borderRadius: "12px", maxHeight: "500px" }}
            >
              <source src={`${API_BASE_URL}/uploads/${videoData.video_path}`} />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

      {/* Detailed Metrics Grid */}
      <div style={styles.metricsSection}>
        <h2 style={styles.sectionTitle}>📈 Detailed Metrics</h2>
        <div style={styles.metricsGrid}>
          <MetricCard
            title="👁️ Eye Contact"
            value={videoData.eye_contact_percentage}
            unit="%"
            color={getMetricColor(videoData.eye_contact_percentage)}
          />
          <MetricCard
            title="🧍 Posture"
            value={videoData.posture_percentage}
            unit="%"
            color={getMetricColor(videoData.posture_percentage)}
          />
          <MetricCard
            title="😊 Smile"
            value={videoData.smile_percentage}
            unit="%"
            color={getMetricColor(videoData.smile_percentage)}
          />
          <MetricCard
            title="🤚 Hand Movement"
            value={videoData.hand_movement_percentage}
            unit="%"
            color={getMetricColor(videoData.hand_movement_percentage)}
          />
          <MetricCard
            title="📢 Speech Score"
            value={videoData.speech_score}
            unit="/10"
            color={getMetricColor((videoData.speech_score || 0) * 10)}
          />
          <MetricCard
            title="💬 Filler Words"
            value={videoData.filler_word_count || 0}
            unit=" words"
            color={
              (videoData.filler_word_count || 0) < 3
                ? "#00ff99"
                : (videoData.filler_word_count || 0) < 6
                ? "#ffd166"
                : "#ff6b9d"
            }
            inverted={true}
          />
        </div>
      </div>

      {/* Metrics Comparison Chart */}
      <div style={styles.chartCard}>
        <h2 style={styles.cardTitle}>📊 Comparison with Average</h2>
        <div style={styles.chartContainer}>
          <Bar data={metricsComparisonData} options={{ responsive: true }} />
        </div>
      </div>

      {/* Performance Insights */}
      <div style={styles.insightsSection}>
        <h2 style={styles.sectionTitle}>💡 Performance Insights</h2>
        <div style={styles.insightsGrid}>
          <InsightCard
            icon="🏆"
            title="Strongest Metric"
            value={getStrongestMetric(videoData)}
            color="#00ff99"
          />
          <InsightCard
            icon="⚠️"
            title="Needs Improvement"
            value={getWeakestMetric(videoData)}
            color="#ff6b9d"
          />
          <InsightCard
            icon="📊"
            title="Overall Rating"
            value={scoreLevel.level}
            color={scoreLevel.color}
          />
          <InsightCard
            icon="🎯"
            title="Confidence Level"
            value={videoData.confidence_level}
            color={getMetricColor(videoData.confidence_score)}
          />
        </div>
      </div>

      {/* Navigation */}
      <div style={styles.navigationSection}>
        <button
          onClick={() => {
            const prevVideo = allVideos[videoIndex + 1];
            if (prevVideo) navigate(`/video/${prevVideo.id}`);
          }}
          disabled={videoIndex === allVideos.length - 1}
          style={{
            ...styles.navButton,
            ...(videoIndex === allVideos.length - 1 ? styles.navButtonDisabled : {}),
          }}
        >
          ← Previous Session
        </button>
        <button onClick={() => navigate("/dashboard")} style={styles.navButtonCenter}>
          📊 Back to Dashboard
        </button>
        <button
          onClick={() => {
            const nextVideo = allVideos[videoIndex - 1];
            if (nextVideo) navigate(`/video/${nextVideo.id}`);
          }}
          disabled={videoIndex === 0}
          style={{
            ...styles.navButton,
            ...(videoIndex === 0 ? styles.navButtonDisabled : {}),
          }}
        >
          Next Session →
        </button>
      </div>
    </div>
  );
}

function MetricCard({ title, value, unit, color, inverted }) {
  return (
    <div style={styles.metricCard}>
      <h4 style={styles.metricTitle}>{title}</h4>
      <div style={{ ...styles.metricValue, color }}>{(value || 0).toFixed(1)}</div>
      <div style={styles.metricUnit}>{unit}</div>
      {!inverted ? (
        <div style={{ ...styles.progressBar, background: `linear-gradient(to right, ${color}, ${color})` }}>
          <div style={{ width: `${Math.min((value || 0), 100)}%`, height: "100%", background: color }}></div>
        </div>
      ) : (
        <div style={styles.inverseIndicator}>
          Lower is better ✓
        </div>
      )}
    </div>
  );
}

function InsightCard({ icon, title, value, color }) {
  return (
    <div style={styles.insightCard}>
      <div style={{ fontSize: "32px", marginBottom: "8px" }}>{icon}</div>
      <h4 style={styles.insightTitle}>{title}</h4>
      <p style={{ ...styles.insightValue, color }}>{value}</p>
    </div>
  );
}

function getStrongestMetric(videoData) {
  const metrics = {
    "Eye Contact": videoData.eye_contact_percentage || 0,
    Posture: videoData.posture_percentage || 0,
    Smile: videoData.smile_percentage || 0,
    "Hand Movement": videoData.hand_movement_percentage || 0,
    Speech: (videoData.speech_score || 0) * 10,
  };
  return Object.keys(metrics).reduce((a, b) =>
    metrics[a] > metrics[b] ? a : b
  );
}

function getWeakestMetric(videoData) {
  const metrics = {
    "Eye Contact": videoData.eye_contact_percentage || 0,
    Posture: videoData.posture_percentage || 0,
    Smile: videoData.smile_percentage || 0,
    "Hand Movement": videoData.hand_movement_percentage || 0,
    Speech: (videoData.speech_score || 0) * 10,
  };
  return Object.keys(metrics).reduce((a, b) =>
    metrics[a] < metrics[b] ? a : b
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "clamp(16px, 4vw, 24px)",
    paddingTop: "clamp(24px, 6vw, 40px)",
    background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    color: "white",
    fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(16px, 3vw, 24px)",
    marginBottom: "clamp(24px, 6vw, 40px)",
    position: "relative",
    flexWrap: "wrap",
  },
  backButtonHeader: {
    padding: "clamp(8px, 1.5vw, 10px) clamp(16px, 3vw, 20px)",
    fontSize: "clamp(12px, 1.5vw, 14px)",
    fontWeight: "600",
    background: "rgba(0, 245, 255, 0.2)",
    color: "#00f5ff",
    border: "1px solid #00f5ff",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    position: "absolute",
    left: "0",
    whiteSpace: "nowrap",
  },
  title: {
    textAlign: "center",
    fontSize: "clamp(28px, 7vw, 42px)",
    fontWeight: "700",
    letterSpacing: "-1px",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: "0",
  },
  videoNumber: {
    position: "absolute",
    right: "0",
    fontSize: "clamp(12px, 1.5vw, 14px)",
    color: "rgba(255, 255, 255, 0.6)",
    backgroundColor: "rgba(0, 245, 255, 0.1)",
    padding: "6px 12px",
    borderRadius: "8px",
    whiteSpace: "nowrap",
  },
  mainScoreCard: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    display: "flex",
    gap: "clamp(20px, 4vw, 40px)",
    alignItems: "center",
    padding: "clamp(20px, 4vw, 30px)",
    background: "linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(0, 212, 255, 0.05) 100%)",
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    border: "2px solid rgba(0, 245, 255, 0.2)",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  scoreCircle: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "clamp(140px, 25vw, 180px)",
    height: "clamp(140px, 25vw, 180px)",
    borderRadius: "50%",
    background: "rgba(0, 255, 153, 0.15)",
    border: "3px solid rgba(0, 255, 153, 0.3)",
    boxShadow: "0 0 30px rgba(0, 255, 153, 0.2)",
  },
  scoreValue: {
    fontSize: "clamp(32px, 6vw, 48px)",
    fontWeight: "700",
    color: "#00ff99",
    margin: "0",
  },
  scoreLevel: {
    fontSize: "clamp(12px, 1.5vw, 14px)",
    fontWeight: "700",
    marginTop: "4px",
  },
  sessionInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "clamp(12px, 2vw, 16px)",
    flex: 1,
    minWidth: "200px",
  },
  infoItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "clamp(10px, 2vw, 12px)",
    background: "rgba(255, 255, 255, 0.08)",
    borderRadius: "10px",
    border: "1px solid rgba(0, 245, 255, 0.1)",
  },
  infoLabel: {
    fontSize: "clamp(11px, 1.2vw, 12px)",
    opacity: "0.7",
    fontWeight: "600",
  },
  infoValue: {
    fontSize: "clamp(13px, 1.5vw, 14px)",
    fontWeight: "700",
    color: "#00f5ff",
  },
  videoPlayerCard: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "clamp(20px, 4vw, 30px)",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  videoContainer: {
    marginTop: "clamp(12px, 2vw, 20px)",
  },
  cardTitle: {
    fontSize: "clamp(16px, 3vw, 20px)",
    fontWeight: "700",
    margin: "0 0 clamp(12px, 2vw, 20px) 0",
    color: "#00f5ff",
  },
  metricsSection: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "0 clamp(12px, 2vw, 20px)",
  },
  sectionTitle: {
    fontSize: "clamp(18px, 4vw, 22px)",
    fontWeight: "700",
    marginBottom: "clamp(16px, 3vw, 20px)",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(clamp(140px, 20vw, 180px), 1fr))",
    gap: "clamp(12px, 2vw, 16px)",
  },
  metricCard: {
    background: "rgba(0, 245, 255, 0.1)",
    border: "2px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "16px",
    padding: "clamp(16px, 3vw, 20px)",
    textAlign: "center",
    transition: "all 0.3s ease",
  },
  metricTitle: {
    margin: "0 0 clamp(8px, 1.5vw, 12px) 0",
    fontSize: "clamp(13px, 1.5vw, 14px)",
    fontWeight: "700",
  },
  metricValue: {
    fontSize: "clamp(24px, 5vw, 32px)",
    fontWeight: "700",
    margin: "clamp(8px, 1vw, 12px) 0",
  },
  metricUnit: {
    fontSize: "clamp(11px, 1.2vw, 12px)",
    opacity: "0.7",
    marginBottom: "clamp(8px, 1.5vw, 12px)",
  },
  progressBar: {
    height: "8px",
    borderRadius: "4px",
    overflow: "hidden",
    background: "rgba(0, 0, 0, 0.3)",
  },
  inverseIndicator: {
    fontSize: "clamp(10px, 1vw, 11px)",
    opacity: "0.8",
    marginTop: "8px",
    fontStyle: "italic",
  },
  chartCard: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "clamp(20px, 4vw, 30px)",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  chartContainer: {
    marginTop: "clamp(16px, 3vw, 20px)",
  },
  insightsSection: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "0 clamp(12px, 2vw, 20px)",
  },
  insightsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(clamp(140px, 22vw, 180px), 1fr))",
    gap: "clamp(12px, 2vw, 16px)",
  },
  insightCard: {
    background: "rgba(255, 107, 157, 0.1)",
    border: "2px solid rgba(255, 107, 157, 0.2)",
    borderRadius: "16px",
    padding: "clamp(16px, 3vw, 20px)",
    textAlign: "center",
    transition: "all 0.3s ease",
  },
  insightTitle: {
    margin: "0 0 clamp(8px, 1.5vw, 12px) 0",
    fontSize: "clamp(13px, 1.5vw, 14px)",
    fontWeight: "700",
  },
  insightValue: {
    fontSize: "clamp(14px, 2vw, 16px)",
    fontWeight: "700",
    margin: "0",
  },
  navigationSection: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    display: "flex",
    gap: "clamp(12px, 2vw, 16px)",
    justifyContent: "center",
    flexWrap: "wrap",
    padding: "0 clamp(12px, 2vw, 20px)",
  },
  navButton: {
    padding: "clamp(10px, 1.5vw, 12px) clamp(16px, 3vw, 20px)",
    fontSize: "clamp(12px, 1.5vw, 14px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    color: "#0f2027",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(0, 245, 255, 0.3)",
    whiteSpace: "nowrap",
  },
  navButtonDisabled: {
    opacity: "0.4",
    cursor: "not-allowed",
    boxShadow: "none",
  },
  navButtonCenter: {
    padding: "clamp(10px, 1.5vw, 12px) clamp(16px, 3vw, 20px)",
    fontSize: "clamp(12px, 1.5vw, 14px)",
    fontWeight: "600",
    background: "rgba(0, 255, 153, 0.2)",
    color: "#00ff99",
    border: "2px solid #00ff99",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    whiteSpace: "nowrap",
  },
  backButton: {
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: "600",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    color: "#0f2027",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(0, 245, 255, 0.3)",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    gap: "24px",
  },
  spinner: {
    fontSize: "64px",
    animation: "spin 1s linear infinite",
  },
  errorContainer: {
    maxWidth: "600px",
    margin: "100px auto",
    padding: "40px",
    textAlign: "center",
    background: "rgba(255, 77, 77, 0.1)",
    border: "2px solid rgba(255, 77, 77, 0.3)",
    borderRadius: "16px",
  },
};

export default VideoAnalytics;
