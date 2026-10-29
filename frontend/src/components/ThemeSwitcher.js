import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import "./ThemeSwitcher.css";

export default function ThemeSwitcher() {
  const { theme, setTheme, themes, currentThemeConfig } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectTheme = (themeId) => {
    setTheme(themeId);
    setIsOpen(false);
  };

  return (
    <div className="theme-switcher-container" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`theme-switcher-btn ${isOpen ? "theme-switcher-btn--open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Switch Theme. Current: ${currentThemeConfig?.name}`}
        aria-expanded={isOpen}
      >
        <div
          className="theme-switcher-dot"
          style={{
            background: currentThemeConfig?.accent,
            boxShadow: `0 0 10px ${currentThemeConfig?.accent}`,
          }}
        />
        <span className="theme-switcher-icon">{currentThemeConfig?.icon}</span>
        <span className="theme-switcher-label">{currentThemeConfig?.name}</span>
        <svg
          className={`theme-switcher-chevron ${isOpen ? "theme-switcher-chevron--open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Flyout Menu */}
      {isOpen && (
        <div className="theme-dropdown-menu" role="menu" aria-label="Theme selection menu">
          <div className="theme-dropdown-header">
            <span className="theme-dropdown-title">APPEARANCE THEME</span>
            <span className="theme-dropdown-subtitle">Select your coaching vibe</span>
          </div>

          <div className="theme-list">
            {themes.map((item) => {
              const isSelected = item.id === theme;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={`theme-option-card ${isSelected ? "theme-option-card--active" : ""}`}
                  onClick={() => handleSelectTheme(item.id)}
                  style={{
                    "--theme-opt-accent": item.accent,
                    "--theme-opt-secondary": item.secondary,
                  }}
                >
                  {/* Theme icon badge */}
                  <div
                    className="theme-option-icon-box"
                    style={{ background: item.badgeBg, borderColor: `${item.accent}33` }}
                  >
                    <span>{item.icon}</span>
                  </div>

                  {/* Theme details */}
                  <div className="theme-option-info">
                    <div className="theme-option-name-row">
                      <span className="theme-option-name">{item.name}</span>
                      {isSelected && (
                        <span className="theme-option-badge">ACTIVE</span>
                      )}
                    </div>
                    <span className="theme-option-tagline">{item.tagline}</span>

                    {/* Color Swatches */}
                    <div className="theme-swatches">
                      <span
                        className="theme-swatch"
                        title="Primary Accent"
                        style={{ background: item.accent }}
                      />
                      <span
                        className="theme-swatch"
                        title="Secondary Accent"
                        style={{ background: item.secondary }}
                      />
                      <span
                        className="theme-swatch theme-swatch--border"
                        title="Dark Canvas"
                        style={{ background: item.bgBase }}
                      />
                    </div>
                  </div>

                  {/* Active Indicator Checkmark */}
                  {isSelected && (
                    <div className="theme-option-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
