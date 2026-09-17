import { describe, expect, it } from 'vitest';
import type { Conversation } from '@/shared/conversation';
import { toLLMMessages } from './to-llm-messages';

const conversation: Conversation = {
  id: 'c1',
  title: 'Test',
  createdAt: '2026-09-17T10:00:00.000Z',
  updatedAt: '2026-09-17T10:00:02.000Z',
  messages: [
    {
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello' }],
      createdAt: '2026-09-17T10:00:01.000Z',
    },
    {
      id: 'm2',
      conversationId: 'c1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hi' }],
      createdAt: '2026-09-17T10:00:02.000Z',
    },
  ],
};

describe('toLLMMessages', () => {
  it('maps persisted messages to provider messages with the system prompt first', () => {
    expect(toLLMMessages(conversation, 'You are Unrestricted AI.')).toEqual([
      { role: 'system', content: 'You are Unrestricted AI.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]);
  });

  it('omits a whitespace-only system prompt and persistence metadata', () => {
    const messages = toLLMMessages(conversation, '   ');

    expect(messages).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]);
    expect(messages.every((message) => !('id' in message) && !('conversationId' in message))).toBe(true);
  });
});
