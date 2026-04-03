import React from 'react';
import { motion } from 'framer-motion';
import { Video, Square, Upload, Zap } from 'lucide-react';
import { ClipLoader } from 'react-spinners';

export default function CameraSection({
  recording,
  startRecording,
  stopRecording,
  recordingTime,
  videoRef,
  handleFileSelect,
  handleUpload,
  loading,
  recordedBlob,
  selectedFile
}) {

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="glass-panel p-6 flex flex-col h-full bg-white relative overflow-hidden group">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Video className="w-5 h-5 text-indigo-500" />
            Camera Input
          </h2>
          <p className="text-sm text-slate-500 mt-1">Record or upload to start analysis</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {!recording ? (
            <button 
              onClick={startRecording}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-[0_2px_10px_rgb(79,70,229,0.2)] transition-all font-medium text-sm flex items-center gap-2"
            >
              <Video className="w-4 h-4" /> Start
            </button>
          ) : (
            <motion.button 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={stopRecording}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-[0_2px_10px_rgb(244,63,94,0.3)] transition-all font-medium text-sm flex items-center gap-2"
            >
              <Square className="w-4 h-4" /> Stop
            </motion.button>
          )}

          <div className="relative overflow-hidden group/btn">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={loading}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />
            <button className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-all font-medium text-sm flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative flex-1 bg-slate-900 rounded-2xl overflow-hidden min-h-[300px] border border-slate-200">
        <video
          ref={videoRef}
          autoPlay
          muted={recording}
          playsInline
          controls={!recording}
          className="w-full h-full object-cover"
        />

        {/* Recording Overlay */}
        {recording && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full z-10">
            <motion.div 
              animate={{ opacity: [1, 0.4, 1] }} 
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2.5 h-2.5 bg-rose-500 rounded-full"
            />
            <span className="text-white text-xs font-medium font-mono">{formatTime(recordingTime)}</span>
          </div>
        )}

        {/* AI Scanning FX Overlay Layer */}
        {recording && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Eye tracking simulated dots */}
            <motion.div 
              animate={{ x: [0, 20, -10, 0], y: [0, -10, 15, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute left-[40%] top-[30%] w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]"
            />
            <motion.div 
              animate={{ x: [0, 20, -10, 0], y: [0, -10, 15, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.2 }}
              className="absolute right-[40%] top-[30%] w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]"
            />

            {/* Scanning line */}
            <motion.div
              animate={{ y: ["0%", "100%", "0%"] }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="absolute left-0 right-0 h-0.5 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)] z-20"
            />
            
            {/* Corner brackets */}
            <div className="absolute top-1/4 left-1/4 w-8 h-8 border-t-2 border-l-2 border-indigo-400/50 opacity-50" />
            <div className="absolute top-1/4 right-1/4 w-8 h-8 border-t-2 border-r-2 border-indigo-400/50 opacity-50" />
            <div className="absolute bottom-1/4 left-1/4 w-8 h-8 border-b-2 border-l-2 border-indigo-400/50 opacity-50" />
            <div className="absolute bottom-1/4 right-1/4 w-8 h-8 border-b-2 border-r-2 border-indigo-400/50 opacity-50" />
          </div>
        )}
      </div>

      {/* Analyze Action Bar */}
      <div className="mt-4 flex justify-between items-center bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 transition-all">
        <div className="flex items-center gap-3">
           <div className="bg-indigo-100 p-2 rounded-lg"><Zap className="w-5 h-5 text-indigo-600" /></div>
           <div>
             <p className="text-sm font-semibold text-slate-800">Ready for Analysis</p>
             <p className="text-xs text-slate-500 mt-0.5">
                {(recordedBlob || selectedFile) ? (selectedFile?.name || "recorded_video.webm") : "No video selected"}
             </p>
           </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={loading || (!recordedBlob && !selectedFile)}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
            (!recordedBlob && !selectedFile) 
              ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
          }`}
        >
          {loading ? <ClipLoader size={16} color="#fff" /> : null}
          {loading ? "Analyzing..." : "Analyze Video"}
        </button>
      </div>

    </div>
  );
}
