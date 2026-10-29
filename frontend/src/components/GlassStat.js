import React, { useState } from "react";

function GlassStat({ title, value, sub, color = "#7c5cfc" }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.card,
        ...(hovered ? styles.cardHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ ...styles.dot, background: color }} />
      <p style={styles.label}>{title}</p>
      <h2 style={{ ...styles.value, color }}>{value}</h2>
      {sub && <p style={styles.sub}>{sub}</p>}
    </div>
  );
}

const styles = {
  card: {
    background: "#1a1f35",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    borderRadius: "12px",
    padding: "18px 20px",
    cursor: "default",
    transition: "all 0.2s ease",
    position: "relative",
    overflow: "hidden",
  },
  cardHover: {
    boxShadow: "0 4px 20px rgba(124, 92, 252, 0.25)",
    borderColor: "rgba(124, 92, 252, 0.3)",
    transform: "translateY(-1px)",
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    marginBottom: "10px",
  },
  label: {
    fontSize: "11.5px",
    color: "#50587a",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    fontWeight: "600",
    margin: "0 0 6px 0",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  value: {
    fontSize: "26px",
    fontWeight: "700",
    margin: "0",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    letterSpacing: "-0.5px",
  },
  sub: {
    fontSize: "11px",
    color: "#22c55e",
    margin: "4px 0 0 0",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: "600",
  },
};

export default GlassStat;
