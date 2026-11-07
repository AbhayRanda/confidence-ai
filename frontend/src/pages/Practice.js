import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mic,
  Video,
  BookOpen,
  Sparkles,
  ArrowRight,
  Clock,
  Target,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import "./Practice.css";

const DRILL_MODES = [
  {
    id: "presentation",
    title: "Presentation Studio",
    tag: "60-Second Full Assessment",
    desc: "Record a comprehensive talk or slide pitch. Analyzes all 6 biometric dimensions including gaze drift, spine posture, and vocal cadence.",
    icon: <Video size={24} />,
    color: "#7c5cfc",
    bg: "rgba(124, 92, 252, 0.12)",
    route: "/ai",
    bullets: [
      "Tracks 33 skeletal posture landmarks",
      "Measures exact words-per-minute",
      "Generates 7-day personalized plan",
    ],
  },
  {
    id: "quick-check",
    title: "30-Second Focus Drill",
    tag: "Speed Micro-Workout",
    desc: "Target one specific weakness: eliminate filler words, lock uninterrupted eye contact, or warm up natural facial engagement.",
    icon: <Target size={24} />,
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
    route: "/ai",
    bullets: [
      "Instant feedback on single metric",
      "Live visual threshold meters",
      "Perfect for pre-meeting warmups",
    ],
  },
  {
    id: "read-aloud",
    title: "Executive Script Read Aloud",
    tag: "Vocal Clarity & Cadence",
    desc: "Read curated or AI-generated executive speeches aloud. Trains vocal modulation, confident breathing, and pauses.",
    icon: <BookOpen size={24} />,
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
    route: "/resources",
    bullets: [
      "Highlights filler words in real-time",
      "Pacing metronome indicator",
      "Curated leadership monologues",
    ],
  },
  {
    id: "live-coach",
    title: "3D Avatar Mock Interview",
    tag: "Interactive Conversation",
    desc: "Engage in real-time vocal Q&A with our 3D VRM humanoid coach across HR, Technical, or Leadership interview scenarios.",
    icon: <Mic size={24} />,
    color: "#ec4899",
    bg: "rgba(236, 72, 153, 0.12)",
    route: "/live",
    bullets: [
      "Spoken follow-up questions",
      "Dynamic difficulty adjustment",
      "Empathetic facial reactions",
    ],
  },
];

const PROMPTS = [
  "“Tell me about yourself and what drives your professional ambition.”",
  "“Describe a high-stakes disagreement with a teammate and how you resolved it.”",
  "“Pitch a new product concept to an executive leadership team in 45 seconds.”",
  "“Walk through a complex project where you had to adapt quickly under tight deadlines.”",
];

export default function Practice() {
  const navigate = useNavigate();
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);

  return (
    <div className="practice-page">
      <div className="practice-container">
        {/* Header */}
        <div className="practice-header animate-fadeUp">
          <div className="practice-badge">
            <Sparkles size={14} /> Training Studio
          </div>
          <h1 className="practice-title">Practice Studio</h1>
          <p className="practice-subtitle">
            Choose a targeted drill to sharpen your public speaking, interview delivery, and body language.
          </p>
        </div>

        {/* Dynamic Prompt Box */}
        <div className="practice-prompt-card animate-fadeUp">
          <div className="practice-prompt-header">
            <span className="practice-prompt-tag">Suggested Drill Topic</span>
            <button
              className="practice-prompt-refresh"
              onClick={() => setSelectedPromptIndex((prev) => (prev + 1) % PROMPTS.length)}
            >
              <RotateCcw size={14} /> New Prompt
            </button>
          </div>
          <p className="practice-prompt-text">{PROMPTS[selectedPromptIndex]}</p>
          <div className="practice-prompt-footer">
            <span className="practice-prompt-hint">
              <Clock size={14} /> Recommended duration: 45–60 seconds
            </span>
            <Link to="/ai" className="practice-prompt-action">
              Practice This Now <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Drill Modes Grid */}
        <div className="practice-modes-grid animate-fadeUp">
          {DRILL_MODES.map((mode) => (
            <div key={mode.id} className="practice-mode-card">
              <div className="practice-mode-header">
                <div className="practice-mode-icon" style={{ background: mode.bg, color: mode.color }}>
                  {mode.icon}
                </div>
                <span className="practice-mode-tag">{mode.tag}</span>
              </div>
              <h2 className="practice-mode-title">{mode.title}</h2>
              <p className="practice-mode-desc">{mode.desc}</p>

              <ul className="practice-mode-bullets">
                {mode.bullets.map((b, i) => (
                  <li key={i}>
                    <CheckCircle2 size={14} style={{ color: mode.color, flexShrink: 0 }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate(mode.route)}
                className="practice-mode-btn"
                style={{ borderColor: mode.color }}
              >
                <span>Launch Drill</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
