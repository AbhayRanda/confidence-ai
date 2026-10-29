/**
 * useAICharacter.js
 * ─────────────────────────────────────────────────────────────
 * Custom React hook providing the public API for controlling
 * the AI character state from any component in the app.
 *
 * Usage:
 *   const character = useAICharacter();
 *
 *   // Session lifecycle:
 *   character.onSessionStart();               // recording started
 *   character.onSessionEnd();                 // recording stopped
 *   character.onAnalysisStart();              // upload/analysis begun
 *   character.onAnalysisComplete(score);      // results ready — score-aware
 *   character.onAnalysisError();              // analysis failed
 *
 *   // Direct control:
 *   character.setState('talking');
 *   character.setIsSpeaking(true);
 *   character.triggerGreeting();
 *
 * Step 6 additions:
 *   • Minimum state hold durations prevent rapid jitter
 *   • Pending state queue: if a change arrives too soon, it waits
 *   • All rapid-fire changes during a minimum hold are debounced
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useRef } from 'react';
import { CHARACTER_STATES } from '../components/ai-character/CharacterAnimations';

// ── Step 6: Minimum hold duration per state (ms) ─────────────
// States with a minimum hold ensure the character doesn't flicker
// when the backend emits rapid changes.
const MIN_STATE_DURATION = {
  [CHARACTER_STATES.IDLE]:        0,
  [CHARACTER_STATES.LISTENING]:   300,
  [CHARACTER_STATES.THINKING]:    800,
  [CHARACTER_STATES.ANALYZING]:   600,
  [CHARACTER_STATES.TALKING]:     500,
  [CHARACTER_STATES.HAPPY]:      1500,
  [CHARACTER_STATES.GREETING]:   1500,
  [CHARACTER_STATES.GESTURE]:     800,
  [CHARACTER_STATES.ENCOURAGING]:1200,
};

export function useAICharacter(initialState = CHARACTER_STATES.IDLE) {
  const [state, setStateRaw]            = useState(initialState);
  const [isSpeaking, setIsSpeakingRaw]  = useState(false);
  const [isListening, setIsListening]   = useState(false);

  // Use an array of timer IDs so we can cancel all pending timers at once,
  // preventing state conflicts when new sequences override old ones.
  const timerIds = useRef([]);

  // Step 6: Track when the current state was entered and any pending change
  const lastStateChangeAt = useRef(Date.now());
  const pendingStateRef   = useRef(null);
  const pendingTimerRef   = useRef(null);

  /** Cancel every scheduled state transition */
  const clearAllTimers = useCallback(() => {
    timerIds.current.forEach(clearTimeout);
    timerIds.current = [];
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
      pendingStateRef.current = null;
    }
  }, []);

  /** Schedule a state change after `ms` milliseconds */
  const scheduleState = useCallback((newState, ms) => {
    const id = setTimeout(() => setStateRaw(newState), ms);
    timerIds.current.push(id);
    return id;
  }, []);

  // ── Internal setter that respects minimum hold duration ──────
  const applyState = useCallback((newState) => {
    const now      = Date.now();
    const elapsed  = now - lastStateChangeAt.current;
    const minHold  = MIN_STATE_DURATION[state] ?? 0;
    const remaining = minHold - elapsed;

    if (remaining > 0) {
      // Too soon — queue it, cancel any older pending change
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingStateRef.current = newState;
      pendingTimerRef.current = setTimeout(() => {
        setStateRaw(pendingStateRef.current);
        lastStateChangeAt.current = Date.now();
        pendingStateRef.current   = null;
        pendingTimerRef.current   = null;
      }, remaining);
    } else {
      // Apply immediately
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
        pendingStateRef.current = null;
      }
      setStateRaw(newState);
      lastStateChangeAt.current = Date.now();
    }
  }, [state]);

  // ── Public API ───────────────────────────────────────────────

  /**
   * Set character state directly (validates against known states).
   * Step 6: Respects minimum hold duration before applying.
   * @param {string} newState — one of CHARACTER_STATES values
   */
  const setCharacterState = useCallback((newState) => {
    if (Object.values(CHARACTER_STATES).includes(newState)) {
      clearAllTimers();
      applyState(newState);
    } else {
      console.warn('[AICharacter] Unknown state:', newState);
    }
  }, [clearAllTimers, applyState]);

  /**
   * Control speaking state.
   * Automatically transitions: TALKING ↔ ENCOURAGING ↔ IDLE
   * @param {boolean} speaking
   */
  const setIsSpeaking = useCallback((speaking) => {
    setIsSpeakingRaw(speaking);
    clearAllTimers();
    if (speaking) {
      applyState(CHARACTER_STATES.TALKING);
    } else {
      applyState(CHARACTER_STATES.ENCOURAGING);
      scheduleState(CHARACTER_STATES.IDLE, 1800);
    }
  }, [clearAllTimers, applyState, scheduleState]);

  /**
   * Trigger a greeting sequence: GREETING → HAPPY → IDLE
   */
  const triggerGreeting = useCallback(() => {
    clearAllTimers();
    setStateRaw(CHARACTER_STATES.GREETING);
    lastStateChangeAt.current = Date.now();
    scheduleState(CHARACTER_STATES.HAPPY, 2000);
    scheduleState(CHARACTER_STATES.IDLE,  3500);
  }, [clearAllTimers, scheduleState]);

  /**
   * Score-aware analysis feedback sequence.
   *
   * High score (≥70):  THINKING → TALKING → HAPPY → IDLE
   * Mid  score (≥40):  THINKING → TALKING → ENCOURAGING → IDLE
   * Low  score (<40):  THINKING → GESTURE → ENCOURAGING → IDLE
   *
   * @param {number} score   — 0–100 confidence score (default 50)
   * @param {number} thinkMs — ms to stay in THINKING (default 1500)
   * @param {number} talkMs  — ms to stay in TALKING/GESTURE (default 3500)
   */
  const triggerAnalysisFeedback = useCallback((
    score    = 50,
    thinkMs  = 1500,
    talkMs   = 3500,
  ) => {
    clearAllTimers();
    lastStateChangeAt.current = Date.now();

    if (score >= 70) {
      // 🎉 High score: THINKING → TALKING → HAPPY → IDLE
      setStateRaw(CHARACTER_STATES.THINKING);
      scheduleState(CHARACTER_STATES.TALKING,     thinkMs);
      scheduleState(CHARACTER_STATES.HAPPY,       thinkMs + talkMs);
      scheduleState(CHARACTER_STATES.IDLE,        thinkMs + talkMs + 2000);
    } else if (score >= 40) {
      // 👍 Mid score: THINKING → TALKING → ENCOURAGING → IDLE
      setStateRaw(CHARACTER_STATES.THINKING);
      scheduleState(CHARACTER_STATES.TALKING,     thinkMs);
      scheduleState(CHARACTER_STATES.ENCOURAGING, thinkMs + talkMs);
      scheduleState(CHARACTER_STATES.IDLE,        thinkMs + talkMs + 1800);
    } else {
      // 💪 Low score: THINKING → GESTURE (coaching) → ENCOURAGING → IDLE
      setStateRaw(CHARACTER_STATES.THINKING);
      scheduleState(CHARACTER_STATES.GESTURE,     thinkMs);
      scheduleState(CHARACTER_STATES.ENCOURAGING, thinkMs + talkMs);
      scheduleState(CHARACTER_STATES.IDLE,        thinkMs + talkMs + 2000);
    }
  }, [clearAllTimers, scheduleState]);

  /**
   * Called when a recording session starts.
   * Character switches to LISTENING.
   */
  const onSessionStart = useCallback(() => {
    clearAllTimers();
    setIsListening(true);
    setStateRaw(CHARACTER_STATES.LISTENING);
    lastStateChangeAt.current = Date.now();
  }, [clearAllTimers]);

  /**
   * Called when a recording session ends.
   * Character switches to THINKING (analysis underway).
   */
  const onSessionEnd = useCallback(() => {
    clearAllTimers();
    setIsListening(false);
    setStateRaw(CHARACTER_STATES.THINKING);
    lastStateChangeAt.current = Date.now();
  }, [clearAllTimers]);

  /**
   * Called when the video upload/analysis API call begins.
   * Character enters ANALYZING state (distinct from THINKING).
   */
  const onAnalysisStart = useCallback(() => {
    clearAllTimers();
    setStateRaw(CHARACTER_STATES.ANALYZING);
    lastStateChangeAt.current = Date.now();
  }, [clearAllTimers]);

  /**
   * Called when AI analysis results are ready.
   * Triggers score-aware feedback sequence.
   * @param {number} score — 0–100 confidence score
   */
  const onAnalysisComplete = useCallback((score = 50) => {
    triggerAnalysisFeedback(score, 1500, 3500);
  }, [triggerAnalysisFeedback]);

  /**
   * Called when analysis fails (network error, server error, etc.)
   * Character expresses confusion then encourages: GESTURE → ENCOURAGING → IDLE
   */
  const onAnalysisError = useCallback(() => {
    clearAllTimers();
    setStateRaw(CHARACTER_STATES.GESTURE);      // "hmm, something went wrong"
    lastStateChangeAt.current = Date.now();
    scheduleState(CHARACTER_STATES.ENCOURAGING, 2000); // "don't worry, try again"
    scheduleState(CHARACTER_STATES.IDLE,        3800);
  }, [clearAllTimers, scheduleState]);

  return {
    // State
    state,
    isSpeaking,
    isListening,

    // Core setters
    setState:       setCharacterState,
    setIsSpeaking,
    setIsListening,

    // Sequence helpers
    triggerGreeting,
    triggerAnalysisFeedback,

    // Session lifecycle
    onSessionStart,
    onSessionEnd,
    onAnalysisStart,
    onAnalysisComplete,
    onAnalysisError,

    // All valid state names (for dev controls)
    CHARACTER_STATES,
  };
}

export default useAICharacter;
