import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const AUTO_REFRESH_INTERVAL = 5000; // Refresh every 5 seconds
const API_ENDPOINTS = {
  dashboard: `${API_BASE_URL}/dashboard`,
  storage: `${API_BASE_URL}/storage`,
};

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
    fetch(`${API_BASE_URL}/dashboard`, {
      headers: {
        "X-User-ID": userId || "",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch dashboard");
        return res.json();
      })
      .then((data) => {
        const sorted = Array.isArray(data) ? [...data].reverse() : [];
        setDataPoints(sorted);
        setLastUpdate(new Date().toLocaleTimeString());
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load dashboard. Please refresh.");
        setLoading(false);
      });
  }, []);

  const fetchStorage = useCallback(() => {
    const userId = localStorage.getItem("user_id");
    fetch(API_ENDPOINTS.storage, {
      headers: {
        "X-User-ID": userId || "",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch storage info");
        return res.json();
      })
      .then((data) => {
        setStorageInfo(data);
      })
      .catch((err) => {
        console.error("Storage fetch error:", err);
      });
  }, []);

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

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    // Fetch immediately on mount
    fetchDashboard();
    fetchStorage();

    // Set up auto-refresh interval
    refreshIntervalRef.current = setInterval(() => {
      fetchDashboard();
      fetchStorage();
    }, AUTO_REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchDashboard, fetchStorage]);

  // Manual refresh function for button
  const handleManualRefresh = () => {
    fetchDashboard();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this session?")) return;

    try {
      const userId = localStorage.getItem("user_id");
      const response = await fetch(`${API_BASE_URL}/delete/${id}`, {
        method: "DELETE",
        headers: {
          "X-User-ID": userId || "",
        },
      });
      if (!response.ok) throw new Error("Delete failed");
      fetchDashboard();
    } catch (err) {
      console.error(err);
      setError("Failed to delete session. Please try again.");
    }
  };

  const latest = dataPoints[dataPoints.length - 1];
  const previous = dataPoints[dataPoints.length - 2];
  const first = dataPoints[0];

  const average =
    dataPoints.length > 0
      ? (
          dataPoints.reduce((sum, d) => sum + d.confidence_score, 0) /
          dataPoints.length
        ).toFixed(2)
      : 0;

  const best =
    dataPoints.length > 0
      ? Math.max(...dataPoints.map((d) => d.confidence_score)).toFixed(2)
      : 0;

  // Trend Analysis
  const getTrend = useCallback((currentVal, prevVal) => {
    if (!currentVal || !prevVal) return { direction: "➡️", change: 0, percent: 0 };
    const change = currentVal - prevVal;
    const percent = ((change / prevVal) * 100).toFixed(1);
    return {
      direction: change > 0 ? "📈" : change < 0 ? "📉" : "➡️",
      change: change.toFixed(2),
      percent: Math.abs(percent)
    };
  }, []);

  // Overall Progress
  const overallProgress = first && latest ? {
    startScore: Number(first.confidence_score).toFixed(2),
    currentScore: Number(latest.confidence_score).toFixed(2),
    improvement: (latest.confidence_score - first.confidence_score).toFixed(2),
    improvementPercent: (((latest.confidence_score - first.confidence_score) / first.confidence_score) * 100).toFixed(1)
  } : null;

  // Comprehensive Stats
  const getComprehensiveStats = useCallback(() => {
    if (dataPoints.length === 0) return null;
    
    return {
      eyeContact: {
        best: Math.max(...dataPoints.map(d => d.eye_contact_percentage || 0)),
        current: latest.eye_contact_percentage,
        avg: (dataPoints.reduce((sum, d) => sum + (d.eye_contact_percentage || 0), 0) / dataPoints.length).toFixed(2)
      },
      posture: {
        best: Math.max(...dataPoints.map(d => d.posture_percentage || 0)),
        current: latest.posture_percentage,
        avg: (dataPoints.reduce((sum, d) => sum + (d.posture_percentage || 0), 0) / dataPoints.length).toFixed(2)
      },
      smile: {
        best: Math.max(...dataPoints.map(d => d.smile_percentage || 0)),
        current: latest.smile_percentage,
        avg: (dataPoints.reduce((sum, d) => sum + (d.smile_percentage || 0), 0) / dataPoints.length).toFixed(2)
      },
      handMovement: {
        best: Math.max(...dataPoints.map(d => d.hand_movement_percentage || 0)),
        current: latest.hand_movement_percentage,
        avg: (dataPoints.reduce((sum, d) => sum + (d.hand_movement_percentage || 0), 0) / dataPoints.length).toFixed(2)
      },
      speech: {
        best: Math.max(...dataPoints.map(d => d.speech_score || 0)),
        current: latest.speech_score,
        avg: (dataPoints.reduce((sum, d) => sum + (d.speech_score || 0), 0) / dataPoints.length).toFixed(2)
      }
    };
  }, [dataPoints, latest]);

  // Best Session
  const bestSession = dataPoints.length > 0 
    ? dataPoints.reduce((best, current) => 
        current.confidence_score > best.confidence_score ? current : best
      )
    : null;

  // Most Improved Metric
  const getMostImprovedMetric = useCallback(() => {
    if (!previous || !latest) return null;
    const metrics = [
      { name: "Eye Contact", prev: previous.eye_contact_percentage || 0, curr: latest.eye_contact_percentage || 0 },
      { name: "Posture", prev: previous.posture_percentage || 0, curr: latest.posture_percentage || 0 },
      { name: "Smile", prev: previous.smile_percentage || 0, curr: latest.smile_percentage || 0 },
      { name: "Hand Movement", prev: previous.hand_movement_percentage || 0, curr: latest.hand_movement_percentage || 0 },
      { name: "Speech", prev: previous.speech_score || 0, curr: latest.speech_score || 0 }
    ];
    return metrics.reduce((best, m) => 
      (m.curr - m.prev) > (best.curr - best.prev) ? m : best
    );
  }, [previous, latest]);

  // Achievements
  const getAchievements = useCallback(() => {
    const achievements = [];
    
    if (latest && latest.confidence_score >= 85) {
      achievements.push({ icon: "🔥", title: "Confidence Champion", desc: "Consistency is key" });
    }
    if (overallProgress && parseFloat(overallProgress.improvementPercent) >= 20) {
      achievements.push({ icon: "⭐", title: "Most Improved", desc: `+${overallProgress.improvementPercent}% progress` });
    }
    if (latest && latest.eye_contact_percentage >= 80) {
      achievements.push({ icon: "👁️", title: "Eye Contact Expert", desc: "Mastered eye contact" });
    }
    if (latest && latest.posture_percentage >= 85) {
      achievements.push({ icon: "🧍", title: "Posture Master", desc: "Standing tall and proud" });
    }
    if (dataPoints.length >= 10) {
      achievements.push({ icon: "🎯", title: "Dedicated Practitioner", desc: `${dataPoints.length} sessions completed` });
    }
    const avgScore = parseFloat(average);
    if (avgScore >= 75) {
      achievements.push({ icon: "🌟", title: "Consistent Performer", desc: "Maintaining excellence" });
    }
    
    return achievements;
  }, [latest, overallProgress, dataPoints.length, average]);

  // Smart Recommendations
  const getSmartRecommendations = useCallback(() => {
    const recs = [];
    
    if (latest && previous) {
      const eyeTrend = getTrend(latest.eye_contact_percentage, previous.eye_contact_percentage);
      if (eyeTrend.direction === "📈" && latest.eye_contact_percentage > 70) {
        recs.push({ icon: "👁️", title: "Eye Contact Improving!", desc: `Keep it up! +${eyeTrend.change}% from last session` });
      }
      if (latest.smile_percentage < 50) {
        recs.push({ icon: "😊", title: "Practice Your Smile", desc: "Show more warmth in your expressions" });
      }
      if (latest.filler_word_count > 5) {
        recs.push({ icon: "💬", title: "Reduce Filler Words", desc: `${latest.filler_word_count} filler words detected` });
      }
    }
    
    if (latest && latest.posture_percentage < 70) {
      recs.push({ icon: "🧍", title: "Improve Your Posture", desc: "Stand straighter for more confidence" });
    }
    
    return recs.slice(0, 3);
  }, [latest, previous, getTrend]);

  const chartData = {
    labels: dataPoints.map((d) =>
    new Date(d.created_at).toLocaleDateString()
),
    datasets: [
      {
        label: "Confidence Score",
        data: dataPoints.map((d) => d.confidence_score),
        borderColor: "#00f5ff",
        backgroundColor: "#00f5ff",
        tension: 0.4,
      },
    ],
  };

  const weakestMetric = latest
    ? Object.entries({
        Eye: latest.eye_contact_percentage,
        Smile: latest.smile_percentage,
        Posture: latest.posture_percentage,
        Speech: latest.speech_score,
      }).sort((a, b) => (a[1] || 0) - (b[1] || 0))[0]
    : null;

  return (
    <div style={styles.page}>
      <div style={styles.headerWithRefresh}>
        <div style={styles.headerContent}>
          <span style={styles.purposeTag}>📊 Session Analytics</span>
          <h1 style={styles.title}>Your Confidence Analysis Dashboard</h1>
          <p style={styles.headerDescription}>
            Track your progress across all recorded sessions. View real-time confidence metrics including 
            eye contact, posture, speech patterns, and overall performance scores.
          </p>
        </div>
        <div style={styles.refreshContainer}>
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            style={{
              ...styles.refreshButton,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer"
            }}
            title="Refresh dashboard data"
          >
            🔄 {loading ? "Loading..." : "Refresh"}
          </button>
          {lastUpdate && (
            <div style={styles.lastUpdate}>
              Last updated: {lastUpdate}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={styles.errorMessage}>
          ⚠️ {error}
          <button
            onClick={() => setError(null)}
            style={styles.closeButton}
          >
            ✕
          </button>
        </div>
      )}

      {/* STORAGE METER */}
      {storageInfo && (
        <div style={styles.storageCard}>
          <div style={styles.storageHeader}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>💾 Storage Usage</h3>
            <span style={{ fontSize: "14px", opacity: "0.8" }}>{storageInfo.used_mb} MB / {storageInfo.limit_mb} MB</span>
          </div>
          <div style={styles.storageBarContainer}>
            <div 
              style={{
                ...styles.storageBar,
                width: `${Math.min(storageInfo.percentage, 100)}%`,
                backgroundColor: storageInfo.percentage >= 90 ? "#ff6b9d" : storageInfo.percentage >= 70 ? "#ffaa00" : "#00ff99"
              }}
            />
          </div>
          <div style={styles.storageText}>
            {storageInfo.percentage >= 100 
              ? "❌ Storage limit reached. Delete old videos to upload new ones." 
              : storageInfo.percentage >= 90
              ? `⚠️ ${(100 - storageInfo.percentage).toFixed(1)} MB remaining`
              : `✅ ${storageInfo.available_mb} MB available`
            }
          </div>
        </div>
      )}

      {/* PROGRESS SUMMARY WITH TRENDS */}
      {overallProgress && (
        <ProgressSummary progress={overallProgress} />
      )}

      {/* KPI CARDS */}
      {latest && (
        <div style={styles.grid}>
          <Stat title="Current Score" value={latest.confidence_score?.toFixed(2)} icon="⚡" />
          <Stat title="Average Score" value={average} icon="📊" />
          <Stat title="Best Score" value={best} icon="🏆" />
          <Stat title="Sessions" value={dataPoints.length} icon="🎬" />
        </div>
      )}

      {/* ACHIEVEMENT BADGES */}
      <AchievementBadges achievements={getAchievements()} />

      {/* CHART */}
      {/* <div style={styles.glassCard}>
        <h2 style={styles.chartTitle}>📈 Confidence Trend Over Time</h2>
        <Line data={chartData} />
      </div> */}

      {/* COMPREHENSIVE STATISTICS */}
      <ComprehensiveStats stats={getComprehensiveStats()} latest={latest} />

      {/* SMART RECOMMENDATIONS */}
      <SmartRecommendations recommendations={getSmartRecommendations()} />

      {/* BEST SESSION HIGHLIGHT */}
      {bestSession && (
        <BestSessionCard session={bestSession} />
      )}

      {/* DETAILED SESSION INSIGHTS */}
      <DetailedSessionHistory dataPoints={dataPoints} latest={latest} getTrend={getTrend} />

      {/* SESSION TABLE */}
      <div style={styles.tableCard}>
        <h3 style={{fontSize: "clamp(16px, 3vw, 18px)", fontWeight: "700", marginTop: "0"}}>📋 Full Session History</h3>
        <div style={{overflowX: "auto", WebkitOverflowScrolling: "touch"}}>
          <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Session</th>
              <th style={styles.th}>Score</th>
              <th style={styles.th}>Level</th>
              <th style={styles.th}>Eye Contact</th>
              <th style={styles.th}>Posture</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Video</th> 
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {dataPoints.map((d, i) => (
              <tr key={i}>
                <td style={styles.td}>#{dataPoints.length - i}</td>
                <td style={styles.td}><strong>{d.confidence_score?.toFixed(2)}</strong></td>
                <td
                  style={{
                    ...styles.td,
                    ...(d.confidence_level?.includes("High")
                      ? styles.high
                      : d.confidence_level?.includes("Medium")
                      ? styles.moderate
                      : styles.low),
                  }}
                >
                  {d.confidence_level}
                </td>
                <td style={styles.td}>{d.eye_contact_percentage?.toFixed(0)}%</td>
                <td style={styles.td}>{d.posture_percentage?.toFixed(0)}%</td>
                <td style={styles.td}>{new Date(d.created_at).toLocaleDateString()}</td>
                <td style={styles.td}>
  {d.video_path ? (
    <video width="100" height="75" controls style={{maxWidth: "100%", borderRadius: "6px"}}>
      {/* Make sure /uploads/ is right here in the middle! */}
      <source src={`${API_BASE_URL}/uploads/${d.video_path}`} />
    </video>
  ) : (
    <span style={{ opacity: 0.6, fontSize: "clamp(11px, 1.2vw, 12px)" }}>No Video</span>
  )}
</td>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                    <button
                      style={styles.analyticsBtn}
                      onClick={() => navigate(`/video/${d.id}`)}
                      title="View detailed analytics"
                    >
                      📊 Analytics
                    </button>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => handleDelete(d.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

/* Components */

function ProgressSummary({ progress }) {
  return (
    <div style={styles.progressSummary}>
      <div>
        <h2 style={styles.progressTitle}>🚀 Your Progress Journey</h2>
        <div style={styles.progressStats}>
          <div style={styles.progressStat}>
            <span style={styles.progressLabel}>Starting Score</span>
            <span style={styles.progressValue}>{progress.startScore}</span>
          </div>
          <div style={styles.progressArrow}>→</div>
          <div style={styles.progressStat}>
            <span style={styles.progressLabel}>Current Score</span>
            <span style={styles.progressValue}>{progress.currentScore}</span>
          </div>
        </div>
      </div>
      <div style={{...styles.improvementCard, background: parseFloat(progress.improvementPercent) >= 0 ? "rgba(0, 255, 153, 0.1)" : "rgba(255, 107, 157, 0.1)"}}>
        <div style={{fontSize: "clamp(28px, 6vw, 40px)", marginBottom: "8px"}}>
          {parseFloat(progress.improvementPercent) >= 0 ? "📈" : "📉"}
        </div>
        <div style={{fontSize: "clamp(20px, 5vw, 28px)", fontWeight: "700", color: parseFloat(progress.improvementPercent) >= 0 ? "#00ff99" : "#ff6b9d"}}>
          {parseFloat(progress.improvementPercent) >= 0 ? "+" : ""}{progress.improvement}
        </div>
        <div style={{fontSize: "clamp(10px, 1.5vw, 12px)", color: parseFloat(progress.improvementPercent) >= 0 ? "#00ff99" : "#ff6b9d", fontWeight: "700"}}>
          {Math.abs(progress.improvementPercent)}% IMPROVEMENT
        </div>
      </div>
    </div>
  );
}

function AchievementBadges({ achievements }) {
  if (achievements.length === 0) return null;
  return (
    <div style={styles.achievementSection}>
      <h2 style={styles.sectionTitle}>🏆 Achievements Unlocked</h2>
      <div style={styles.badgesGrid}>
        {achievements.map((ach, idx) => (
          <div key={idx} style={styles.badge}>
            <div style={{fontSize: "clamp(24px, 5vw, 32px)", marginBottom: "8px"}}>{ach.icon}</div>
            <div style={{fontSize: "clamp(12px, 1.5vw, 13px)", fontWeight: "700"}}>{ach.title}</div>
            <div style={{fontSize: "clamp(10px, 1.2vw, 11px)", opacity: "0.7", marginTop: "4px"}}>{ach.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComprehensiveStats({ stats, latest }) {
  if (!stats) return null;
  const metrics = [
    { name: "👁️ Eye Contact", ...stats.eyeContact },
    { name: "🧍 Posture", ...stats.posture },
    { name: "😊 Smile", ...stats.smile },
    { name: "🤚 Hand Movement", ...stats.handMovement },
    { name: "📢 Speech", ...stats.speech }
  ];

  return (
    <div style={styles.statsSection}>
      <h2 style={styles.sectionTitle}>📊 Comprehensive Statistics</h2>
      <div style={styles.metricsGrid}>
        {metrics.map((metric, idx) => (
          <div key={idx} style={styles.metricBox}>
            <h4 style={{margin: "0 0 clamp(8px, 1.5vw, 12px) 0", fontSize: "clamp(13px, 1.5vw, 14px)", fontWeight: "700"}}>{metric.name}</h4>
            <div style={styles.statRow}>
              <span style={{fontSize: "clamp(10px, 1.1vw, 12px)", opacity: "0.7"}}>Current</span>
              <span style={{fontSize: "clamp(14px, 2vw, 18px)", fontWeight: "700", color: "#00f5ff"}}>{metric.current?.toFixed(0)}%</span>
            </div>
            <div style={styles.statRow}>
              <span style={{fontSize: "clamp(10px, 1.1vw, 12px)", opacity: "0.7"}}>Best</span>
              <span style={{fontSize: "clamp(12px, 1.8vw, 16px)", fontWeight: "700", color: "#00ff99"}}>{metric.best?.toFixed(0)}%</span>
            </div>
            <div style={styles.statRow}>
              <span style={{fontSize: "clamp(10px, 1.1vw, 12px)", opacity: "0.7"}}>Average</span>
              <span style={{fontSize: "clamp(11px, 1.5vw, 14px)", fontWeight: "700", opacity: "0.8"}}>{metric.avg}%</span>
            </div>
            <div style={styles.progressBarSmall}>
              <div style={{...styles.progressFill, width: `${metric.current}%`, background: "#00f5ff"}}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmartRecommendations({ recommendations }) {
  if (recommendations.length === 0) return null;
  return (
    <div style={styles.recsSection}>
      <h2 style={styles.sectionTitle}>💡 Smart Recommendations</h2>
      <div style={styles.recsGrid}>
        {recommendations.map((rec, idx) => (
          <div key={idx} style={styles.recCard}>
            <div style={{fontSize: "clamp(24px, 5vw, 32px)", marginBottom: "8px"}}>{rec.icon}</div>
            <h4 style={{margin: "0 0 6px 0", fontSize: "clamp(13px, 1.5vw, 14px)", fontWeight: "700"}}>{rec.title}</h4>
            <p style={{margin: "0", fontSize: "clamp(11px, 1.3vw, 12px)", opacity: "0.8", lineHeight: "1.4"}}>{rec.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BestSessionCard({ session }) {
  return (
    <div style={styles.bestSessionCard}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px", flexWrap: "wrap"}}>
        <h2 style={{margin: "0", fontSize: "clamp(16px, 3vw, 18px)", fontWeight: "700"}}>⭐ Your Best Performance</h2>
        <div style={{fontSize: "clamp(28px, 5vw, 36px)"}}>🏆</div>
      </div>
      <div style={styles.bestSessionStats}>
        <div>
          <div style={{fontSize: "clamp(10px, 1.2vw, 12px)", opacity: "0.7", marginBottom: "4px"}}>Score</div>
          <div style={{fontSize: "clamp(24px, 5vw, 32px)", fontWeight: "700", color: "#00ff99"}}>{session.confidence_score?.toFixed(1)}</div>
        </div>
        <div style={{borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "clamp(12px, 2vw, 20px)"}}>
          <div style={{fontSize: "clamp(10px, 1.2vw, 12px)", opacity: "0.7", marginBottom: "4px"}}>Date</div>
          <div style={{fontSize: "clamp(12px, 1.5vw, 14px)", fontWeight: "600"}}>{new Date(session.created_at).toLocaleDateString()}</div>
        </div>
        <div style={{borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "clamp(12px, 2vw, 20px)"}}>
          <div style={{fontSize: "clamp(10px, 1.2vw, 12px)", opacity: "0.7", marginBottom: "4px"}}>Level</div>
          <div style={{fontSize: "clamp(12px, 1.5vw, 14px)", fontWeight: "600", color: "#00f5ff"}}>{session.confidence_level}</div>
        </div>
      </div>
    </div>
  );
}

function DetailedSessionHistory({ dataPoints, latest, getTrend }) {
  if (dataPoints.length < 2) return null;
  
  const recentSessions = dataPoints.slice(0, 3).map((session, idx) => {
    const prevSession = dataPoints[idx + 1];
    const trend = getTrend(session.confidence_score, prevSession?.confidence_score);
    const comparison = prevSession ? session.confidence_score - prevSession.confidence_score : 0;
    
    return { session, trend, comparison };
  });

  return (
    <div style={styles.sessionInsightSection}>
      <h2 style={styles.sectionTitle}>📋 Recent Session Insights</h2>
      <div style={styles.sessionCardsGrid}>
        {recentSessions.map((item, idx) => (
          <div key={idx} style={styles.sessionCard}>
            <div style={styles.sessionHeader}>
              <h4 style={{margin: "0 0 8px 0", fontSize: "clamp(13px, 1.5vw, 14px)", fontWeight: "700"}}>Session #{dataPoints.length - idx}</h4>
              <span style={{...styles.trendBadge, color: item.trend.direction === "📈" ? "#00ff99" : item.trend.direction === "📉" ? "#ff6b9d" : "#ffd166"}}>
                {item.trend.direction} {Math.abs(item.trend.change)}
              </span>
            </div>
            <div style={{...styles.scoreDisplay, color: parseFloat(item.session.confidence_score) >= 80 ? "#00ff99" : parseFloat(item.session.confidence_score) >= 60 ? "#00f5ff" : "#ff6b9d"}}>
              {item.session.confidence_score?.toFixed(1)}
            </div>
            <p style={{margin: "8px 0 0 0", fontSize: "clamp(11px, 1.2vw, 12px)", opacity: "0.7"}}>
              {new Date(item.session.created_at).toLocaleDateString()}
            </p>
            {idx > 0 && (
              <div style={{marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "clamp(10px, 1.1vw, 11px)", opacity: "0.8"}}>
                {item.comparison > 0 ? "📈" : "📉"} {Math.abs(item.comparison).toFixed(2)} vs previous
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ title, value, icon }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      style={{
        ...styles.statCard,
        ...(isHovered ? styles.statCardHover : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{fontSize: "clamp(18px, 4vw, 24px)", marginBottom: "8px"}}>{icon}</div>
      <p style={styles.statTitle}>{title}</p>
      <h2 style={styles.statValue}>{value}</h2>
    </div>
  );
}

/* Styles */
const styles = {
  page: {
    minHeight: "100vh",
    padding: "clamp(16px, 4vw, 24px)",
    paddingTop: "clamp(24px, 6vw, 40px)",
    background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    color: "white",
    fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
  },
  purposeTag: {
    display: "inline-block",
    background: "rgba(0, 245, 255, 0.15)",
    border: "1px solid rgba(0, 245, 255, 0.4)",
    color: "#00f5ff",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    marginBottom: "12px",
    textTransform: "uppercase",
  },
  headerContent: {
    flex: 1,
    textAlign: "center",
  },
  headerDescription: {
    fontSize: "clamp(13px, 2vw, 15px)",
    opacity: 0.8,
    margin: "12px 0 0 0",
    lineHeight: "1.6",
    maxWidth: "600px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  title: {
    textAlign: "center",
    marginBottom: "clamp(24px, 6vw, 40px)",
    fontSize: "clamp(28px, 7vw, 42px)",
    fontWeight: "700",
    letterSpacing: "-1px",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: "0",
  },
  headerWithRefresh: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "clamp(24px, 6vw, 40px)",
    flexWrap: "wrap",
    gap: "clamp(12px, 3vw, 20px)",
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    width: "100%",
  },
  refreshContainer: {
    display: "flex",
    alignItems: "center",
    gap: "clamp(10px, 2vw, 15px)",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  refreshButton: {
    padding: "clamp(8px, 1.5vw, 10px) clamp(16px, 3vw, 20px)",
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
  lastUpdate: {
    fontSize: "clamp(10px, 1.2vw, 12px)",
    color: "rgba(255, 255, 255, 0.7)",
    padding: "clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 10px)",
    backgroundColor: "rgba(0, 245, 255, 0.1)",
    borderRadius: "5px",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    whiteSpace: "nowrap",
  },
  progressSummary: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "clamp(20px, 4vw, 40px)",
    padding: "clamp(20px, 4vw, 30px)",
    background: "linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(0, 212, 255, 0.05) 100%)",
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    border: "2px solid rgba(0, 245, 255, 0.2)",
    flexWrap: "wrap",
  },
  progressTitle: {
    margin: "0 0 clamp(12px, 2vw, 20px) 0",
    fontSize: "clamp(18px, 4vw, 22px)",
    fontWeight: "700",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  progressStats: {
    display: "flex",
    alignItems: "center",
    gap: "clamp(12px, 2vw, 20px)",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  progressStat: {
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
  },
  progressLabel: {
    fontSize: "clamp(10px, 1.2vw, 12px)",
    opacity: "0.7",
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: "4px",
  },
  progressValue: {
    fontSize: "clamp(24px, 5vw, 32px)",
    fontWeight: "700",
    color: "#00f5ff",
  },
  progressArrow: {
    fontSize: "clamp(18px, 4vw, 24px)",
    color: "#00f5ff",
    opacity: "0.6",
  },
  improvementCard: {
    padding: "clamp(16px, 3vw, 24px)",
    borderRadius: "12px",
    border: "1px solid rgba(0, 255, 153, 0.3)",
    textAlign: "center",
    minWidth: "clamp(120px, 25vw, 180px)",
  },
  achievementSection: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "0 clamp(12px, 2vw, 20px)",
  },
  sectionTitle: {
    fontSize: "clamp(18px, 4vw, 22px)",
    fontWeight: "700",
    marginBottom: "clamp(12px, 2vw, 20px)",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  badgesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(clamp(100px, 20vw, 140px), 1fr))",
    gap: "clamp(12px, 2vw, 16px)",
  },
  badge: {
    background: "rgba(0, 245, 255, 0.1)",
    backdropFilter: "blur(12px)",
    border: "2px solid rgba(0, 245, 255, 0.3)",
    borderRadius: "12px",
    padding: "clamp(12px, 2vw, 20px)",
    textAlign: "center",
    transition: "all 0.3s ease",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(clamp(160px, 20vw, 200px), 1fr))",
    gap: "clamp(12px, 2vw, 16px)",
    marginBottom: "clamp(24px, 6vw, 40px)",
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "0 clamp(12px, 2vw, 20px)",
  },
  statCard: {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(16px)",
    padding: "clamp(16px, 3vw, 24px) clamp(12px, 2vw, 20px)",
    borderRadius: "16px",
    textAlign: "center",
    border: "1px solid rgba(0, 245, 255, 0.15)",
    boxShadow: "0 4px 20px rgba(0, 245, 255, 0.08)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    animation: "fadeIn 0.5s ease",
  },
  statCardHover: {
    background: "rgba(255,255,255,0.12)",
    boxShadow: "0 8px 32px rgba(0, 245, 255, 0.15)",
    transform: "translateY(-4px)",
    border: "1px solid rgba(0, 245, 255, 0.25)",
  },
  statTitle: {
    opacity: 0.7,
    marginBottom: "clamp(8px, 1vw, 12px)",
    fontSize: "clamp(11px, 1.2vw, 13px)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    fontWeight: "600",
    margin: "0 0 clamp(8px, 1vw, 12px) 0",
  },
  statValue: {
    margin: 0,
    fontSize: "clamp(20px, 4vw, 28px)",
    fontWeight: "700",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  glassCard: {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    padding: "clamp(20px, 4vw, 30px)",
    borderRadius: "20px",
    marginBottom: "clamp(24px, 6vw, 40px)",
    boxShadow: "0 8px 32px rgba(0, 245, 255, 0.1)",
    border: "1px solid rgba(255,255,255,0.12)",
    animation: "slideDown 0.5s ease",
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
  },
  chartTitle: {
    fontSize: "clamp(16px, 3vw, 20px)",
    fontWeight: "700",
    marginBottom: "clamp(12px, 2vw, 20px)",
    color: "#00f5ff",
    margin: "0 0 clamp(12px, 2vw, 20px) 0",
  },
  statsSection: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "clamp(20px, 4vw, 30px)",
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    border: "1px solid rgba(0, 245, 255, 0.1)",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(clamp(150px, 20vw, 180px), 1fr))",
    gap: "clamp(12px, 2vw, 16px)",
  },
  metricBox: {
    background: "rgba(0, 245, 255, 0.08)",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "12px",
    padding: "clamp(12px, 2vw, 16px)",
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  progressBarSmall: {
    height: "6px",
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: "3px",
    overflow: "hidden",
    marginTop: "8px",
  },
  progressFill: {
    height: "100%",
    transition: "width 0.3s ease",
  },
  recsSection: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "clamp(20px, 4vw, 30px)",
    background: "rgba(255, 107, 157, 0.05)",
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    border: "1px solid rgba(255, 107, 157, 0.2)",
  },
  recsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(clamp(160px, 20vw, 200px), 1fr))",
    gap: "clamp(12px, 2vw, 16px)",
  },
  recCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255, 107, 157, 0.3)",
    borderRadius: "12px",
    padding: "clamp(16px, 3vw, 20px)",
    textAlign: "center",
    transition: "all 0.3s ease",
  },
  bestSessionCard: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "clamp(20px, 4vw, 30px)",
    background: "linear-gradient(135deg, rgba(0, 255, 153, 0.1) 0%, rgba(0, 212, 255, 0.1) 100%)",
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    border: "2px solid rgba(0, 255, 153, 0.3)",
  },
  bestSessionStats: {
    display: "flex",
    gap: "clamp(12px, 2vw, 20px)",
    alignItems: "center",
    flexWrap: "wrap",
  },
  sessionInsightSection: {
    maxWidth: "1200px",
    margin: "0 auto clamp(24px, 6vw, 40px) auto",
    padding: "0 clamp(12px, 2vw, 20px)",
  },
  sessionCardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(clamp(160px, 20vw, 200px), 1fr))",
    gap: "clamp(12px, 2vw, 16px)",
  },
  sessionCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "12px",
    padding: "clamp(16px, 3vw, 20px)",
    transition: "all 0.3s ease",
  },
  sessionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "clamp(8px, 1.5vw, 12px)",
  },
  trendBadge: {
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "clamp(10px, 1.2vw, 12px)",
    fontWeight: "700",
  },
  scoreDisplay: {
    fontSize: "clamp(20px, 4vw, 28px)",
    fontWeight: "700",
    marginBottom: "8px",
  },
  tableCard: {
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(12px)",
    padding: "clamp(16px, 3vw, 30px)",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
    overflowX: "auto",
    maxWidth: "1200px",
    margin: "0 auto",
    WebkitOverflowScrolling: "touch",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "clamp(12px, 2vw, 20px)",
    fontSize: "clamp(12px, 1.5vw, 14px)",
  },
  th: {
    textAlign: "left",
    padding: "clamp(10px, 2vw, 16px)",
    borderBottom: "2px solid rgba(0, 245, 255, 0.2)",
    fontWeight: "700",
    textTransform: "uppercase",
    fontSize: "clamp(10px, 1.2vw, 12px)",
    letterSpacing: "0.8px",
    color: "rgba(0, 245, 255, 0.9)",
  },
  td: {
    padding: "clamp(10px, 2vw, 16px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  high: {
    color: "#00ff99",
    fontWeight: "700",
    background: "rgba(0, 255, 153, 0.1)",
    padding: "4px 8px",
    borderRadius: "6px",
    display: "inline-block",
  },
  moderate: {
    color: "#ffd166",
    fontWeight: "700",
    background: "rgba(255, 209, 102, 0.1)",
    padding: "4px 8px",
    borderRadius: "6px",
    display: "inline-block",
  },
  low: {
    color: "#ff6b9d",
    fontWeight: "700",
    background: "rgba(255, 77, 109, 0.1)",
    padding: "4px 8px",
    borderRadius: "6px",
    display: "inline-block",
  },
  deleteBtn: {
    background: "linear-gradient(135deg, #ff4d6d, #ff6b9d)",
    border: "none",
    padding: "clamp(6px, 1vw, 8px) clamp(12px, 2vw, 16px)",
    borderRadius: "8px",
    color: "white",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "clamp(10px, 1.2vw, 12px)",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(255, 77, 109, 0.3)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  analyticsBtn: {
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    border: "none",
    padding: "clamp(6px, 1vw, 8px) clamp(12px, 2vw, 16px)",
    borderRadius: "8px",
    color: "#0f2027",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "clamp(10px, 1.2vw, 12px)",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(0, 245, 255, 0.3)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  errorMessage: {
    background: "rgba(255, 77, 77, 0.15)",
    border: "1px solid rgba(255, 77, 77, 0.5)",
    color: "#ff9999",
    padding: "clamp(12px, 2vw, 16px) clamp(14px, 3vw, 20px)",
    borderRadius: "12px",
    marginBottom: "clamp(12px, 2vw, 20px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backdropFilter: "blur(10px)",
    animation: "slideDown 0.3s ease",
    maxWidth: "1200px",
    margin: "0 auto clamp(12px, 2vw, 20px) auto",
    gap: "10px",
    flexWrap: "wrap",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "#ff9999",
    cursor: "pointer",
    fontSize: "clamp(14px, 2vw, 18px)",
    fontWeight: "bold",
    padding: "0 8px",
    transition: "all 0.2s ease",
  },
  storageCard: {
    background: "rgba(0, 200, 150, 0.1)",
    border: "1px solid rgba(0, 200, 150, 0.3)",
    borderRadius: "12px",
    padding: "16px 20px",
    marginBottom: "20px",
    backdropFilter: "blur(10px)",
    maxWidth: "1200px",
    margin: "0 auto 20px auto",
  },
  storageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  storageBarContainer: {
    width: "100%",
    height: "8px",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "10px",
  },
  storageBar: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.3s ease, background-color 0.3s ease",
  },
  storageText: {
    fontSize: "13px",
    opacity: "0.85",
    color: "#00ff99",
  },
};

export default Dashboard;