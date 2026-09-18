import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('database runtime dependency', () => {
  it('uses the Node 24 built-in SQLite runtime instead of a native npm addon', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const databaseSource = readFileSync(
      resolve(process.cwd(), 'src/server/db/database.ts'),
      'utf8',
    );

    expect(packageJson.dependencies?.['better-sqlite3']).toBeUndefined();
    expect(packageJson.devDependencies?.['@types/better-sqlite3']).toBeUndefined();
    expect(databaseSource).toContain("from 'node:sqlite'");
  });
});
