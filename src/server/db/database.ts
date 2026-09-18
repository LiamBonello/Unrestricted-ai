import { DatabaseSync } from 'node:sqlite';

export function createDatabase(filename: string): DatabaseSync {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON');
  if (filename !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  return db;
}
