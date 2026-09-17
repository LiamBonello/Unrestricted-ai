import type { ChatTransportEvent } from '@/shared/chat';
import type { Conversation, ConversationSummary } from '@/shared/conversation';

function isTransportEvent(value: unknown): value is ChatTransportEvent {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.type === 'conversation') return typeof record.conversationId === 'string';
  if (record.type === 'delta') return typeof record.text === 'string';
  if (record.type === 'done') return typeof record.messageId === 'string';
  if (record.type === 'error') return typeof record.message === 'string';
  return false;
}

export function parseNdjsonLine(line: string): ChatTransportEvent {
  const value: unknown = JSON.parse(line);
  if (!isTransportEvent(value)) throw new Error('Invalid chat stream event');
  return value;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await fetch('/api/conversations', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load conversations');
  return (await response.json()) as ConversationSummary[];
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load conversation');
  return (await response.json()) as Conversation;
}

export async function* streamChat(input: {
  conversationId?: string;
  message: string;
  signal: AbortSignal;
}): AsyncIterable<ChatTransportEvent> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: input.conversationId, message: input.message }),
    signal: input.signal,
  });
  if (!response.ok || !response.body) throw new Error('Could not start generation');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = parseNdjsonLine(line);
        if (event.type === 'error') throw new Error(event.message);
        yield event;
      }

      if (done) break;
    }

    if (buffer.trim()) {
      const event = parseNdjsonLine(buffer);
      if (event.type === 'error') throw new Error(event.message);
      yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
