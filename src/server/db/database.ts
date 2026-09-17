import Database from 'better-sqlite3';

export function createDatabase(filename: string): Database.Database {
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  if (filename !== ':memory:') db.pragma('journal_mode = WAL');
  return db;
}
