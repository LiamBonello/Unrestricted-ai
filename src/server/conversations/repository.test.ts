import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import { ConversationRepository } from './repository';

let db: DatabaseSync;
let repository: ConversationRepository;

beforeEach(() => {
  db = createDatabase(':memory:');
  runMigrations(db);
  repository = new ConversationRepository(db);
});

afterEach(() => {
  db.close();
});

describe('ConversationRepository', () => {
  it('maps stored conversation messages into domain objects', () => {
    repository.createConversation({
      id: 'c1',
      title: 'Test',
      createdAt: '2026-09-17T10:00:00.000Z',
      updatedAt: '2026-09-17T10:00:00.000Z',
    });

    repository.insertMessage({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello' }],
      createdAt: '2026-09-17T10:00:01.000Z',
    });
    repository.insertMessage({
      id: 'm2',
      conversationId: 'c1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hi' }],
      createdAt: '2026-09-17T10:00:02.000Z',
    });

    expect(repository.getConversation('c1')?.messages).toEqual([
      expect.objectContaining({ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }),
      expect.objectContaining({ role: 'assistant', parts: [{ type: 'text', text: 'Hi' }] }),
    ]);
  });
  it('round-trips image message parts without exposing storage paths', () => {
    repository.createConversation({
      id: 'c-image',
      title: 'Image test',
      createdAt: '2026-09-18T10:00:00.000Z',
      updatedAt: '2026-09-18T10:00:00.000Z',
    });

    repository.insertMessage({
      id: 'm-image',
      conversationId: 'c-image',
      role: 'assistant',
      parts: [{ type: 'image', assetId: 'asset-1', alt: 'Generated image' }],
      createdAt: '2026-09-18T10:00:01.000Z',
    });

    expect(repository.getConversation('c-image')?.messages[0]?.parts).toEqual([
      { type: 'image', assetId: 'asset-1', alt: 'Generated image' },
    ]);
  });

});
