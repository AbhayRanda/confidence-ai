import React, { useEffect, useState, useRef, useCallback } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./AIDashboard.css";
import { AICharacter } from "../components/ai-character/AICharacter";
import { useAICharacter } from "../hooks/useAICharacter";
import { useSpeech } from "../hooks/useSpeech";
import { useChat } from "../hooks/useChat";
import { ChatPanel } from "../components/ChatPanel";
import { IdealPerformanceDemo } from "./IdealPerformanceDemo";

import { API_BASE_URL, WS_BASE_URL } from "../utils/api";
const API_ENDPOINTS = {
  dashboard: `${API_BASE_URL}/dashboard`,
  analyze:   `${API_BASE_URL}/analyze`,
  storage:   `${API_BASE_URL}/storage`,
  progress:  `${API_BASE_URL}/progress`,
};

// ── Step 6: Trend arrow ───────────────────────────────────────
function TrendArrow({ direction, delta }) {
  if (!direction || direction === "same") return null;
  const up    = direction === "up";
  const color = up ? "#22c55e" : "#ef4444";
  return (
    <span
      className="ai-trend-arrow"
      style={{ color }}
      title={`${up ? "+" : ""}${delta}% vs last session`}
    >
      {up ? "↑" : "↓"} {Math.abs(delta)}%
    </span>
  );
}

// ── Metric bar ────────────────────────────────────────────────
function MetricBar({ icon, label, val, raw, trend }) {
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
      <div className="ai-metric-right">
        <span className="ai-metric-pct" style={{ color }}>{raw || `${pct.toFixed(0)}%`}</span>
        {trend && <TrendArrow direction={trend.direction} delta={trend.delta} />}
      </div>
    </div>
  );
}

// ── Step 9: Exercise card with 30s countdown ─────────────────
function ExerciseCard({ exercise, onDismiss }) {
  const [timeLeft, setTimeLeft] = useState(null); // null = not started
  const timerRef = useRef(null);

  const start = () => {
    setTimeLeft(30);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  if (!exercise) return null;
  return (
    <div className="ai-exercise-card animate-fadeUp">
      <div className="ai-exercise-header">
        <span className="ai-exercise-icon">{exercise.icon || "🏋️"}</span>
        <div>
          <div className="ai-exercise-title">{exercise.title}</div>
          <div className="ai-exercise-meta">30-Second Practice Drill</div>
        </div>
        <button className="ai-exercise-dismiss" onClick={onDismiss} title="Dismiss">✕</button>
      </div>
      <p className="ai-exercise-instruction">{exercise.instruction}</p>
      <div className="ai-exercise-actions">
        {timeLeft === null ? (
          <button className="ai-exercise-start" onClick={start}>▶ Start Drill</button>
        ) : timeLeft === 0 ? (
          <div className="ai-exercise-done">✅ Done! Great work!</div>
        ) : (
          <div className="ai-exercise-timer">
            <div
              className="ai-exercise-timer-ring"
              style={{ "--pct": `${(timeLeft / 30) * 100}%` }}
            />
            <span className="ai-exercise-timer-num">{timeLeft}s</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Full coaching report panel ────────────────────────
function CoachingReport({ report, onClose }) {
  if (!report) return null;
  return (
    <div className="ai-report-overlay" onClick={onClose}>
      <div className="ai-report-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ai-report-header">
          <span>📋 Full Coaching Report</span>
          <button onClick={onClose} className="ai-report-close">✕</button>
        </div>

        <p className="ai-report-summary">{report.summary}</p>

        {/* Strengths */}
        {report.strengths?.length > 0 && (
          <div className="ai-report-section">
            <div className="ai-report-section-title">✅ What You Did Well</div>
            {report.strengths.map((s, i) => (
              <div key={i} className="ai-report-strength-item">
                <span className="ai-report-check">✓</span> {s}
              </div>
            ))}
          </div>
        )}

        {/* Priority fixes */}
        {report.priority_fixes?.length > 0 && (
          <div className="ai-report-section">
            <div className="ai-report-section-title">🎯 Priority Improvements</div>
            {report.priority_fixes.map((f, i) => (
              <div key={i} className="ai-report-fix-item">
                <div className="ai-report-fix-header">
                  <span className="ai-report-fix-rank">#{i + 1}</span>
                  <span className="ai-report-fix-metric">{f.metric}</span>
                  <span className="ai-report-fix-val">{f.value}%</span>
                </div>
                <p className="ai-report-fix-tip">→ {f.tip}</p>
              </div>
            ))}
          </div>
        )}

        {/* 7-day plan */}
        {report.practice_plan?.length > 0 && (
          <div className="ai-report-section">
            <div className="ai-report-section-title">📅 7-Day Practice Plan</div>
            <div className="ai-report-plan-grid">
              {report.practice_plan.map((d, i) => (
                <div key={i} className={`ai-report-plan-day${i === 0 ? " ai-report-plan-day--today" : ""}`}>
                  <div className="ai-report-plan-day-label">{i === 0 ? "Today" : d.day}</div>
                  <div className="ai-report-plan-focus">{d.icon} {d.focus}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 10: Days since last session ─────────────────────────
function LastSessionBadge({ dataPoints }) {
  if (!dataPoints || dataPoints.length === 0) return null;
  const last    = new Date(dataPoints[0].created_at);
  const now     = new Date();
  const diffMs  = now - last;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return null; // don't show if practiced today

  return (
    <div className={`ai-last-session-badge ${diffDays > 2 ? "ai-last-session-badge--warn" : ""}`}>
      {diffDays > 2 ? "⏰" : "🕐"} Last session: {diffDays === 1 ? "yesterday" : `${diffDays} days ago`}
      {diffDays > 2 && " — time to practice!"}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
function AIDashboard() {
  const [recordingTime, setRecordingTime] = useState(0);
  const [dataPoints, setDataPoints]       = useState([]);
  const [selectedFile, setSelectedFile]   = useState(null);
  const [loading, setLoading]             = useState(false);
  const [recording, setRecording]         = useState(false);
  const [recordedBlob, setRecordedBlob]   = useState(null);
  const [storageInfo, setStorageInfo]     = useState(null);
  const [showDevPanel, setShowDevPanel]   = useState(false);

  // WebSocket analysis progress
  const [analysisProgress, setAnalysisProgress] = useState(null);
  // { percent: number, message: string, stage: string, completedStages: string[] }

  // Step 3: Coaching report state
  const [report, setReport]           = useState(null);
  const [showReport, setShowReport]   = useState(false);

  // Step 9: Exercise card state
  const [exercise, setExercise]         = useState(null);

  // Step 6: Progress trends
  const [trends, setTrends]             = useState(null);

  // Step 5: Live filler counter
  const [liveFillers, setLiveFillers]   = useState(0);

  // Ideal Performance Demo
  const [showIdealDemo, setShowIdealDemo]   = useState(false);
  const [lastResult, setLastResult]         = useState(null);

  const timerRef         = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoRef         = useRef(null);
  const wsRef            = useRef(null);  // WebSocket progress connection

  // AI Character controller
  const character = useAICharacter();

  // Speech (TTS + STT)
  const speech = useSpeech({
    onSpeakStart:  () => character.setIsSpeaking(true),
    onSpeakEnd:    () => character.setIsSpeaking(false),
    onListenStart: () => character.onSessionStart(),
    onListenEnd:   () => character.setState("thinking"),
    onError:       (msg) => toast.error(msg),
  });

  // Step 5: Mirror speech.fillerWordCount to local state during recording
  useEffect(() => {
    if (recording) setLiveFillers(speech.fillerWordCount);
  }, [speech.fillerWordCount, recording]);

  // We use a ref so useChat always reads the latest dataPoints
  const dataPointsRef = useRef([]);
  dataPointsRef.current = dataPoints;

  const getChatContext = useCallback(() => {
    const d = dataPointsRef.current[0];
    if (!d) return null;
    return {
      confidence_score:         d.confidence_score,
      eye_contact_percentage:   d.eye_contact_percentage,
      smile_percentage:         d.smile_percentage,
      posture_percentage:       d.posture_percentage,
      hand_movement_percentage: d.hand_movement_percentage,
      speech_score:             d.speech_score,
      filler_word_count:        d.filler_word_count,
      words_per_minute:         d.words_per_minute,
    };
  }, []);

  // Chat hook — wired to character + speech
  const chat = useChat({ getAnalysisContext: getChatContext, character, speech });

  const fetchDashboard = useCallback(() => {
    const token = localStorage.getItem("token");
    return fetch(API_ENDPOINTS.dashboard, { headers: { "Authorization": `Bearer ${token || ""}` } })
      .then((r) => r.json())
      .then((data) => setDataPoints(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchStorage = useCallback(() => {
    const token = localStorage.getItem("token");
    fetch(API_ENDPOINTS.storage, { headers: { "Authorization": `Bearer ${token || ""}` } })
      .then((r) => r.json()).then(setStorageInfo).catch(() => {});
  }, []);

  // Step 6: Fetch progress trends
  const fetchProgress = useCallback(() => {
    const token = localStorage.getItem("token");
    fetch(API_ENDPOINTS.progress, { headers: { "Authorization": `Bearer ${token || ""}` } })
      .then((r) => r.json())
      .then((data) => { if (data?.has_data) setTrends(data.metrics); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchStorage();
    fetchProgress();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };
  }, [fetchDashboard, fetchStorage, fetchProgress]);

  const startRecording = async () => {
    try {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);

      // Step 5: Reset filler counter at session start
      setLiveFillers(0);
      speech.resetFillerCount?.();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Camera/Mic blocked: Mobile browsers require an HTTPS (secure) connection.");
        return;
      }

      // Step 1: Request camera & mic with smart fallback for mobile phones
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } catch (constraintErr) {
        console.warn("[Camera] Retrying with generic mobile constraints:", constraintErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }

      // Step 2: Attach stream and play muted (mandatory for mobile browsers to allow autoplay)
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("[Video] Autoplay warning:", playErr);
        }
      }

      // Step 3: Determine supported MIME type (safely handles iOS Safari & Android Chrome)
      let recorderOptions = {};
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported?.("video/webm;codecs=vp9")) {
          recorderOptions = { mimeType: "video/webm;codecs=vp9" };
        } else if (MediaRecorder.isTypeSupported?.("video/webm")) {
          recorderOptions = { mimeType: "video/webm" };
        } else if (MediaRecorder.isTypeSupported?.("video/mp4")) {
          recorderOptions = { mimeType: "video/mp4" };
        }
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
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
        character.onSessionEnd();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      character.onSessionStart();

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
      console.error("[Recording Error]", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Camera/Mic permission denied. Please tap the lock icon in the address bar and allow Camera & Microphone.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        toast.error("Camera or microphone not found on this device.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        toast.error("Camera is in use by another app. Please close other camera apps.");
      } else {
        toast.error(`Recording failed: ${err.message || err.name || "Unknown error"}`);
      }
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
      character.onSessionEnd();
    }
  }, [character]);

  const handleUpload = async () => {
    const fileToUpload = recordedBlob || selectedFile;
    if (!fileToUpload) { toast.warning("Please upload or record a video first."); return; }

    const formData = new FormData();
    formData.append("file", fileToUpload, recordedBlob ? "video.webm" : selectedFile.name);
    setLoading(true);
    setAnalysisProgress({ percent: 0, message: "Connecting…", stage: "connecting", completedStages: [] });
    character.onAnalysisStart();

    // ── Open WebSocket progress channel BEFORE uploading ──────────────────
    const jobId = crypto.randomUUID();
    const wsUrl = `${WS_BASE_URL}/ws/progress/${jobId}`;

    await new Promise((resolveWs) => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => resolveWs();   // WS ready — now safe to POST
      ws.onerror = () => resolveWs();  // fallback: continue without progress

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data);
          setAnalysisProgress((prev) => ({
            percent:         event.percent,
            message:         event.message,
            stage:           event.stage,
            completedStages: event.stage === "done" || event.stage === "error"
              ? (prev?.completedStages || [])
              : [...(prev?.completedStages || []), event.stage],
          }));
        } catch (_) {}
      };

      ws.onclose = () => {};
    });

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_ENDPOINTS.analyze}?job_id=${encodeURIComponent(jobId)}`, {
        method: "POST",
        body: formData,
        headers: { "Authorization": `Bearer ${token || ""}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 413) {
          toast.error(err.detail || "Storage limit reached. Please delete old videos.");
          fetchStorage();
          character.onAnalysisError();
          return;
        }
        throw new Error(err.detail || `Server error: ${response.status}`);
      }

      const result = await response.json();
      toast.success("Analysis complete! Results are ready.");

      await fetchDashboard();
      fetchStorage();
      fetchProgress();

      setRecordedBlob(null);
      setSelectedFile(null);
      setRecordingTime(0);
      if (videoRef.current) { videoRef.current.src = ""; videoRef.current.srcObject = null; }

      if (result.report) {
        setReport(result.report);
        if (result.report.exercise) setExercise(result.report.exercise);
      }

      // Save result for Ideal Performance Demo
      setLastResult(result);

      character.onAnalysisComplete(result.confidence_score);

      setTimeout(() => {
        const score   = result.confidence_score;
        const metrics = [
          { name: "Eye Contact",   value: result.eye_contact_percentage },
          { name: "Posture",       value: result.posture_percentage },
          { name: "Smile",         value: result.smile_percentage },
          { name: "Hand Movement", value: result.hand_movement_percentage },
          { name: "Speech",        value: result.speech_score },
        ];
        const weakest = metrics.reduce((a, b) => a.value < b.value ? a : b);
        const nudge   = score >= 70
          ? `Score: ${score.toFixed(1)}/100 — great session! What do you want to work on?`
          : `Score: ${score.toFixed(1)}/100 — ask me for a tip on ${weakest.name}.`;
        chat.sendMessage(nudge);
      }, 1500);

      if (trends?.["Eye Contact"] !== undefined) {
        const scoreImproved = Object.values(trends).filter(t => t.direction === "up").length;
        if (scoreImproved >= 2) {
          setTimeout(() => {
            toast.success("📈 You improved in multiple areas since last session! Keep it up!");
            character.triggerGreeting();
          }, 3000);
        }
      }

    } catch (err) {
      toast.error(`Analysis failed: ${err.message}`);
      character.onAnalysisError();
    } finally {
      // Clean up WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setLoading(false);
      setAnalysisProgress(null);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Fast-path: check file size first (100 MB limit)
    const MAX_SIZE_MB = 100;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File is too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum is ${MAX_SIZE_MB} MB.`);
      e.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video     = document.createElement("video");
    let   settled   = false;

    const accept = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      setSelectedFile(file);
      toast.success(`Selected: ${file.name}`);
    };

    const reject = (msg) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      toast.error(msg);
      e.target.value = "";
      setSelectedFile(null);
    };

    // If metadata loads successfully — enforce 30s cap
    video.onloadedmetadata = () => {
      // Some WebM files report Infinity; treat as unknown ≤ 30s (backend validates)
      const dur = video.duration;
      if (isFinite(dur) && dur > 30) {
        reject(`Video is ${Math.ceil(dur)}s. Maximum is 30 seconds.`);
      } else {
        accept();
      }
    };

    // onerror fires for many valid WebM files (VP8/VP9, missing duration header).
    // The backend (OpenCV + FFmpeg) can decode these perfectly — so we warn but allow.
    video.onerror = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      // Accept the file but warn the user the duration check was skipped
      const isWebm = file.name.toLowerCase().endsWith(".webm") ||
                     file.type === "video/webm";
      if (isWebm) {
        setSelectedFile(file);
        toast.info(`Selected: ${file.name} (WebM — duration check skipped, 30s limit still applies)`);
      } else {
        toast.error("Unable to read video file. Please try a different format (MP4 or WebM recommended).");
        e.target.value = "";
      }
    };

    // Fallback timeout: if neither event fires in 4s, accept the file
    setTimeout(() => {
      if (!settled) accept();
    }, 4000);

    video.preload = "metadata";
    video.src     = objectUrl;
  };



  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const latest     = dataPoints[0];
  const scoreColor = (s) => s >= 70 ? "#22c55e" : s >= 45 ? "#f59e0b" : "#ef4444";
  const scoreLabel = (s) =>
    s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Fair" : "Needs Work";

  const progressPct = (recordingTime / 30) * 100;

  // Build analysisData for AICharacter personalized messages
  const analysisData = latest ? (() => {
    const metrics = [
      { name: "Eye Contact",   value: latest.eye_contact_percentage },
      { name: "Posture",       value: latest.posture_percentage },
      { name: "Smile",         value: latest.smile_percentage },
      { name: "Hand Movement", value: latest.hand_movement_percentage },
      { name: "Speech",        value: latest.speech_score },
    ];
    const weakest = metrics.reduce((a, b) => a.value < b.value ? a : b);
    return { score: latest.confidence_score, weakestMetric: weakest.name, weakestValue: weakest.value };
  })() : null;

  return (
    <div className="ai-page">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        theme="dark"
        toastStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px" }}
      />

      {/* Step 3: Full report modal */}
      {showReport && <CoachingReport report={report} onClose={() => setShowReport(false)} />}

      {/* Ideal Performance Demo modal */}
      {showIdealDemo && (
        <IdealPerformanceDemo
          analysisData={lastResult}
          onClose={() => setShowIdealDemo(false)}
        />
      )}

      {/* Header */}
      <div className="ai-header animate-fadeUp">
        <div>
          <h1 className="ai-title">AI Practice Room</h1>
          <p className="ai-subtitle">Record up to 30 seconds and get instant AI feedback</p>
        </div>
        <div className="ai-header-right">
          {/* Step 10: Last session badge */}
          <LastSessionBadge dataPoints={dataPoints} />
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
      </div>

      <div className="ai-grid ai-grid--3col">
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
            <div className="ai-camera-wrap" style={{ position: "relative" }}>
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

              {/* Step 5: Live filler counter badge */}
              {recording && liveFillers > 0 && (
                <div className="ai-filler-badge">
                  <span className="ai-filler-icon">💬</span>
                  <span className="ai-filler-count">{liveFillers}×</span>
                  <span className="ai-filler-label">um/uh</span>
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
                  {loading
                    ? <span style={{ display:"inline-block", width:13, height:13, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"ws-spin 0.8s linear infinite" }} />
                    : "Analyze →"}
                </button>
              </div>
            )}
          </div>

          {/* Analysis in progress — staged progress bar */}
          {loading && (
            <div className="ai-analysis-card animate-fadeUp">
              <div className="ai-progress-header">
                <span className="ai-progress-spinner" />
                <div>
                  <div className="ai-analysis-title">Analyzing your session…</div>
                  <div className="ai-analysis-sub">
                    {analysisProgress?.message || "Preparing…"}
                  </div>
                </div>
                <span className="ai-progress-pct">
                  {analysisProgress?.percent ?? 0}%
                </span>
              </div>

              {/* Progress bar track */}
              <div className="ai-ws-bar-track">
                <div
                  className="ai-ws-bar-fill"
                  style={{ width: `${analysisProgress?.percent ?? 0}%` }}
                />
              </div>

              {/* Stage pills */}
              <div className="ai-stage-pills">
                {[
                  { key: "starting",            label: "Start" },
                  { key: "video_metrics_done",  label: "Face & Pose" },
                  { key: "speech_transcription",label: "Whisper" },
                  { key: "speech_done",         label: "Speech" },
                  { key: "scoring",             label: "Score" },
                  { key: "report",              label: "Report" },
                  { key: "done",                label: "Done" },
                ].map(({ key, label }) => {
                  const done    = analysisProgress?.completedStages?.includes(key)
                                  || analysisProgress?.stage === "done";
                  const active  = analysisProgress?.stage === key;
                  return (
                    <span
                      key={key}
                      className={`ai-stage-pill${
                        done   ? " ai-stage-pill--done"   : ""
                      }${active ? " ai-stage-pill--active" : ""}`}
                    >
                      {done ? "✓" : active ? "●" : "○"} {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 9: Exercise card */}
          {exercise && (
            <ExerciseCard exercise={exercise} onDismiss={() => setExercise(null)} />
          )}
        </div>

        {/* Center — AI Mentor character + chat */}
        <div className="ai-mentor-col">
          <div className="ai-mentor-card animate-fadeUp">
            <div className="ai-mentor-header">
              <div className="ai-mentor-title">
                <span className="ai-mentor-status-dot" />
                Your AI Mentor
              </div>
              <button
                className="ai-mentor-dev-toggle"
                onClick={() => setShowDevPanel((v) => !v)}
                title="Toggle dev controls"
              >
                ⚙
              </button>
            </div>
            <AICharacter
              state={character.state}
              isSpeaking={character.isSpeaking}
              analysisData={analysisData}
              speech={speech}
              showDevPanel={showDevPanel}
              onCharacterClick={character.triggerGreeting}
              style={{ flex: 1 }}
            />
          </div>

          {/* Voice + Chat panel */}
          <ChatPanel
            messages={chat.messages}
            isThinking={chat.isThinking}
            isStreaming={chat.isStreaming}
            onSendMessage={chat.sendMessage}
            onStop={chat.stopResponse}
            onClear={chat.clearHistory}
            speech={speech}
            className="animate-fadeUp"
            style={{ animationDelay: "0.08s" }}
          />
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
                {/* Step 6: Overall trend */}
                {trends !== null && (
                  <div className="ai-score-trend">
                    {Object.values(trends).filter(t => t.direction === "up").length > 0
                      ? <span className="ai-trend-positive">📈 Improved in {Object.values(trends).filter(t => t.direction === "up").length} areas</span>
                      : <span className="ai-trend-neutral">Keep practicing to see improvement</span>
                    }
                  </div>
                )}
                <p className="ai-score-desc">
                  {scoreLabel(latest.confidence_score) === "Excellent"
                    ? "Outstanding performance! You're on fire — keep it up."
                    : scoreLabel(latest.confidence_score) === "Good"
                    ? "Great job! A few refinements will get you to excellent."
                    : scoreLabel(latest.confidence_score) === "Fair"
                    ? "Good effort. Focus on the areas below to level up."
                    : "Keep practicing — consistency is the key to growth!"}
                </p>
                {/* Step 3: View full report button */}
                {report && (
                  <button className="ai-report-btn" onClick={() => setShowReport(true)}>
                    📋 View Full Coaching Report
                  </button>
                )}

                {/* Ideal Performance Demo trigger */}
                {lastResult && (
                  <button
                    className="ipd-trigger-btn"
                    onClick={() => setShowIdealDemo(true)}
                    id="ideal-demo-trigger-btn"
                  >
                    <span className="ipd-trigger-btn-icon">🤖</span>
                    <span className="ipd-trigger-btn-text">
                      <span className="ipd-trigger-btn-main">✨ See Ideal Performance Demo</span>
                      <span className="ipd-trigger-btn-sub">
                        {lastResult.speech_text ? "Watch 3D avatar deliver your speech with improved confidence" : "Watch your AI-improved 3D presentation"}
                      </span>
                    </span>
                    <span className="ipd-trigger-btn-arrow">→</span>
                  </button>
                )}
              </div>

              {/* Metrics with Step 6 trend arrows */}
              <div className="ai-metrics-card animate-fadeUp" style={{ animationDelay: "0.06s" }}>
                <div className="ai-card-title">Detailed Breakdown</div>
                <MetricBar icon="👁️" label="Eye Contact"   val={latest.eye_contact_percentage}   trend={trends?.["Eye Contact"]} />
                <MetricBar icon="🧍" label="Posture"        val={latest.posture_percentage}         trend={trends?.["Posture"]} />
                <MetricBar icon="😊" label="Smile"          val={latest.smile_percentage}           trend={trends?.["Smile"]} />
                <MetricBar icon="🤚" label="Hand Movement"  val={latest.hand_movement_percentage}   trend={trends?.["Hand Movement"]} />
                <MetricBar icon="🎤" label="Speech Score"
                  val={latest.speech_score}
                  raw={`${Number(latest.speech_score).toFixed(1)}%`}
                  trend={trends?.["Speech"]}
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