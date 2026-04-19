import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Resources.css";

const TIPS = [
  {
    id: "eye",
    icon: "👁️",
    title: "Eye Contact",
    desc: "Build trust and connection through deliberate gaze",
    color: "#7c5cfc",
    glow: "rgba(124,92,252,0.2)",
    importance: "Builds trust and shows engagement. People believe speakers who maintain eye contact significantly more.",
    tips: [
      "Maintain eye contact 50–70% of the time",
      "Do not stare continuously — blink naturally",
      "Look at the triangle: left eye → right eye → mouth",
      "Return to eye contact after looking away",
    ],
    exercises: [
      "30-second drill: hold eye contact while speaking",
      "Record yourself and compare with vs. without eye contact",
      "Mirror practice for 1–2 minutes daily",
    ],
  },
  {
    id: "posture",
    icon: "🧍",
    title: "Posture",
    desc: "Project confidence through powerful body language",
    color: "#5b8def",
    glow: "rgba(91,141,239,0.2)",
    importance: "Your body speaks louder than words. Good posture projects confidence and improves your own mental state.",
    tips: [
      "Keep spine straight and elongated",
      "Relax shoulders — pull them back gently",
      "Chest slightly forward and open",
      "Head aligned directly with your neck",
    ],
    exercises: [
      "Wall test: stand against wall, maintain posture for 2 min",
      "Mirror feedback: speak while watching your posture",
      "Movement drill: walk while speaking to feel natural",
    ],
  },
  {
    id: "facial",
    icon: "😊",
    title: "Facial Expression",
    desc: "Engage your audience with authentic expressions",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.2)",
    importance: "A genuine smile is contagious! It makes you likeable and helps your audience connect emotionally.",
    tips: [
      "Smile softly even when not speaking",
      "Relax your eyelids and forehead",
      "Match your expression to your message",
      "Avoid neutral 'resting' face during presentations",
    ],
    exercises: [
      "Smile mirror check: hold for 10 seconds",
      "Record with smile vs without — notice the difference",
      "Expression variety: practice 5 expressions in 1 minute",
    ],
  },
  {
    id: "speech",
    icon: "🎤",
    title: "Speech & Voice",
    desc: "Speak with clarity, authority and confidence",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.2)",
    importance: "Clear, well-paced speech ensures your message lands. Filler words undermine authority — eliminate them.",
    tips: [
      "Aim for 120–150 words per minute",
      "Pause instead of saying 'um' or 'uh'",
      "Vary your tone and pitch for emphasis",
      "Breathe deeply from your diaphragm before speaking",
    ],
    exercises: [
      "Record yourself and count filler words per minute",
      "Read a passage aloud at different speeds",
      "Tongue twisters daily for diction improvement",
    ],
  },
];

function Modal({ tip, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="res-overlay animate-fadeIn" onClick={onClose}>
      <div className="res-modal animate-fadeUp" onClick={(e) => e.stopPropagation()}>
        <div className="res-modal-header" style={{ borderBottom: `2px solid ${tip.color}30` }}>
          <div className="res-modal-title-row">
            <div className="res-modal-icon-wrap" style={{ background: `${tip.glow}`, border: `1px solid ${tip.color}40` }}>
              <span style={{ fontSize: "22px" }}>{tip.icon}</span>
            </div>
            <h2 className="res-modal-title">{tip.title} Guide</h2>
          </div>
          <button onClick={onClose} className="res-modal-close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p className="res-modal-importance">{tip.importance}</p>

        <div className="res-modal-section">
          <div className="res-modal-section-title">Key Tips</div>
          {tip.tips.map((t) => (
            <div key={t} className="res-modal-item">
              <span className="res-modal-bullet" style={{ background: tip.color }} />
              {t}
            </div>
          ))}
        </div>

        <div className="res-modal-section">
          <div className="res-modal-section-title">Practice Exercises</div>
          {tip.exercises.map((ex, i) => (
            <div key={ex} className="res-modal-item">
              <span className="res-modal-num" style={{ background: `${tip.glow}`, color: tip.color, border: `1px solid ${tip.color}40` }}>
                {i + 1}
              </span>
              {ex}
            </div>
          ))}
        </div>

        <button className="res-modal-cta" style={{ background: `linear-gradient(135deg, ${tip.color}, ${tip.color}bb)` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Practice Now in AI Room
        </button>
      </div>
    </div>
  );
}

function Resources() {
  const navigate = useNavigate();
  const [activeTip, setActiveTip] = useState(null);

  return (
    <div className="res-page">
      {activeTip && <Modal tip={activeTip} onClose={() => setActiveTip(null)} />}

      {/* Hero */}
      <div className="res-hero">
        <div className="res-hero-bg" />
        <div className="res-hero-content animate-fadeUp">
          <div className="res-hero-badge">Learning Resources</div>
          <h1 className="res-hero-title">Personality Development<br /><span className="res-hero-title-accent">Mastery Guide</span></h1>
          <p className="res-hero-sub">
            Master the 4 pillars of confident communication — click any card to unlock techniques and exercises.
          </p>
          <button onClick={() => navigate("/ai")} className="res-hero-btn" id="start-practice-resources-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Start Practicing Now
          </button>
        </div>
        <div className="res-hero-orb res-hero-orb-1" />
        <div className="res-hero-orb res-hero-orb-2" />
      </div>

      <div className="res-content">
        {/* Skills grid */}
        <div className="res-section-header">
          <h2 className="res-section-title">Core Skills</h2>
          <span className="res-section-sub">Click any card to expand tips & exercises</span>
        </div>

        <div className="res-tips-grid">
          {TIPS.map((tip, i) => (
            <div
              key={tip.id}
              className="res-tip-card animate-fadeUp"
              style={{ animationDelay: `${i * 0.07}s` }}
              onClick={() => setActiveTip(tip)}
            >
              <div className="res-tip-icon-bg" style={{ background: `${tip.glow}`, border: `1px solid ${tip.color}30` }}>
                <span className="res-tip-icon">{tip.icon}</span>
              </div>
              <h3 className="res-tip-title">{tip.title}</h3>
              <p className="res-tip-desc">{tip.desc}</p>
              <div className="res-tip-footer">
                <span className="res-tip-link" style={{ color: tip.color }}>
                  View tips
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Learning path */}
        <div className="res-path-card animate-fadeUp">
          <div className="res-path-header">
            <h2 className="res-path-title">Your Learning Path</h2>
            <span className="res-path-badge">4 Steps</span>
          </div>
          <div className="res-path-grid">
            {[
              { step: "01", title: "Learn", desc: "Read tips and understand why each element matters", icon: "📚", color: "#7c5cfc" },
              { step: "02", title: "Record", desc: "Practice with the AI video recorder", icon: "🎬", color: "#5b8def" },
              { step: "03", title: "Analyze", desc: "Get AI confidence scores to track progress", icon: "📊", color: "#22c55e" },
              { step: "04", title: "Master", desc: "Build consistent habits and real confidence", icon: "🏆", color: "#f59e0b" },
            ].map((p, i) => (
              <div key={p.step} className="res-path-step animate-fadeUp" style={{ animationDelay: `${0.2 + i * 0.07}s` }}>
                <div className="res-path-step-icon" style={{ background: `${p.color}18`, border: `1px solid ${p.color}30` }}>
                  <span style={{ fontSize: "22px" }}>{p.icon}</span>
                </div>
                <div className="res-path-step-num" style={{ color: p.color }}>{p.step}</div>
                <div className="res-path-step-title">{p.title}</div>
                <div className="res-path-step-desc">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="res-cta animate-fadeUp">
          <div className="res-cta-bg" />
          <div className="res-cta-content">
            <h3 className="res-cta-title">Ready to put it into practice?</h3>
            <p className="res-cta-sub">Record a session and get instant AI feedback on your confidence.</p>
          </div>
          <button onClick={() => navigate("/ai")} className="res-cta-btn" id="go-to-practice-btn">
            Go to AI Practice Room
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Resources;