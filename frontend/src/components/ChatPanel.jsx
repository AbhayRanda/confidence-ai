/**
 * ChatPanel.jsx
 * ─────────────────────────────────────────────────────────────
 * The AI character voice + chat interaction panel.
 *
 * Props:
 *   messages      {array}    — chat history from useChat
 *   isThinking    {boolean}  — show typing indicator
 *   onSendMessage {function} — send a text/voice message
 *   onClear       {function} — clear chat history
 *   speech        {object}   — useSpeech hook instance
 *   className     {string}
 * ─────────────────────────────────────────────────────────────
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import './ChatPanel.css';

// ── Suggested quick prompts ───────────────────────────────────
const QUICK_PROMPTS = [
  "What was my score?",
  "Give me a tip",
  "How do I improve eye contact?",
  "How do I stop saying um?",
  "Tips for better posture",
  "How fast should I speak?",
];

// ── Emotion icon mapping ──────────────────────────────────────
const EMOTION_ICON = {
  happy:       '😊',
  encouraging: '💪',
  gesture:     '🤌',
  thinking:    '🤔',
  greeting:    '👋',
  idle:        '🤖',
};

// ── Typing indicator ──────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="cp-msg cp-msg--mentor">
      <div className="cp-avatar">🤖</div>
      <div className="cp-bubble cp-bubble--mentor cp-typing">
        <span className="cp-dot" />
        <span className="cp-dot" />
        <span className="cp-dot" />
      </div>
    </div>
  );
}

// ── Single message bubble ─────────────────────────────────────
function Message({ msg }) {
  const isUser   = msg.role === 'user';
  const icon     = isUser ? null : (EMOTION_ICON[msg.emotion] || '🤖');
  const time     = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isEmpty  = !msg.text && msg.streaming;

  return (
    <div className={`cp-msg ${isUser ? 'cp-msg--user' : 'cp-msg--mentor'}`}>
      {!isUser && <div className="cp-avatar" aria-hidden="true">{icon}</div>}
      <div className={`cp-bubble ${isUser ? 'cp-bubble--user' : 'cp-bubble--mentor'}${msg.streaming ? ' cp-bubble--streaming' : ''}`}>
        {isEmpty ? (
          // Still waiting for first token — show dots
          <div className="cp-typing">
            <span className="cp-dot" /><span className="cp-dot" /><span className="cp-dot" />
          </div>
        ) : (
          <p className="cp-bubble-text">
            {msg.text}
            {/* Step 2: Animated cursor while streaming */}
            {msg.streaming && <span className="cp-stream-cursor" aria-hidden="true">▋</span>}
          </p>
        )}
        {!msg.streaming && <span className="cp-bubble-time">{time}</span>}
      </div>
      {isUser && <div className="cp-avatar cp-avatar--user" aria-hidden="true">🧑</div>}
    </div>
  );
}

// ── Interim transcript badge ──────────────────────────────────
function LiveTranscript({ text }) {
  if (!text) return null;
  return (
    <div className="cp-live-transcript">
      <span className="cp-live-dot" />
      <span className="cp-live-text">{text}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function ChatPanel({
  messages      = [],
  isThinking    = false,
  onSendMessage,
  onClear,
  speech        = null,
  className     = '',
}) {
  const [inputText, setInputText]   = useState('');
  const [showPrompts, setShowPrompts] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Hide quick prompts after first user message
  useEffect(() => {
    if (messages.some((m) => m.role === 'user')) {
      setShowPrompts(false);
    }
  }, [messages]);

  const handleSubmit = useCallback((text) => {
    const t = (text || inputText).trim();
    if (!t) return;
    onSendMessage?.(t);
    setInputText('');
    inputRef.current?.focus();
  }, [inputText, onSendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleMicClick = useCallback(() => {
    if (!speech) return;
    if (speech.isListening) {
      speech.stopListening();
    } else {
      speech.startListening();
    }
  }, [speech]);

  // When STT produces a transcript, fill input and auto-send
  useEffect(() => {
    if (speech?.transcript) {
      setInputText(speech.transcript);
    }
  }, [speech?.transcript]);

  // Auto-submit when STT finishes (isListening goes false and transcript exists)
  const prevListening = useRef(false);
  useEffect(() => {
    if (prevListening.current && !speech?.isListening && speech?.transcript) {
      handleSubmit(speech.transcript);
    }
    prevListening.current = speech?.isListening ?? false;
  }, [speech?.isListening, speech?.transcript, handleSubmit]);

  const canSend = inputText.trim().length > 0 && !isThinking;

  return (
    <div className={`cp-root ${className}`} aria-label="AI Coach Chat">
      {/* Header */}
      <div className="cp-header">
        <div className="cp-header-left">
          <span className="cp-header-dot" />
          <span className="cp-header-title">Chat with Mentor</span>
        </div>
        <div className="cp-header-right">
          {/* TTS mute toggle */}
          {speech?.ttsSupported && (
            <button
              className={`cp-icon-btn ${speech.isMuted ? 'cp-icon-btn--muted' : ''}`}
              onClick={speech.toggleMute}
              title={speech.isMuted ? 'Unmute voice' : 'Mute voice'}
              aria-label={speech.isMuted ? 'Unmute mentor voice' : 'Mute mentor voice'}
            >
              {speech.isMuted ? (
                // Muted icon
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              ) : (
                // Speaker icon
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              )}
            </button>
          )}

          {/* Clear button */}
          <button
            className="cp-icon-btn"
            onClick={onClear}
            title="Clear chat"
            aria-label="Clear chat history"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className="cp-messages" role="log" aria-live="polite">
        {messages.map((msg) => (
          <Message key={msg.id} msg={msg} />
        ))}
        {isThinking && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Live STT transcript */}
      {speech?.isListening && (
        <LiveTranscript text={speech.transcript} />
      )}

      {/* Quick prompts */}
      {showPrompts && (
        <div className="cp-prompts" role="list" aria-label="Quick questions">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              className="cp-prompt-chip"
              onClick={() => handleSubmit(p)}
              disabled={isThinking}
              role="listitem"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="cp-input-row">
        {/* Mic button */}
        {speech?.sttSupported && (
          <button
            id="mic-btn"
            className={`cp-mic-btn ${speech.isListening ? 'cp-mic-btn--active' : ''}`}
            onClick={handleMicClick}
            disabled={isThinking && !speech.isListening}
            title={speech.isListening ? 'Stop listening' : 'Speak to mentor'}
            aria-label={speech.isListening ? 'Stop microphone' : 'Start microphone'}
          >
            {speech.isListening ? (
              // Stop icon
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
            ) : (
              // Mic icon
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
            {speech.isListening && <span className="cp-mic-ring" />}
          </button>
        )}

        {/* Text input */}
        <div className="cp-input-wrap">
          <textarea
            ref={inputRef}
            id="chat-input"
            className="cp-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              speech?.isListening
                ? 'Listening… speak now'
                : 'Ask your mentor anything…'
            }
            rows={1}
            disabled={isThinking}
            aria-label="Chat message input"
          />
        </div>

        {/* Send button */}
        <button
          id="chat-send-btn"
          className="cp-send-btn"
          onClick={() => handleSubmit()}
          disabled={!canSend}
          aria-label="Send message"
          title="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;
