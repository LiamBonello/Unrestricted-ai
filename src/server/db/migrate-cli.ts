import { mkdirSync } from 'node:fs';
import { getDataPaths } from '@/server/config/paths';
import { createDatabase } from './database';
import { runMigrations } from './migrate';

const paths = getDataPaths();
mkdirSync(paths.dataDir, { recursive: true });
const db = createDatabase(paths.databaseFile);

try {
  runMigrations(db);
  console.log(`Migrated ${paths.databaseFile}`);
} finally {
  db.close();
}
