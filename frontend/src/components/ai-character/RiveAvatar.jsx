/**
 * RiveAvatar.jsx
 * ─────────────────────────────────────────────────────────────
 * Rive-powered animated AI coach avatar.
 * DROP-IN replacement for CharacterScene / VRMAvatar.
 *
 * Loads /public/rive/coach.riv if present.
 * Falls back to a beautiful CSS-animated avatar instantly.
 *
 * Props:
 *   state        {string}  — CHARACTER_STATES value
 *   isSpeaking   {boolean}
 *   isListening  {boolean}
 *   ttsAmplitude {number}  0–1 for lip sync intensity
 *   onReady      {function}
 *   style        {object}
 * ─────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import { CHARACTER_STATES } from './CharacterAnimations';
import './RiveAvatar.css';

// ── Try to import Rive (gracefully fails if not installed) ────
let useRiveHook = null;
let useStateMachineInputHook = null;
let RiveLayout = null;
let RiveFit = null;
let RiveAlignment = null;

try {
  const riveModule = require('@rive-app/react-canvas');
  useRiveHook               = riveModule.useRive;
  useStateMachineInputHook  = riveModule.useStateMachineInput;
  RiveLayout    = riveModule.Layout;
  RiveFit       = riveModule.Fit;
  RiveAlignment = riveModule.Alignment;
} catch {
  // Rive not installed — CSS fallback will be used
}

// ── State → Rive numeric index ────────────────────────────────
const STATE_INDEX = {
  [CHARACTER_STATES.IDLE]:        0,
  [CHARACTER_STATES.TALKING]:     1,
  [CHARACTER_STATES.LISTENING]:   2,
  [CHARACTER_STATES.THINKING]:    3,
  [CHARACTER_STATES.ANALYZING]:   3,
  [CHARACTER_STATES.HAPPY]:       4,
  [CHARACTER_STATES.GREETING]:    5,
  [CHARACTER_STATES.GESTURE]:     1,
  [CHARACTER_STATES.ENCOURAGING]: 4,
};

// ── State glow colours ────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════
// CSS-ONLY FALLBACK AVATAR
// Works with no .riv file at all — pure React + CSS animations
// ═══════════════════════════════════════════════════════════
function CSSAvatarFallback({ state, amplitude }) {
  const isTalking   = [CHARACTER_STATES.TALKING, CHARACTER_STATES.GESTURE].includes(state);
  const isListening = state === CHARACTER_STATES.LISTENING;
  const isThinking  = [CHARACTER_STATES.THINKING, CHARACTER_STATES.ANALYZING].includes(state);
  const isHappy     = [CHARACTER_STATES.HAPPY, CHARACTER_STATES.ENCOURAGING].includes(state);
  const isGreeting  = state === CHARACTER_STATES.GREETING;
  const glowColor   = STATE_COLORS[state] || '#50587a';

  return (
    <div className="riva-css-root" style={{ '--riva-glow': glowColor }}>

      {/* ── Ambient glow behind head ─── */}
      <div className="riva-aura" />

      {/* ── Head ─── */}
      <div className={[
        'riva-head',
        isHappy    ? 'riva-head--happy'    : '',
        isGreeting ? 'riva-head--greeting' : '',
      ].join(' ')}>

        {/* Hair */}
        <div className="riva-hair" />

        {/* Eyebrows */}
        <div className="riva-brows">
          <div className={[
            'riva-brow riva-brow--left',
            isThinking ? 'riva-brow--furrowed' : '',
            isHappy    ? 'riva-brow--raised'   : '',
          ].join(' ')} />
          <div className={[
            'riva-brow riva-brow--right',
            isThinking ? 'riva-brow--furrowed' : '',
            isHappy    ? 'riva-brow--raised'   : '',
          ].join(' ')} />
        </div>

        {/* Eyes */}
        <div className="riva-eyes">
          <div className={['riva-eye riva-eye--left', isThinking ? 'riva-eye--squint' : ''].join(' ')}>
            <div className="riva-iris" />
            <div className="riva-pupil" />
            <div className="riva-shine" />
          </div>
          <div className={['riva-eye riva-eye--right', isThinking ? 'riva-eye--squint' : ''].join(' ')}>
            <div className="riva-iris" />
            <div className="riva-pupil" />
            <div className="riva-shine" />
          </div>
        </div>

        {/* Nose */}
        <div className="riva-nose" />

        {/* Mouth / Lips */}
        <div className={[
          'riva-mouth-wrap',
          isTalking ? 'riva-mouth-wrap--talking' : '',
          isHappy   ? 'riva-mouth-wrap--smile'   : '',
        ].join(' ')}>
          <div
            className="riva-mouth"
            style={isTalking ? {
              height: `${6 + amplitude * 18}px`,
              borderRadius: `50% 50% ${4 + amplitude * 8}px ${4 + amplitude * 8}px / 30% 30% 70% 70%`,
            } : {}}
          />
          {isTalking && <div className="riva-teeth" style={{ opacity: Math.min(amplitude * 2, 1) }} />}
        </div>

        {/* Ear accents */}
        <div className="riva-ear riva-ear--left" />
        <div className="riva-ear riva-ear--right" />

        {/* Thinking dots */}
        {isThinking && (
          <div className="riva-think-dots">
            <span /><span /><span />
          </div>
        )}
      </div>

      {/* ── Neck ─── */}
      <div className="riva-neck" />

      {/* ── Body / Shoulders ─── */}
      <div className={['riva-body', isTalking ? 'riva-body--talking' : ''].join(' ')}>
        <div className="riva-shirt">
          {/* Lapels */}
          <div className="riva-lapel riva-lapel--left" />
          <div className="riva-lapel riva-lapel--right" />
          {/* AI badge */}
          <div className="riva-badge">
            <span>AI</span>
            <div className="riva-badge-dot" />
          </div>
        </div>
        {/* Arms */}
        <div className={['riva-arm riva-arm--left',
          state === CHARACTER_STATES.GESTURE  ? 'riva-arm--raised' : '',
          isGreeting                           ? 'riva-arm--wave'   : '',
        ].join(' ')} />
        <div className={['riva-arm riva-arm--right',
          isHappy    ? 'riva-arm--raised' : '',
          isGreeting ? 'riva-arm--wave'  : '',
        ].join(' ')} />
      </div>

      {/* ── Listening pulse rings ─── */}
      {isListening && (
        <div className="riva-listen-rings">
          <span /><span /><span />
        </div>
      )}

      {/* ── Greeting wave hand ─── */}
      {isGreeting && <div className="riva-wave-hand">👋</div>}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// RIVE CANVAS WRAPPER (only mounted if Rive is available)
// ═══════════════════════════════════════════════════════════
function RiveCanvasWrapper({ state, ttsAmplitude, onLoad, onError }) {
  const amplitudeRef = useRef(0);
  useEffect(() => { amplitudeRef.current = ttsAmplitude; }, [ttsAmplitude]);

  const { rive, RiveComponent } = useRiveHook({
    src: '/rive/coach.riv',
    stateMachines: 'State Machine 1',
    autoplay: true,
    layout: new RiveLayout({ fit: RiveFit.Cover, alignment: RiveAlignment.Center }),
    onLoad:      onLoad,
    onLoadError: onError,
  });

  const stateInput     = useStateMachineInputHook(rive, 'State Machine 1', 'state');
  const amplitudeInput = useStateMachineInputHook(rive, 'State Machine 1', 'amplitude');

  useEffect(() => {
    if (!stateInput) return;
    stateInput.value = STATE_INDEX[state] ?? 0;
  }, [state, stateInput]);

  useEffect(() => {
    if (!amplitudeInput || !rive) return;
    let rafId;
    const tick = () => {
      amplitudeInput.value = amplitudeRef.current;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [amplitudeInput, rive]);

  return <RiveComponent style={{ width: '100%', height: '100%' }} />;
}


// ═══════════════════════════════════════════════════════════
// MAIN RiveAvatar
// ═══════════════════════════════════════════════════════════
export function RiveAvatar({
  state        = CHARACTER_STATES.IDLE,
  isSpeaking   = false,
  isListening  = false,
  ttsAmplitude = 0,
  onReady,
  style        = {},
}) {
  const [riveLoaded, setRiveLoaded] = useState(false);
  const [riveError,  setRiveError]  = useState(false);

  const riveAvailable = !!useRiveHook;
  const glowColor     = STATE_COLORS[state] || '#50587a';

  // When Rive unavailable → call onReady immediately so parent removes loader
  useEffect(() => {
    if (!riveAvailable) { onReady && onReady(); }
  }, [riveAvailable, onReady]);

  const amplitude = isSpeaking ? Math.max(ttsAmplitude, 0.2) : 0;

  return (
    <div
      className="rive-avatar-root"
      style={{ ...style, '--rive-glow': glowColor }}
    >
      {/* CSS fallback: always shown until Rive canvas is ready */}
      {(!riveLoaded || riveError || !riveAvailable) && (
        <div className="rive-fallback-layer">
          <CSSAvatarFallback state={state} amplitude={amplitude} />
        </div>
      )}

      {/* Rive canvas layer: only if package installed AND file loaded */}
      {riveAvailable && !riveError && (
        <div
          className="rive-canvas-layer"
          style={{ opacity: riveLoaded ? 1 : 0, transition: 'opacity 0.6s ease' }}
        >
          <RiveCanvasWrapper
            state={state}
            ttsAmplitude={amplitude}
            onLoad={() => { setRiveLoaded(true); onReady && onReady(); }}
            onError={() => { setRiveError(true); onReady && onReady(); }}
          />
        </div>
      )}

      {/* Glow ring — always visible */}
      <div className="rive-glow-ring" />
    </div>
  );
}

export default RiveAvatar;
