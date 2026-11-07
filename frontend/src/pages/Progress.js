import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Radar } from "react-chartjs-2";
import {
  TrendingUp,
  Award,
  Flame,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Sparkles,
  Play,
} from "lucide-react";
import { apiJSON } from "../utils/api";
import { SkeletonStat } from "../components/Skeleton";
import "./Progress.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend
);

export default function Progress() {
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProgress() {
      setLoading(true);
      setError(null);
      try {
        const [progRes, dashRes] = await Promise.all([
          apiJSON("/progress"),
          apiJSON("/dashboard?limit=10"),
        ]);

        if (progRes.ok && progRes.data) {
          setProgressData(progRes.data);
        }
        if (dashRes.ok && Array.isArray(dashRes.data)) {
          setRecentSessions(dashRes.data);
        }
      } catch (err) {
        setError(err.message || "Failed to load progress analytics");
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, []);

  if (loading) {
    return (
      <div className="progress-page">
        <div className="progress-container">
          <div className="progress-header">
            <h1 className="progress-title">Progress & Analytics</h1>
            <p className="progress-subtitle">Loading your personalized performance trajectory…</p>
          </div>
          <div className="progress-stats-grid">
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </div>
        </div>
      </div>
    );
  }

  const sessionsCount = progressData?.sessions_count || recentSessions.length;
  const streak = progressData?.streak || 0;
  const bestScore = progressData?.best_score || (recentSessions.length ? Math.max(...recentSessions.map(s => s.confidence_score)) : 0);
  const overallDelta = progressData?.overall_delta || 0;

  // Confidence Progression Line Chart Data
  const series = progressData?.series || {};
  const labels = series.labels?.length
    ? series.labels
    : recentSessions.slice(0, 10).reverse().map((s, i) => `Session ${i + 1}`);

  const confidenceScores = series.confidence?.length
    ? series.confidence
    : recentSessions.slice(0, 10).reverse().map((s) => s.confidence_score);

  const lineChartData = {
    labels,
    datasets: [
      {
        label: "Overall Confidence Score",
        data: confidenceScores,
        borderColor: "#7c5cfc",
        backgroundColor: "rgba(124, 92, 252, 0.15)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#c4b5fd",
        pointBorderColor: "#7c5cfc",
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(18, 24, 38, 0.95)",
        titleColor: "#ffffff",
        bodyColor: "#cbd5e1",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 12,
        displayColors: false,
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: { color: "rgba(255, 255, 255, 0.06)" },
        ticks: { color: "#94a3b8" },
      },
      x: {
        grid: { display: false },
        ticks: { color: "#94a3b8", maxRotation: 0 },
      },
    },
  };

  // Radar Chart: Metric Balance Overview
  const latest = recentSessions[0] || {};
  const radarData = {
    labels: ["Eye Contact", "Posture", "Facial Warmth", "Speech Score", "Hand Gestures"],
    datasets: [
      {
        label: "Current Metric Balance",
        data: [
          latest.eye_contact_percentage || 60,
          latest.posture_percentage || 65,
          latest.smile_percentage || 55,
          latest.speech_score || 70,
          latest.hand_movement_percentage || 50,
        ],
        backgroundColor: "rgba(124, 92, 252, 0.25)",
        borderColor: "#7c5cfc",
        borderWidth: 2,
        pointBackgroundColor: "#c4b5fd",
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      r: {
        angleLines: { color: "rgba(255, 255, 255, 0.1)" },
        grid: { color: "rgba(255, 255, 255, 0.08)" },
        pointLabels: { color: "#cbd5e1", font: { size: 12, weight: 600 } },
        ticks: { display: false, min: 0, max: 100 },
      },
    },
  };

  return (
    <div className="progress-page">
      <div className="progress-container">
        {/* Header */}
        <div className="progress-header animate-fadeUp">
          <div className="progress-badge">
            <TrendingUp size={14} /> Analytics & Growth
          </div>
          <div className="progress-header-row">
            <div>
              <h1 className="progress-title">Performance Trajectory</h1>
              <p className="progress-subtitle">
                Track how your body language, gaze discipline, and vocal delivery compound over time.
              </p>
            </div>
            <Link to="/practice" className="progress-cta-btn">
              <Play size={16} fill="currentColor" /> Start Practice Drill
            </Link>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ padding: "14px 18px", marginBottom: "20px", background: "rgba(239,68,68,0.1)", borderRadius: "10px", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.9rem" }}>
            <span>{error}</span>
          </div>
        )}

        {/* 4 Key Metrics Bar */}
        <div className="progress-stats-grid animate-fadeUp">
          <div className="progress-stat-card">
            <div className="progress-stat-icon" style={{ background: "rgba(124, 92, 252, 0.15)", color: "#a78bfa" }}>
              <Zap size={22} />
            </div>
            <div className="progress-stat-value">{Math.round(bestScore)}</div>
            <div className="progress-stat-label">Personal Best Score</div>
          </div>

          <div className="progress-stat-card">
            <div className="progress-stat-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
              <Flame size={22} />
            </div>
            <div className="progress-stat-value">{streak} Days</div>
            <div className="progress-stat-label">7-Day Consistency Streak</div>
          </div>

          <div className="progress-stat-card">
            <div className="progress-stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
              <Award size={22} />
            </div>
            <div className="progress-stat-value">{sessionsCount}</div>
            <div className="progress-stat-label">Completed Assessments</div>
          </div>

          <div className="progress-stat-card">
            <div className="progress-stat-icon" style={{ background: overallDelta >= 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: overallDelta >= 0 ? "#34d399" : "#f87171" }}>
              {overallDelta >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
            </div>
            <div className="progress-stat-value">
              {overallDelta > 0 ? `+${overallDelta.toFixed(1)}%` : `${overallDelta.toFixed(1)}%`}
            </div>
            <div className="progress-stat-label">Recent Score Delta</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="progress-charts-grid animate-fadeUp">
          <div className="progress-chart-card">
            <div className="progress-chart-header">
              <h2 className="progress-chart-title">Confidence Score Evolution</h2>
              <span className="progress-chart-tag">Last 10 Sessions</span>
            </div>
            <div className="progress-canvas-wrapper">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          </div>

          <div className="progress-chart-card">
            <div className="progress-chart-header">
              <h2 className="progress-chart-title">Biometric Balance Matrix</h2>
              <span className="progress-chart-tag">5 Core Dimensions</span>
            </div>
            <div className="progress-canvas-wrapper">
              <Radar data={radarData} options={radarOptions} />
            </div>
          </div>
        </div>

        {/* Per-Metric Comparison Cards */}
        {progressData?.metrics && (
          <div className="progress-metrics-section animate-fadeUp">
            <h2 className="progress-section-heading">Detailed Dimension Breakdown</h2>
            <div className="progress-metrics-grid">
              {Object.entries(progressData.metrics).map(([metricName, data]) => {
                const isPositive = data.delta >= 0;
                return (
                  <div key={metricName} className="progress-metric-box">
                    <div className="progress-metric-header">
                      <span className="progress-metric-name">{metricName}</span>
                      <span className={`progress-metric-delta ${isPositive ? "progress-metric-delta--up" : "progress-metric-delta--down"}`}>
                        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(data.delta).toFixed(1)}%
                      </span>
                    </div>
                    <div className="progress-metric-scores">
                      <span className="progress-metric-current">{Math.round(data.current)}%</span>
                      <span className="progress-metric-prev">prev: {Math.round(data.previous)}%</span>
                    </div>
                    <div className="progress-metric-bar">
                      <div
                        className="progress-metric-bar-fill"
                        style={{ width: `${Math.min(100, Math.max(5, data.current))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Session History Table */}
        <div className="progress-history-card animate-fadeUp">
          <div className="progress-history-header">
            <h2 className="progress-chart-title">Recent Session Log</h2>
            <Link to="/dashboard" className="progress-view-all-link">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div className="progress-empty-state">
              <Sparkles size={32} className="progress-empty-icon" />
              <p>No video sessions recorded yet. Record your first practice session to build your analytics profile!</p>
              <Link to="/ai" className="progress-cta-btn" style={{ marginTop: "12px" }}>
                Record First Session
              </Link>
            </div>
          ) : (
            <div className="progress-table-wrap">
              <table className="progress-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Eye Contact</th>
                    <th>Posture</th>
                    <th>Speech Score</th>
                    <th>WPM</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.created_at ? new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}</td>
                      <td>
                        <span className="progress-score-pill">
                          {Math.round(s.confidence_score)}%
                        </span>
                      </td>
                      <td>{Math.round(s.eye_contact_percentage)}%</td>
                      <td>{Math.round(s.posture_percentage)}%</td>
                      <td>{Math.round(s.speech_score)}%</td>
                      <td>{Math.round(s.words_per_minute)} wpm</td>
                      <td>
                        <Link to={`/video/${s.id}`} className="progress-inspect-link">
                          Inspect ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
