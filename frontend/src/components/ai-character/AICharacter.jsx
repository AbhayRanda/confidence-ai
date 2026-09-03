/**
 * AICharacter.jsx
 * ─────────────────────────────────────────────────────────────
 * Top-level AI Character component.
 * Drop-in integration for any page in the application.
 *
 * Props:
 *   state        {string}   — CHARACTER_STATES value
 *   isSpeaking   {boolean}  — auto-switches to TALKING state
 *   analysisData {object}   — { score, weakestMetric, weakestValue }
 *   speech       {object}   — useSpeech() return value (Step 7/8)
 *                             if provided: auto syncs voice↔state + lip amplitude
 *   showDevPanel {boolean}  — show state control panel (dev only)
 *   onReady      {function} — called when character finishes loading
 *   onCharacterClick {function}
 *   className    {string}
 *   style        {object}
 *
 * Step 7: Accepts `speech` prop to auto-sync mic/TTS → character states
 * Step 8: Forwards audio amplitude to CharacterScene for lip sync
 * Step 9: Built-in preset picker UI (3 colour swatches)
 *
 * Simple usage:
 *   <AICharacter state="talking" isSpeaking={true} />
 *
 * Full usage:
 *   <AICharacter
 *     state={character.state}
 *     speech={speech}
 *     analysisData={{ score: 82, weakestMetric: 'Smile', weakestValue: 34 }}
 *   />
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { CHARACTER_STATES, STATE_CONFIG, CHARACTER_PRESETS } from './CharacterAnimations';
import { CharacterFallback } from './CharacterFallback';
import './AICharacter.css';

// Lazy-load the heavy 3D scene to keep initial bundle small
const CharacterScene = React.lazy(() =>
  import('./CharacterScene').then((m) => ({ default: m.CharacterScene }))
);

// ── WebGL detection ───────────────────────────────────────────
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// ── Dev control panel ─────────────────────────────────────────
function DevPanel({ currentState, onStateChange }) {
  const states = Object.values(CHARACTER_STATES);
  return (
    <div className="aic-dev-panel" aria-label="Character State Dev Controls">
      <div className="aic-dev-title">
        <span className="aic-dev-dot" />
        Character State
      </div>
      <div className="aic-dev-buttons">
        {states.map((s) => (
          <button
            key={s}
            className={`aic-dev-btn${currentState === s ? ' aic-dev-btn--active' : ''}`}
            onClick={() => onStateChange(s)}
            title={STATE_CONFIG[s]?.description || s}
          >
            {STATE_CONFIG[s]?.label || s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 9: Preset picker ─────────────────────────────────────
function PresetPicker({ currentPreset, onChange }) {
  return (
    <div className="aic-preset-picker" aria-label="Character appearance presets">
      <span className="aic-preset-label">Style</span>
      {CHARACTER_PRESETS.map((p) => (
        <button
          key={p.id}
          className={`aic-preset-btn${currentPreset === p.id ? ' aic-preset-btn--active' : ''}`}
          style={{ '--preset-color': p.color }}
          onClick={() => onChange(p.id)}
          title={p.name}
          aria-label={`${p.name} preset`}
        />
      ))}
    </div>
  );
}

// ── State color map (used for glow ring) ──────────────────────
const STATE_COLORS = {
  [CHARACTER_STATES.IDLE]:        '#50587a',
  [CHARACTER_STATES.LISTENING]:   '#22c55e',
  [CHARACTER_STATES.THINKING]:    '#f59e0b',
  [CHARACTER_STATES.ANALYZING]:   '#5b8def',
  [CHARACTER_STATES.TALKING]:     '#7c5cfc',
  [CHARACTER_STATES.HAPPY]:       '#22c55e',
  [CHARACTER_STATES.GREETING]:    '#5b8def',
  [CHARACTER_STATES.GESTURE]:     '#a78bfa',
  [CHARACTER_STATES.ENCOURAGING]: '#22c55e',
};

// ── Mentor messages per state ─────────────────────────────────
const STATE_MESSAGES = {
  [CHARACTER_STATES.IDLE]: [
    "I'm here to help you grow.",
    'Ready when you are!',
    "Let's build your confidence together.",
  ],
  [CHARACTER_STATES.LISTENING]: [
    "I'm listening… go ahead.",
    "I've got your full attention.",
    "Speak naturally — I'm here with you.",
  ],
  [CHARACTER_STATES.THINKING]: [
    'Analyzing your performance…',
    'Processing what I observed…',
    'Give me a moment to reflect on this…',
  ],
  [CHARACTER_STATES.ANALYZING]: [
    'Scanning your session data…',
    'Running confidence analysis…',
    'Crunching the numbers — almost there!',
  ],
  [CHARACTER_STATES.TALKING]: [
    "Here's my feedback for you.",
    'Let me share what I noticed.',
    'I have some thoughts for you.',
  ],
  [CHARACTER_STATES.HAPPY]: [
    'Excellent work today! 🎉',
    "Brilliant session — you're on fire!",
    'That was outstanding. Keep it up! 🚀',
  ],
  [CHARACTER_STATES.GREETING]: [
    'Welcome back! Ready to practice?',
    "Great to see you! Let's do this.",
    "Hello! I'm excited to coach you today.",
  ],
  [CHARACTER_STATES.GESTURE]: [
    'Let me explain this for you.',
    "Here's something important to work on.",
    'Focus on this — it will make a big difference.',
  ],
  [CHARACTER_STATES.ENCOURAGING]: [
    "Keep going — you're improving!",
    'Every session counts. You got this!',
    'Progress over perfection. I believe in you! 💪',
  ],
};

/**
 * Build a score-personalised message when analysisData is available.
 * Falls back to generic state messages when not.
 */
function resolveMessage(state, analysisData) {
  if (analysisData && (
    state === CHARACTER_STATES.TALKING ||
    state === CHARACTER_STATES.HAPPY   ||
    state === CHARACTER_STATES.ENCOURAGING ||
    state === CHARACTER_STATES.GESTURE
  )) {
    const { score, weakestMetric, weakestValue } = analysisData;
    if (score >= 70) {
      return `Confidence score ${score.toFixed(1)}/100 — excellent! Your ${weakestMetric || 'performance'} was great!`;
    } else if (score >= 40) {
      return weakestMetric
        ? `Score ${score.toFixed(1)}/100. Focus on improving your ${weakestMetric} (${Math.round(weakestValue || 0)}%) for next time.`
        : `Score ${score.toFixed(1)}/100. Good effort — keep practicing!`;
    } else {
      return weakestMetric
        ? `Score ${score.toFixed(1)}/100. Let's especially work on ${weakestMetric} — it's at ${Math.round(weakestValue || 0)}%.`
        : `Score ${score.toFixed(1)}/100. Don't worry — every session teaches you something!`;
    }
  }

  // Default: random message for the state
  const pool = STATE_MESSAGES[state] || STATE_MESSAGES[CHARACTER_STATES.IDLE];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Status indicator ──────────────────────────────────────────
function StatusBadge({ state }) {
  const cfg   = STATE_CONFIG[state] || STATE_CONFIG[CHARACTER_STATES.IDLE];
  const color = STATE_COLORS[state] || '#50587a';
  return (
    <div className="aic-status-badge" style={{ borderColor: `${color}40` }}>
      <span className="aic-status-dot" style={{ background: color }} />
      <span className="aic-status-label" style={{ color }}>{cfg.label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function AICharacter({
  state: externalState,
  isSpeaking: externalSpeaking,
  analysisData,
  speech,              // Step 7: useSpeech() return value
  showDevPanel = false,
  onReady,
  className = '',
  style = {},
  onCharacterClick,
}) {
  const [internalState, setInternalState] = useState(CHARACTER_STATES.IDLE);
  const [webGLAvail]  = useState(() => isWebGLAvailable());
  const [loadStatus, setLoadStatus]       = useState(webGLAvail ? 'loading' : 'unavailable');
  const [hasError, setHasError]           = useState(false);
  const [message, setMessage]             = useState(
    STATE_MESSAGES[CHARACTER_STATES.IDLE][0]
  );

  // Step 9: Preset — persisted in localStorage
  const [preset, setPreset] = useState(() => {
    try {
      const saved = localStorage.getItem('aic_preset');
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch { return 0; }
  });

  const handlePresetChange = useCallback((id) => {
    setPreset(id);
    try { localStorage.setItem('aic_preset', String(id)); } catch { /* noop */ }
  }, []);

  // Resolve effective state (external prop wins over internal)
  const effectiveState = externalState !== undefined ? externalState : internalState;
  const glowColor      = STATE_COLORS[effectiveState] || '#50587a';

  // Step 7: Auto-sync speech states → character states
  useEffect(() => {
    if (!speech) return;
    if (speech.isListening) {
      setInternalState(CHARACTER_STATES.LISTENING);
    } else if (speech.isSpeaking) {
      setInternalState(CHARACTER_STATES.TALKING);
    }
  }, [speech?.isListening, speech?.isSpeaking]); // eslint-disable-line react-hooks/exhaustive-deps

  // External isSpeaking prop → auto state (kept for backward compat)
  useEffect(() => {
    if (speech) return; // speech prop takes priority
    if (externalSpeaking === true) {
      setInternalState(CHARACTER_STATES.TALKING);
    } else if (externalSpeaking === false && effectiveState === CHARACTER_STATES.TALKING) {
      setInternalState(CHARACTER_STATES.ENCOURAGING);
      const t = setTimeout(() => setInternalState(CHARACTER_STATES.IDLE), 1800);
      return () => clearTimeout(t);
    }
  }, [externalSpeaking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update message when state or analysisData changes
  useEffect(() => {
    const newMsg = resolveMessage(effectiveState, analysisData);
    const t = setTimeout(() => setMessage(newMsg), 200);
    return () => clearTimeout(t);
  }, [effectiveState, analysisData]);

  // Auto-greeting on mount
  useEffect(() => {
    if (!webGLAvail) return;
    const t = setTimeout(() => {
      setInternalState(CHARACTER_STATES.GREETING);
      setTimeout(() => setInternalState(CHARACTER_STATES.IDLE), 2500);
    }, 1200);
    return () => clearTimeout(t);
  }, [webGLAvail]);

  const handleReady = useCallback(() => {
    setLoadStatus('ready');
    onReady && onReady();
  }, [onReady]);

  const handleError = useCallback(() => {
    setHasError(true);
    setLoadStatus('error');
  }, []);

  const handleClick = useCallback(() => {
    // Click interaction: brief greeting
    setInternalState(CHARACTER_STATES.GREETING);
    setTimeout(() => setInternalState(CHARACTER_STATES.IDLE), 2000);
    onCharacterClick && onCharacterClick();
  }, [onCharacterClick]);

  // Step 8: Pick the right amplitude source for lip sync
  // • While listening  → mic amplitude (real)
  // • While speaking   → TTS amplitude (simulated)
  // • Otherwise        → 0
  const audioAmplitude = (() => {
    if (!speech) return 0;
    if (speech.isListening) return speech.micAmplitude || 0;
    if (speech.isSpeaking)  return speech.ttsAmplitude || 0;
    return 0;
  })();

  // ── Render ────────────────────────────────────────────────
  if (!webGLAvail || hasError) {
    return (
      <div className={`aic-root ${className}`} style={style}>
        <CharacterFallback reason={hasError ? 'error' : 'unavailable'} />
      </div>
    );
  }

  return (
    <div className={`aic-root ${className}`} style={style}>
      {/* Canvas area */}
      <div
        className="aic-canvas-wrap"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="AI Mentor — click to interact"
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        style={{
          '--glow-color':      glowColor,
          '--glow-color-soft': `${glowColor}30`,
        }}
      >
        {/* State-driven glow ring */}
        <div className="aic-glow-ring" aria-hidden="true" />

        {/* Loading overlay */}
        {loadStatus === 'loading' && (
          <div className="aic-loading-overlay">
            <CharacterFallback reason="loading" />
          </div>
        )}

        {/* 3D Scene — Step 8: audioAmplitude, Step 9: preset */}
        <Suspense fallback={null}>
          <ErrorBoundaryWrapper onError={handleError}>
            <CharacterScene
              state={effectiveState}
              onReady={handleReady}
              audioAmplitude={audioAmplitude}
              preset={preset}
              style={{ opacity: loadStatus === 'ready' ? 1 : 0, transition: 'opacity 0.6s ease' }}
            />
          </ErrorBoundaryWrapper>
        </Suspense>
      </div>

      {/* Status badge */}
      <StatusBadge state={effectiveState} />

      {/* Step 9: Preset picker */}
      <PresetPicker currentPreset={preset} onChange={handlePresetChange} />

      {/* Mentor message bubble */}
      <div className="aic-message-bubble" key={effectiveState}>
        <span className="aic-message-icon">💬</span>
        <span className="aic-message-text">{message}</span>
      </div>

      {/* Dev panel */}
      {showDevPanel && (
        <DevPanel
          currentState={effectiveState}
          onStateChange={(s) => setInternalState(s)}
        />
      )}
    </div>
  );
}

// ── Simple error boundary wrapper ─────────────────────────────
class ErrorBoundaryWrapper extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error('[AICharacter] 3D render error:', err);
    this.props.onError && this.props.onError();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default AICharacter;
