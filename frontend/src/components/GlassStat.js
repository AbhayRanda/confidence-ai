import React, { useState } from "react";

function GlassStat({ title, value, sub, color = "#6c47ff" }) {
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
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: "12px",
    padding: "18px 20px",
    cursor: "default",
    transition: "all 0.2s ease",
    position: "relative",
    overflow: "hidden",
  },
  cardHover: {
    boxShadow: "0 4px 20px rgba(108,71,255,0.08)",
    borderColor: "#d4c8ff",
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
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    fontWeight: "600",
    margin: "0 0 6px 0",
    fontFamily: "'Segoe UI', sans-serif",
  },
  value: {
    fontSize: "26px",
    fontWeight: "700",
    margin: "0",
    fontFamily: "'Segoe UI', sans-serif",
    letterSpacing: "-0.5px",
  },
  sub: {
    fontSize: "11px",
    color: "#27ae60",
    margin: "4px 0 0 0",
    fontFamily: "'Segoe UI', sans-serif",
    fontWeight: "600",
  },
};

export default GlassStat;
