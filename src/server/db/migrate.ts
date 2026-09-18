import type { DatabaseSync } from 'node:sqlite';
import { initialMigration } from './migrations/0001-initial';
import { imageAssetsMigration } from './migrations/0002-image-assets';
import type { Migration } from './migrations/types';

const migrations: readonly Migration[] = [initialMigration, imageAssetsMigration];

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as Array<{
    version: number;
  }>;
  const applied = new Set(appliedRows.map(({ version }) => version));
  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      insert.run(migration.version, migration.name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
  }
}
