import React, { createContext, useContext, useState, useEffect } from "react";

export const THEMES = [
  {
    id: "cyber-violet",
    name: "Cyber Violet",
    tagline: "Futuristic AI Studio",
    accent: "#7c5cfc",
    secondary: "#5b8def",
    badgeBg: "rgba(124, 92, 252, 0.15)",
    icon: "⚡",
    bgBase: "#080b14",
    bgCard: "#141827",
  },
  {
    id: "peak-emerald",
    name: "Peak Emerald",
    tagline: "Growth & Breakthrough",
    accent: "#00f59b",
    secondary: "#06b6d4",
    badgeBg: "rgba(0, 245, 155, 0.15)",
    icon: "📈",
    bgBase: "#080c0e",
    bgCard: "#0f171c",
  },
  {
    id: "executive-gold",
    name: "Executive Gold",
    tagline: "Leadership & Prestige",
    accent: "#f59e0b",
    secondary: "#38bdf8",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    icon: "👑",
    bgBase: "#080d1a",
    bgCard: "#0f172a",
  },
  {
    id: "radiant-coral",
    name: "Radiant Coral",
    tagline: "Warmth & Courage",
    accent: "#ff5e62",
    secondary: "#fb923c",
    badgeBg: "rgba(255, 94, 98, 0.15)",
    icon: "🌅",
    bgBase: "#0d0a14",
    bgCard: "#171224",
  },
  {
    id: "ocean-teal",
    name: "Ocean Teal",
    tagline: "Calm Clarity & Focus",
    accent: "#14b8a6",
    secondary: "#6366f1",
    badgeBg: "rgba(20, 184, 166, 0.15)",
    icon: "🌊",
    bgBase: "#040914",
    bgCard: "#0a1324",
  },
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const savedTheme = localStorage.getItem("confidence-theme");
      if (savedTheme && THEMES.some((t) => t.id === savedTheme)) {
        return savedTheme;
      }
    } catch {
      // fallback if localStorage unavailable
    }
    return "cyber-violet";
  });

  const setTheme = (themeId) => {
    if (!THEMES.some((t) => t.id === themeId)) return;
    setThemeState(themeId);
    try {
      localStorage.setItem("confidence-theme", themeId);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute("data-theme", themeId);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const currentThemeConfig = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, currentThemeConfig }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
