import type Database from 'better-sqlite3';
import { initialMigration } from './migrations/0001-initial';
import type { Migration } from './migrations/types';

const migrations: readonly Migration[] = [initialMigration];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>;
  const applied = new Set(appliedRows.map(({ version }) => version));
  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );

  const apply = db.transaction((migration: Migration) => {
    db.exec(migration.sql);
    insert.run(migration.version, migration.name, new Date().toISOString());
  });

  for (const migration of migrations) {
    if (!applied.has(migration.version)) apply(migration);
  }
}
