import React, { useEffect, useState, useRef, useCallback } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Activity } from "lucide-react";
import { motion } from "framer-motion";

// Sub-components
import CameraSection from "../components/dashboard/CameraSection";
import ScoreCards from "../components/dashboard/ScoreCards";
import ReportsGraph from "../components/dashboard/ReportsGraph";
import Recommendations from "../components/dashboard/Recommendations";

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const API_ENDPOINTS = {
  dashboard: `${API_BASE_URL}/dashboard`,
  analyze: `${API_BASE_URL}/analyze`,
  storage: `${API_BASE_URL}/storage`,
};

export default function AIDashboard() {
  const [recordingTime, setRecordingTime] = useState(0);
  const [dataPoints, setDataPoints] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [currentStream, setCurrentStream] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);

  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoRef = useRef(null);

  const fetchDashboard = useCallback(() => {
    return new Promise((resolve, reject) => {
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
        .catch((e) => {
          toast.error("Failed to load dashboard data");
          reject(e);
        });
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
    fetchDashboard();
    fetchStorage();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [fetchDashboard, fetchStorage]);

  const startRecording = async () => {
    try {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      setCurrentStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

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
        setRecording(false);
        clearInterval(timerRef.current);
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(chunks, { type: mimeType });
        setRecordedBlob(blob);
        
        stream.getTracks().forEach(track => track.stop());
        setCurrentStream(null);
        
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = URL.createObjectURL(blob);
        }
        clearInterval(timerRef.current);
        setRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
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
      toast.error(`Camera error: ${err.message}`);
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

    if (!fileToUpload) {
      toast.warning("Please upload or record a video first.");
      return;
    }

    const formData = new FormData();
    const filename = recordedBlob ? "video.webm" : selectedFile.name;
    formData.append("file", fileToUpload, filename);

    setLoading(true);

    try {
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
        if (response.status === 413) {
          toast.error(errorData.detail || "Storage limit reached (500 MB).");
          fetchStorage();
          setLoading(false);
          return;
        }
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }
      
      toast.success("Analysis complete! Your results are ready.");
      
      try {
        await fetchDashboard();
        fetchStorage();
      } catch (dashErr) {}

      setRecordedBlob(null);
      setSelectedFile(null);
      setRecording(false);
      setRecordingTime(0);
      
      if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current.srcObject = null;
      }
      
    } catch (error) {
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (duration > 30) {
        toast.error(`Video is ${Math.ceil(duration)} seconds. Max 30 seconds allowed.`);
        e.target.value = "";
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
        toast.success(`Selected: ${file.name}`);
      }
    };
    video.onerror = () => {
      toast.error("Unable to read video file.");
      e.target.value = "";
      setSelectedFile(null);
    };
    video.src = URL.createObjectURL(file);
  };

  const latest = dataPoints[0] || null;

  return (
    <div className="w-full">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Practice presenting and track your AI-rated confidence score.</p>
        </div>
        
        {storageInfo && (
          <div className="flex items-center gap-3 bg-white px-4 py-2 border border-slate-200 rounded-full shadow-sm">
            <Activity className="w-4 h-4 text-indigo-500" />
            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
               <div 
                  className="h-full bg-indigo-500 rounded-full" 
                  style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }} 
               />
            </div>
            <span className="text-xs font-semibold text-slate-600">{storageInfo.percentage.toFixed(0)}% used</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Camera */}
        <div className="xl:col-span-1 h-full min-h-[450px]">
          <CameraSection 
            recording={recording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            recordingTime={recordingTime}
            videoRef={videoRef}
            handleFileSelect={handleFileSelect}
            handleUpload={handleUpload}
            loading={loading}
            recordedBlob={recordedBlob}
            selectedFile={selectedFile}
          />
        </div>

        {/* Right Column: Key Metrics & Graph */}
        <div className="xl:col-span-2 space-y-6">
          {latest ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <ScoreCards latest={latest} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <ReportsGraph dataPoints={dataPoints} />
                 <Recommendations latest={latest} />
              </div>
            </motion.div>
          ) : (
             <div className="flex flex-col items-center justify-center p-12 bg-white glass-card h-full min-h-[400px]">
                <img src="/logo.svg" alt="App Logo" className="w-16 h-16 opacity-10 mb-4 grayscale" />
                <p className="text-slate-500 font-medium text-center">Record or upload a video to see your confidence analysis.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}