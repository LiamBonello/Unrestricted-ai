import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import { ConversationRepository } from './repository';

let db: Database.Database;
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
});
