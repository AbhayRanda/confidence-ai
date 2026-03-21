import React from "react";

function GlassStat({ title, value }) {
  const styles = {
    glassStat: {
      background: "rgba(255,255,255,0.08)",
      backdropFilter: "blur(16px)",
      padding: "24px 20px",
      borderRadius: "16px",
      textAlign: "center",
      boxShadow: "0 4px 20px rgba(0, 245, 255, 0.08)",
      border: "1px solid rgba(0, 245, 255, 0.15)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      cursor: "pointer",
    },
    glassStatHover: {
      background: "rgba(255,255,255,0.12)",
      boxShadow: "0 8px 32px rgba(0, 245, 255, 0.15)",
      transform: "translateY(-4px)",
      border: "1px solid rgba(0, 245, 255, 0.25)",
    },
    statTitle: {
      fontSize: "13px",
      opacity: 0.7,
      marginBottom: "12px",
      textTransform: "uppercase",
      letterSpacing: "0.8px",
      fontWeight: "600",
      color: "rgba(255, 255, 255, 0.8)",
    },
    statValue: {
      fontSize: "28px",
      fontWeight: "700",
      margin: 0,
      background: "linear-gradient(135deg, #00f5ff, #00d4ff)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    },
  };

  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      style={{
        ...styles.glassStat,
        ...(isHovered ? styles.glassStatHover : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <p style={styles.statTitle}>{title}</p>
      <h2 style={styles.statValue}>{value}</h2>
    </div>
  );
}

export default GlassStat;
