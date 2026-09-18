import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from './database';
import { runMigrations } from './migrate';

let db: DatabaseSync | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

describe('runMigrations', () => {
  it('creates the schema once', () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    runMigrations(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['schema_migrations', 'conversations', 'messages', 'assets']),
    );

    const row = db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as { count: number };
    expect(row.count).toBe(2);
  });
});
