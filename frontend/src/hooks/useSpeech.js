/**
 * useSpeech.js  v3
 * ─────────────────────────────────────────────────────────────
 * Custom React hook managing both:
 *  • TTS  — Web Speech API SpeechSynthesis (or ElevenLabs if key is set)
 *  • STT  — Web Speech API SpeechRecognition (user voice input)
 *
 * Steps implemented:
 *   5  — fillerWordCount: real-time counter of um/uh/like during STT
 *   7  — ElevenLabs TTS (optional): if REACT_APP_ELEVENLABS_API_KEY is set,
 *          uses ElevenLabs API; otherwise falls back to browser TTS
 *
 * Usage:
 *   const speech = useSpeech({ onSpeakStart, onSpeakEnd, onTranscript, ... });
 *
 *   speech.speak("Hello!")          // character speaks
 *   speech.startListening()         // mic on
 *   speech.stopListening()          // mic off
 *   speech.cancel()                 // abort TTS mid-sentence
 *   speech.toggleMute()             // mute/unmute TTS
 *   speech.resetFillerCount()       // clear filler word counter
 *
 *   speech.isSpeaking     — true while TTS is active
 *   speech.isListening    — true while STT mic is active
 *   speech.isMuted        — true when TTS is muted
 *   speech.transcript     — current STT transcript
 *   speech.micAmplitude   — 0–1 real mic level
 *   speech.ttsAmplitude   — 0–1 simulated TTS level
 *   speech.fillerWordCount— Step 5: cumulative filler word count
 *   speech.sttSupported   — false if browser doesn't support STT
 *   speech.ttsSupported   — false if browser doesn't support TTS
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ── Detect support ────────────────────────────────────────────
const TTS_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;
const STT_SUPPORTED = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// ── Step 5: Filler words to track ─────────────────────────────
const FILLER_WORDS = ['um', 'uh', 'like', 'basically', 'actually', 'literally', 'you know', 'i mean', 'right', 'so'];

function countFillers(text) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let count = 0;
  for (const word of FILLER_WORDS) {
    // Match whole word occurrences
    const re = new RegExp(`\\b${word}\\b`, 'g');
    const matches = lower.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

// ── Voice selector ─────────────────────────────────────────────
function pickVoice() {
  if (!TTS_SUPPORTED) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferred = [
    (v) => /aria|jenny|davis|tony/i.test(v.name) && v.lang.startsWith('en'),   // Microsoft Neural
    (v) => v.name.includes('Neural') && v.lang.startsWith('en'),
    (v) => v.name.includes('Premium') && v.lang.startsWith('en'),
    (v) => v.name.includes('Google') && v.lang.startsWith('en'),
    (v) => v.name.includes('Samantha'),
    (v) => v.lang === 'en-US',
    (v) => v.lang.startsWith('en'),
  ];

  for (const test of preferred) {
    const found = voices.find(test);
    if (found) return found;
  }
  return voices[0];
}

// ── Step 7: ElevenLabs TTS via backend proxy ──────────────────
const API_BASE = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — reliable on all ElevenLabs plans

async function speakViaBackend(text, onStart, onEnd, onSilentFallback) {
  try {
    onStart?.();
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: DEFAULT_VOICE_ID }),
    });

    if (!res.ok) {
      // Don't show error toast — backend TTS is an enhancement, not a requirement.
      // Silently fall back to browser TTS so the user still hears audio.
      console.warn(`[TTS] Backend unavailable (${res.status}), using browser TTS`);
      onSilentFallback?.();
      onEnd?.();
      return null;
    }

    const blob      = await res.blob();
    const url       = URL.createObjectURL(blob);
    const audio     = new Audio(url);
    audio.onended   = () => { URL.revokeObjectURL(url); onEnd?.(); };
    audio.onerror   = () => { URL.revokeObjectURL(url); onSilentFallback?.(); onEnd?.(); };
    await audio.play();
    return audio;   // caller can .pause() to cancel
  } catch (err) {
    // Network error etc. — silent fallback, no toast
    console.warn('[TTS] Backend fetch failed, using browser TTS:', err.message);
    onSilentFallback?.();
    onEnd?.();
    return null;
  }
}

// ── Main hook ─────────────────────────────────────────────────
export function useSpeech({
  onSpeakStart,
  onSpeakEnd,
  onTranscript,
  onListenStart,
  onListenEnd,
  onError,
} = {}) {
  const [isSpeaking,      setIsSpeaking]      = useState(false);
  const [isListening,     setIsListening]     = useState(false);
  const [isMuted,         setIsMuted]         = useState(false);
  const [transcript,      setTranscript]      = useState('');
  const [micAmplitude,    setMicAmplitude]    = useState(0);
  const [ttsAmplitude,    setTtsAmplitude]    = useState(0);
  const [fillerWordCount, setFillerWordCount] = useState(0); // Step 5

  const recognitionRef    = useRef(null);
  const voiceRef          = useRef(null);
  const mutedRef          = useRef(false);
  const isSpeakingRef     = useRef(false);
  const isListeningRef    = useRef(false);  // ref mirror to avoid stale closure in startListening

  // Web Audio refs
  const audioCtxRef       = useRef(null);
  const analyserRef       = useRef(null);
  const micSourceRef      = useRef(null);
  const micStreamRef      = useRef(null);
  const amplitudeRafRef   = useRef(null);
  const ttsRafRef         = useRef(null);
  const ttsStartRef       = useRef(0);
  const ttsDurationRef    = useRef(0);

  // Step 7: Backend TTS audio ref (for cancellation)
  const backendAudioRef   = useRef(null);

  // Backend TTS availability (checked on mount)
  const backendTtsRef     = useRef(false);

  // Step 5: Filler tracking
  const prevTranscriptRef = useRef('');
  const fillerCountRef    = useRef(0);

  // Acoustic echo suppression: track when speech ends and pending timeouts
  const lastSpeakEndTimeRef      = useRef(0);
  const transcriptTimeoutRef     = useRef(null);
  const accumulatedTranscriptRef = useRef('');

  useEffect(() => { mutedRef.current      = isMuted; },     [isMuted]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; },  [isSpeaking]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  // Check backend TTS availability on mount
  useEffect(() => {
    fetch(`${API_BASE}/tts/status`)
      .then((r) => r.json())
      .then((data) => { backendTtsRef.current = !!data?.available; })
      .catch(() => { backendTtsRef.current = false; });
  }, []);

  // Load voices (browser TTS fallback)
  useEffect(() => {
    if (!TTS_SUPPORTED) return;
    const load = () => { voiceRef.current = pickVoice(); };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  // ── Mic amplitude analysis ─────────────────────────────────
  const startMicAnalysis = useCallback(async () => {
    if (typeof AudioContext === 'undefined' && typeof window.webkitAudioContext === 'undefined') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      const AudioCtx  = window.AudioContext || window.webkitAudioContext;
      const ctx       = new AudioCtx();
      audioCtxRef.current  = ctx;
      const analyser  = ctx.createAnalyser();
      analyser.fftSize              = 256;
      analyser.smoothingTimeConstant = 0.7;
      analyserRef.current = analyser;
      const source    = ctx.createMediaStreamSource(stream);
      micSourceRef.current = source;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
        const rms = Math.sqrt(sum / dataArray.length) / 128;
        setMicAmplitude(Math.min(1, rms * 2.2));
        amplitudeRafRef.current = requestAnimationFrame(tick);
      };
      amplitudeRafRef.current = requestAnimationFrame(tick);
    } catch { /* mic access denied */ }
  }, []);

  const stopMicAnalysis = useCallback(() => {
    if (amplitudeRafRef.current) { cancelAnimationFrame(amplitudeRafRef.current); amplitudeRafRef.current = null; }
    micSourceRef.current?.disconnect(); micSourceRef.current = null;
    micStreamRef.current?.getTracks().forEach(t => t.stop()); micStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {}); audioCtxRef.current = null;
    analyserRef.current = null;
    setMicAmplitude(0);
  }, []);

  // ── TTS amplitude simulation ───────────────────────────────
  const startTtsAmplitude = useCallback((durationMs) => {
    ttsStartRef.current    = performance.now();
    ttsDurationRef.current = durationMs;
    if (ttsRafRef.current) cancelAnimationFrame(ttsRafRef.current);
    const tick = () => {
      if (!isSpeakingRef.current) { setTtsAmplitude(0); return; }
      const elapsed  = performance.now() - ttsStartRef.current;
      const progress = Math.min(elapsed / ttsDurationRef.current, 1);
      const envelope = Math.sin(progress * Math.PI);
      const syllable = 0.5 + 0.5 * Math.abs(Math.sin(elapsed * 0.012));
      setTtsAmplitude(Math.max(0, envelope * syllable * 0.75));
      ttsRafRef.current = requestAnimationFrame(tick);
    };
    ttsRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTtsAmplitude = useCallback(() => {
    if (ttsRafRef.current) { cancelAnimationFrame(ttsRafRef.current); ttsRafRef.current = null; }
    setTtsAmplitude(0);
  }, []);

  // ── Browser TTS ────────────────────────────────────────────
  const speakBrowser = useCallback((text, opts = {}) => {
    if (!TTS_SUPPORTED || !text?.trim()) return;

    // Immediately stop speech recognition to prevent mic from hearing TTS output
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    clearTimeout(transcriptTimeoutRef.current);
    accumulatedTranscriptRef.current = '';
    isListeningRef.current = false;
    setIsListening(false);
    isSpeakingRef.current = true;
    setIsSpeaking(true);

    const wordCount   = text.trim().split(/\s+/).length;
    const estimatedMs = Math.max(1500, wordCount * 280);

    if (mutedRef.current) {
      onSpeakStart?.();
      startTtsAmplitude(estimatedMs);
      setTimeout(() => {
        isSpeakingRef.current = false;
        lastSpeakEndTimeRef.current = Date.now();
        setIsSpeaking(false);
        stopTtsAmplitude();
        onSpeakEnd?.();
      }, estimatedMs);
      return;
    }

    // Cancel any ongoing browser utterance
    try { window.speechSynthesis.cancel(); } catch {}

    const utter       = new SpeechSynthesisUtterance(text);
    utter.voice       = voiceRef.current || null;
    utter.rate        = opts.rate   ?? 0.95;
    utter.pitch       = opts.pitch  ?? 1.05;
    utter.volume      = opts.volume ?? 1.0;

    utter.onstart     = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      onSpeakStart?.();
      startTtsAmplitude(estimatedMs);
    };

    const handleDone = () => {
      isSpeakingRef.current = false;
      lastSpeakEndTimeRef.current = Date.now();
      setIsSpeaking(false);
      stopTtsAmplitude();
      onSpeakEnd?.();
    };

    utter.onend       = handleDone;
    utter.onerror     = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        isSpeakingRef.current = false;
        lastSpeakEndTimeRef.current = Date.now();
        setIsSpeaking(false);
        stopTtsAmplitude();
        return;
      }
      handleDone();
      onError?.(`TTS error: ${e.error}`);
    };

    // Small delay after cancel() prevents Chromium from glitching/doubling utterances
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        handleDone();
      }
    }, 40);
  }, [onSpeakStart, onSpeakEnd, onError, startTtsAmplitude, stopTtsAmplitude]);

  // ── Step 7: Unified speak (backend TTS if available) ────────
  const speak = useCallback((text, opts = {}) => {
    if (!text?.trim()) return;

    // Stop speech recognition immediately
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    clearTimeout(transcriptTimeoutRef.current);
    accumulatedTranscriptRef.current = '';
    isListeningRef.current = false;
    setIsListening(false);
    isSpeakingRef.current = true;

    // Stop any existing backend audio
    if (backendAudioRef.current) {
      try {
        backendAudioRef.current.pause();
        backendAudioRef.current = null;
      } catch {}
    }

    const wordCount   = text.trim().split(/\s+/).length;
    const estimatedMs = Math.max(1500, wordCount * 280);

    if (backendTtsRef.current && !mutedRef.current) {
      setIsSpeaking(true);
      startTtsAmplitude(estimatedMs);
      speakViaBackend(
        text,
        () => onSpeakStart?.(),
        () => {
          isSpeakingRef.current = false;
          lastSpeakEndTimeRef.current = Date.now();
          setIsSpeaking(false);
          stopTtsAmplitude();
          onSpeakEnd?.();
        },
        // Silent fallback: backend TTS failed — switch to browser TTS without any toast
        () => speakBrowser(text, opts),
      ).then((audio) => { backendAudioRef.current = audio; });
    } else {
      speakBrowser(text, opts);
    }
  }, [speakBrowser, onSpeakStart, onSpeakEnd, startTtsAmplitude, stopTtsAmplitude]);

  const cancel = useCallback(() => {
    // Cancel browser TTS
    if (TTS_SUPPORTED) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    // Cancel backend TTS playback
    if (backendAudioRef.current) {
      try {
        backendAudioRef.current.pause();
        backendAudioRef.current = null;
      } catch {}
    }
    isSpeakingRef.current = false;
    lastSpeakEndTimeRef.current = Date.now();
    setIsSpeaking(false);
    stopTtsAmplitude();
    onSpeakEnd?.();
  }, [onSpeakEnd, stopTtsAmplitude]);

  const toggleMute = useCallback(() => {
    setIsMuted((v) => {
      if (!v) {
        try { window.speechSynthesis?.cancel(); } catch {}
      }
      return !v;
    });
  }, []);

  // ── STT ────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!STT_SUPPORTED || !SpeechRecognitionAPI) {
      onError?.('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    // Echo protection: never listen while avatar is speaking
    if (isSpeakingRef.current) return;

    // If we're still within the echo cooldown window, retry once after the window expires
    const sinceLastSpeak = Date.now() - lastSpeakEndTimeRef.current;
    if (sinceLastSpeak < 400) {
      const remaining = 400 - sinceLastSpeak + 50; // small buffer
      setTimeout(() => startListening(), remaining);
      return;
    }

    // Use ref (not state) to avoid stale closure — state update is async
    if (isListeningRef.current) return;

    try { window.speechSynthesis?.cancel(); } catch {}
    startMicAnalysis();

    const rec             = new SpeechRecognitionAPI();
    rec.lang              = 'en-US';
    rec.continuous        = false;
    rec.interimResults    = true;
    rec.maxAlternatives   = 1;

    accumulatedTranscriptRef.current = '';

    rec.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      setTranscript('');
      prevTranscriptRef.current = '';
      accumulatedTranscriptRef.current = '';
      onListenStart?.();
    };

    const finalizeTranscript = () => {
      clearTimeout(transcriptTimeoutRef.current);
      transcriptTimeoutRef.current = null;
      const finalTxt = accumulatedTranscriptRef.current.trim();
      if (finalTxt && !isSpeakingRef.current && (Date.now() - lastSpeakEndTimeRef.current >= 400)) {
        accumulatedTranscriptRef.current = '';
        onTranscript?.(finalTxt);
      }
    };

    rec.onresult = (e) => {
      // Acoustic echo suppression: discard mic audio only if avatar is actively speaking
      if (isSpeakingRef.current || (Date.now() - lastSpeakEndTimeRef.current < 400)) {
        accumulatedTranscriptRef.current = '';
        return;
      }

      let interim = '';
      let final   = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }

      const current = (final || interim).trim();
      setTranscript(current);

      if (final) {
        accumulatedTranscriptRef.current = final;
      }

      // Step 5: Count new filler words in incremental transcript
      const newText = current.slice(prevTranscriptRef.current.length);
      if (newText) {
        const newFillers = countFillers(newText);
        if (newFillers > 0) {
          fillerCountRef.current += newFillers;
          setFillerWordCount(fillerCountRef.current);
        }
      }
      prevTranscriptRef.current = current;

      // Debounce emission of final transcript so full sentences are emitted once
      if (final) {
        clearTimeout(transcriptTimeoutRef.current);
        transcriptTimeoutRef.current = setTimeout(finalizeTranscript, 600);
      }
    };

    rec.onerror = (e) => {
      clearTimeout(transcriptTimeoutRef.current);
      accumulatedTranscriptRef.current = '';
      isListeningRef.current = false;
      setIsListening(false);
      stopMicAnalysis();
      onListenEnd?.();
      if (e.error === 'no-speech') return; // Natural silence, don't spam errors
      else if (e.error === 'not-allowed') onError?.('Microphone access denied.');
      else if (e.error !== 'aborted')  onError?.(`Microphone error: ${e.error}`);
    };

    rec.onend = () => {
      finalizeTranscript();
      isListeningRef.current = false;
      setIsListening(false);
      stopMicAnalysis();
      onListenEnd?.();
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {}
  }, [onTranscript, onListenStart, onListenEnd, onError, startMicAnalysis, stopMicAnalysis]);

  const stopListening = useCallback(() => {
    clearTimeout(transcriptTimeoutRef.current);
    accumulatedTranscriptRef.current = '';
    try { recognitionRef.current?.stop(); } catch {}
    isListeningRef.current = false;
    setIsListening(false);
    stopMicAnalysis();
    onListenEnd?.();
  }, [onListenEnd, stopMicAnalysis]);

  // Step 5: Reset filler counter (call at session start)
  const resetFillerCount = useCallback(() => {
    fillerCountRef.current = 0;
    setFillerWordCount(0);
    prevTranscriptRef.current = '';
  }, []);

  // Clean up on unmount
  useEffect(() => () => {
    clearTimeout(transcriptTimeoutRef.current);
    accumulatedTranscriptRef.current = '';
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    backendAudioRef.current?.pause();
    stopMicAnalysis();
    stopTtsAmplitude();
  }, [stopMicAnalysis, stopTtsAmplitude]);

  return {
    isSpeaking,
    isListening,
    isMuted,
    transcript,
    micAmplitude,
    ttsAmplitude,
    fillerWordCount,      // Step 5
    ttsSupported: TTS_SUPPORTED,
    sttSupported: STT_SUPPORTED,
    speak,
    cancel,
    toggleMute,
    startListening,
    stopListening,
    resetFillerCount,     // Step 5
  };
}

export default useSpeech;
