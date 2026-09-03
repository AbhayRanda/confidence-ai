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
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // "Bella" — warm, friendly

async function speakViaBackend(text, onStart, onEnd, onError) {
  try {
    onStart?.();
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: DEFAULT_VOICE_ID }),
    });

    if (!res.ok) throw new Error(`Backend TTS error: ${res.status}`);

    const blob      = await res.blob();
    const url       = URL.createObjectURL(blob);
    const audio     = new Audio(url);
    audio.onended   = () => { URL.revokeObjectURL(url); onEnd?.(); };
    audio.onerror   = () => { URL.revokeObjectURL(url); onError?.('Audio playback error'); onEnd?.(); };
    await audio.play();
    return audio;   // caller can .pause() to cancel
  } catch (err) {
    onError?.(`TTS: ${err.message}`);
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

  useEffect(() => { mutedRef.current      = isMuted; },     [isMuted]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; },  [isSpeaking]);

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
    const wordCount   = text.trim().split(/\s+/).length;
    const estimatedMs = Math.max(1500, wordCount * 280);

    if (mutedRef.current) {
      onSpeakStart?.(); startTtsAmplitude(estimatedMs);
      setTimeout(() => { stopTtsAmplitude(); onSpeakEnd?.(); }, estimatedMs);
      return;
    }

    window.speechSynthesis.cancel();
    const utter       = new SpeechSynthesisUtterance(text);
    utter.voice       = voiceRef.current || null;
    utter.rate        = opts.rate   ?? 0.95;
    utter.pitch       = opts.pitch  ?? 1.05;
    utter.volume      = opts.volume ?? 1.0;
    utter.onstart     = () => { setIsSpeaking(true); onSpeakStart?.(); startTtsAmplitude(estimatedMs); };
    utter.onend       = () => { setIsSpeaking(false); stopTtsAmplitude(); onSpeakEnd?.(); };
    utter.onerror     = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      setIsSpeaking(false); stopTtsAmplitude(); onSpeakEnd?.();
      onError?.(`TTS error: ${e.error}`);
    };
    window.speechSynthesis.speak(utter);
  }, [onSpeakStart, onSpeakEnd, onError, startTtsAmplitude, stopTtsAmplitude]);

  // ── Step 7: Unified speak (backend TTS if available) ────────
  const speak = useCallback((text, opts = {}) => {
    if (!text?.trim()) return;
    const wordCount   = text.trim().split(/\s+/).length;
    const estimatedMs = Math.max(1500, wordCount * 280);

    if (backendTtsRef.current && !mutedRef.current) {
      setIsSpeaking(true);
      startTtsAmplitude(estimatedMs);
      speakViaBackend(
        text,
        () => onSpeakStart?.(),
        () => { setIsSpeaking(false); stopTtsAmplitude(); onSpeakEnd?.(); },
        (msg) => { onError?.(msg); speakBrowser(text, opts); }, // fallback on backend error
      ).then((audio) => { backendAudioRef.current = audio; });
    } else {
      speakBrowser(text, opts);
    }
  }, [speakBrowser, onSpeakStart, onSpeakEnd, onError, startTtsAmplitude, stopTtsAmplitude]);

  const cancel = useCallback(() => {
    // Cancel browser TTS
    if (TTS_SUPPORTED) window.speechSynthesis.cancel();
    // Cancel backend TTS playback
    if (backendAudioRef.current) {
      backendAudioRef.current.pause();
      backendAudioRef.current = null;
    }
    setIsSpeaking(false);
    stopTtsAmplitude();
    onSpeakEnd?.();
  }, [onSpeakEnd, stopTtsAmplitude]);

  const toggleMute = useCallback(() => {
    setIsMuted((v) => {
      if (!v) window.speechSynthesis?.cancel();
      return !v;
    });
  }, []);

  // ── STT ────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!STT_SUPPORTED || !SpeechRecognitionAPI) {
      onError?.('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (isListening) return;
    window.speechSynthesis?.cancel();
    startMicAnalysis();

    const rec             = new SpeechRecognitionAPI();
    rec.lang              = 'en-US';
    rec.continuous        = false;
    rec.interimResults    = true;
    rec.maxAlternatives   = 1;

    rec.onstart = () => {
      setIsListening(true);
      setTranscript('');
      prevTranscriptRef.current = '';
      onListenStart?.();
    };

    rec.onresult = (e) => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }

      const current = final || interim;
      setTranscript(current);

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

      if (final) onTranscript?.(final.trim());
    };

    rec.onerror = (e) => {
      setIsListening(false);
      stopMicAnalysis();
      onListenEnd?.();
      if (e.error === 'no-speech')     onError?.('No speech detected. Please try again.');
      else if (e.error === 'not-allowed') onError?.('Microphone access denied.');
      else if (e.error !== 'aborted')  onError?.(`Microphone error: ${e.error}`);
    };

    rec.onend = () => {
      setIsListening(false);
      stopMicAnalysis();
      onListenEnd?.();
    };

    recognitionRef.current = rec;
    rec.start();
  }, [isListening, onTranscript, onListenStart, onListenEnd, onError, startMicAnalysis, stopMicAnalysis]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
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
