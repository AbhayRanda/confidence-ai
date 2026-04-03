import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Info, CheckCircle2 } from 'lucide-react';

export default function Recommendations({ latest }) {
  if (!latest) return null;

  // Extract recommendations based on weakest points
  const getWeaknesses = () => {
    const metrics = [
      { name: "Eye Contact", value: latest.eye_contact_percentage, tip: "Look directly at the camera lens, not the screen, to simulate eye contact." },
      { name: "Posture", value: latest.posture_percentage, tip: "Keep your shoulders back and sit up straight." },
      { name: "Smile", value: latest.smile_percentage, tip: "Try to maintain a warm, natural expression while listening." },
      { name: "Gestures", value: latest.hand_movement_percentage, tip: "Use natural hand movements to emphasize your key points." },
      { name: "Speech Pace", value: Math.min((latest.words_per_minute / 150) * 100, 100), tip: "Slow down your speech to ensure clarity and emphasis." }
    ];
    
    // Sort from lowest to highest and pick bottom 3
    return metrics.filter(m => m.value !== undefined)
                  .sort((a, b) => a.value - b.value)
                  .slice(0, 3);
  };

  const weaknesses = getWeaknesses();

  return (
    <div className="glass-panel p-6 bg-white flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-amber-100 p-2 rounded-lg">
          <Lightbulb className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Areas for Improvement</h3>
          <p className="text-xs text-slate-500">AI-generated tips for your next session</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {weaknesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400" />
            <p className="text-sm">Great job! No major weaknesses detected.</p>
          </div>
        ) : (
          weaknesses.map((item, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ x: 4 }}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-sm transition-all group"
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {item.name}
                </h4>
                <span className="text-xs font-bold px-2 py-0.5 rounded border border-amber-200 text-amber-700 bg-amber-50">
                  {Math.round(item.value)}%
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-1">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                {item.tip}
              </p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
