/**
 * CharacterFallback.js
 * ─────────────────────────────────────────────────────────────
 * Fallback UI shown when:
 *  • WebGL is unavailable
 *  • Character fails to initialize
 *  • An error occurs during rendering
 *
 * Matches the existing app's dark design system.
 * ─────────────────────────────────────────────────────────────
 */

import React from 'react';

export function CharacterFallback({ reason = 'unavailable' }) {
  const messages = {
    loading:     { icon: '⟳', title: 'Initializing AI Mentor…',        sub: 'Setting up your virtual mentor. This takes just a moment.' },
    unavailable: { icon: '🤖', title: 'AI Mentor Temporarily Unavailable', sub: 'WebGL is not supported in this browser. Please try Chrome or Firefox.' },
    error:       { icon: '⚠️', title: 'AI Mentor Could Not Load',        sub: 'An error occurred while initializing. The rest of the app is unaffected.' },
  };

  const { icon, title, sub } = messages[reason] || messages.unavailable;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '300px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '32px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '40px', lineHeight: 1, marginBottom: '4px' }}>
        {reason === 'loading' ? (
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '36px' }}>◌</span>
        ) : icon}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
        {title}
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '220px' }}>
        {sub}
      </div>
      {reason === 'loading' && (
        <div style={{
          marginTop: '8px',
          width: '120px',
          height: '2px',
          background: 'var(--border)',
          borderRadius: '99px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: 'var(--accent-gradient)',
            borderRadius: '99px',
            animation: 'shimmer 1.5s ease-in-out infinite',
            backgroundSize: '200% 100%',
          }} />
        </div>
      )}
    </div>
  );
}

export default CharacterFallback;
