import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { ConversationRepository } from '@/server/conversations/repository';
import { ConversationService } from '@/server/conversations/service';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import type { LLMProvider, LLMStreamRequest, LLMStreamEvent } from '@/server/providers/types';
import { ResourceManager } from '@/server/resources/resource-manager';
import { ChatOrchestrator } from './chat-orchestrator';

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function createHarness(provider: LLMProvider) {
  db = createDatabase(':memory:');
  runMigrations(db);
  const ids = ['c1', 'u1', 'a1', 'u2', 'a2'];
  const conversations = new ConversationService(
    new ConversationRepository(db),
    () => ids.shift() ?? 'fallback-id',
    () => '2026-09-17T10:00:00.000Z',
  );
  const resources = new ResourceManager();
  const orchestrator = new ChatOrchestrator(conversations, provider, resources, 'System prompt');
  return { conversations, resources, orchestrator };
}

class InspectingProvider implements LLMProvider {
  readonly id = 'inspect';
  readonly requests: LLMStreamRequest[] = [];

  constructor(
    private readonly beforeStream?: (request: LLMStreamRequest) => void,
    private readonly abortAfterFirstDelta = false,
  ) {}

  async *stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent> {
    this.requests.push(request);
    this.beforeStream?.(request);
    yield { type: 'text-delta', text: 'Hello' };
    if (this.abortAfterFirstDelta) {
      throw new DOMException('Generation aborted', 'AbortError');
    }
    if (request.signal?.aborted) throw new DOMException('Generation aborted', 'AbortError');
    yield { type: 'text-delta', text: ' there' };
    yield { type: 'done' };
  }
}

async function collect(stream: AsyncIterable<unknown>): Promise<unknown[]> {
  const events: unknown[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('ChatOrchestrator', () => {
  it('creates a conversation and emits it before provider deltas', async () => {
    const { orchestrator } = createHarness(new InspectingProvider());
    const events = await collect(orchestrator.stream({ text: 'Hi' }));

    expect(events[0]).toEqual({ type: 'conversation', conversationId: 'c1' });
    expect(events[1]).toEqual({ type: 'delta', text: 'Hello' });
  });

  it('persists the user message before provider consumption and assistant only after completion', async () => {
    const conversationsRef: { current: ConversationService | null } = { current: null };
    const provider = new InspectingProvider(() => {
      const conversations = conversationsRef.current;
      if (!conversations) throw new Error('Conversation service was not initialized');
      const stored = conversations.getConversation('c1');
      expect(stored?.messages).toHaveLength(1);
      expect(stored?.messages[0]).toMatchObject({ role: 'user', parts: [{ type: 'text', text: 'Hi' }] });
    });
    const harness = createHarness(provider);
    conversationsRef.current = harness.conversations;

    const events = await collect(harness.orchestrator.stream({ text: 'Hi' }));
    expect(events.at(-1)).toEqual({ type: 'done', messageId: 'a1' });
    expect(harness.conversations.getConversation('c1')?.messages).toHaveLength(2);
    expect(harness.conversations.getConversation('c1')?.messages[1]).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hello there' }],
    });
    expect(harness.resources.getActiveCapability()).toBeNull();
  });

  it('sends the system prompt and full persisted history on later turns', async () => {
    const provider = new InspectingProvider();
    const { orchestrator } = createHarness(provider);

    await collect(orchestrator.stream({ text: 'First' }));
    await collect(orchestrator.stream({ conversationId: 'c1', text: 'Second' }));

    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1].messages).toEqual([
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Hello there' },
      { role: 'user', content: 'Second' },
    ]);
  });

  it('does not persist a completed assistant message when the provider aborts', async () => {
    const { conversations, resources, orchestrator } = createHarness(new InspectingProvider(undefined, true));

    await expect(collect(orchestrator.stream({ text: 'Hi' }))).rejects.toMatchObject({ name: 'AbortError' });

    expect(conversations.getConversation('c1')?.messages).toEqual([
      expect.objectContaining({ role: 'user' }),
    ]);
    expect(resources.getActiveCapability()).toBeNull();
  });
});
