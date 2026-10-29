/**
 * LiveAvatarChat.js
 * ─────────────────────────────────────────────────────────────
 * Full-featured live video chat page with 3D humanoid avatar.
 *
 * Features:
 *   • Split-screen: user webcam tile + 3D avatar tile
 *   • Direct camera & microphone integration
 *   • Real-time client-side vision detection via MediaPipe:
 *       - Face expression (smile, eye contact, head pose)
 *       - Hand gestures (thumbs up, open palm, etc.)
 *       - Object detection (phone, cup, bottle, etc.)
 *   • Avatar reacts verbally & physically to vision events
 *   • Voice chat loop: STT → AI response → TTS lip-sync
 *   • Session modes: Mock Interview, Coach, Free Chat, Vision Sandbox
 *   • Call controls: Mic, Camera, Vision HUD, End Call
 *   • End-call summary modal with session stats
 *
 * Zero subscriptions required — all processing runs in-browser.
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AICharacter } from '../components/ai-character/AICharacter';
import { useAICharacter } from '../hooks/useAICharacter';
import { useSpeech } from '../hooks/useSpeech';
import { useChat } from '../hooks/useChat';
import { useLiveVision } from '../hooks/useLiveVision';
import { useUserProfile } from '../hooks/useUserProfile';
import './LiveAvatarChat.css';

// ── Session modes ────────────────────────────────────────────
const MODES = [
  {
    id:     'coach',
    label:  '🎯 Coach',
    system: 'You are an AI confidence coach. STRICT BREVITY: reply in 1-2 sentences MAX — never more. Give one direct observation or tip per message. No bullet points, no preamble, no markdown formatting — plain text only, no asterisks or symbols. You watch the user via camera and give real-time feedback on posture, eye contact, and expressions.',
    allowVisionReactions: true,   // coach actively comments on what it sees
  },
  {
    id:     'interview',
    label:  '💼 Mock Interview',
    system: [
      'You are a professional mock job interviewer. You ONLY conduct interviews — you do not chat.',
      '',
      'MANDATORY RESPONSE FORMAT — follow this EXACTLY for every single reply:',
      'Sentence 1: Acknowledge what the candidate just said (one sentence, specific to their answer).',
      'Sentence 2: Give ONE brief delivery coaching tip (e.g. eye contact, speaking pace, filler words, posture, confidence).',
      'Sentence 3: Ask your next interview question. This sentence MUST end with a "?".',
      '',
      'ABSOLUTE RULES:',
      '- EVERY response must contain exactly one question ending with "?".',
      '- NEVER give a response without a question at the end.',
      '- NEVER repeat a question already asked in this conversation.',
      '- NEVER ask two questions in one response.',
      '- Progress naturally: start with background → experience → situational ("Tell me about a time...") → behavioral → strengths/weaknesses.',
      '- Keep each response to 3 sentences maximum. Short and focused.',
      '',
      'The conversation has already started with: "Tell me about yourself and what role you are preparing for?" — do not repeat this question.',
    ].join('\n'),
    allowVisionReactions: false,  // interview = respond to words only, no vision interruptions
  },
  {
    id:     'freeChat',
    label:  '💬 Free Chat',
    system: 'You are a friendly AI companion. STRICT BREVITY: reply in 1-2 sentences MAX. Be warm, direct, and engaging. No long paragraphs, no bullet lists, no markdown — plain text only. Answer only what was asked.',
    allowVisionReactions: true,
  },
  {
    id:     'vision',
    label:  '👁️ Vision Sandbox',
    system: 'Focus on what you see through the camera. Reply in 1 sentence only — name the observation and nothing else.',
    allowVisionReactions: true,
  },
];

// ── Quick prompt suggestions for Gemini ──────────────────────
const QUICK_PROMPTS = [
  "How is my posture and eye contact?",
  "Give me an interview question",
  "How can I sound more confident?",
  "What tips do you have for my body language?",
];

// ── Vision-reactive response templates ───────────────────────
const VISION_REACTIONS = {
  smile: [
    "Love that smile! It really projects warmth and confidence.",
    "Great expression — a genuine smile like that makes people trust you more.",
    "That smile is excellent! Keep that energy going.",
  ],
  noEyeContact: [
    "Hey, try looking at the camera — that's where eye contact happens on video.",
    "I noticed you looked away. In video calls, keeping your gaze near the lens really helps.",
    "Quick tip: try to keep eye contact with the camera. I can tell when you look away!",
  ],
  eyeContactRestored: [
    "Perfect, now you're making great eye contact!",
    "That's it — right at the camera. Great job!",
  ],
  thumbsUp: [
    "I see that thumbs up! Glad to know we're on the same page.",
    "👍 Right back at you! Should we continue?",
  ],
  openPalm: [
    "I see you raising your hand — go ahead, what's on your mind?",
    "Got it, you want to say something. I'm listening!",
  ],
  victory: [
    "Victory sign! You must be feeling confident! ✌️",
    "Love the energy! That V-sign tells me you're feeling good.",
  ],
  phone: [
    "I see you've got your phone — try putting it aside to stay focused!",
    "Looks like there's a phone on camera. Pro tip: keep distractions out of frame during interviews.",
  ],
  cup: [
    "I see a cup there — staying hydrated is actually great for speaking clarity!",
    "Coffee or water? Either way, good to stay hydrated during practice.",
  ],
  bottle: [
    "I notice a bottle on camera — good, staying hydrated helps your voice!",
  ],
  book: [
    "I see a book! Are you preparing notes? That's smart preparation.",
  ],
  laptop: [
    "Another screen in view — try to stay focused on this camera for the best practice.",
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Timestamp formatting ─────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function timeStamp() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

// ═════════════════════════════════════════════════════════════
//  Main Component
// ═════════════════════════════════════════════════════════════

export default function LiveAvatarChat() {

  // ── Camera & Mic state ─────────────────────────────────────
  const [cameraOn,  setCameraOn]  = useState(false);
  const [micOn,     setMicOn]     = useState(false);
  const [hudOn,     setHudOn]     = useState(true);
  const [mode,      setMode]      = useState('coach');
  const [callActive, setCallActive] = useState(false);

  // ── Text chat drawer state ─────────────────────────────────
  const [chatOpen,  setChatOpen]  = useState(false);
  const [textInput, setTextInput] = useState('');
  const chatMessagesEndRef        = useRef(null);

  // ── User profile ───────────────────────────────────────────
  const { profile } = useUserProfile();
  const userName = profile?.name || 'there';

  // Refs to track mic/call state across async boundaries (for auto-restart)
  const micOnRef      = useRef(false);
  const callActiveRef = useRef(false);
  const restartTimerRef = useRef(null);
  micOnRef.current      = micOn;
  callActiveRef.current = callActive;

  // ── Session timer ──────────────────────────────────────────
  const [elapsed, setElapsed]     = useState(0);
  const timerRef                  = useRef(null);

  // ── Detection event log ────────────────────────────────────
  const [events, setEvents]       = useState([]);
  const eventsEndRef              = useRef(null);
  const lastEventRef              = useRef({});  // debounce per type

  // ── End-call summary ───────────────────────────────────────
  const [showSummary, setShowSummary] = useState(false);
  const sessionStatsRef           = useRef({
    smileCount: 0,
    eyeContactLost: 0,
    gestureCount: 0,
    objectsDetected: new Set(),
    messagesExchanged: 0,
  });

  // ── Refs for video/canvas ──────────────────────────────────
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ── Avatar subtitle ────────────────────────────────────────
  const [subtitle, setSubtitle]   = useState('');
  const subtitleTimerRef          = useRef(null);

  // ── AI Character hook ──────────────────────────────────────
  const character = useAICharacter();

  // ── Refs to break stale closures in speech callbacks ───────
  // The speech hook captures callbacks at startListening() time,
  // so inline closures over handleUserSpeech/chat/speech go stale.
  // Using refs ensures callbacks always invoke the latest version.
  const handleUserSpeechRef        = useRef(null);
  const speechRef                  = useRef(null);
  const lastUserSpeechRef          = useRef({ text: '', time: 0 });
  const lastVisionReactionTimeRef  = useRef(0);

  // ── Speech hook ────────────────────────────────────────────
  const speech = useSpeech({
    onSpeakStart: () => character.setIsSpeaking(true),
    onSpeakEnd:   () => {
      character.setIsSpeaking(false);
      // Re-engage listening after avatar finishes speaking (with acoustic echo buffer)
      // ⚠️ Delay MUST exceed the 600ms cooldown inside startListening, otherwise
      //    the echo guard fires first and the mic silently never starts.
      if (micOnRef.current && callActiveRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (micOnRef.current && callActiveRef.current && !speechRef.current?.isSpeaking) {
            speechRef.current?.startListening();
            character.setState('listening');
          }
        }, 700); // must be > 600ms echo cooldown
      }
    },
    onTranscript: (text) => {
      if (text && text.trim()) {
        // Always call through the ref to get the latest handleUserSpeech
        handleUserSpeechRef.current?.(text.trim());
      }
    },
    onListenEnd: () => {
      // Auto-restart STT when recognition ends naturally (continuous=false)
      // ⚠️ Delay MUST exceed the 600ms echo cooldown in startListening.
      if (micOnRef.current && callActiveRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (micOnRef.current && callActiveRef.current && !speechRef.current?.isSpeaking) {
            speechRef.current?.startListening();
          }
        }, 650); // must be > 600ms echo cooldown
      }
    },
  });

  // Keep speechRef always pointing to the latest speech object
  speechRef.current = speech;

  // ── Vision hook ────────────────────────────────────────────
  const vision = useLiveVision({
    enabled: cameraOn && callActive,
    videoRef,
    canvasRef,
  });

  // ── Chat hook (for AI responses) ───────────────────────────
  const getVisionContext = useCallback(() => {
    const ctx = {};
    if (vision.faceData) {
      ctx.smiling     = vision.faceData.smiling;
      ctx.eye_contact = vision.faceData.eyeContact;
    }
    if (vision.gesture) {
      ctx.gesture = vision.gesture.name;
    }
    if (vision.detectedObjects?.length > 0) {
      ctx.detected_objects = vision.detectedObjects.map(o => o.label);
    }
    return Object.keys(ctx).length > 0 ? ctx : null;
  }, [vision.faceData, vision.gesture, vision.detectedObjects]);

  const chat = useChat({
    getAnalysisContext: getVisionContext,
    character,
    speech,
    systemPrompt: MODES.find(m => m.id === mode)?.system || null,
  });

  // ── Add event to log ───────────────────────────────────────
  const addEvent = useCallback((icon, text, type = 'info') => {
    // Debounce same event type within 5 seconds
    const now = Date.now();
    if (lastEventRef.current[type] && now - lastEventRef.current[type] < 5000) return;
    lastEventRef.current[type] = now;

    setEvents(prev => [...prev.slice(-30), { id: now, time: timeStamp(), icon, text, type }]);
  }, []);

  // ── Handle user speech transcription ───────────────────────
  const handleUserSpeech = useCallback((text) => {
    // Guard: ignore speech input if avatar is speaking or AI is thinking
    if (speechRef.current?.isSpeaking || chat.isThinking) return;

    // Deduplicate rapid or identical transcripts
    const now = Date.now();
    if (lastUserSpeechRef.current.text === text && (now - lastUserSpeechRef.current.time < 3000)) {
      return;
    }
    if (now - lastUserSpeechRef.current.time < 1200) {
      return;
    }
    lastUserSpeechRef.current = { text, time: now };

    // In interview mode send only the raw transcript — vision metadata would confuse
    // an interviewer that should focus purely on what the candidate said.
    // For coach / vision modes, prepend live camera context for richer AI reactions.
    const currentMode = MODES.find(m => m.id === mode);
    let enrichedMessage = text;

    if (currentMode?.allowVisionReactions !== false) {
      const visionCtx = getVisionContext();
      if (visionCtx) {
        const parts = [];
        if (visionCtx.smiling)      parts.push('user is smiling');
        if (visionCtx.eye_contact === false) parts.push('user is not making eye contact');
        if (visionCtx.gesture)      parts.push(`user is making a ${visionCtx.gesture} gesture`);
        if (visionCtx.detected_objects?.length) parts.push(`visible objects: ${visionCtx.detected_objects.join(', ')}`);
        if (parts.length > 0) {
          enrichedMessage = `[Vision context: ${parts.join('; ')}]\n${text}`;
        }
      }
    }

    sessionStatsRef.current.messagesExchanged++;
    chat.sendMessage(enrichedMessage);
    addEvent('🗣️', `You: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`, 'speech-user');
  }, [chat, mode, getVisionContext, addEvent]);

  // Keep the ref always pointing to the latest handleUserSpeech
  handleUserSpeechRef.current = handleUserSpeech;

  // ── Send typed text message to Gemini ───────────────────────
  const handleSendText = useCallback((e) => {
    e?.preventDefault();
    const trimmed = textInput.trim();
    if (!trimmed || chat.isThinking) return;

    setTextInput('');
    sessionStatsRef.current.messagesExchanged++;

    const currentMode = MODES.find(m => m.id === mode);
    let enrichedMessage = trimmed;
    if (currentMode?.allowVisionReactions !== false) {
      const visionCtx = getVisionContext();
      if (visionCtx) {
        const parts = [];
        if (visionCtx.smiling) parts.push('user is smiling');
        if (visionCtx.eye_contact === false) parts.push('user is not making eye contact');
        if (visionCtx.gesture) parts.push(`user is making a ${visionCtx.gesture} gesture`);
        if (visionCtx.detected_objects?.length) parts.push(`visible objects: ${visionCtx.detected_objects.join(', ')}`);
        if (parts.length > 0) {
          enrichedMessage = `[Vision context: ${parts.join('; ')}]\n${trimmed}`;
        }
      }
    }

    chat.sendMessage(enrichedMessage);
    addEvent('💬', `You: "${trimmed.slice(0, 50)}${trimmed.length > 50 ? '…' : ''}"`, 'chat-text');
  }, [textInput, chat, mode, getVisionContext, addEvent]);

  // ── Send quick prompt chip to Gemini ────────────────────────
  const handleSendQuickPrompt = useCallback((promptText) => {
    if (!promptText || chat.isThinking) return;
    sessionStatsRef.current.messagesExchanged++;

    const currentMode = MODES.find(m => m.id === mode);
    let enrichedMessage = promptText;
    if (currentMode?.allowVisionReactions !== false) {
      const visionCtx = getVisionContext();
      if (visionCtx) {
        const parts = [];
        if (visionCtx.smiling) parts.push('user is smiling');
        if (visionCtx.eye_contact === false) parts.push('user is not making eye contact');
        if (visionCtx.gesture) parts.push(`user is making a ${visionCtx.gesture} gesture`);
        if (visionCtx.detected_objects?.length) parts.push(`visible objects: ${visionCtx.detected_objects.join(', ')}`);
        if (parts.length > 0) {
          enrichedMessage = `[Vision context: ${parts.join('; ')}]\n${promptText}`;
        }
      }
    }

    chat.sendMessage(enrichedMessage);
    addEvent('💡', `Prompt: "${promptText}"`, 'chat-text');
  }, [chat, mode, getVisionContext, addEvent]);

  // Auto-scroll chat messages drawer
  useEffect(() => {
    if (chatOpen) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat.messages, chatOpen]);

  // ── Show avatar subtitle when chat responds ────────────────
  useEffect(() => {
    const lastMsg = chat.messages[chat.messages.length - 1];
    if (lastMsg && lastMsg.role === 'mentor' && lastMsg.text) {
      setSubtitle(lastMsg.text.slice(0, 150) + (lastMsg.text.length > 150 ? '…' : ''));
      // Auto-clear after TTS would finish (rough estimate)
      clearTimeout(subtitleTimerRef.current);
      subtitleTimerRef.current = setTimeout(() => setSubtitle(''), Math.min(lastMsg.text.length * 60, 12000));
    }
  }, [chat.messages]);

  // ── Vision reaction engine ─────────────────────────────────
  const lastVisionState = useRef({
    smiling: false,
    eyeContact: true,
    gesture: null,
    objects: [],
  });

  useEffect(() => {
    if (!callActive || !vision.isReady) return;

    const prev = lastVisionState.current;
    const face = vision.faceData;
    const gest = vision.gesture;
    const objs = vision.detectedObjects;

    // In interview mode: never auto-speak vision reactions — the AI should only respond
    // to the user's spoken words. Vision events are still logged silently in the HUD.
    const currentMode = MODES.find(m => m.id === mode);
    const visionReactionsAllowed = currentMode?.allowVisionReactions !== false;

    // Check whether verbal reaction is safe:
    // MUST NOT interrupt ongoing speech, chat thinking, and respect a cooldown
    const canSpeakReaction = visionReactionsAllowed
      && !speech.isSpeaking
      && !chat.isThinking
      && (Date.now() - lastVisionReactionTimeRef.current > 12000);

    const speakVisionReaction = (text, charState = 'gesture') => {
      if (!canSpeakReaction || !text) return;
      lastVisionReactionTimeRef.current = Date.now();
      speech.speak(text);
      character.setState(charState);
    };

    // ── Smile detected ──
    if (face?.smiling && !prev.smiling) {
      addEvent('😊', 'Smile detected!', 'smile');
      sessionStatsRef.current.smileCount++;
      if (Math.random() < 0.4) {
        speakVisionReaction(pickRandom(VISION_REACTIONS.smile), 'happy');
      }
    }

    // ── Eye contact lost ──
    if (face && !face.eyeContact && prev.eyeContact) {
      addEvent('👀', 'Eye contact lost', 'eye-lost');
      sessionStatsRef.current.eyeContactLost++;
      if (Math.random() < 0.3) {
        speakVisionReaction(pickRandom(VISION_REACTIONS.noEyeContact), 'gesture');
      }
    }

    // ── Eye contact restored ──
    if (face?.eyeContact && !prev.eyeContact) {
      addEvent('✅', 'Eye contact restored', 'eye-ok');
      if (Math.random() < 0.25) {
        speakVisionReaction(pickRandom(VISION_REACTIONS.eyeContactRestored), 'encouraging');
      }
    }

    // ── Gesture detected ──
    if (gest && gest.name !== prev.gesture) {
      const label = gest.label || gest.name;
      addEvent('🤚', `Gesture: ${label}`, `gesture-${gest.name}`);
      sessionStatsRef.current.gestureCount++;

      const reactions = VISION_REACTIONS[gest.name === 'Thumb_Up' ? 'thumbsUp'
                      : gest.name === 'Open_Palm' ? 'openPalm'
                      : gest.name === 'Victory'   ? 'victory'
                      : null];
      if (reactions) {
        speakVisionReaction(pickRandom(reactions), 'happy');
      }
    }

    // ── Objects detected ──
    if (objs?.length > 0) {
      for (const obj of objs) {
        const objKey = obj.label.toLowerCase();
        if (!lastVisionState.current.objects?.includes(objKey)) {
          addEvent('📦', `Detected: ${obj.label} (${(obj.score * 100).toFixed(0)}%)`, `obj-${objKey}`);
          sessionStatsRef.current.objectsDetected.add(obj.label);

          // React to specific objects (only if vision reactions are allowed for this mode)
          const reactionKey = objKey.includes('phone') || objKey.includes('cell') ? 'phone'
                            : objKey.includes('cup') || objKey.includes('mug')    ? 'cup'
                            : objKey.includes('bottle')                           ? 'bottle'
                            : objKey.includes('book')                             ? 'book'
                            : objKey.includes('laptop')                           ? 'laptop'
                            : null;
          if (reactionKey && VISION_REACTIONS[reactionKey]) {
            speakVisionReaction(pickRandom(VISION_REACTIONS[reactionKey]), 'gesture');
          }
        }
      }
    }

    // Update prev state
    lastVisionState.current = {
      smiling:    face?.smiling || false,
      eyeContact: face?.eyeContact ?? true,
      gesture:    gest?.name || null,
      objects:    objs?.map(o => o.label.toLowerCase()) || [],
    };
  }, [vision.faceData, vision.gesture, vision.detectedObjects, vision.isReady, callActive, mode, addEvent, speech, character, chat.isThinking]);

  // ── Start / stop camera stream ─────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addEvent('⚠️', 'Camera blocked: requires HTTPS', 'cam-err');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false, // Audio handled by useSpeech
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('[LiveAvatarChat] Video play error:', e));
      }
      setCameraOn(true);
      addEvent('📷', 'Camera active', 'cam-on');
    } catch (err) {
      console.error('[LiveAvatarChat] Camera error:', err);
      addEvent('⚠️', `Camera error: ${err.name || 'access denied'}`, 'cam-error');
    }
  }, [addEvent]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  }, []);

  // Synchronize stream with video element whenever cameraOn changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (cameraOn && streamRef.current) {
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      video.play().catch(e => console.warn('[LiveAvatarChat] Video play error:', e));
    } else if (!cameraOn && video.srcObject) {
      video.srcObject = null;
    }
  }, [cameraOn]);

  // ── Mic toggle ─────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (micOn) {
      clearTimeout(restartTimerRef.current);
      speech.stopListening();
      setMicOn(false);
      character.setState('idle');
      addEvent('🎤', 'Microphone muted', 'mic-off');
    } else {
      speech.startListening();
      setMicOn(true);
      character.setState('listening');
      addEvent('🎤', 'Microphone active', 'mic-on');
    }
  }, [micOn, speech, character, addEvent]);

  // ── Camera toggle ──────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    if (cameraOn) {
      stopCamera();
      addEvent('📷', 'Camera turned off', 'cam-off');
    } else {
      startCamera();
      addEvent('📷', 'Camera turned on', 'cam-on');
    }
  }, [cameraOn, startCamera, stopCamera, addEvent]);

  // ── Start call ─────────────────────────────────────────────
  const startCall = useCallback(async () => {
    setCallActive(true);
    setElapsed(0);
    setEvents([]);
    sessionStatsRef.current = {
      smileCount: 0,
      eyeContactLost: 0,
      gestureCount: 0,
      objectsDetected: new Set(),
      messagesExchanged: 0,
    };
    lastVisionState.current = { smiling: false, eyeContact: true, gesture: null, objects: [] };

    // Start camera
    await startCamera();

    // Enable mic state, but DO NOT start listening yet:
    // Speak the greeting first; onSpeakEnd will safely engage listening with a cooldown.
    // This prevents the microphone from hearing the greeting and triggering an echo response.
    setMicOn(true);
    micOnRef.current = true;

    // Timer
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);

    // Greeting — personalized with user's name and goal
    character.triggerGreeting();
    addEvent('📞', 'Call started', 'call-start');

    const goalMap = {
      interview:  'interview skills',
      speaking:   'public speaking',
      leadership: 'leadership communication',
      casual:     'chatting',
    };
    const goalLabel = goalMap[profile?.goal] || 'confidence';

    const greeting = mode === 'interview'
      ? `Welcome, ${userName}! I'm your mock interviewer today. I'll evaluate your delivery as well as your answers. Let's begin — tell me about yourself and the role you're preparing for.`
      : mode === 'vision'
      ? `Hey ${userName}! Vision sandbox is active. I'll describe everything I can see through your camera — try holding up objects, making gestures, or changing expressions!`
      : `Hey ${userName}! I'm your AI coach. ${profile?.goal ? `I know you're working on ${goalLabel} — let's focus on that today.` : "I can see you through the camera and I'll give you real-time feedback."} Let's get started!`;

    setTimeout(() => {
      speech.speak(greeting);
      character.setState('talking');
    }, 600);
  }, [startCamera, speech, character, mode, addEvent, profile, userName]);

  // ── End call ───────────────────────────────────────────────
  const endCall = useCallback(() => {
    setCallActive(false);
    clearInterval(timerRef.current);
    clearTimeout(restartTimerRef.current);

    // Stop everything
    stopCamera();
    speech.stopListening();
    speech.cancel();
    setMicOn(false);
    character.setState('idle');

    addEvent('📞', 'Call ended', 'call-end');
    setShowSummary(true);
  }, [stopCamera, speech, character, addEvent]);

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(subtitleTimerRef.current);
      clearTimeout(restartTimerRef.current);
      stopCamera();
      speech.stopListening();
      speech.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll events log
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // ── Compute session stats for summary ──────────────────────
  const sessionStats = useMemo(() => ({
    duration:    formatTime(elapsed),
    smiles:      sessionStatsRef.current.smileCount,
    eyeLost:     sessionStatsRef.current.eyeContactLost,
    gestures:    sessionStatsRef.current.gestureCount,
    objects:     sessionStatsRef.current.objectsDetected.size,
    messages:    sessionStatsRef.current.messagesExchanged,
  }), [elapsed, showSummary]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════

  // Pre-call landing
  if (!callActive && !showSummary) {
    return (
      <div className="live-page">
        <div className="live-topbar">
          <div className="live-topbar-left">
            <span className="live-topbar-title">Live AI Video Chat</span>
            <span className="live-gemini-badge">
              <span className="live-gemini-dot" />
              ✨ Gemini AI Powered
            </span>
          </div>
        </div>

        <div className="live-grid" style={{ placeItems: 'center' }}>
          <div className="live-tile live-tile--avatar" style={{ gridColumn: '1 / -1', maxWidth: 600, width: '100%', height: 420 }}>
            <AICharacter state={character.state} speech={speech} />
          </div>
        </div>

        {/* Profile banner */}
        {profile?.name && (
          <div className="live-profile-banner">
            <div className="live-profile-avatar">{profile.name.charAt(0).toUpperCase()}</div>
            <div className="live-profile-info">
              <span className="live-profile-name">Ready, {profile.name}?</span>
              <span className="live-profile-goal">
                {profile.goal === 'interview'  ? '💼 Interview Prep mode' :
                 profile.goal === 'speaking'   ? '🎤 Public Speaking mode' :
                 profile.goal === 'leadership' ? '🚀 Leadership mode' :
                 profile.goal === 'casual'     ? '💬 Free Chat mode' :
                 '🎯 Coaching mode'}
                {profile.experienceLevel ? ` · ${profile.experienceLevel.charAt(0).toUpperCase() + profile.experienceLevel.slice(1)}` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Mode selector + Start button */}
        <div className="live-controls" style={{ flexDirection: 'column', gap: 16 }}>
          <div className="live-mode-selector">
            {MODES.map(m => (
              <button
                key={m.id}
                className={`live-mode-btn${mode === m.id ? ' live-mode-btn--active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button className="live-ctrl-btn live-ctrl-btn--active" onClick={startCall} style={{ padding: '14px 48px', fontSize: 15 }}>
            <svg className="live-ctrl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" />
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span className="live-ctrl-label">Start Live Session</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="live-page">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="live-topbar">
        <div className="live-topbar-left">
          <div className="live-call-indicator">
            <span className="live-call-dot" />
            LIVE
          </div>
          <span className="live-call-timer">{formatTime(elapsed)}</span>
          <span className="live-topbar-title">ConfidenceAI Live</span>
          <span className="live-gemini-badge">
            <span className="live-gemini-dot" />
            ✨ Gemini Active
          </span>
        </div>
        <div className="live-topbar-right">
          {vision.isReady && <span className="live-fps-badge">Vision: {vision.fps} FPS</span>}
          {vision.isLoading && <span className="live-fps-badge">🔄 Loading AI Vision…</span>}
          <div className="live-mode-selector">
            {MODES.map(m => (
              <button
                key={m.id}
                className={`live-mode-btn${mode === m.id ? ' live-mode-btn--active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main body (grid + text chat drawer) ─────────────── */}
      <div className="live-body">
        <div className={`live-grid${chatOpen ? ' live-grid--with-chat' : ''}`}>
        {/* User webcam tile */}
        <div className={`live-tile live-tile--user${micOn && speech.micAmplitude > 0.1 ? ' live-tile--speaking' : ''}`}>
          <video
            ref={videoRef}
            className="live-user-video"
            autoPlay
            playsInline
            muted
            onLoadedMetadata={(e) => {
              e.currentTarget.play().catch(err => console.warn('Autoplay error:', err));
            }}
            style={{ display: cameraOn ? 'block' : 'none' }}
          />
          <canvas
            ref={canvasRef}
            className="live-user-canvas"
            style={{ display: cameraOn && hudOn ? 'block' : 'none' }}
          />
          {!cameraOn && (
            <div className="live-cam-off">
              <div className="live-cam-off-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M16.3 5H4.7C3.76 5 3 5.76 3 6.7v10.6C3 18.24 3.76 19 4.7 19h11.6c.94 0 1.7-.76 1.7-1.7v-3.58l4 3.11V7.17l-4 3.11V6.7C18 5.76 17.24 5 16.3 5Z" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </div>
              Camera off
            </div>
          )}

          <div className="live-tile-label">
            <span className="live-tile-label-dot" style={{ background: cameraOn ? 'var(--success)' : 'var(--text-muted)' }} />
            You
          </div>

          {/* Vision HUD pills */}
          {hudOn && vision.isReady && (
            <div className="live-vision-hud">
              {vision.faceData && (
                <>
                  <div className={`live-hud-pill ${vision.faceData.eyeContact ? 'live-hud-pill--face' : 'live-hud-pill--warn'}`}>
                    <span className="live-hud-icon">{vision.faceData.eyeContact ? '👁️' : '👀'}</span>
                    {vision.faceData.eyeContact ? 'Eye Contact ✓' : 'Eye Contact ✗'}
                  </div>
                  <div className={`live-hud-pill ${vision.faceData.smiling ? 'live-hud-pill--face' : 'live-hud-pill--face'}`}>
                    <span className="live-hud-icon">{vision.faceData.smiling ? '😊' : '😐'}</span>
                    {vision.faceData.smiling ? 'Smiling' : 'Neutral'}
                  </div>
                </>
              )}
              {vision.gesture && (
                <div className="live-hud-pill live-hud-pill--gesture">
                  <span className="live-hud-icon">🤚</span>
                  {vision.gesture.label}
                </div>
              )}
              {vision.detectedObjects?.map((obj, i) => (
                <div key={`${obj.label}-${i}`} className="live-hud-pill live-hud-pill--object">
                  <span className="live-hud-icon">📦</span>
                  {obj.label} {(obj.score * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          )}

          {/* Audio level ring */}
          {micOn && (
            <div className={`live-audio-ring${speech.micAmplitude > 0.1 ? ' live-audio-ring--active' : ''}`}>
              <div
                className="live-audio-ring-inner"
                style={{ transform: `scale(${0.5 + (speech.micAmplitude || 0) * 0.5})` }}
              />
            </div>
          )}

          {/* Vision loading overlay */}
          {cameraOn && vision.isLoading && (
            <div className="live-loading-overlay">
              <div className="live-loading-spinner" />
              <div className="live-loading-text">Loading AI Vision Models…</div>
              <div className="live-loading-subtext">Face • Gesture • Object detection</div>
            </div>
          )}

          {/* Event log */}
          {events.length > 0 && (
            <div className="live-event-log">
              {events.slice(-6).map(ev => (
                <div key={ev.id} className="live-event-item">
                  <span className="live-event-time">{ev.time}</span>
                  <span>{ev.icon}</span>
                  <span className="live-event-text">{ev.text}</span>
                </div>
              ))}
              <div ref={eventsEndRef} />
            </div>
          )}
        </div>

        {/* Avatar tile */}
        <div className={`live-tile live-tile--avatar${speech.isSpeaking ? ' live-tile--speaking' : ''}`}>
          <AICharacter state={character.state} speech={speech} />

          <div className="live-tile-label">
            <span className="live-tile-label-dot" style={{ background: 'var(--accent)' }} />
            AI Mentor
          </div>

          {/* Avatar subtitle */}
          {subtitle && (
            <div className={`live-subtitle-bar${chat.isThinking ? ' live-subtitle-bar--thinking' : ''}`}>
              {chat.isThinking ? 'Thinking…' : subtitle}
            </div>
          )}
        </div>
      </div>

        {/* ── Slide-in Chat Drawer ───────────────────────────── */}
        {chatOpen && (
          <aside className="live-chat-drawer" aria-label="AI Live Chat">
            <div className="live-chat-header">
              <div className="live-chat-header-info">
                <span className="live-chat-header-title">💬 Live Session Chat</span>
                <span className="live-chat-gemini-pill">
                  <span className="live-gemini-dot" />
                  Gemini LLM
                </span>
              </div>
              <button
                type="button"
                className="live-chat-close-btn"
                onClick={() => setChatOpen(false)}
                title="Close Chat"
                aria-label="Close Chat"
              >
                ✕
              </button>
            </div>

            {/* Quick suggestions */}
            <div className="live-chat-quick-prompts">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="live-chat-quick-btn"
                  onClick={() => handleSendQuickPrompt(prompt)}
                  disabled={chat.isThinking}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Messages list */}
            <div className="live-chat-messages">
              {chat.messages.map((m) => {
                const isUser = m.role === 'user';
                const displayText = isUser
                  ? m.text.replace(/^\[Vision context:[^\]]+\]\s*/i, '')
                  : m.text;
                if (!displayText && m.streaming) return null;

                return (
                  <div
                    key={m.id}
                    className={`live-chat-bubble ${isUser ? 'live-chat-bubble--user' : 'live-chat-bubble--mentor'}`}
                  >
                    <div className="live-chat-bubble-author">
                      {isUser ? '👤 You' : '🤖 AI Mentor'}
                      {m.emotion && !isUser && (
                        <span className="live-chat-bubble-tag">{m.emotion}</span>
                      )}
                    </div>
                    <div className="live-chat-bubble-text">
                      {displayText}
                      {m.streaming && <span className="live-chat-cursor">▍</span>}
                    </div>
                  </div>
                );
              })}
              {chat.isThinking && (
                <div className="live-chat-bubble live-chat-bubble--mentor live-chat-bubble--thinking">
                  <span className="live-chat-dot" />
                  <span className="live-chat-dot" />
                  <span className="live-chat-dot" />
                  <span style={{ marginLeft: 6, fontSize: 12 }}>Gemini is thinking…</span>
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Text input form */}
            <form className="live-chat-input-bar" onSubmit={handleSendText}>
              <input
                type="text"
                className="live-chat-input"
                placeholder="Ask Gemini or type your response…"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={chat.isThinking}
              />
              <button
                type="submit"
                className="live-chat-send-btn"
                disabled={!textInput.trim() || chat.isThinking}
                title="Send to Gemini"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* ── Bottom controls ─────────────────────────────────── */}
      <div className="live-controls">
        {/* Mic toggle */}
        <button
          className={`live-ctrl-btn${micOn ? ' live-ctrl-btn--active' : ' live-ctrl-btn--muted'}`}
          onClick={toggleMic}
          title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          <svg className="live-ctrl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {micOn ? (
              <>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </>
            ) : (
              <>
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </>
            )}
          </svg>
          <span className="live-ctrl-label">{micOn ? 'Mic On' : 'Mic Off'}</span>
        </button>

        {/* Camera toggle */}
        <button
          className={`live-ctrl-btn${cameraOn ? ' live-ctrl-btn--active' : ' live-ctrl-btn--muted'}`}
          onClick={toggleCamera}
          title={cameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          <svg className="live-ctrl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {cameraOn ? (
              <path d="M16.3 5H4.7C3.76 5 3 5.76 3 6.7v10.6C3 18.24 3.76 19 4.7 19h11.6c.94 0 1.7-.76 1.7-1.7v-3.58l4 3.11V7.17l-4 3.11V6.7C18 5.76 17.24 5 16.3 5Z" />
            ) : (
              <>
                <path d="M16.3 5H4.7C3.76 5 3 5.76 3 6.7v10.6C3 18.24 3.76 19 4.7 19h11.6c.94 0 1.7-.76 1.7-1.7v-3.58l4 3.11V7.17l-4 3.11V6.7C18 5.76 17.24 5 16.3 5Z" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            )}
          </svg>
          <span className="live-ctrl-label">{cameraOn ? 'Cam On' : 'Cam Off'}</span>
        </button>

        {/* Vision HUD toggle */}
        <button
          className={`live-ctrl-btn${hudOn ? ' live-ctrl-btn--active' : ''}`}
          onClick={() => setHudOn(!hudOn)}
          title={hudOn ? 'Hide Vision HUD' : 'Show Vision HUD'}
        >
          <svg className="live-ctrl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="live-ctrl-label">Vision HUD</span>
        </button>

        {/* Text Chat Drawer toggle */}
        <button
          className={`live-ctrl-btn${chatOpen ? ' live-ctrl-btn--active' : ''}`}
          onClick={() => setChatOpen(!chatOpen)}
          title={chatOpen ? 'Close Chat Panel' : 'Open Text Chat'}
        >
          <svg className="live-ctrl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="live-ctrl-label">{chatOpen ? 'Close Chat' : 'Text Chat'}</span>
        </button>

        {/* End call */}
        <button
          className="live-ctrl-btn live-ctrl-btn--danger"
          onClick={endCall}
          title="End Call"
        >
          <svg className="live-ctrl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91" />
          </svg>
          <span className="live-ctrl-label">End Call</span>
        </button>
      </div>

      {/* ── End-call summary modal ──────────────────────────── */}
      {showSummary && (
        <div className="live-summary-overlay" onClick={() => { setShowSummary(false); }}>
          <div className="live-summary-modal" onClick={e => e.stopPropagation()}>
            <div className="live-summary-title">Session Complete 🎉</div>
            <div className="live-summary-subtitle">
              Here's how your {MODES.find(m => m.id === mode)?.label || 'session'} went.
            </div>

            <div className="live-summary-stats">
              <div className="live-summary-stat">
                <div className="live-summary-stat-value">{sessionStats.duration}</div>
                <div className="live-summary-stat-label">Duration</div>
              </div>
              <div className="live-summary-stat">
                <div className="live-summary-stat-value">{sessionStats.smiles}</div>
                <div className="live-summary-stat-label">Smiles Detected</div>
              </div>
              <div className="live-summary-stat">
                <div className="live-summary-stat-value">{sessionStats.eyeLost}</div>
                <div className="live-summary-stat-label">Eye Contact Drops</div>
              </div>
              <div className="live-summary-stat">
                <div className="live-summary-stat-value">{sessionStats.gestures}</div>
                <div className="live-summary-stat-label">Gestures</div>
              </div>
              <div className="live-summary-stat">
                <div className="live-summary-stat-value">{sessionStats.objects}</div>
                <div className="live-summary-stat-label">Objects Spotted</div>
              </div>
              <div className="live-summary-stat">
                <div className="live-summary-stat-value">{sessionStats.messages}</div>
                <div className="live-summary-stat-label">Exchanges</div>
              </div>
            </div>

            {events.length > 0 && (
              <div className="live-summary-events">
                <div className="live-summary-events-title">Detection Timeline</div>
                {events.slice(-15).map(ev => (
                  <div key={ev.id} className="live-summary-event-row">
                    <span className="live-event-time">{ev.time}</span>
                    <span>{ev.icon}</span>
                    <span>{ev.text}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="live-summary-close-btn" onClick={() => { setShowSummary(false); }}>
              Done — Back to Call Screen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
