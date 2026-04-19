import React, { useEffect, useState, useRef, useCallback } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ClipLoader } from "react-spinners";
import "./AIDashboard.css";

const API_BASE_URL  = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const API_ENDPOINTS = {
  dashboard: `${API_BASE_URL}/dashboard`,
  analyze:   `${API_BASE_URL}/analyze`,
  storage:   `${API_BASE_URL}/storage`,
};

function MetricBar({ icon, label, val, raw }) {
  const pct   = Math.min(Math.max(Number(val) || 0, 0), 100);
  const color = pct >= 70 ? "#22c55e" : pct >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div className="ai-metric-row">
      <span className="ai-metric-icon">{icon}</span>
      <span className="ai-metric-name">{label}</span>
      <div className="ai-metric-bar-bg">
        <div
          className="ai-metric-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="ai-metric-pct" style={{ color }}>{raw || `${pct.toFixed(0)}%`}</span>
    </div>
  );
}

function AIDashboard() {
  const [recordingTime, setRecordingTime] = useState(0);
  const [dataPoints, setDataPoints]       = useState([]);
  const [selectedFile, setSelectedFile]   = useState(null);
  const [loading, setLoading]             = useState(false);
  const [recording, setRecording]         = useState(false);
  const [recordedBlob, setRecordedBlob]   = useState(null);
  const [storageInfo, setStorageInfo]     = useState(null);

  const timerRef         = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoRef         = useRef(null);

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

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const latest = dataPoints[0];
  const scoreColor = (s) => s >= 70 ? "#22c55e" : s >= 45 ? "#f59e0b" : "#ef4444";
  const scoreLabel = (s) =>
    s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Fair" : "Needs Work";

  const progressPct = (recordingTime / 30) * 100;

  return (
    <div className="ai-page">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        theme="dark"
        toastStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px" }}
      />

      {/* Header */}
      <div className="ai-header animate-fadeUp">
        <div>
          <h1 className="ai-title">AI Practice Room</h1>
          <p className="ai-subtitle">Record up to 30 seconds and get instant AI feedback</p>
        </div>
        {storageInfo && (
          <div className="ai-storage-pill" style={{
            borderColor: storageInfo.percentage >= 90 ? "rgba(239,68,68,0.3)"
              : storageInfo.percentage >= 70 ? "rgba(245,158,11,0.3)"
              : "rgba(34,197,94,0.3)",
          }}>
            <span className="ai-storage-dot" style={{
              background: storageInfo.percentage >= 90 ? "#ef4444"
                : storageInfo.percentage >= 70 ? "#f59e0b"
                : "#22c55e",
            }} />
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            {storageInfo.used_mb} / {storageInfo.limit_mb} MB
          </div>
        )}
      </div>

      <div className="ai-grid">
        {/* Left — camera */}
        <div className="ai-left">
          <div className="ai-camera-card animate-fadeUp">
            <div className="ai-camera-header">
              <div className="ai-camera-title">
                <span className="ai-camera-dot" style={{ background: recording ? "#ef4444" : "#50587a" }} />
                Camera Preview
              </div>
              {recording && (
                <div className="ai-rec-badge">
                  <span className="ai-rec-pulse" />
                  REC {formatTime(recordingTime)}
                </div>
              )}
            </div>

            {/* Video viewport */}
            <div className="ai-camera-wrap">
              <video
                ref={videoRef}
                autoPlay
                muted={recording}
                playsInline
                controls={!recording}
                className="ai-video"
              />
              {!recording && !recordedBlob && !selectedFile && (
                <div className="ai-camera-placeholder">
                  <div className="ai-camera-placeholder-icon animate-float">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                      <circle cx="12" cy="13" r="3"/>
                    </svg>
                  </div>
                  <span className="ai-camera-placeholder-text">Camera feed will appear here</span>
                </div>
              )}
            </div>

            {/* Progress bar while recording */}
            {recording && (
              <div className="ai-progress-bar-wrap">
                <div className="ai-progress-bar" style={{ width: `${progressPct}%` }} />
                <span className="ai-progress-label">{30 - recordingTime}s remaining</span>
              </div>
            )}

            {/* Controls */}
            <div className="ai-camera-controls">
              {!recording ? (
                <button className="ai-btn-primary" onClick={startRecording} id="start-session-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Start Session
                </button>
              ) : (
                <button className="ai-btn-stop" onClick={stopRecording} id="stop-recording-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                  </svg>
                  Stop Recording
                </button>
              )}
              <label className="ai-btn-upload" id="upload-label">
                <input type="file" accept="video/*" onChange={handleFileSelect}
                  style={{ display: "none" }} disabled={loading} />
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload
              </label>
            </div>

            {/* Ready banner */}
            {(selectedFile || recordedBlob) && (
              <div className="ai-ready-banner">
                <div className="ai-ready-check">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <span className="ai-ready-text">
                  {recordedBlob ? `Recorded ${formatTime(recordingTime)}` : selectedFile.name}
                </span>
                <button
                  className="ai-analyze-btn"
                  onClick={handleUpload}
                  disabled={loading}
                  id="analyze-btn"
                  style={{ opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? <ClipLoader size={13} color="#fff" /> : "Analyze →"}
                </button>
              </div>
            )}
          </div>

          {/* Analysis in progress */}
          {loading && (
            <div className="ai-analysis-card animate-fadeUp">
              <ClipLoader color="#7c5cfc" size={28} />
              <div>
                <div className="ai-analysis-title">Analyzing your session…</div>
                <div className="ai-analysis-sub">This may take 15–30 seconds. Don't close this page.</div>
              </div>
            </div>
          )}
        </div>

        {/* Right — results */}
        <div className="ai-right">
          {latest ? (
            <>
              {/* Score card */}
              <div className="ai-score-card animate-fadeUp">
                <div className="ai-score-top">
                  <div>
                    <div className="ai-score-label">Session Analysis</div>
                    <div className="ai-score-date">{new Date(latest.created_at).toLocaleString()}</div>
                  </div>
                  <span
                    className="ai-score-badge"
                    style={{
                      background: `${scoreColor(latest.confidence_score)}18`,
                      color: scoreColor(latest.confidence_score),
                      borderColor: `${scoreColor(latest.confidence_score)}35`,
                    }}
                  >
                    {scoreLabel(latest.confidence_score)}
                  </span>
                </div>
                <div className="ai-score-main">
                  <span className="ai-score-num" style={{ color: scoreColor(latest.confidence_score) }}>
                    {Number(latest.confidence_score).toFixed(1)}
                  </span>
                  <span className="ai-score-unit">/100</span>
                </div>
                <p className="ai-score-desc">
                  {scoreLabel(latest.confidence_score) === "Excellent"
                    ? "Outstanding performance! You're on fire — keep it up."
                    : scoreLabel(latest.confidence_score) === "Good"
                    ? "Great job! A few refinements will get you to excellent."
                    : scoreLabel(latest.confidence_score) === "Fair"
                    ? "Good effort. Focus on the areas below to level up."
                    : "Keep practicing — consistency is the key to growth!"}
                </p>
              </div>

              {/* Metrics */}
              <div className="ai-metrics-card animate-fadeUp" style={{ animationDelay: "0.06s" }}>
                <div className="ai-card-title">Detailed Breakdown</div>
                <MetricBar icon="👁️" label="Eye Contact" val={latest.eye_contact_percentage} />
                <MetricBar icon="🧍" label="Posture" val={latest.posture_percentage} />
                <MetricBar icon="😊" label="Smile" val={latest.smile_percentage} />
                <MetricBar icon="🤚" label="Hand Movement" val={latest.hand_movement_percentage} />
                <MetricBar icon="🎤" label="Speech Score"
                  val={latest.speech_score * 10}
                  raw={`${Number(latest.speech_score).toFixed(1)}/10`}
                />
                <MetricBar icon="💬" label="Filler Words"
                  val={Math.max(0, 100 - (latest.filler_word_count ?? 0) * 10)}
                  raw={`${latest.filler_word_count ?? 0} detected`}
                />
              </div>

              {/* Tips */}
              <div className="ai-tips-card animate-fadeUp" style={{ animationDelay: "0.12s" }}>
                <div className="ai-card-title">Areas to Improve</div>
                {[
                  { label: "Eye Contact", val: latest.eye_contact_percentage, tips: ["Focus on the camera lens", "Hold contact 5–10 seconds", "Blink naturally"] },
                  { label: "Smile",       val: latest.smile_percentage,       tips: ["Think of happy moments", "Let the smile reach your eyes", "Relax your jaw"] },
                  { label: "Hand Movement", val: latest.hand_movement_percentage, tips: ["Use gestures to emphasize", "Keep hands visible", "Avoid crossed arms"] },
                ]
                  .sort((a, b) => a.val - b.val)
                  .slice(0, 2)
                  .map((rec) => {
                    const col = rec.val >= 70 ? "#22c55e" : rec.val >= 45 ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={rec.label} className="ai-tip-item">
                        <div className="ai-tip-header">
                          <span className="ai-tip-label">{rec.label}</span>
                          <span className="ai-tip-score" style={{ color: col }}>
                            {Number(rec.val).toFixed(0)}%
                          </span>
                        </div>
                        <div className="ai-tip-list">
                          {rec.tips.map((t) => (
                            <div key={t} className="ai-tip-row">
                              <span className="ai-tip-arrow">→</span>
                              {t}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          ) : (
            <div className="ai-empty animate-fadeUp">
              <div className="ai-empty-icon animate-float">🎯</div>
              <div className="ai-empty-title">No results yet</div>
              <div className="ai-empty-sub">
                Record or upload a video and click Analyze to see your confidence breakdown.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIDashboard;