import React from "react";
import "./Skeleton.css";

export function Skeleton({ className = "", width, height, borderRadius, style = {} }) {
  const customStyles = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(borderRadius ? { borderRadius } : {}),
    ...style,
  };

  return <div className={`sk-placeholder ${className}`} style={customStyles} />;
}

export function SkeletonCard() {
  return (
    <div className="sk-card">
      <div className="sk-card-header">
        <Skeleton width="48px" height="48px" borderRadius="12px" />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height="18px" borderRadius="4px" style={{ marginBottom: "6px" }} />
          <Skeleton width="40%" height="13px" borderRadius="4px" />
        </div>
      </div>
      <div className="sk-card-body">
        <Skeleton width="100%" height="14px" borderRadius="4px" style={{ marginBottom: "8px" }} />
        <Skeleton width="85%" height="14px" borderRadius="4px" />
      </div>
      <div className="sk-card-footer">
        <Skeleton width="30%" height="28px" borderRadius="8px" />
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="sk-stat-box">
      <Skeleton width="36px" height="36px" borderRadius="10px" style={{ marginBottom: "12px" }} />
      <Skeleton width="45%" height="28px" borderRadius="6px" style={{ marginBottom: "6px" }} />
      <Skeleton width="75%" height="13px" borderRadius="4px" />
    </div>
  );
}

