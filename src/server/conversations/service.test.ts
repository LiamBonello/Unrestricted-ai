import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import { ConversationRepository } from './repository';
import { ConversationService } from './service';

let db: DatabaseSync;
let service: ConversationService;

beforeEach(() => {
  db = createDatabase(':memory:');
  runMigrations(db);
  const ids = ['c1', 'm1'];
  service = new ConversationService(
    new ConversationRepository(db),
    () => ids.shift() ?? 'fallback-id',
    () => '2026-09-17T10:00:00.000Z',
  );
});

afterEach(() => {
  db.close();
});

describe('ConversationService', () => {
  it('rejects whitespace-only messages', () => {
    const conversation = service.createConversation();
    expect(() => service.appendTextMessage(conversation.id, 'user', '   ')).toThrow(
      'Message text cannot be empty',
    );
  });

  it('creates valid messages with IDs and timestamps', () => {
    const conversation = service.createConversation();
    const message = service.appendTextMessage(conversation.id, 'user', ' Hello ');

    expect(message).toEqual({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello' }],
      createdAt: '2026-09-17T10:00:00.000Z',
    });
  });
});
