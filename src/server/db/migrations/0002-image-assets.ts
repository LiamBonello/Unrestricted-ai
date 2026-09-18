import type { Migration } from './types';

export const imageAssetsMigration: Migration = {
  version: 2,
  name: 'image assets',
  sql: `
    CREATE TABLE assets (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK (source IN ('upload', 'generated')),
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
      width INTEGER,
      height INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE INDEX assets_conversation_created_idx
      ON assets(conversation_id, created_at, id);
  `,
};
