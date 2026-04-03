import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Smile, Activity, Hand, Mic, User, Target } from 'lucide-react';

const CircularProgress = ({ value, color, size = 60, strokeWidth = 6 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div style={{ width: size, height: size }} className="relative flex items-center justify-center">
      <svg className="transform -rotate-90 w-full h-full">
        {/* Background circle */}
        <circle
          className="text-slate-100"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Animated Progress circle */}
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ stroke: color }}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold text-slate-700 text-sm">
        {Math.round(value)}%
      </div>
    </div>
  );
};

export default function ScoreCards({ latest }) {
  if (!latest) return null;

  const metrics = [
    { title: "Eye Contact", icon: Eye, value: latest.eye_contact_percentage, color: "#4f46e5", bg: "bg-indigo-50" },
    { title: "Posture", icon: Activity, value: latest.posture_percentage, color: "#0ea5e9", bg: "bg-sky-50" },
    { title: "Smile", icon: Smile, value: latest.smile_percentage, color: "#10b981", bg: "bg-emerald-50" },
    { title: "Gestures", icon: Hand, value: latest.hand_movement_percentage, color: "#f59e0b", bg: "bg-amber-50" },
    { title: "Speech Clarity", icon: Mic, value: latest.speech_score, color: "#ec4899", bg: "bg-pink-50" },
    { title: "Face Visibility", icon: User, value: latest.face_visibility_percentage || 0, color: "#8b5cf6", bg: "bg-violet-50" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Overall Score Card */}
      <motion.div 
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="glass-panel p-6 col-span-1 md:col-span-2 lg:col-span-3 bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg overflow-hidden relative"
      >
        <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                  <Target className="w-6 h-6 text-white" />
               </div>
               <h3 className="text-xl text-white/90 font-medium">Overall Confidence Score</h3>
            </div>
            <p className="text-indigo-100 mt-1 max-w-md">Your overall confidence score is calculated based on eye contact, posture, gestures, and speech clarity.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-indigo-200 font-medium uppercase tracking-wider">Rating</p>
              <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200">
                {latest.confidence_level || 'Good'}
              </p>
            </div>
            <div className="w-px h-12 bg-white/20"></div>
            <div className="text-5xl font-black tabular-nums tracking-tight">
              {Number(latest.confidence_score).toFixed(1)}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Individual Metric Cards */}
      {metrics.map((metric, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1, duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          className="glass-card p-5 bg-white border border-slate-100 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metric.bg} transition-colors`}>
              <metric.icon className="w-6 h-6" style={{ color: metric.color }} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700">{metric.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">Analysed metric</p>
            </div>
          </div>
          <CircularProgress value={metric.value} color={metric.color} size={54} strokeWidth={5} />
        </motion.div>
      ))}
    </div>
  );
}
