import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatPanel from './ChatPanel';

// Mock scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe('ChatPanel Component', () => {
  test('renders exactly one thinking indicator when chatbot is streaming/thinking', () => {
    const messages = [
      { id: 1, role: 'user', text: 'Hello', ts: Date.now() },
      { id: 2, role: 'mentor', text: '', emotion: 'thinking', ts: Date.now(), streaming: true },
    ];

    const { container } = render(
      <ChatPanel
        messages={messages}
        isThinking={true}
        isStreaming={true}
      />
    );

    // Verify there is only one typing bubble (.cp-typing), NOT two
    const typingIndicators = container.querySelectorAll('.cp-typing');
    expect(typingIndicators.length).toBe(1);
  });

  test('renders exactly one thinking indicator in non-streaming fallback mode', () => {
    const messages = [
      { id: 1, role: 'user', text: 'Hello', ts: Date.now() },
    ];

    const { container } = render(
      <ChatPanel
        messages={messages}
        isThinking={true}
        isStreaming={false}
      />
    );

    const typingIndicators = container.querySelectorAll('.cp-typing');
    expect(typingIndicators.length).toBe(1);
  });

  test('renders zero thinking indicators when idle', () => {
    const messages = [
      { id: 1, role: 'user', text: 'Hello', ts: Date.now() },
      { id: 2, role: 'mentor', text: 'Hi there!', ts: Date.now(), streaming: false },
    ];

    const { container } = render(
      <ChatPanel
        messages={messages}
        isThinking={false}
        isStreaming={false}
      />
    );

    const typingIndicators = container.querySelectorAll('.cp-typing');
    expect(typingIndicators.length).toBe(0);
  });
});
