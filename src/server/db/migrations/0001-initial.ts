import type { Migration } from './types';

export const initialMigration: Migration = {
  version: 1,
  name: 'initial conversations and messages',
  sql: `
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      parts_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX messages_conversation_created_idx
      ON messages(conversation_id, created_at, id);
  `,
};
