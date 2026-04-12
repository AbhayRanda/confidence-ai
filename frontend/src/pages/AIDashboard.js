import React, { useEffect, useState, useRef, useCallback } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ClipLoader } from "react-spinners";

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
  const [storageInfo, setStorageInfo] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
      @keyframes fadeUp { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
      .ai-tab:hover { background: rgba(108,71,255,0.06) !important; }
      .action-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      .action-btn:active { transform: scale(0.98); }
      .sec-btn:hover { background: #f0eeff !important; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const fetchDashboard = useCallback(() => {
    const userId = localStorage.getItem("user_id");
    return fetch(API_ENDPOINTS.dashboard, { headers: { "X-User-ID": userId || "" } })
      .then((r) => r.json())
      .then((data) => setDataPoints(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchStorage = useCallback(() => {
    const userId = localStorage.getItem("user_id");
    fetch(API_ENDPOINTS.storage, { headers: { "X-User-ID": userId || "" } })
      .then((r) => r.json()).then(setStorageInfo).catch(() => {});
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchStorage();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };
  }, [fetchDashboard, fetchStorage]);

  const startRecording = async () => {
    try {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm" : "video/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      let chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blob);
        clearInterval(timerRef.current);
        setRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev + 1 >= 30) {
            if (mediaRecorderRef.current?.state === "recording") {
              mediaRecorderRef.current.stop();
              setRecording(false);
              clearInterval(timerRef.current);
            }
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      if (err.name === "NotAllowedError") toast.error("Camera/microphone access denied.");
      else if (err.name === "NotFoundError") toast.error("Camera or microphone not found.");
      else toast.error(`Recording failed: ${err.message}`);
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  }, []);

  const handleUpload = async () => {
    const fileToUpload = recordedBlob || selectedFile;
    if (!fileToUpload) { toast.warning("Please upload or record a video first."); return; }

    const formData = new FormData();
    formData.append("file", fileToUpload, recordedBlob ? "video.webm" : selectedFile.name);
    setLoading(true);

    try {
      const userId = localStorage.getItem("user_id");
      const response = await fetch(API_ENDPOINTS.analyze, {
        method: "POST",
        body: formData,
        headers: { "X-User-ID": userId || "" },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 413) {
          toast.error(err.detail || "Storage limit reached. Please delete old videos.");
          fetchStorage();
          return;
        }
        throw new Error(err.detail || `Server error: ${response.status}`);
      }

      toast.success("Analysis complete! Results are ready.");
      await fetchDashboard();
      fetchStorage();
      setShowResults(true);
      setRecordedBlob(null);
      setSelectedFile(null);
      setRecordingTime(0);
      if (videoRef.current) { videoRef.current.src = ""; videoRef.current.srcObject = null; }
    } catch (err) {
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      if (video.duration > 30) {
        toast.error(`Video is ${Math.ceil(video.duration)}s. Maximum is 30 seconds.`);
        e.target.value = "";
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
        toast.success(`Selected: ${file.name}`);
      }
    };
    video.onerror = () => { toast.error("Unable to read video file."); e.target.value = ""; };
    video.src = URL.createObjectURL(file);
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const latest = dataPoints[0];

  const getQuality = (score) => {
    if (score >= 80) return { label: "Excellent", color: "#27ae60", bg: "#eafaf1" };
    if (score >= 60) return { label: "Good", color: "#2980b9", bg: "#ebf5fb" };
    if (score >= 40) return { label: "Fair", color: "#f39c12", bg: "#fef9e7" };
    return { label: "Needs Work", color: "#e74c3c", bg: "#fdf2f2" };
  };

  return (
    <div style={styles.page}>
      <ToastContainer position="top-right" autoClose={4000} theme="light" />

      {/* Page header */}
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.pageTitle}>AI Practice Room</h1>
          <p style={styles.pageSubtitle}>Live Practice Session — record up to 30 seconds</p>
        </div>
        {storageInfo && (
          <div style={styles.storagePill}>
            <div style={styles.storageDot(storageInfo.percentage)} />
            {storageInfo.used_mb} / {storageInfo.limit_mb} MB
          </div>
        )}
      </div>

      <div style={styles.mainGrid}>
        {/* Left column — camera + controls */}
        <div style={styles.leftCol}>
          {/* Camera card */}
          <div style={styles.cameraCard}>
            <div style={styles.cameraHeader}>
              <span style={styles.cameraTitle}>Camera Preview</span>
              {recording && (
                <div style={styles.recBadge}>
                  <div style={styles.recDot} />
                  <span>REC {formatTime(recordingTime)}</span>
                </div>
              )}
            </div>
            <div style={styles.cameraWrap}>
              <video
                ref={videoRef}
                autoPlay
                muted={recording}
                playsInline
                controls={!recording}
                style={styles.video}
              />
              {!recording && !recordedBlob && !selectedFile && (
                <div style={styles.cameraPlaceholder}>
                  <div style={styles.cameraPlaceholderIcon}>📷</div>
                  <span style={styles.cameraPlaceholderText}>Camera preview will appear here</span>
                </div>
              )}
            </div>
            <div style={styles.cameraControls}>
              {!recording ? (
                <button className="action-btn" onClick={startRecording} style={styles.primaryBtn}>
                  ▶ Start Session
                </button>
              ) : (
                <button className="action-btn" onClick={stopRecording} style={styles.stopBtn}>
                  ■ Stop Recording
                </button>
              )}
              <label style={styles.uploadLabel}>
                <input type="file" accept="video/*" onChange={handleFileSelect} style={{ display: "none" }} disabled={loading} />
                Upload Video
              </label>
            </div>
            {(selectedFile || recordedBlob) && (
              <div style={styles.readyBanner}>
                <span style={styles.readyIcon}>✓</span>
                <span style={styles.readyText}>
                  {recordedBlob ? `Recorded ${formatTime(recordingTime)}` : selectedFile.name}
                </span>
                <button
                  className="action-btn"
                  onClick={handleUpload}
                  style={{ ...styles.analyzeBtn, opacity: loading ? 0.7 : 1 }}
                  disabled={loading}
                >
                  {loading ? <ClipLoader size={14} color="#fff" /> : "Analyze ↗"}
                </button>
              </div>
            )}
          </div>

          {/* Analysis in progress */}
          {loading && (
            <div style={styles.analysisCard}>
              <ClipLoader color="#6c47ff" size={32} />
              <div>
                <div style={styles.analysisTitle}>Analyzing your session…</div>
                <div style={styles.analysisSub}>This may take 15–30 seconds. Please don't close this page.</div>
              </div>
            </div>
          )}
        </div>

        {/* Right column — results */}
        <div style={styles.rightCol}>
          {latest ? (
            <>
              {/* Overall score */}
              <div style={styles.scoreCard}>
                <div style={styles.scoreTop}>
                  <div>
                    <div style={styles.scoreLabel}>Session Analysis</div>
                    <div style={styles.scoreDate}>{new Date(latest.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ ...styles.scoreBadge, background: getQuality(latest.confidence_score).bg, color: getQuality(latest.confidence_score).color }}>
                    {getQuality(latest.confidence_score).label}
                  </div>
                </div>
                <div style={styles.scoreMain}>
                  <div style={{ ...styles.scoreNum, color: getQuality(latest.confidence_score).color }}>
                    {Number(latest.confidence_score).toFixed(1)}
                  </div>
                  <div style={styles.scoreUnit}>/100</div>
                </div>
                <div style={styles.scoreDesc}>
                  {getQuality(latest.confidence_score).label === "Excellent"
                    ? "Outstanding performance! Keep it up."
                    : getQuality(latest.confidence_score).label === "Good"
                    ? "Great job! A few tweaks will get you to excellent."
                    : getQuality(latest.confidence_score).label === "Fair"
                    ? "Good effort. Focus on the areas below."
                    : "Keep practicing — you're on your way!"}
                </div>
              </div>

              {/* Metrics */}
              <div style={styles.metricsCard}>
                <div style={styles.metricsTitle}>Detailed Breakdown</div>
                {[
                  { label: "Eye Contact", val: latest.eye_contact_percentage, icon: "👁️" },
                  { label: "Posture", val: latest.posture_percentage, icon: "🧍" },
                  { label: "Smile", val: latest.smile_percentage, icon: "😊" },
                  { label: "Hand Movement", val: latest.hand_movement_percentage, icon: "🤚" },
                  { label: "Speech Score", val: latest.speech_score * 10, icon: "🎤", raw: `${Number(latest.speech_score).toFixed(1)}/10` },
                  { label: "Filler Words", val: Math.max(0, 100 - (latest.filler_word_count ?? 0) * 10), icon: "💬", raw: `${latest.filler_word_count ?? 0} detected` },
                ].map((m) => {
                  const q = getQuality(m.val);
                  return (
                    <div key={m.label} style={styles.metricRow}>
                      <span style={styles.metricIcon}>{m.icon}</span>
                      <span style={styles.metricName}>{m.label}</span>
                      <div style={styles.metricBarBg}>
                        <div style={{ ...styles.metricBarFill, width: `${m.val}%`, background: q.color }} />
                      </div>
                      <span style={{ ...styles.metricPct, color: q.color }}>
                        {m.raw || `${Number(m.val).toFixed(0)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Tips */}
              <div style={styles.tipsCard}>
                <div style={styles.metricsTitle}>Areas to Improve</div>
                {[
                  { label: "Eye Contact", val: latest.eye_contact_percentage, tips: ["Focus on camera lens", "Hold contact 5-10 seconds", "Blink naturally"] },
                  { label: "Smile", val: latest.smile_percentage, tips: ["Think of happy thoughts", "Smile reaches eyes", "Relax your face"] },
                  { label: "Hand Movement", val: latest.hand_movement_percentage, tips: ["Use gestures to emphasize", "Keep hands visible", "Avoid crossing arms"] },
                ]
                  .sort((a, b) => a.val - b.val)
                  .slice(0, 2)
                  .map((rec) => (
                    <div key={rec.label} style={styles.tipItem}>
                      <div style={styles.tipHeader}>
                        <span style={styles.tipLabel}>{rec.label}</span>
                        <span style={{ ...styles.tipScore, color: getQuality(rec.val).color }}>{Number(rec.val).toFixed(0)}%</span>
                      </div>
                      <div style={styles.tipList}>
                        {rec.tips.map((t) => (
                          <div key={t} style={styles.tipRow}>
                            <span style={styles.tipCheck}>→</span>{t}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <div style={styles.emptyResults}>
              <div style={styles.emptyIcon}>🎯</div>
              <div style={styles.emptyTitle}>No results yet</div>
              <div style={styles.emptySub}>Record or upload a video and click Analyze to see your confidence breakdown.</div>
            </div>
          )}
        </div>
      </div>
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
  storagePill: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "6px 14px",
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "20px",
    fontSize: "12px",
    color: "#666",
    fontWeight: "500",
  },
  storageDot: (pct) => ({
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: pct >= 90 ? "#e74c3c" : pct >= 70 ? "#f39c12" : "#27ae60",
  }),
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    alignItems: "start",
  },
  leftCol: { display: "flex", flexDirection: "column", gap: "16px" },
  rightCol: { display: "flex", flexDirection: "column", gap: "16px" },
  cameraCard: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "14px",
    overflow: "hidden",
  },
  cameraHeader: {
    padding: "14px 18px",
    borderBottom: "1px solid #f5f5f5",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cameraTitle: { fontSize: "13.5px", fontWeight: "700", color: "#1a1a2e" },
  recBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "#fff1f0",
    border: "1px solid #ffd8d4",
    color: "#e74c3c",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
  },
  recDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#e74c3c",
    animation: "pulse 1.2s ease infinite",
  },
  cameraWrap: {
    position: "relative",
    background: "#0d0d1a",
    aspectRatio: "16/9",
    overflow: "hidden",
  },
  video: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  cameraPlaceholder: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
  },
  cameraPlaceholderIcon: { fontSize: "32px", opacity: 0.4 },
  cameraPlaceholderText: { fontSize: "13px", color: "rgba(255,255,255,0.35)" },
  cameraControls: {
    padding: "14px 18px",
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  primaryBtn: {
    flex: 1,
    padding: "10px 16px",
    background: "linear-gradient(135deg, #6c47ff, #4f8ef7)",
    color: "#fff",
    border: "none",
    borderRadius: "9px",
    fontSize: "13.5px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  stopBtn: {
    flex: 1,
    padding: "10px 16px",
    background: "#e74c3c",
    color: "#fff",
    border: "none",
    borderRadius: "9px",
    fontSize: "13.5px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  uploadLabel: {
    padding: "10px 16px",
    background: "#fff",
    border: "1.5px solid #e0e0e0",
    borderRadius: "9px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#555",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "'Segoe UI', sans-serif",
  },
  readyBanner: {
    margin: "0 18px 14px",
    padding: "10px 14px",
    background: "rgba(108,71,255,0.06)",
    border: "1px solid rgba(108,71,255,0.15)",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  readyIcon: { fontSize: "16px", color: "#27ae60" },
  readyText: { flex: 1, fontSize: "12.5px", color: "#555", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  analyzeBtn: {
    padding: "8px 16px",
    background: "linear-gradient(135deg, #6c47ff, #4f8ef7)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "12.5px",
    fontWeight: "700",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  },
  analysisCard: {
    background: "#fff",
    border: "1px solid rgba(108,71,255,0.15)",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  analysisTitle: { fontSize: "13.5px", fontWeight: "700", color: "#1a1a2e", marginBottom: "4px" },
  analysisSub: { fontSize: "12px", color: "#999" },
  scoreCard: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "14px",
    padding: "20px",
  },
  scoreTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" },
  scoreLabel: { fontSize: "13px", fontWeight: "700", color: "#1a1a2e", marginBottom: "3px" },
  scoreDate: { fontSize: "11px", color: "#bbb" },
  scoreBadge: { padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" },
  scoreMain: { display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "10px" },
  scoreNum: { fontSize: "52px", fontWeight: "800", lineHeight: 1, letterSpacing: "-2px" },
  scoreUnit: { fontSize: "18px", color: "#ccc", fontWeight: "400" },
  scoreDesc: { fontSize: "13px", color: "#777", lineHeight: "1.5" },
  metricsCard: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "14px",
    padding: "18px 20px",
  },
  metricsTitle: { fontSize: "13.5px", fontWeight: "700", color: "#1a1a2e", marginBottom: "14px" },
  metricRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" },
  metricIcon: { fontSize: "14px", width: "20px", textAlign: "center" },
  metricName: { fontSize: "12.5px", color: "#555", width: "90px", flexShrink: 0 },
  metricBarBg: { flex: 1, height: "6px", background: "#f0f0f0", borderRadius: "3px", overflow: "hidden" },
  metricBarFill: { height: "100%", borderRadius: "3px", transition: "width 0.5s ease" },
  metricPct: { fontSize: "12px", fontWeight: "700", width: "55px", textAlign: "right", flexShrink: 0 },
  tipsCard: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "14px",
    padding: "18px 20px",
  },
  tipItem: {
    marginBottom: "14px",
    paddingBottom: "14px",
    borderBottom: "1px solid #f5f5f5",
  },
  tipHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  tipLabel: { fontSize: "13px", fontWeight: "700", color: "#1a1a2e" },
  tipScore: { fontSize: "13px", fontWeight: "700" },
  tipList: { display: "flex", flexDirection: "column", gap: "5px" },
  tipRow: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#666" },
  tipCheck: { color: "#6c47ff", fontWeight: "700", fontSize: "13px" },
  emptyResults: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "14px",
    padding: "48px 24px",
    textAlign: "center",
  },
  emptyIcon: { fontSize: "40px", marginBottom: "14px" },
  emptyTitle: { fontSize: "16px", fontWeight: "700", color: "#1a1a2e", marginBottom: "8px" },
  emptySub: { fontSize: "13px", color: "#999", lineHeight: "1.6" },
};

export default AIDashboard;