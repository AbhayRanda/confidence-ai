import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
} from "chart.js";
import { Line } from "react-chartjs-2";
import GlassStat from "../components/GlassStat";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const API_ENDPOINTS = {
  dashboard: `${API_BASE_URL}/dashboard`,
  analyze: `${API_BASE_URL}/analyze`,
  storage: `${API_BASE_URL}/storage`,
};

function AIDashboard() {
  const [recordingTime, setRecordingTime] = useState(0);
  const [dataPoints, setDataPoints] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [error, setError] = useState(null);
  const [currentStream, setCurrentStream] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);

  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoRef = useRef(null);

  // Inject keyframe animations
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; box-shadow: 0 0 10px rgba(255, 77, 77, 0.8); }
        50% { opacity: 0.6; box-shadow: 0 0 20px rgba(255, 77, 77, 1); }
      }
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

const fetchDashboard = useCallback(() => {
  return new Promise((resolve, reject) => {
    setError(null);
    const userId = localStorage.getItem("user_id");
    fetch(API_ENDPOINTS.dashboard, {
      headers: {
        "X-User-ID": userId || "",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        return res.json();
      })
      .then((data) => {
        setDataPoints(Array.isArray(data) ? data : []);
        resolve(data);
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard data. Please refresh.");
        reject(err);
      });
  });
}, []);

const fetchStorage = useCallback(() => {
  setStorageLoading(true);
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
      setStorageLoading(false);
    })
    .catch((err) => {
      console.error("Storage fetch error:", err);
      setStorageLoading(false);
    });
}, []);

useEffect(() => {
  fetchDashboard();
  fetchStorage();

  // Cleanup: Stop recording and clear timers on unmount only
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };
}, [fetchDashboard, fetchStorage]);

  // 🎥 START RECORDING
  const startRecording = async () => {
    try {
      setError(null);
      
      // Stop any existing recording
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      setCurrentStream(stream);
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4'
      });
      let chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        setError(`Recording error: ${e.error}`);
        setRecording(false);
        clearInterval(timerRef.current);
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(chunks, { type: mimeType });
        setRecordedBlob(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        setCurrentStream(null);
        
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blob);
        clearInterval(timerRef.current);
        setRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);

      // ⏱ START TIMER
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          // Stop recording after 30 seconds
          if (newTime >= 30) {
            if (mediaRecorderRef.current?.state === "recording") {
              mediaRecorderRef.current.stop();
              setRecording(false);
              clearInterval(timerRef.current);
            }
          }
          return newTime;
        });
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      if (err.name === "NotAllowedError") {
        setError("❌ Camera/microphone access denied. Please allow permissions in browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("❌ Camera or microphone not found. Please check your devices.");
      } else {
        setError(`❌ Recording failed: ${err.message}`);
      }
    }
  };

  // ⏹ STOP RECORDING
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  }, []);

  // 🚀 UPLOAD FUNCTION (Works for both upload & record)
  const handleUpload = async () => {
    const fileToUpload = recordedBlob || selectedFile;

    if (!fileToUpload) {
      setError("Please upload or record a video first.");
      return;
    }

    const formData = new FormData();
    const filename = recordedBlob ? "video.webm" : selectedFile.name;
    formData.append("file", fileToUpload, filename);

    setLoading(true);
    setError(null);

    try {
      console.log("Starting analysis...");
      const userId = localStorage.getItem("user_id");
      const response = await fetch(API_ENDPOINTS.analyze, {
        method: "POST",
        body: formData,
        headers: {
          "X-User-ID": userId || "",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Check for storage limit error (413 Payload Too Large)
        if (response.status === 413) {
          setError(`❌ ${errorData.detail || "Storage limit reached (500 MB). Please delete old videos to upload new ones."}`);
          fetchStorage(); // Refresh storage info
          setLoading(false);
          return;
        }
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      console.log("Analysis complete, fetching updated dashboard...");
      
      // Wait for dashboard to update and refresh storage
      try {
        const updatedData = await fetchDashboard();
        console.log("Dashboard updated successfully");
        fetchStorage(); // Refresh storage info after successful upload
      } catch (dashErr) {
        console.error("Error refreshing dashboard:", dashErr);
      }

      // Clear recorded/selected file
      setRecordedBlob(null);
      setSelectedFile(null);
      setRecording(false);
      setRecordingTime(0);
      
      // Clear video preview
      if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current.srcObject = null;
      }
      
      setError(null);
    } catch (error) {
      console.error("Upload error:", error);
      setError(`❌ Analysis failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Format time helper
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Memoized chart data to prevent unnecessary re-renders
  const chartData = React.useMemo(() => {
    const reversedData = [...dataPoints].reverse();
    return {
      labels: reversedData.map((d) =>
        new Date(d.created_at).toLocaleDateString()
      ),
      datasets: [
        {
          label: "Confidence Score",
          data: reversedData.map((d) => d.confidence_score),
          borderColor: "#00f5ff",
          backgroundColor: "#00f5ff",
          tension: 0.4,
        },
      ],
    };
  }, [dataPoints]);

  const latest = dataPoints[0];

  // Helper function to determine score quality
  const getScoreQuality = (score, benchmarks = { excellent: 80, good: 60, fair: 40 }) => {
    if (score >= benchmarks.excellent) return { label: "Excellent", color: "#00ff99", bgColor: "rgba(0, 255, 153, 0.15)" };
    if (score >= benchmarks.good) return { label: "Good", color: "#00d4ff", bgColor: "rgba(0, 212, 255, 0.15)" };
    if (score >= benchmarks.fair) return { label: "Fair", color: "#ffaa00", bgColor: "rgba(255, 170, 0, 0.15)" };
    return { label: "Needs Work", color: "#ff6b9d", bgColor: "rgba(255, 107, 157, 0.15)" };
  };

  // Get personalized recommendations based on lowest scores
  const getRecommendations = useCallback(() => {
    if (!latest) return [];
    const metrics = [
      { name: "Eye Contact", value: latest.eye_contact_percentage, tips: ["Focus on camera lens", "Imagine speaking to a friend", "Practice 30-second eye contact drills"] },
      { name: "Posture", value: latest.posture_percentage, tips: ["Keep shoulders back", "Stand with weight balanced", "Practice mirror exercises"] },
      { name: "Smile", value: latest.smile_percentage, tips: ["Think of happy thoughts", "Smile reaches eyes (Duchenne smile)", "Natural > forced expressions"] },
      { name: "Hand Movement", value: latest.hand_movement_percentage, tips: ["Use gestures to emphasize points", "Avoid crossing arms", "Keep hands visible and relaxed"] },
    ];
    
    return metrics.sort((a, b) => a.value - b.value).slice(0, 3);
  }, [latest]);

  // 📹 VALIDATE VIDEO DURATION
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (duration > 30) {
        setError(`❌ Video is ${Math.ceil(duration)} seconds. Maximum allowed is 30 seconds.`);
        e.target.value = ""; // Reset file input
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
        setError(null);
      }
    };
    video.onerror = () => {
      setError("❌ Unable to read video file. Please select a valid video.");
      e.target.value = "";
      setSelectedFile(null);
    };
    video.src = URL.createObjectURL(file);
  };

  return (
    <div style={styles.page}>
      <div style={styles.headerSection}>
        <span style={styles.purposeTag}>🎯 Practice & Analyze</span>
        <h1 style={styles.title}>AI Confidence Trainer</h1>
        <p style={styles.subtitle}>Record yourself presenting, speaking, or pitching ideas. Get instant AI-powered feedback on your confidence metrics.</p>
      </div>

      {/* Error Message Display */}
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

      {/* 🎥 RECORD SECTION */}
      <div style={styles.recordingSection}>
  {!recording ? (
    <button onClick={startRecording} style={styles.button}>
      🎥 Start Recording
    </button>
  ) : (
    <div style={styles.recordingContainer}>
      <div style={styles.recordingIndicator}></div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={styles.recordingText}>Recording...</span>
      <span style={styles.timerText}>{formatTime(recordingTime)}</span>
    </div>
      <button onClick={stopRecording} style={styles.stopButton}>
        ⏹ Stop
      </button>
    </div>
  )}
</div>

      {/* VIDEO PREVIEW */}
      <div style={styles.videoContainer}>
        <video
          ref={videoRef}
          autoPlay
          muted={recording}
          playsinline
          controls
          style={styles.video}
        />
      </div>

      {/* UPLOAD SECTION */}
      <div style={styles.uploadBox}>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          style={styles.fileInput}
          disabled={loading}
        />
        <button 
          onClick={handleUpload} 
          style={{...styles.button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer"}}
          disabled={loading}
        >
          {loading ? "⏳ Analyzing Video... Please wait" : "🎬 Analyze Video"}
        </button>
      </div>

      {/* ANALYSIS PROGRESS MESSAGE */}
      {loading && (
        <div style={styles.analysisProgress}>
          <div style={styles.spinner}></div>
          <p style={{margin: "12px 0 0 0", fontSize: "15px", fontWeight: "600"}}>
            Analyzing your confidence metrics...
          </p>
          <p style={{margin: "6px 0 0 0", fontSize: "12px", opacity: "0.8"}}>
            This may take 15-30 seconds. Please don't close this page.
          </p>
        </div>
      )}

      {/* CHART */}
      {/* <div style={styles.glassCard}>
        <h2 style={styles.chartTitle}>📈 Progress Over Time</h2>
        <Line data={chartData} />
      </div> */}

      {/* PERFORMANCE SUMMARY */}
      {latest && (
        <>
          <PerformanceSummary latest={latest} getScoreQuality={getScoreQuality} />
          
          {/* DETAILED METRICS WITH EXPLANATIONS */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📊 Detailed Breakdown</h2>
            <MetricsGrid latest={latest} getScoreQuality={getScoreQuality} />
          </div>

          {/* PERSONALIZED RECOMMENDATIONS */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🎯 Areas to Improve</h2>
            <RecommendationsList recommendations={getRecommendations()} />
          </div>

          {/* STRENGTHS HIGHLIGHT */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>⭐ Your Strengths</h2>
            <StrengthsGrid latest={latest} getScoreQuality={getScoreQuality} />
          </div>

          {/* NEXT STEPS */}
          <NextStepsSection latest={latest} />
        </>
      )}
    </div>
  );
}

/* COMPONENT - PerformanceSummary */
function PerformanceSummary({ latest, getScoreQuality }) {
  const quality = getScoreQuality(latest.confidence_score);
  const feedbackTexts = {
    "Excellent": "🌟 Outstanding! You're demonstrating excellent confidence. Keep practicing to maintain this level.",
    "Good": "👍 Great job! You're showing good confidence. Focus on the areas below to reach excellence.",
    "Fair": "💪 Good effort! You're on the right track. Work on the suggested areas to improve faster.",
    "Needs Work": "🚀 Time to level up! Focus on the key areas below and you'll see rapid improvement."
  };

  return (
    <div style={{...styles.section, background: quality.bgColor, borderLeft: `4px solid ${quality.color}`}}>
      <div style={styles.summaryHeader}>
        <div>
          <h2 style={styles.summaryTitle}>Overall Confidence: <span style={{color: quality.color}}>{quality.label}</span></h2>
          <h1 style={{...styles.overallScore, color: quality.color}}>{Number(latest.confidence_score).toFixed(1)}/100</h1>
          <p style={styles.feedbackText}>{feedbackTexts[quality.label]}</p>
        </div>
        <div style={styles.levelBadge}>
          <span style={{fontSize: "48px", marginBottom: "8px"}}>
            {latest.confidence_level === "High" ? "🔥" : latest.confidence_level === "Medium" ? "⚡" : "🌱"}
          </span>
          <span style={{fontWeight: "700", fontSize: "16px"}}>{latest.confidence_level}</span>
        </div>
      </div>
    </div>
  );
}

/* COMPONENT - MetricsGrid */
function MetricsGrid({ latest, getScoreQuality }) {
  const metrics = [
    {
      title: "👁️ Eye Contact",
      value: latest.eye_contact_percentage,
      desc: "Looking at camera/audience",
      importance: "Builds trust and shows engagement",
      benchmarks: { excellent: 80, good: 60, fair: 40 }
    },
    {
      title: "😊 Smile",
      value: latest.smile_percentage,
      desc: "Natural, warm facial expressions",
      importance: "Creates connection and likability",
      benchmarks: { excellent: 70, good: 50, fair: 30 }
    },
    {
      title: "🧍 Posture",
      value: latest.posture_percentage,
      desc: "Straight, open body position",
      importance: "Projects authority and confidence",
      benchmarks: { excellent: 85, good: 70, fair: 50 }
    },
    {
      title: "🤚 Hand Movement",
      value: latest.hand_movement_percentage,
      desc: "Natural gestures while speaking",
      importance: "Emphasizes points and shows engagement",
      benchmarks: { excellent: 75, good: 55, fair: 35 }
    },
    {
      title: "📢 Speech Score",
      value: latest.speech_score,
      desc: "Clarity, pace, and delivery",
      importance: "Clear communication of message",
      benchmarks: { excellent: 80, good: 65, fair: 45 }
    },
    {
      title: "💬 Filler Words",
      value: 100 - Math.min((latest.filler_word_count ?? 0) * 10, 100),
      desc: `${latest.filler_word_count ?? 0} filler words detected`,
      importance: "Fewer fillers = more professional",
      benchmarks: { excellent: 90, good: 70, fair: 50 }
    },
    {
      title: "⚡ Words Per Minute",
      value: Math.min((latest.words_per_minute / 200) * 100, 100),
      desc: `${Number(latest.words_per_minute).toFixed(0)} WPM`,
      importance: "Optimal pace (120-150 WPM ideal)",
      benchmarks: { excellent: 80, good: 60, fair: 40 }
    },
    {
      title: "👤 Face Visibility",
      value: latest.face_visibility_percentage ?? 0,
      desc: "Face clearly visible in frame",
      importance: "Audience can see your expressions",
      benchmarks: { excellent: 90, good: 75, fair: 60 }
    },
  ];

  return (
    <div style={styles.metricsGrid}>
      {metrics.map((metric, idx) => {
        const quality = getScoreQuality(metric.value, metric.benchmarks);
        return (
          <MetricCard key={idx} metric={metric} quality={quality} />
        );
      })}
    </div>
  );
}

/* COMPONENT - MetricCard */
function MetricCard({ metric, quality }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{...styles.metricCard, borderLeft: `4px solid ${quality.color}`}}>
      <div style={styles.metricHeader} onClick={() => setExpanded(!expanded)}>
        <div style={styles.metricTop}>
          <h3 style={styles.metricTitle}>{metric.title}</h3>
          <span style={{...styles.qualityBadge, background: quality.bgColor, color: quality.color}}>
            {quality.label}
          </span>
        </div>
        <div style={{fontSize: "28px", fontWeight: "700", color: quality.color, marginBottom: "8px"}}>
          {Number(metric.value).toFixed(0)}%
        </div>
        <div style={styles.progressBar}>
          <div style={{
            ...styles.progressFill,
            width: `${metric.value}%`,
            background: quality.color
          }}></div>
        </div>
        <p style={styles.metricDesc}>{metric.desc}</p>
        <span style={styles.expandIcon}>{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div style={styles.metricDetails}>
          <p><strong>Why it matters:</strong> {metric.importance}</p>
          <div style={styles.benchmarkInfo}>
            <span>Excellent: {metric.benchmarks.excellent}%+ | </span>
            <span>Good: {metric.benchmarks.good}%+ | </span>
            <span>Fair: {metric.benchmarks.fair}%+</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* COMPONENT - RecommendationsList */
function RecommendationsList({ recommendations }) {
  return (
    <div style={styles.recommendationsGrid}>
      {recommendations.length === 0 ? (
        <p style={{...styles.noData, gridColumn: "1 / -1"}}>🎉 Great job! All areas are performing well!</p>
      ) : (
        recommendations.map((rec, idx) => (
          <RecommendationCard key={idx} index={idx + 1} recommendation={rec} />
        ))
      )}
    </div>
  );
}

/* COMPONENT - RecommendationCard */
function RecommendationCard({ index, recommendation }) {
  const [expanded, setExpanded] = useState(false);
  const priority = index === 1 ? "🔴 High" : index === 2 ? "🟡 Medium" : "🟢 Low";

  return (
    <div style={{...styles.recommendCard, opacity: 1 - index * 0.1}}>
      <div style={styles.recHeader} onClick={() => setExpanded(!expanded)}>
        <div>
          <h3 style={styles.recTitle}>{index}. {recommendation.name}</h3>
          <span style={styles.priorityBadge}>{priority}</span>
          <p style={styles.recScore}>Current: {Number(recommendation.value).toFixed(0)}% - Room to improve: {100 - Number(recommendation.value).toFixed(0)}%</p>
        </div>
        <span style={styles.expandIcon}>{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div style={styles.recDetails}>
          <h4 style={{marginTop: "0"}}>💡 Quick Tips:</h4>
          <ul style={styles.tipsList}>
            {recommendation.tips.map((tip, idx) => (
              <li key={idx} style={styles.tipItem}>✓ {tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* COMPONENT - StrengthsGrid */
function StrengthsGrid({ latest, getScoreQuality }) {
  const strengths = [
    { name: "Eye Contact", value: latest.eye_contact_percentage },
    { name: "Posture", value: latest.posture_percentage },
    { name: "Smile", value: latest.smile_percentage },
    { name: "Hand Movement", value: latest.hand_movement_percentage },
    { name: "Speech Score", value: latest.speech_score },
    { name: "Face Visibility", value: latest.face_visibility_percentage ?? 0 },
  ]
  .filter(s => s.value >= 70)
  .sort((a, b) => b.value - a.value);

  return (
    <div style={styles.strengthsGrid}>
      {strengths.length === 0 ? (
        <p style={{...styles.noData, gridColumn: "1 / -1"}}>Keep working on your skills - you'll have strengths to celebrate soon!</p>
      ) : (
        strengths.map((strength, idx) => (
          <div key={idx} style={styles.strengthCard}>
            <div style={{fontSize: "24px", marginBottom: "8px"}}>⭐</div>
            <h4 style={{margin: "0 0 8px 0", fontSize: "14px", fontWeight: "700"}}>{strength.name}</h4>
            <div style={{...styles.progressBar, marginBottom: "8px"}}>
              <div style={{...styles.progressFill, width: `${strength.value}%`, background: "#00ff99"}}></div>
            </div>
            <p style={{margin: "0", fontSize: "13px", color: "#00ff99", fontWeight: "700"}}>
              {Number(strength.value).toFixed(0)}%
            </p>
          </div>
        ))
      )}
    </div>
  );
}

/* COMPONENT - NextStepsSection */
function NextStepsSection({ latest }) {
  return (
    <div style={styles.nextStepsSection}>
      <h2 style={styles.sectionTitle}>🚀 Your Next Steps</h2>
      <div style={styles.stepsGrid}>
        <StepCard 
          number="1" 
          title="Review" 
          desc="Watch your recording and note what felt natural"
          icon="🎬"
        />
        <StepCard 
          number="2" 
          title="Focus" 
          desc="Pick ONE area from 'Areas to Improve' to work on"
          icon="🎯"
        />
        <StepCard 
          number="3" 
          title="Practice" 
          desc="Use the tips from Resources page and practice 3-5 times"
          icon="💪"
        />
        <StepCard 
          number="4" 
          title="Record Again" 
          desc="Record a new video and track your improvement"
          icon="📈"
        />
      </div>
    </div>
  );
}

/* COMPONENT - StepCard */
function StepCard({ number, title, desc, icon }) {
  return (
    <div style={styles.stepCard}>
      <div style={{fontSize: "32px", marginBottom: "12px"}}>{icon}</div>
      <div style={{...styles.stepNumber}}>Step {number}</div>
      <h4 style={{margin: "8px 0", fontSize: "16px", fontWeight: "700"}}>{title}</h4>
      <p style={{margin: "0", fontSize: "13px", opacity: "0.8", lineHeight: "1.5"}}>{desc}</p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "20px",
    paddingTop: "40px",
    background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    color: "white",
    fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
  },
  headerSection: {
    textAlign: "center",
    marginBottom: "40px",
  },
  purposeTag: {
    display: "inline-block",
    background: "rgba(0, 245, 255, 0.15)",
    border: "1px solid rgba(0, 245, 255, 0.4)",
    color: "#00f5ff",
    padding: "8px 16px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    marginBottom: "16px",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: "16px",
    opacity: 0.8,
    margin: "16px 0 0 0",
    lineHeight: "1.6",
    maxWidth: "600px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  title: {
    textAlign: "center",
    marginBottom: "0",
    fontSize: "clamp(24px, 5vw, 42px)",
    fontWeight: "700",
    letterSpacing: "-1px",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    textShadow: "0 0 30px rgba(0, 245, 255, 0.3)",
    margin: "0",
  },
  recordingSection: {
    textAlign: "center",
    marginBottom: "30px",
    padding: "20px",
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(8px)",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  uploadBox: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    marginBottom: "40px",
    flexWrap: "wrap",
    padding: "20px",
    background: "rgba(255,255,255,0.03)",
    backdropFilter: "blur(8px)",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  analysisProgress: {
    maxWidth: "600px",
    margin: "0 auto 40px auto",
    padding: "30px",
    background: "linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(0, 212, 255, 0.1) 100%)",
    backdropFilter: "blur(12px)",
    borderRadius: "16px",
    border: "2px solid rgba(0, 245, 255, 0.3)",
    textAlign: "center",
    animation: "fadeIn 0.3s ease",
  },
  spinner: {
    width: "50px",
    height: "50px",
    margin: "0 auto",
    border: "4px solid rgba(0, 245, 255, 0.2)",
    borderTop: "4px solid #00f5ff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  fileInput: {
    background: "rgba(0, 245, 255, 0.1)",
    padding: "12px 16px",
    borderRadius: "10px",
    color: "white",
    border: "2px solid rgba(0, 245, 255, 0.3)",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontSize: "14px",
  },
  button: {
    padding: "12px 28px",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    border: "none",
    borderRadius: "10px",
    color: "#000",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "15px",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 4px 15px rgba(0, 245, 255, 0.3)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  buttonHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 8px 25px rgba(0, 245, 255, 0.5)",
  },
  timerText: {
    marginTop: "8px",
    fontSize: "32px",
    fontWeight: "700",
    color: "#ff4d4d",
    fontFamily: "'Courier New', monospace",
    letterSpacing: "2px",
  },
  glassCard: {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    borderRadius: "20px",
    padding: "30px",
    marginBottom: "40px",
    boxShadow: "0 8px 32px rgba(0, 245, 255, 0.1)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  chartTitle: {
    fontSize: "20px",
    fontWeight: "700",
    marginBottom: "20px",
    color: "#00f5ff",
    margin: "0 0 20px 0",
  },
  section: {
    maxWidth: "1200px",
    margin: "0 auto 40px auto",
    padding: "30px",
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    border: "1px solid rgba(0, 245, 255, 0.1)",
  },
  sectionTitle: {
    fontSize: "24px",
    fontWeight: "700",
    marginBottom: "25px",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: "0 0 25px 0",
  },
  summaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "40px",
    flexWrap: "wrap",
  },
  summaryTitle: {
    margin: "0 0 12px 0",
    fontSize: "20px",
    fontWeight: "600",
  },
  overallScore: {
    margin: "0 0 16px 0",
    fontSize: "48px",
    fontWeight: "700",
  },
  feedbackText: {
    margin: "0",
    fontSize: "15px",
    opacity: "0.9",
    lineHeight: "1.6",
  },
  levelBadge: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    background: "rgba(0, 0, 0, 0.2)",
    borderRadius: "16px",
    border: "2px solid rgba(0, 245, 255, 0.3)",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
  },
  metricCard: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "20px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  metricHeader: {
    cursor: "pointer",
  },
  metricTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  metricTitle: {
    margin: "0",
    fontSize: "16px",
    fontWeight: "700",
  },
  qualityBadge: {
    padding: "4px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  progressBar: {
    height: "8px",
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "12px",
  },
  progressFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  metricDesc: {
    margin: "0 0 8px 0",
    fontSize: "13px",
    opacity: "0.7",
  },
  expandIcon: {
    float: "right",
    fontSize: "12px",
    opacity: "0.6",
  },
  metricDetails: {
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    fontSize: "13px",
    opacity: "0.8",
  },
  benchmarkInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "12px",
    opacity: "0.7",
    marginTop: "8px",
  },
  recommendationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  recommendCard: {
    background: "rgba(255,107,157,0.08)",
    border: "1px solid rgba(255,107,157,0.3)",
    borderRadius: "12px",
    padding: "20px",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  recHeader: {
    cursor: "pointer",
  },
  recTitle: {
    margin: "0 0 8px 0",
    fontSize: "16px",
    fontWeight: "700",
    color: "#ff6b9d",
  },
  priorityBadge: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "700",
    background: "rgba(255,107,157,0.2)",
    marginBottom: "8px",
  },
  recScore: {
    margin: "8px 0 0 0",
    fontSize: "13px",
    opacity: "0.8",
  },
  recDetails: {
    marginTop: "16px",
    paddingTop: "16px",
    borderTop: "1px solid rgba(255,107,157,0.2)",
  },
  tipsList: {
    listStyle: "none",
    padding: "0",
    margin: "0",
  },
  tipItem: {
    padding: "8px 0",
    fontSize: "13px",
    opacity: "0.85",
  },
  strengthsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  },
  strengthCard: {
    background: "rgba(0,255,153,0.08)",
    border: "1px solid rgba(0,255,153,0.3)",
    borderRadius: "12px",
    padding: "20px",
    textAlign: "center",
  },
  nextStepsSection: {
    maxWidth: "1200px",
    margin: "0 auto 40px auto",
    padding: "40px 30px",
    background: "linear-gradient(135deg, rgba(0, 245, 255, 0.05) 0%, rgba(0, 212, 255, 0.03) 100%)",
    borderRadius: "20px",
    border: "2px solid rgba(0, 245, 255, 0.2)",
  },
  stepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
  },
  stepCard: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "24px",
    textAlign: "center",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    transition: "all 0.3s ease",
  },
  stepNumber: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#00f5ff",
    textTransform: "uppercase",
    opacity: "0.8",
    marginBottom: "8px",
  },
  noData: {
    fontSize: "16px",
    opacity: "0.7",
    textAlign: "center",
    padding: "30px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  },
  recordingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    flexWrap: "wrap",
  },
  recordingIndicator: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    backgroundColor: "#ff4d4d",
    boxShadow: "0 0 10px rgba(255, 77, 77, 0.8)",
    animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  },
  recordingText: {
    fontWeight: "700",
    color: "#ff4d4d",
    fontSize: "16px",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  stopButton: {
    padding: "12px 24px",
    background: "linear-gradient(135deg, #ff4d4d, #ff6b6b)",
    border: "none",
    borderRadius: "10px",
    color: "white",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(255, 77, 77, 0.3)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  errorMessage: {
    background: "rgba(255, 77, 77, 0.15)",
    border: "1px solid rgba(255, 77, 77, 0.5)",
    color: "#ff9999",
    padding: "16px 20px",
    borderRadius: "12px",
    marginBottom: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backdropFilter: "blur(10px)",
    animation: "slideDown 0.3s ease",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "#ff9999",
    cursor: "pointer",
    fontSize: "18px",
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
  videoContainer: {
    textAlign: "center",
    marginBottom: "30px",
    padding: "16px",
    background: "rgba(0, 0, 0, 0.2)",
    borderRadius: "16px",
    border: "1px solid rgba(0, 245, 255, 0.2)",
  },
  video: {
    width: "100%",
    maxWidth: "400px",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
    border: "2px solid rgba(0, 245, 255, 0.3)",
  },
};

export default AIDashboard;