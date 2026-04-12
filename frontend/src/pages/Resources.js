import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const TIPS = [
  {
    id: "eye",
    icon: "👁️",
    title: "Eye Contact",
    desc: "Learn perfect eye contact techniques",
    color: "#6c47ff",
    bg: "#f0eeff",
    importance: "Builds trust and shows engagement. People believe speakers who maintain eye contact significantly more.",
    tips: [
      "Maintain eye contact 50–70% of the time",
      "Do not stare continuously",
      "Look at the triangle: left eye → right eye → mouth",
      "Blink naturally",
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
    desc: "Correct sitting & standing posture",
    color: "#2980b9",
    bg: "#ebf5fb",
    importance: "Your body speaks louder than words. Good posture projects confidence and improves your own mental state.",
    tips: [
      "Keep spine straight",
      "Relax shoulders",
      "Chest slightly forward",
      "Head aligned with neck",
    ],
    exercises: [
      "Wall test: stand against wall, maintain posture for 2 min",
      "Mirror feedback: speak while watching your posture",
      "Movement drill: walk while speaking to feel natural movement",
    ],
  },
  {
    id: "facial",
    icon: "😊",
    title: "Facial Expression",
    desc: "Improve face confidence & smile",
    color: "#27ae60",
    bg: "#eafaf1",
    importance: "A genuine smile is contagious! It makes you likeable and helps your audience connect emotionally.",
    tips: [
      "Smile softly even when not speaking",
      "Relax eyelids",
      "Avoid frowning",
      "Match your expression to your message",
    ],
    exercises: [
      "Smile mirror check: hold for 10 seconds",
      "Voice test: record with smile vs without — notice the difference",
      "Expression variety: practice 5 expressions in 1 minute",
    ],
  },
  {
    id: "speech",
    icon: "🎤",
    title: "Speech & Voice",
    desc: "Speak with clarity and confidence",
    color: "#e67e22",
    bg: "#fef5e4",
    importance: "Clear, well-paced speech ensures your message lands. Filler words undermine authority — remove them.",
    tips: [
      "Aim for 120–150 words per minute",
      "Pause instead of saying 'um' or 'uh'",
      "Vary your tone for emphasis",
      "Breathe deeply before speaking",
    ],
    exercises: [
      "Record yourself and count filler words",
      "Read a passage aloud at different speeds",
      "Tongue twisters daily for diction",
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
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>{tip.icon}</span>
            <h2 style={styles.modalTitle}>{tip.title} Tips</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <p style={styles.modalImportance}>{tip.importance}</p>

        <div style={styles.modalSection}>
          <div style={styles.modalSectionTitle}>Key Tips</div>
          {tip.tips.map((t) => (
            <div key={t} style={styles.modalListItem}>
              <span style={{ ...styles.modalBullet, background: tip.color }}>•</span>
              {t}
            </div>
          ))}
        </div>

        <div style={styles.modalSection}>
          <div style={styles.modalSectionTitle}>Practice Exercises</div>
          {tip.exercises.map((ex, i) => (
            <div key={ex} style={styles.modalListItem}>
              <span style={{ ...styles.modalNum, background: tip.bg, color: tip.color }}>{i + 1}</span>
              {ex}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Resources() {
  const navigate = useNavigate();
  const [activeTip, setActiveTip] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeUp { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:translateY(0);} }
      @keyframes modalIn { from{opacity:0;transform:scale(0.95) translateY(8px);} to{opacity:1;transform:scale(1) translateY(0);} }
      .tip-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.08); transform: translateY(-2px); }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={styles.page}>
      {activeTip && <Modal tip={activeTip} onClose={() => setActiveTip(null)} />}

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>Learning Resources</div>
          <h1 style={styles.heroTitle}>Personality Development Tips</h1>
          <p style={styles.heroSub}>
            Master the 4 pillars of confident communication — click any card to learn techniques and exercises.
          </p>
          <button onClick={() => navigate("/ai")} style={styles.heroBtn}>
            🎬 Start Practicing Now
          </button>
        </div>
      </div>

      {/* Tips grid */}
      <div style={styles.content}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Core Skills</h2>
          <span style={styles.sectionSub}>Click any card to expand tips & exercises</span>
        </div>

        <div style={styles.tipsGrid}>
          {TIPS.map((tip) => (
            <div
              key={tip.id}
              className="tip-card"
              style={styles.tipCard}
              onClick={() => setActiveTip(tip)}
            >
              <div style={{ ...styles.tipIconWrap, background: tip.bg }}>
                <span style={styles.tipIcon}>{tip.icon}</span>
              </div>
              <h3 style={styles.tipTitle}>{tip.title}</h3>
              <p style={styles.tipDesc}>{tip.desc}</p>
              <div style={styles.tipFooter}>
                <span style={{ ...styles.tipLink, color: tip.color }}>View tips →</span>
              </div>
            </div>
          ))}
        </div>

        {/* Learning path */}
        <div style={styles.pathCard}>
          <h2 style={styles.pathTitle}>🚀 Your Learning Path</h2>
          <div style={styles.pathGrid}>
            {[
              { step: "01", title: "Learn", desc: "Read tips and understand why each element matters", icon: "📚" },
              { step: "02", title: "Record", desc: "Practice with the AI video recorder", icon: "🎬" },
              { step: "03", title: "Analyze", desc: "Get AI confidence scores to track progress", icon: "📊" },
              { step: "04", title: "Master", desc: "Build consistent habits and real confidence", icon: "🏆" },
            ].map((p) => (
              <div key={p.step} style={styles.pathStep}>
                <div style={styles.pathNum}>{p.step}</div>
                <div style={styles.pathIcon}>{p.icon}</div>
                <div style={styles.pathStepTitle}>{p.title}</div>
                <div style={styles.pathStepDesc}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={styles.ctaBanner}>
          <div>
            <h3 style={styles.ctaTitle}>Ready to put it into practice?</h3>
            <p style={styles.ctaSub}>Record a session and get instant AI feedback on your confidence.</p>
          </div>
          <button onClick={() => navigate("/ai")} style={styles.ctaBtn}>
            Go to AI Practice Room →
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    flex: 1,
    background: "#f7f8fc",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', sans-serif",
    overflowY: "auto",
  },
  hero: {
    background: "linear-gradient(135deg, #5c2fff 0%, #7e57ff 50%, #4f8ef7 100%)",
    padding: "48px 48px 40px",
  },
  heroContent: { maxWidth: "560px", animation: "fadeUp 0.5s ease both" },
  heroBadge: {
    display: "inline-block",
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    padding: "4px 14px",
    borderRadius: "20px",
    fontSize: "11.5px",
    fontWeight: "600",
    letterSpacing: "0.5px",
    marginBottom: "14px",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: "clamp(22px, 4vw, 32px)",
    fontWeight: "800",
    color: "#fff",
    margin: "0 0 12px 0",
    letterSpacing: "-0.4px",
    lineHeight: "1.2",
  },
  heroSub: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.8)",
    lineHeight: "1.7",
    margin: "0 0 24px 0",
  },
  heroBtn: {
    padding: "11px 24px",
    background: "#fff",
    color: "#6c47ff",
    border: "none",
    borderRadius: "9px",
    fontSize: "13.5px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  content: { padding: "32px 36px" },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: "12px",
    marginBottom: "20px",
  },
  sectionTitle: { fontSize: "17px", fontWeight: "800", color: "#1a1a2e", margin: 0, letterSpacing: "-0.2px" },
  sectionSub: { fontSize: "13px", color: "#bbb" },
  tipsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "28px",
  },
  tipCard: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "14px",
    padding: "22px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    animation: "fadeUp 0.4s ease both",
  },
  tipIconWrap: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "14px",
  },
  tipIcon: { fontSize: "22px" },
  tipTitle: { fontSize: "15px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 6px 0" },
  tipDesc: { fontSize: "13px", color: "#888", lineHeight: "1.5", margin: "0 0 16px 0" },
  tipFooter: { borderTop: "1px solid #f5f5f5", paddingTop: "12px" },
  tipLink: { fontSize: "12.5px", fontWeight: "700" },
  pathCard: {
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "14px",
    padding: "28px",
    marginBottom: "20px",
  },
  pathTitle: { fontSize: "17px", fontWeight: "800", color: "#1a1a2e", margin: "0 0 24px 0", letterSpacing: "-0.2px" },
  pathGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "20px" },
  pathStep: { textAlign: "center" },
  pathNum: { fontSize: "11px", fontWeight: "800", color: "#ddd", letterSpacing: "1px", marginBottom: "8px" },
  pathIcon: { fontSize: "28px", marginBottom: "8px" },
  pathStepTitle: { fontSize: "14px", fontWeight: "700", color: "#1a1a2e", marginBottom: "4px" },
  pathStepDesc: { fontSize: "12px", color: "#999", lineHeight: "1.5" },
  ctaBanner: {
    background: "linear-gradient(135deg, #5c2fff, #4f8ef7)",
    borderRadius: "14px",
    padding: "24px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
  },
  ctaTitle: { fontSize: "16px", fontWeight: "800", color: "#fff", margin: "0 0 4px 0" },
  ctaSub: { fontSize: "13px", color: "rgba(255,255,255,0.75)", margin: 0 },
  ctaBtn: {
    padding: "11px 22px",
    background: "#fff",
    color: "#6c47ff",
    border: "none",
    borderRadius: "9px",
    fontSize: "13.5px",
    fontWeight: "700",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  },
  // Modal
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,15,30,0.55)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#fff",
    borderRadius: "16px",
    padding: "28px",
    width: "100%",
    maxWidth: "500px",
    maxHeight: "85vh",
    overflowY: "auto",
    animation: "modalIn 0.25s ease both",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  modalTitle: { fontSize: "18px", fontWeight: "800", color: "#1a1a2e", margin: 0 },
  closeBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "#f5f5f5",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    color: "#666",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalImportance: {
    fontSize: "13.5px",
    color: "#666",
    lineHeight: "1.6",
    margin: "0 0 20px 0",
    padding: "12px 16px",
    background: "#f9f9f9",
    borderRadius: "8px",
    borderLeft: "3px solid #6c47ff",
  },
  modalSection: { marginBottom: "20px" },
  modalSectionTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: "10px",
  },
  modalListItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    fontSize: "13.5px",
    color: "#444",
    lineHeight: "1.5",
    marginBottom: "8px",
  },
  modalBullet: {
    color: "#fff",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    flexShrink: 0,
    marginTop: "1px",
  },
  modalNum: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "700",
    flexShrink: 0,
    marginTop: "1px",
  },
};

export default Resources;