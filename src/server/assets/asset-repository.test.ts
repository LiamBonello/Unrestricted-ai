import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import { AssetRepository } from './asset-repository';

let db: DatabaseSync;
let repository: AssetRepository;

beforeEach(() => {
  db = createDatabase(':memory:');
  runMigrations(db);
  repository = new AssetRepository(db);
  db.prepare(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
  ).run('c1', 'Images', '2026-09-18T10:00:00.000Z', '2026-09-18T10:00:00.000Z');
});

afterEach(() => {
  db.close();
});

describe('AssetRepository', () => {
  it('round-trips image asset metadata', () => {
    repository.create({
      id: 'a1',
      conversationId: 'c1',
      source: 'generated',
      storagePath: 'images/a1.png',
      mimeType: 'image/png',
      width: 768,
      height: 768,
      createdAt: '2026-09-18T10:00:01.000Z',
    });

    expect(repository.getById('a1')).toEqual({
      id: 'a1',
      conversationId: 'c1',
      source: 'generated',
      storagePath: 'images/a1.png',
      mimeType: 'image/png',
      width: 768,
      height: 768,
      createdAt: '2026-09-18T10:00:01.000Z',
    });
  });

  it('cascades asset metadata when its conversation is deleted', () => {
    repository.create({
      id: 'a1',
      conversationId: 'c1',
      source: 'upload',
      storagePath: 'images/a1.webp',
      mimeType: 'image/webp',
      width: null,
      height: null,
      createdAt: '2026-09-18T10:00:01.000Z',
    });

    db.prepare('DELETE FROM conversations WHERE id = ?').run('c1');

    expect(repository.getById('a1')).toBeNull();
  });
});
