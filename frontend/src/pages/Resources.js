import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Resources() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideDown {
        from { 
          opacity: 0; 
          transform: translateY(-10px); 
          max-height: 0;
        }
        to { 
          opacity: 1; 
          transform: translateY(0); 
          max-height: 1000px;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handlePractice = () => {
    navigate("/dashboard");
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.purposeTag}>📚 Learning Resources</span>
        <h1 style={styles.title}>Confidence Building Guide</h1>
        <p style={styles.subtitle}>Master the 4 pillars of confident presentation</p>
        <p style={styles.description}>Each section below shows what to do and what to avoid, plus actionable tips to improve. Practice makes perfect!</p>
      </div>

      <VisualSection
        title="👁️ Eye Contact"
        icon="👁️"
        goodImg="https://images.unsplash.com/photo-1520813792240-56fc4a3765a7"
        badImg="https://images.unsplash.com/photo-1517841905240-472988babdf9"
        goodText="Looking directly at camera"
        badText="Looking down / away"
        importance="Builds trust and shows engagement. People believe speakers who make eye contact 50% more."
        tips={[
          "Focus on the camera lens as if talking to a friend",
          "Blink naturally - no staring contest",
          "Hold eye contact for 5-10 seconds at a time",
          "If using camera, place it at eye level"
        ]}
        exercises={[
          "30-second stare: Look at camera for 30 seconds while speaking",
          "Record yourself: Compare 1 min with eye contact vs without",
          "Mirror practice: Maintain focus for 1-2 minutes"
        ]}
        difficulty="Beginner"
        onPractice={handlePractice}
      />

      <VisualSection
        title="🧍 Posture & Body Language"
        icon="🧍"
        goodImg="https://images.unsplash.com/photo-1551836022-d5d88e9218df"
        badImg="https://images.unsplash.com/photo-1492724441997-5dc865305da7"
        goodText="Straight, open posture"
        badText="Slouching or closed off"
        importance="Your body speaks louder than words. Good posture projects confidence and improves your own mental state."
        tips={[
          "Keep shoulders back and relaxed",
          "Stand with weight balanced on both feet",
          "Avoid crossing arms - look open and approachable",
          "Use natural hand gestures to emphasize points"
        ]}
        exercises={[
          "Wall test: Stand against wall, maintain neutral posture for 2 min",
          "Mirror feedback: Practice speaking while watching posture",
          "Movement drill: Walk while speaking to feel natural movement"
        ]}
        difficulty="Beginner"
        onPractice={handlePractice}
      />

      <VisualSection
        title="😀 Facial Expression & Smile"
        icon="😊"
        goodImg="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e"
        badImg="https://images.unsplash.com/photo-1500648767791-00dcc994a43e"
        goodText="Natural, warm smile"
        badText="Stiff or blank expression"
        importance="A genuine smile is contagious! It makes you likeable and helps audience connect with you emotionally."
        tips={[
          "Smile should reach your eyes (Duchenne smile)",
          "Relax your face between expressions",
          "Practice smiling while speaking - it changes your tone",
          "Authentic > forced. Think of something that makes you happy"
        ]}
        exercises={[
          "Smile mirror check: Hold smile for 10 seconds, check corners of mouth",
          "Voice test: Record with smile vs without - notice the difference",
          "Expression variety: Practice 5 different natural expressions in 1 min"
        ]}
        difficulty="Beginner"
        onPractice={handlePractice}
      />

      <VisualSection
        title="💡 Environment Setup"
        icon="💡"
        goodImg="https://images.unsplash.com/photo-1522071820081-009f0129c71c"
        badImg="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"
        goodText="Good lighting & professional background"
        badText="Poor lighting & cluttered space"
        importance="Your environment affects how others perceive you. Good setup removes distractions and keeps focus on your message."
        tips={[
          "Position light source in front of you, not behind",
          "Keep background clean and professional (blurred or plain wall)",
          "Use headphones for better audio quality",
          "Test camera angle - should be at or slightly above eye level"
        ]}
        exercises={[
          "Lighting test: Record in 3 different setups, compare quality",
          "Background audit: Identify and remove 5 distracting items",
          "Camera angle: Adjust until you look naturally at viewer eye level"
        ]}
        difficulty="Beginner"
        onPractice={handlePractice}
      />

      <div style={styles.progressSection}>
        <h2 style={styles.progressTitle}>🚀 Your Learning Path</h2>
        <div style={styles.progressGrid}>
          <ProgressCard icon="📚" title="Learn" desc="Read tips and understand why each element matters" />
          <ProgressCard icon="🎬" title="Record" desc="Practice with video recorder on Dashboard" />
          <ProgressCard icon="📊" title="Analyze" desc="Get AI confidence scores to track progress" />
          <ProgressCard icon="🏆" title="Master" desc="Build consistent habits and gain real confidence" />
        </div>
      </div>

      <div style={styles.callToAction}>
        <h2>Ready to Practice?</h2>
        <button 
          onClick={handlePractice}
          style={styles.ctaButton}
          onMouseEnter={(e) => e.target.style.background = styles.ctaButtonHover.background}
          onMouseLeave={(e) => e.target.style.background = styles.ctaButton.background}
        >
          🎥 Go to Video Recorder
        </button>
        <p style={styles.ctaText}>Start recording yourself and get instant confidence feedback!</p>
      </div>
    </div>
  );
}

/* ---------- COMPONENT ---------- */

function ProgressCard({ icon, title, desc }) {
  return (
    <div style={styles.progressCard}>
      <div style={styles.progressIcon}>{icon}</div>
      <h3 style={styles.progressTitle2}>{title}</h3>
      <p style={styles.progressDesc}>{desc}</p>
    </div>
  );
}

function VisualSection({ title, icon, goodImg, badImg, goodText, badText, importance, tips = [], exercises = [], difficulty, onPractice }) {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [expandedTips, setExpandedTips] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState(false);

  const difficultyColors = {
    "Beginner": "#00ff99",
    "Intermediate": "#ffaa00",
    "Advanced": "#ff6b9d"
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>{title}</h2>
          <p style={styles.importance}>📌 {importance}</p>
          <span style={{...styles.difficultyBadge, color: difficultyColors[difficulty]}}>
            {difficulty} Level
          </span>
        </div>
      </div>

      <div style={styles.grid}>
        <VisualCard
          img={goodImg}
          label={goodText}
          type="good"
          onHover={(hovered) => setHoveredCard(hovered ? `${title}-good` : null)}
          isHovered={hoveredCard === `${title}-good`}
        />
        <VisualCard
          img={badImg}
          label={badText}
          type="bad"
          onHover={(hovered) => setHoveredCard(hovered ? `${title}-bad` : null)}
          isHovered={hoveredCard === `${title}-bad`}
        />
      </div>

      <div style={styles.expandableContainer}>
        <div 
          style={{...styles.expandableHeader, background: expandedTips ? "rgba(0, 245, 255, 0.1)" : ""}}
          onClick={() => setExpandedTips(!expandedTips)}
        >
          <span style={styles.expandIcon}>{expandedTips ? "▼" : "▶"}</span>
          <h3 style={styles.expandTitle}>💡 Tips & Best Practices</h3>
        </div>
        {expandedTips && (
          <div style={styles.expandedContent}>
            <ul style={styles.tipsList}>
              {tips.map((tip, idx) => (
                <li key={idx} style={styles.tipItem}>
                  <span style={styles.checkmark}>✓</span> {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div style={styles.expandableContainer}>
        <div 
          style={{...styles.expandableHeader, background: expandedExercises ? "rgba(0, 245, 255, 0.1)" : ""}}
          onClick={() => setExpandedExercises(!expandedExercises)}
        >
          <span style={styles.expandIcon}>{expandedExercises ? "▼" : "▶"}</span>
          <h3 style={styles.expandTitle}>💪 Practice Exercises</h3>
        </div>
        {expandedExercises && (
          <div style={styles.expandedContent}>
            <ul style={styles.tipsList}>
              {exercises.map((exercise, idx) => (
                <li key={idx} style={styles.tipItem}>
                  <span style={styles.exerciseIcon}>🎯</span> {exercise}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button 
        onClick={onPractice}
        style={styles.practiceButton}
        onMouseEnter={(e) => e.target.style.background = styles.practiceButtonHover.background}
        onMouseLeave={(e) => e.target.style.background = styles.practiceButton.background}
      >
        🎬 Practice This Now
      </button>
    </div>
  );
}

function VisualCard({ img, label, type, onHover, isHovered }) {
  return (
    <div
      style={{
        ...styles.card,
        ...(isHovered ? styles.cardHover : {}),
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div style={styles.imageContainer}>
        <img src={img} alt={label} style={styles.image} />
        <div style={styles.overlay}>
          {type === "good" ? "✓ DO THIS" : "✗ AVOID THIS"}
        </div>
      </div>
      <div
        style={{
          ...styles.label,
          color: type === "good" ? "#00ff99" : "#ff6b9d",
          background: type === "good" ? "rgba(0, 255, 153, 0.1)" : "rgba(255, 77, 109, 0.1)",
        }}
      >
        {type === "good" ? "✓" : "✗"} {label}
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */

const styles = {
  page: {
    minHeight: "100vh",
    padding: "20px",
    paddingTop: "40px",
    background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    color: "white",
    fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
  },

  purposeTag: {
    display: "inline-block",
    background: "rgba(0, 245, 255, 0.15)",
    border: "1px solid rgba(0, 245, 255, 0.4)",
    color: "#00f5ff",
    padding: "8px 16px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    marginBottom: "16px",
    textTransform: "uppercase",
  },

  header: {
    textAlign: "center",
    marginBottom: "60px",
    animation: "fadeIn 0.5s ease",
  },

  title: {
    fontSize: "clamp(28px, 5vw, 48px)",
    fontWeight: "700",
    margin: "0 0 12px 0",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    letterSpacing: "-1px",
  },

  subtitle: {
    fontSize: "18px",
    opacity: 0.9,
    margin: "0 0 12px 0",
    fontWeight: "600",
    color: "#00f5ff",
  },

  description: {
    fontSize: "15px",
    opacity: 0.8,
    margin: "12px 0 0 0",
    maxWidth: "600px",
    marginLeft: "auto",
    marginRight: "auto",
    lineHeight: "1.6",
  },

  section: {
    marginBottom: "60px",
    maxWidth: "1200px",
    margin: "0 auto 60px auto",
    padding: "30px",
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    border: "1px solid rgba(0, 245, 255, 0.1)",
    animation: "fadeIn 0.6s ease",
  },

  sectionHeader: {
    marginBottom: "30px",
  },

  sectionTitle: {
    fontSize: "28px",
    fontWeight: "700",
    marginBottom: "10px",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },

  importance: {
    fontSize: "16px",
    opacity: 0.85,
    margin: "8px 0",
    lineHeight: "1.5",
    color: "#a8e6ff",
  },

  difficultyBadge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    border: "1px solid currentColor",
    marginTop: "8px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "24px",
    marginBottom: "30px",
  },

  card: {
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(12px)",
    borderRadius: "16px",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.1)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
    animation: "fadeIn 0.5s ease",
  },

  cardHover: {
    transform: "translateY(-8px)",
    boxShadow: "0 12px 40px rgba(0, 245, 255, 0.2)",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(0, 245, 255, 0.3)",
  },

  imageContainer: {
    position: "relative",
    overflow: "hidden",
    height: "320px",
  },

  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transition: "transform 0.3s ease",
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: "700",
    color: "#00f5ff",
    opacity: 0,
    transition: "opacity 0.3s ease",
  },

  label: {
    padding: "18px 16px",
    fontWeight: "700",
    textAlign: "center",
    fontSize: "15px",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },

  expandableContainer: {
    marginTop: "20px",
    marginBottom: "20px",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "12px",
    overflow: "hidden",
  },

  expandableHeader: {
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    background: "rgba(0, 245, 255, 0.05)",
    transition: "all 0.3s ease",
    userSelect: "none",
  },

  expandIcon: {
    fontSize: "14px",
    color: "#00f5ff",
    fontWeight: "700",
    transition: "transform 0.3s ease",
    display: "inline-block",
  },

  expandTitle: {
    margin: "0",
    fontSize: "16px",
    fontWeight: "600",
    color: "#00f5ff",
  },

  expandedContent: {
    padding: "20px",
    background: "rgba(0, 0, 0, 0.3)",
    animation: "slideDown 0.3s ease",
  },

  tipsList: {
    listStyle: "none",
    padding: "0",
    margin: "0",
  },

  tipItem: {
    padding: "12px 0",
    fontSize: "15px",
    lineHeight: "1.6",
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },

  checkmark: {
    color: "#00ff99",
    fontWeight: "700",
    minWidth: "20px",
    marginTop: "2px",
  },

  exerciseIcon: {
    minWidth: "20px",
    marginTop: "2px",
  },

  practiceButton: {
    marginTop: "20px",
    padding: "14px 28px",
    fontSize: "16px",
    fontWeight: "700",
    border: "2px solid #00f5ff",
    background: "rgba(0, 245, 255, 0.1)",
    color: "#00f5ff",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    width: "100%",
  },

  practiceButtonHover: {
    background: "#00f5ff",
    color: "#0f2027",
  },

  progressSection: {
    maxWidth: "1200px",
    margin: "80px auto",
    padding: "40px 30px",
    background: "rgba(0, 245, 255, 0.05)",
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    animation: "fadeIn 0.7s ease",
  },

  progressTitle: {
    fontSize: "28px",
    fontWeight: "700",
    marginBottom: "30px",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    textAlign: "center",
  },

  progressGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
  },

  progressCard: {
    padding: "25px",
    background: "rgba(255,255,255,0.06)",
    borderRadius: "12px",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    textAlign: "center",
    transition: "all 0.3s ease",
  },

  progressIcon: {
    fontSize: "40px",
    marginBottom: "12px",
  },

  progressTitle2: {
    margin: "0 0 10px 0",
    fontSize: "18px",
    fontWeight: "700",
    color: "#00f5ff",
  },

  progressDesc: {
    margin: "0",
    fontSize: "14px",
    opacity: 0.8,
    lineHeight: "1.5",
  },

  callToAction: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "60px 30px",
    textAlign: "center",
    background: "linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(0, 212, 255, 0.08) 100%)",
    borderRadius: "20px",
    border: "2px solid rgba(0, 245, 255, 0.3)",
    animation: "fadeIn 0.8s ease",
  },

  ctaButton: {
    marginTop: "20px",
    padding: "16px 40px",
    fontSize: "18px",
    fontWeight: "700",
    border: "none",
    background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
    color: "#0f2027",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 8px 24px rgba(0, 245, 255, 0.3)",
  },

  ctaButtonHover: {
    background: "linear-gradient(135deg, #00d4ff, #00a8cc)",
    boxShadow: "0 12px 32px rgba(0, 245, 255, 0.4)",
    transform: "translateY(-2px)",
  },

  ctaText: {
    marginTop: "16px",
    fontSize: "15px",
    opacity: 0.85,
  },
};

export default Resources;
