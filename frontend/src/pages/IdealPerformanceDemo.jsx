/**
 * IdealPerformanceDemo.jsx
 * ─────────────────────────────────────────────────────────────
 * Shows a realistic 3D VRoid humanoid avatar (avatar1.vrm)
 * performing the user's improved presentation with a confident
 * female voice narration, generated from their analysis metrics.
 *
 * Features:
 *  • 3D VRM avatar model (/avatar1.vrm) with natural expressions,
 *    posture sway, gestures, and phoneme lip-sync
 *  • Natural female voice synthesis (Aria, Jenny, Zira, Samantha, etc.)
 *  • AI-generated improved script from analysis metrics
 *  • Live speech-bubble typewriter effect synced with voice
 *  • Real-time coaching overlay with before/after metric bars
 *  • Play/Pause/Restart controls with speed selection & voice picker
 *  • Progress ring and metric HUD chips
 * ─────────────────────────────────────────────────────────────
 */

import React, {
  useRef, useEffect, useState, useCallback, useMemo,
} from 'react';
import { VRMAvatar } from '../components/ai-character/VRMAvatar';
import { CHARACTER_STATES } from '../components/ai-character/CharacterAnimations';
import './IdealPerformanceDemo.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const DEFAULT_VRM_URL = '/avatar1.vrm';

// ── Ideal target values the demo avatar "achieves" ───────────
const IDEAL_METRICS = {
  eye_contact_percentage:   92,
  smile_percentage:         88,
  posture_percentage:       95,
  hand_movement_percentage: 75,
  speech_score:             90,
  filler_word_count:        0,
  confidence_score:         91,
};

// ── Colour helpers ────────────────────────────────────────────
function metricColor(val) {
  if (val >= 70) return '#22c55e';
  if (val >= 45) return '#f59e0b';
  return '#ef4444';
}

// ── Score ring SVG ────────────────────────────────────────────
function ScoreRing({ score, size = 48 }) {
  const r    = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(130,90,255,0.1)" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="#a875ff" strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.16,1,0.3,1)' }}
      />
    </svg>
  );
}

// ── Filler word highlighter helper ───────────────────────────
function highlightFillersInText(text) {
  if (!text || !text.trim()) {
    return <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No speech recorded in this video.</span>;
  }
  const regex = /\b(you know|sort of|kind of|so yeah|i mean|um|uh|er|ah|like|basically|actually|literally)\b/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isFiller: false });
    }
    parts.push({ text: match[0], isFiller: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isFiller: false });
  }

  return parts.map((part, idx) =>
    part.isFiller ? (
      <mark key={idx} className="ipd-filler-mark" title="Filler word detected & removed in demo">
        {part.text}
      </mark>
    ) : (
      <span key={idx}>{part.text}</span>
    )
  );
}

// ── Client-side fallback speech cleaner ──────────────────────
function generateClientFallbackScript(analysisData) {
  const orig = (analysisData?.speech_text || '').trim();
  if (orig.length >= 8) {
    let cleaned = orig
      .replace(/\b(um|uh|er|ah|like|you know|so yeah|sort of|kind of|basically|literally|i mean)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length === 0) sentences = [cleaned];

    sentences = sentences.map(s => {
      let trimmed = s.trim();
      if (!trimmed) return '';
      let cap = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      return (cap.endsWith('.') || cap.endsWith('!') || cap.endsWith('?')) ? cap : cap + '.';
    }).filter(Boolean);

    let result = sentences.join(' ');
    if (result.split(/\s+/).length < 25) {
      result = `Hello, and thank you for your attention. ${result} I am dedicated to delivering real impact, communicating with clarity, and executing with excellence.`;
    }
    return { script: result, usedUserSpeech: true };
  }

  return {
    script: `Good morning everyone. Thank you for the opportunity to speak with you today. `
      + `I want to start by making one thing absolutely clear — I am genuinely excited about what we're building together. `
      + `Every idea begins with a bold vision and the courage to believe in it. `
      + `Today, I will walk you through exactly how we plan to turn that vision into reality, `
      + `step by step, with clarity and confidence. `
      + `The metrics show we have a strong foundation — now is the time to build on it. `
      + `I appreciate your attention, and I look forward to your questions.`,
    usedUserSpeech: false,
  };
}

// ── Female voice identification helpers ───────────────────────
const MALE_VOICE_NAMES = [
  'david', 'mark', 'george', 'guy', 'christopher', 'eric', 'roger', 'steffan',
  'richard', 'james', 'brian', 'daniel', 'alex', 'fred', 'male', 'tom', 'oliver',
  'prabhat', 'ravi', 'ryan', 'harun', 'stefan', 'connor', 'mitchell'
];

const FEMALE_VOICE_PRIORITIES = [
  // High-quality modern natural / neural online voices
  'jenny online', 'aria online', 'ava online', 'emma online', 'ana online',
  'google uk english female', 'natural female', 'neural female',
  // Specific popular natural female voices
  'jenny', 'aria', 'ava', 'emma', 'ana', 'michelle', 'stephanie',
  'sonia', 'natasha', 'libby', 'mia', 'clara', 'neerja',
  // Standard OS female voices
  'zira', 'hazel', 'susan', 'heera', 'samantha', 'victoria',
  'karen', 'fiona', 'moira', 'tessa', 'serena', 'allison', 'kate',
  'female', 'woman', 'girl'
];

export function getAvailableFemaleVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return [];

  // Filter out any voice explicitly matching male keywords
  const nonMale = voices.filter(v => {
    const n = (v.name || '').toLowerCase();
    return !MALE_VOICE_NAMES.some(m => n.includes(m));
  });

  // Filter explicitly female matching
  const females = nonMale.filter(v => {
    const n = (v.name || '').toLowerCase();
    return FEMALE_VOICE_PRIORITIES.some(f => n.includes(f));
  });

  if (females.length > 0) {
    const en = females.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
    return en.length > 0 ? en : females;
  }

  // Fallback: non-male English voices
  const enNonMale = nonMale.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
  return enNonMale.length > 0 ? enNonMale : nonMale;
}

export function pickBestFemaleVoice() {
  const list = getAvailableFemaleVoices();
  if (!list.length) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const all = window.speechSynthesis.getVoices() || [];
      return all.find(v => (v.lang || '').toLowerCase().startsWith('en')) || all[0] || null;
    }
    return null;
  }

  // Prioritize top natural female voices
  for (const pri of FEMALE_VOICE_PRIORITIES) {
    const found = list.find(v => (v.name || '').toLowerCase().includes(pri));
    if (found) return found;
  }
  return list[0];
}

// ── Generating overlay (shown while script is being prepared) ─
function GeneratingOverlay({ step, hasUserSpeech }) {
  const STEPS = [
    { id: 'analyze',  label: 'Analyzing your performance metrics…' },
    { id: 'script',   label: hasUserSpeech ? 'Transforming your speech into confident ideal delivery…' : 'Writing improved presentation script…' },
    { id: 'avatar',   label: 'Loading 3D avatar (avatar1.vrm) & female vocal cadence…' },
    { id: 'ready',    label: 'All set! Opening demo…' },
  ];

  return (
    <div className="ipd-generating">
      <div className="ipd-generating-orb">
        <div className="ipd-generating-ring"  />
        <div className="ipd-generating-ring2" />
        <div className="ipd-generating-icon">👩‍💼</div>
      </div>

      <div className="ipd-generating-title">Generating Your Ideal Demo</div>
      <div className="ipd-generating-sub">
        {hasUserSpeech
          ? 'Our AI is transforming your speech into an exemplary 3D demonstration with commanding posture, clear cadence, and zero filler words.'
          : 'Our AI is crafting how your presentation could look with perfect confidence and body language.'}
      </div>

      <div className="ipd-generating-steps">
        {STEPS.map((s, i) => {
          const stepIndex = STEPS.findIndex(x => x.id === step);
          const isDone    = i < stepIndex;
          const isActive  = s.id === step;
          return (
            <div key={s.id} className={`ipd-gen-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}>
              <div className="ipd-gen-step-dot" />
              {isDone ? `✓ ${s.label}` : s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Typewriter hook ────────────────────────────────────────────
function useTypewriter(text, speed = 34, playing = false) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone]           = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
  }, [text]);

  useEffect(() => {
    if (!playing || !text) return;
    setDisplayed('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, playing]);

  return { displayed, done };
}

// ── Main component ────────────────────────────────────────────
export function IdealPerformanceDemo({ analysisData, onClose }) {
  const synthRef       = useRef(null);
  const ttsRafRef      = useRef(null);
  const ttsStartRef    = useRef(0);
  const ttsDurationRef = useRef(3000);
  const isSpeakingRef  = useRef(false);

  const [vrmModelUrl, setVrmModelUrl] = useState(DEFAULT_VRM_URL);
  const [avatarState, setAvatarState] = useState(CHARACTER_STATES.IDLE);
  const [isSpeaking,  setIsSpeaking]  = useState(false);
  const [ttsAmplitude, setTtsAmplitude] = useState(0);

  const [femaleVoices, setFemaleVoices]   = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  const [genStep,     setGenStep]     = useState('analyze');
  const [generating,  setGenerating]  = useState(true);
  const [idealScript, setIdealScript] = useState('');
  const [scriptSentences, setScriptSentences] = useState([]);
  const [sentenceIdx, setSentenceIdx] = useState(0);

  const initialHasSpeech = Boolean(analysisData?.speech_text && analysisData.speech_text.trim().length >= 5);
  const [usedUserSpeech, setUsedUserSpeech] = useState(initialHasSpeech);
  const [originalSpeech, setOriginalSpeech] = useState(analysisData?.speech_text || '');
  const [scriptTab, setScriptTab] = useState('avatar'); // 'avatar' | 'compare' | 'original'

  const [playing,     setPlaying]     = useState(false);
  const [speed,       setSpeed]       = useState(1.0);
  const [progress,    setProgress]    = useState(0);

  // ── TTS amplitude simulation for realistic VRM lip-sync ─────
  const startTtsAmplitude = useCallback((durationMs) => {
    ttsStartRef.current    = performance.now();
    ttsDurationRef.current = durationMs;
    if (ttsRafRef.current) cancelAnimationFrame(ttsRafRef.current);
    const tick = () => {
      if (!isSpeakingRef.current) {
        setTtsAmplitude(0);
        return;
      }
      const elapsed  = performance.now() - ttsStartRef.current;
      const prog = Math.min(elapsed / (ttsDurationRef.current || 3000), 1);
      const envelope = prog < 0.08
        ? prog / 0.08
        : prog > 0.90
          ? (1 - prog) / 0.10
          : 1.0;
      const syllable = 0.60 + 0.40 * Math.abs(Math.sin(elapsed * 0.018));
      setTtsAmplitude(Math.max(0.40, envelope * syllable * 0.95));
      ttsRafRef.current = requestAnimationFrame(tick);
    };
    ttsRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTtsAmplitude = useCallback(() => {
    if (ttsRafRef.current) {
      cancelAnimationFrame(ttsRafRef.current);
      ttsRafRef.current = null;
    }
    setTtsAmplitude(0);
  }, []);

  // ── Voice detection: select female voice automatically ───────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const refreshVoices = () => {
      const list = getAvailableFemaleVoices();
      setFemaleVoices(list);
      const best = pickBestFemaleVoice();
      if (best) {
        setSelectedVoice(best);
      }
    };

    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
    return () => {
      if (window.speechSynthesis.onvoiceschanged === refreshVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // ── Fetch ideal script from backend ─────────────────────────
  const generateScript = useCallback(async () => {
    try {
      setGenStep('analyze');
      await new Promise(r => setTimeout(r, 600));
      setGenStep('script');

      const token = localStorage.getItem('token');
      const res   = await fetch(`${API_BASE_URL}/generate-ideal-script`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          confidence_score:         analysisData?.confidence_score         ?? 50,
          eye_contact_percentage:   analysisData?.eye_contact_percentage   ?? 50,
          smile_percentage:         analysisData?.smile_percentage         ?? 50,
          posture_percentage:       analysisData?.posture_percentage       ?? 50,
          hand_movement_percentage: analysisData?.hand_movement_percentage ?? 50,
          speech_score:             analysisData?.speech_score             ?? 50,
          filler_word_count:        analysisData?.filler_word_count        ?? 0,
          words_per_minute:         analysisData?.words_per_minute         ?? 130,
          speech_text:              analysisData?.speech_text              ?? '',
        }),
      });

      let script = '';
      let usedSpeech = initialHasSpeech;
      let origSpeech = analysisData?.speech_text || '';

      if (res.ok) {
        const data = await res.json();
        script = data.script || '';
        usedSpeech = Boolean(data.used_user_speech);
        if (data.original_speech) origSpeech = data.original_speech;
      }

      // Fallback script if API unavailable
      if (!script) {
        const fallback = generateClientFallbackScript(analysisData);
        script = fallback.script;
        usedSpeech = fallback.usedUserSpeech;
      }

      setIdealScript(script);
      setUsedUserSpeech(usedSpeech);
      setOriginalSpeech(origSpeech);

      // Split into sentences for sequential narration
      const sentences = script
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);
      setScriptSentences(sentences);

      setGenStep('avatar');
      await new Promise(r => setTimeout(r, 800));
      setGenStep('ready');
      await new Promise(r => setTimeout(r, 500));
      setGenerating(false);

    } catch (err) {
      console.warn('[IdealDemo] Script generation failed, using fallback', err);
      const fallback = generateClientFallbackScript(analysisData);
      setIdealScript(fallback.script);
      setUsedUserSpeech(fallback.usedUserSpeech);
      setOriginalSpeech(analysisData?.speech_text || '');
      setScriptSentences(fallback.script.split(/(?<=[.!?])\s+/).filter(Boolean));
      setGenStep('ready');
      await new Promise(r => setTimeout(r, 400));
      setGenerating(false);
    }
  }, [analysisData, initialHasSpeech]);

  // Kick off generation immediately
  useEffect(() => { generateScript(); }, [generateScript]);

  // ── Current sentence displayed in bubble ─────────────────────
  const currentSentence = scriptSentences[sentenceIdx] || '';
  const { displayed, done: sentenceDone } = useTypewriter(currentSentence, 34, playing);

  // ── Web Speech TTS (Female voice + lip-sync drive) ───────────
  useEffect(() => {
    if (!playing || !currentSentence) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utt      = new SpeechSynthesisUtterance(currentSentence);
    utt.rate       = speed;
    utt.pitch      = 1.08;   // Pleasant feminine vocal pitch
    utt.volume     = 1.0;

    // Pick female voice
    const activeVoice = selectedVoice || pickBestFemaleVoice();
    if (activeVoice) utt.voice = activeVoice;

    // Word count estimation for smooth lip sync
    const wordCount = (currentSentence.match(/\S+/g) || []).length;
    const estDurationMs = Math.max(1500, (wordCount / (140 * speed)) * 60000);

    utt.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setAvatarState(CHARACTER_STATES.TALKING);
      startTtsAmplitude(estDurationMs);
    };

    utt.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      stopTtsAmplitude();

      // Pause briefly between sentences like a confident speaker
      if (sentenceIdx < scriptSentences.length - 1) {
        setAvatarState(CHARACTER_STATES.IDLE);
        const timer = setTimeout(() => {
          setSentenceIdx(i => i + 1);
        }, 360);
        return () => clearTimeout(timer);
      } else {
        // Entire demo completed!
        const timer = setTimeout(() => {
          setPlaying(false);
          setProgress(100);
          setAvatarState(CHARACTER_STATES.HAPPY);
        }, 500);
        return () => clearTimeout(timer);
      }
    };

    utt.onerror = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      stopTtsAmplitude();
      setAvatarState(CHARACTER_STATES.IDLE);
    };

    synthRef.current = utt;
    window.speechSynthesis.speak(utt);

    return () => {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      stopTtsAmplitude();
    };
  }, [currentSentence, playing, speed, sentenceIdx, scriptSentences.length, selectedVoice, startTtsAmplitude, stopTtsAmplitude]);

  // Fallback progression if speech synthesis is not active or ends early
  useEffect(() => {
    if (!playing || typeof window === 'undefined' || !window.speechSynthesis) {
      if (playing && sentenceDone) {
        const id = setTimeout(() => {
          if (sentenceIdx < scriptSentences.length - 1) {
            setSentenceIdx(i => i + 1);
          } else {
            setPlaying(false);
            setProgress(100);
            setAvatarState(CHARACTER_STATES.HAPPY);
          }
        }, 500);
        return () => clearTimeout(id);
      }
    }
  }, [sentenceDone, playing, sentenceIdx, scriptSentences.length]);

  // ── Progress bar calculation ─────────────────────────────────
  useEffect(() => {
    if (!playing || scriptSentences.length === 0) return;
    const pct = ((sentenceIdx + 1) / scriptSentences.length) * 100;
    setProgress(pct);
  }, [sentenceIdx, playing, scriptSentences.length]);

  // ── Playback controls ─────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (playing) {
      // Pause
      window.speechSynthesis?.pause();
      setPlaying(false);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      stopTtsAmplitude();
      setAvatarState(CHARACTER_STATES.IDLE);
    } else {
      // Play / Resume
      if (sentenceIdx >= scriptSentences.length - 1 && progress >= 99) {
        // Restart from beginning
        setSentenceIdx(0);
        setProgress(0);
      }
      window.speechSynthesis?.resume();
      setPlaying(true);
      setAvatarState(CHARACTER_STATES.TALKING);
    }
  }, [playing, sentenceIdx, scriptSentences.length, progress, stopTtsAmplitude]);

  const handleRestart = useCallback(() => {
    window.speechSynthesis?.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    stopTtsAmplitude();
    setSentenceIdx(0);
    setProgress(0);
    setPlaying(false);
    setAvatarState(CHARACTER_STATES.IDLE);
  }, [stopTtsAmplitude]);

  // ── Improvement metrics ───────────────────────────────────────
  const improvements = useMemo(() => {
    if (!analysisData) return [];
    return [
      {
        icon: '👁️', label: 'Eye Contact',
        actual: analysisData.eye_contact_percentage ?? 0,
        ideal:  IDEAL_METRICS.eye_contact_percentage,
        tip: 'Sustained camera focus builds deep trust.',
      },
      {
        icon: '😊', label: 'Smile & Warmth',
        actual: analysisData.smile_percentage ?? 0,
        ideal:  IDEAL_METRICS.smile_percentage,
        tip: 'Natural smile creates instant rapport.',
      },
      {
        icon: '🧍', label: 'Posture',
        actual: analysisData.posture_percentage ?? 0,
        ideal:  IDEAL_METRICS.posture_percentage,
        tip: 'Upright posture signals authority.',
      },
      {
        icon: '🤚', label: 'Hand Gestures',
        actual: analysisData.hand_movement_percentage ?? 0,
        ideal:  IDEAL_METRICS.hand_movement_percentage,
        tip: 'Open-palm gestures convey confidence.',
      },
      {
        icon: '🎤', label: 'Speech Quality',
        actual: analysisData.speech_score ?? 0,
        ideal:  IDEAL_METRICS.speech_score,
        tip: 'Clear pace with deliberate pauses.',
      },
    ];
  }, [analysisData]);

  // ── Close handler ─────────────────────────────────────────────
  const handleClose = useCallback(() => {
    window.speechSynthesis?.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    stopTtsAmplitude();
    onClose?.();
  }, [onClose, stopTtsAmplitude]);

  const actualScore = analysisData?.confidence_score ?? 0;
  const idealScore  = IDEAL_METRICS.confidence_score;

  // ── Render ────────────────────────────────────────────────────
  if (generating) {
    return <GeneratingOverlay step={genStep} hasUserSpeech={usedUserSpeech} />;
  }

  return (
    <div className="ipd-overlay" role="dialog" aria-modal="true"
      aria-label="Ideal Performance Demo">
      <div className="ipd-modal">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="ipd-header">
          <div className="ipd-header-left">
            <div className="ipd-badge">
              <div className="ipd-badge-dot" />
              AI Demo • 3D Avatar (avatar1.vrm)
            </div>
            <div>
              <div className="ipd-title">Your Ideal Performance</div>
              <div className="ipd-subtitle">
                {usedUserSpeech
                  ? '3D Avatar demonstrates your speech with improved confidence & poise'
                  : 'Watch how your presentation looks with perfect confidence & body language'}
              </div>
            </div>
          </div>
          <div className="ipd-header-actions">
            <button className="ipd-close-btn" onClick={handleClose}
              aria-label="Close demo" title="Close">
              ✕
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className="ipd-body">

          {/* ── Left: 3D Stage ──────────────────────────── */}
          <div className="ipd-stage">
            <div className="ipd-spotlight" />

            {/* 3D Human VRM Avatar */}
            <div className="ipd-canvas-wrapper">
              <VRMAvatar
                vrmUrl={vrmModelUrl}
                state={avatarState}
                ttsAmplitude={ttsAmplitude}
                isSpeaking={isSpeaking}
                onError={(err) => {
                  console.warn('[IdealDemo] VRM load error, falling back:', err);
                  if (vrmModelUrl === DEFAULT_VRM_URL) {
                    setVrmModelUrl('/avata1.vrm');
                  }
                }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            {/* HUD overlay */}
            <div className="ipd-hud">

              {/* Score ring — top left */}
              <div className="ipd-score-ring-wrap">
                <div className="ipd-score-ring">
                  <ScoreRing score={idealScore} size={48} />
                  <div className="ipd-score-ring-num">{idealScore}</div>
                </div>
                <div>
                  <div className="ipd-score-ring-title">Ideal Score</div>
                  <div className="ipd-score-ring-label">vs your {actualScore.toFixed(0)}</div>
                </div>
              </div>

              {/* Metric chips — top right */}
              <div className="ipd-metric-chips">
                {[
                  { icon: '👁️', label: 'Eye',     val: IDEAL_METRICS.eye_contact_percentage },
                  { icon: '😊', label: 'Smile',   val: IDEAL_METRICS.smile_percentage },
                  { icon: '🧍', label: 'Posture', val: IDEAL_METRICS.posture_percentage },
                ].map(c => (
                  <div key={c.label} className="ipd-chip">
                    <span className="ipd-chip-icon">{c.icon}</span>
                    <span className="ipd-chip-label">{c.label}</span>
                    <span className="ipd-chip-val" style={{ color: metricColor(c.val) }}>
                      {c.val}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Playing bars — bottom left */}
              {playing && (
                <div className="ipd-play-indicator">
                  <div className="ipd-play-bars">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="ipd-play-bar" />
                    ))}
                  </div>
                  Performing ideal demo…
                </div>
              )}

              {/* Speech bubble — bottom center */}
              {(playing || sentenceIdx > 0) && (
                <div className="ipd-speech-bubble">
                  <div className="ipd-speech-source-tag">
                    {usedUserSpeech ? "🎙️ Avatar voicing your speech (improved):" : "🎙️ Ideal Demonstration:"}
                  </div>
                  <div className="ipd-speech-text">
                    "{displayed}"
                    {playing && !sentenceDone && (
                      <span className="ipd-speech-cursor" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Coaching Panel ────────────────────── */}
          <div className="ipd-panel">

            {/* Improvements section */}
            <div className="ipd-section">
              <div className="ipd-section-title">Before → After</div>
              {improvements.map(imp => {
                const tier = imp.actual >= 70 ? 'good' : imp.actual >= 45 ? 'warn' : 'bad';
                return (
                  <div key={imp.label} className="ipd-improvement-item">
                    <div className={`ipd-improvement-icon ipd-improvement-icon--${tier}`}>
                      {imp.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="ipd-improvement-label">{imp.label}</div>
                      <div className="ipd-improvement-desc">{imp.tip}</div>
                      <div className="ipd-improvement-bar-row">
                        <div className="ipd-improvement-bar-bg">
                          <div className="ipd-improvement-bar-fill"
                            style={{
                              width:      `${imp.ideal}%`,
                              background: `linear-gradient(90deg, ${metricColor(imp.actual)}, ${metricColor(imp.ideal)})`,
                            }}
                          />
                        </div>
                        <div className="ipd-improvement-pct">
                          <span style={{ color: metricColor(imp.actual), fontSize: 10 }}>
                            {imp.actual.toFixed(0)}
                          </span>
                          <span style={{ color: 'rgba(180,160,255,0.3)', margin: '0 3px' }}>→</span>
                          <span style={{ color: metricColor(imp.ideal) }}>
                            {imp.ideal}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Script section */}
            <div className="ipd-section ipd-section--script" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="ipd-section-header">
                <div className="ipd-section-title">
                  {usedUserSpeech ? 'Your Speech • Improved' : 'Improved Script'}
                </div>
                {usedUserSpeech && (
                  <span className="ipd-speech-source-badge">
                    <span className="ipd-source-sparkle">✨</span> Using your speech
                  </span>
                )}
              </div>

              {/* View tabs if user speech exists */}
              {usedUserSpeech && originalSpeech && (
                <div className="ipd-script-tabs">
                  <button
                    type="button"
                    className={`ipd-script-tab ${scriptTab === 'avatar' ? 'active' : ''}`}
                    onClick={() => setScriptTab('avatar')}
                  >
                    🎯 Avatar Delivery
                  </button>
                  <button
                    type="button"
                    className={`ipd-script-tab ${scriptTab === 'compare' ? 'active' : ''}`}
                    onClick={() => setScriptTab('compare')}
                  >
                    ⚖️ Before vs After
                  </button>
                  <button
                    type="button"
                    className={`ipd-script-tab ${scriptTab === 'original' ? 'active' : ''}`}
                    onClick={() => setScriptTab('original')}
                  >
                    📝 Original Speech
                  </button>
                </div>
              )}

              {/* Tab 1: Live Avatar Delivery */}
              {scriptTab === 'avatar' && (
                <div className="ipd-script-box">
                  {scriptSentences.map((sentence, i) => (
                    <span key={i}
                      style={{
                        color: i === sentenceIdx && playing
                          ? '#e9d5ff'
                          : i < sentenceIdx
                          ? '#86efac'
                          : 'rgba(216, 200, 255, 0.65)',
                        fontWeight: i === sentenceIdx && playing ? 700 : 400,
                        backgroundColor: i === sentenceIdx && playing ? 'rgba(168, 130, 255, 0.15)' : 'transparent',
                        borderRadius: 4,
                        padding: '1px 3px',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {sentence}{' '}
                    </span>
                  ))}
                </div>
              )}

              {/* Tab 2: Comparison */}
              {scriptTab === 'compare' && (
                <div className="ipd-compare-box">
                  <div className="ipd-compare-col ipd-compare-col--before">
                    <div className="ipd-compare-heading">
                      <span className="ipd-compare-pill ipd-compare-pill--before">Your Version</span>
                      <span className="ipd-compare-sub">{analysisData?.filler_word_count || 0} filler words</span>
                    </div>
                    <div className="ipd-compare-text">
                      {highlightFillersInText(originalSpeech)}
                    </div>
                  </div>
                  <div className="ipd-compare-col ipd-compare-col--after">
                    <div className="ipd-compare-heading">
                      <span className="ipd-compare-pill ipd-compare-pill--after">Avatar Delivery</span>
                      <span className="ipd-compare-sub">0 fillers • Confident</span>
                    </div>
                    <div className="ipd-compare-text ipd-compare-text--after">
                      {idealScript}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Original Transcript with Highlighted Fillers */}
              {scriptTab === 'original' && (
                <div className="ipd-original-box">
                  <div className="ipd-orig-meta">
                    <span>⏱️ Pace: <strong>{analysisData?.words_per_minute || 0} WPM</strong></span>
                    <span>⚠️ Fillers: <strong style={{ color: '#f87171' }}>{analysisData?.filler_word_count || 0}</strong></span>
                  </div>
                  <div className="ipd-orig-text">
                    {highlightFillersInText(originalSpeech)}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="ipd-controls">
              {/* Progress */}
              <div className="ipd-progress-track">
                <div className="ipd-progress-fill" style={{ width: `${progress}%` }} />
              </div>

              {/* Female Voice Selector / Indicator */}
              <div className="ipd-voice-row">
                <span className="ipd-voice-label">Female Voice</span>
                <div className="ipd-voice-container">
                  {femaleVoices.length > 1 ? (
                    <select
                      className="ipd-voice-select"
                      value={selectedVoice?.name || ''}
                      onChange={(e) => {
                        const v = femaleVoices.find(x => x.name === e.target.value);
                        if (v) setSelectedVoice(v);
                      }}
                      title="Select female narrator voice"
                    >
                      {femaleVoices.map((v, idx) => (
                        <option key={idx} value={v.name}>
                          👩 {v.name.replace(/Microsoft |Google |Online \(Natural\)|Desktop/gi, '').trim()} ({v.lang})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="ipd-voice-badge" title={selectedVoice?.name || 'Female Voice'}>
                      <span className="ipd-voice-badge-icon">👩‍💼</span>
                      <span className="ipd-voice-badge-name">
                        {selectedVoice
                          ? selectedVoice.name.replace(/Microsoft |Google |Online \(Natural\)|Desktop/gi, '').trim()
                          : 'Natural Female Voice'}
                      </span>
                      <span className="ipd-voice-badge-tag">Female</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Speed */}
              <div className="ipd-speed-row">
                <span className="ipd-speed-label">Speed</span>
                <div className="ipd-speed-btns">
                  {[0.75, 1.0, 1.25, 1.5].map(s => (
                    <button key={s}
                      className={`ipd-speed-btn${speed === s ? ' active' : ''}`}
                      onClick={() => setSpeed(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              {/* Play row */}
              <div className="ipd-btn-row">
                <button className="ipd-btn-secondary" onClick={handleRestart}
                  title="Restart" aria-label="Restart demo">
                  ↺
                </button>
                <button className="ipd-btn-play" onClick={handlePlay}
                  id="ideal-demo-play-btn">
                  {playing
                    ? <><span>⏸</span> Pause</>
                    : progress >= 99
                    ? <><span>↺</span> Replay</>
                    : sentenceIdx > 0
                    ? <><span>▶</span> Resume</>
                    : <><span>▶</span> Play Demo</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IdealPerformanceDemo;
