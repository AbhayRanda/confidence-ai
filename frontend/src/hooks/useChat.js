/**
 * useChat.js  v2
 * ─────────────────────────────────────────────────────────────
 * Custom React hook managing chat with the AI coaching backend.
 *
 * Steps implemented:
 *   2 — SSE streaming: tokens stream progressively, typewriter effect
 *   4 — Conversation history: last 6 messages sent with every request
 *
 * Usage:
 *   const chat = useChat({ getAnalysisContext, character, speech });
 *
 *   chat.messages        — [{id, role, text, emotion, ts, streaming}]
 *   chat.isThinking      — true while waiting for first token
 *   chat.sendMessage(txt)— sends text, streams response back
 *   chat.clearHistory()  — reset conversation
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useRef } from 'react';
import { useUserProfile, buildProfilePrompt } from './useUserProfile';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

// ── Emotion → character state mapping ────────────────────────
const EMOTION_TO_STATE = {
  happy:       'happy',
  encouraging: 'encouraging',
  gesture:     'gesture',
  thinking:    'thinking',
  greeting:    'greeting',
  idle:        'idle',
};

// Regex to parse [EMOTION:xxx] tag from streamed text
const EMOTION_TAG_RE = /\[EMOTION:(\w+)\]\s*$/i;

let msgIdCounter = 0;
const newId = () => ++msgIdCounter;

export function useChat({ getAnalysisContext = null, character = null, speech = null, systemPrompt = null } = {}) {
  // Load user profile and build the context string once
  const { profile } = useUserProfile();
  const profilePrompt = buildProfilePrompt(profile);

  // Build a personalized initial greeting
  const initialGreeting = (() => {
    if (!profile?.name) {
      return "Hi! I'm your AI confidence coach. Ask me anything about speaking, posture, eye contact, or check your latest results!";
    }
    const goalMap = {
      interview:  'interview prep',
      speaking:   'public speaking',
      leadership: 'leadership communication',
      casual:     'building everyday confidence',
    };
    const focus = profile.goal ? ` I know you're working on ${goalMap[profile.goal] || profile.goal}.` : '';
    return `Hey ${profile.name}! 👋 I'm your AI coach.${focus} Ask me anything — scores, tips, or just chat!`;
  })();

  const [messages, setMessages]     = useState([
    {
      id:        newId(),
      role:      'mentor',
      text:      initialGreeting,
      emotion:   'greeting',
      ts:        Date.now(),
      streaming: false,
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const abortRef    = useRef(null);

  // Step 4: Rolling conversation history (last 6 exchanges)
  const historyRef  = useRef([]);

  // Track whether streaming is supported (detected on first use)
  const streamSupported = useRef(true);

  // Busy lock and message deduplication to prevent overlapping/double responses
  const isBusyRef      = useRef(false);
  const lastMessageRef = useRef({ text: '', time: 0 });

  // ── Add a fully-formed message ────────────────────────────
  const addMessage = useCallback((role, text, emotion = 'idle', streaming = false) => {
    const msg = { id: newId(), role, text, emotion, ts: Date.now(), streaming };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);


  // Step 4: Build history array for backend
  const buildHistory = useCallback(() => {
    return historyRef.current.slice(-6).map((m) => ({
      role:    m.role === 'user' ? 'user' : 'mentor',
      content: m.text,
    }));
  }, []);

  // ── Step 2: Stream a message via SSE ────────────────────────
  const sendMessageStream = useCallback(async (trimmed) => {
    const token   = localStorage.getItem('token');
    const context = (typeof getAnalysisContext === 'function' ? getAnalysisContext() : null) || null;
    // Prepend profile to the system prompt so Gemini always knows who it's coaching
    const enrichedSystemPrompt = profilePrompt
      ? `${profilePrompt}\n${systemPrompt || ''}`
      : (systemPrompt || undefined);
    const body    = {
      message: trimmed,
      context,
      history:       buildHistory(),   // Step 4
      system_prompt: enrichedSystemPrompt || undefined,
    };

    // Create placeholder streaming message
    const placeholderId = newId();
    const placeholder   = {
      id:        placeholderId,
      role:      'mentor',
      text:      '',
      emotion:   'thinking',
      ts:        Date.now(),
      streaming: true,
    };
    setMessages((prev) => [...prev, placeholder]);

    abortRef.current = new AbortController();
    let fullText     = '';
    let firstToken   = true;

    try {
      const res = await fetch(`${API_BASE_URL}/chat/stream`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body:   JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`Stream error: ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') {
            // Stream complete — strip emotion tag, finalise
            const emotionMatch = fullText.match(EMOTION_TAG_RE);
            const emotion      = emotionMatch
              ? (emotionMatch[1].toLowerCase() in EMOTION_TO_STATE
                  ? emotionMatch[1].toLowerCase() : 'gesture')
              : 'gesture';
            const cleanText = fullText.replace(EMOTION_TAG_RE, '').trim();

            // Finalise the streaming message
            setMessages((prev) => prev.map((m) =>
              m.id === placeholderId
                ? { ...m, text: cleanText, emotion, streaming: false }
                : m
            ));

            // Update character state
            character?.setState(EMOTION_TO_STATE[emotion] || 'gesture');

            // Step 4: Save to history
            historyRef.current.push({ role: 'mentor', text: cleanText });

            // Speak full response
            if (cleanText) speech?.speak(cleanText);
            return;
          }

          if (data === '[ERROR]') {
            throw new Error('Stream error from server');
          }

          // Unescape newlines (server encodes \n as \\n)
          const token = data.replace(/\\n/g, '\n');
          fullText   += token;

          // Transition THINKING → TALKING on first token
          if (firstToken) {
            firstToken = false;
            setIsThinking(false);
            character?.setState('talking');
          }

          // Update streaming message in place
          const currentText = fullText.replace(EMOTION_TAG_RE, '').trim();
          setMessages((prev) => prev.map((m) =>
            m.id === placeholderId
              ? { ...m, text: currentText }
              : m
          ));
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') return;
      throw err;
    }
  }, [getAnalysisContext, buildHistory, character, speech]);

  // ── Main send entry point ────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = text?.trim();
    if (!trimmed) return;

    // Reject if chat is currently busy (streaming or fetching response)
    if (isBusyRef.current) {
      console.warn('[useChat] Dropping message because chat is busy:', trimmed);
      return;
    }

    // Deduplicate rapid identical messages within 2.5 seconds
    const now = Date.now();
    if (lastMessageRef.current.text === trimmed && (now - lastMessageRef.current.time < 2500)) {
      console.warn('[useChat] Dropping duplicate message:', trimmed);
      return;
    }
    lastMessageRef.current = { text: trimmed, time: now };

    isBusyRef.current = true;
    setIsThinking(true);
    character?.setState('thinking');

    // Add user message
    addMessage('user', trimmed);
    // Step 4: Track in history
    historyRef.current.push({ role: 'user', text: trimmed });

    // Cancel any ongoing request
    if (abortRef.current) abortRef.current.abort();

    try {
      // Step 2: Try SSE streaming first
      if (streamSupported.current) {
        await sendMessageStream(trimmed);
        return;
      }

      // Fallback: non-streaming /chat
      await _sendMessageFallback(trimmed);

    } catch (err) {
      if (err.name === 'AbortError') return;

      // If streaming failed, retry with non-streaming
      if (streamSupported.current) {
        console.warn('[useChat] Streaming failed, falling back to non-streaming');
        streamSupported.current = false;
        try {
          await _sendMessageFallback(trimmed);
          return;
        } catch { /* fall through to error */ }
      }

      console.error('[useChat] error:', err);
      addMessage('mentor', "Sorry, I couldn't connect right now. Please make sure the server is running.", 'gesture');
      character?.setState('idle');
    } finally {
      setIsThinking(false);
      isBusyRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMessage, sendMessageStream, character]);

  // ── Non-streaming fallback ───────────────────────────────
  const _sendMessageFallback = useCallback(async (trimmed) => {
    const token   = localStorage.getItem('token');
    const context = (typeof getAnalysisContext === 'function' ? getAnalysisContext() : null) || null;
    const enrichedSystemPrompt = profilePrompt
      ? `${profilePrompt}\n${systemPrompt || ''}`
      : (systemPrompt || undefined);
    const body    = {
      message:       trimmed,
      context,
      history:       buildHistory(),
      system_prompt: enrichedSystemPrompt || undefined,
    };

    abortRef.current = new AbortController();
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body:   JSON.stringify(body),
      signal: abortRef.current.signal,
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    const { response, emotion } = data;

    const charState = EMOTION_TO_STATE[emotion] || 'gesture';
    character?.setState(charState);
    addMessage('mentor', response, emotion);
    speech?.speak(response);
    historyRef.current.push({ role: 'mentor', text: response });
    setIsThinking(false);
  }, [getAnalysisContext, buildHistory, character, speech, addMessage]);

  // ── Clear chat history ─────────────────────────────────────
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    const resetMsg = profile?.name
      ? `Chat cleared, ${profile.name}! What would you like to work on next?`
      : 'Chat cleared! What would you like to work on?';
    setMessages([{
      id:        newId(),
      role:      'mentor',
      text:      resetMsg,
      emotion:   'greeting',
      ts:        Date.now(),
      streaming: false,
    }]);
  }, [profile]);

  return {
    messages,
    isThinking,
    sendMessage,
    clearHistory,
  };
}

export default useChat;
