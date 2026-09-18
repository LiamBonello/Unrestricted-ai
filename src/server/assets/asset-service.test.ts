import type { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import { AssetRepository } from './asset-repository';
import { AssetService } from './asset-service';

let db: DatabaseSync;
let root: string;
let service: AssetService;

beforeEach(() => {
  db = createDatabase(':memory:');
  runMigrations(db);
  db.prepare(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
  ).run('c1', 'Images', '2026-09-18T10:00:00.000Z', '2026-09-18T10:00:00.000Z');

  root = mkdtempSync(join(tmpdir(), 'unrestricted-ai-assets-'));
  service = new AssetService(
    new AssetRepository(db),
    {
      outputsDir: join(root, 'outputs'),
      uploadsDir: join(root, 'uploads'),
    },
    () => 'asset-id',
    () => '2026-09-18T10:00:01.000Z',
  );
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe('AssetService', () => {
  it('stores generated image bytes under an app-generated filename', () => {
    const bytes = new Uint8Array([1, 2, 3]);

    const asset = service.saveGeneratedImage({
      conversationId: 'c1',
      bytes,
      mimeType: 'image/png',
      width: 512,
      height: 512,
    });

    expect(asset.storagePath).toBe('images/asset-id.png');
    expect(readFileSync(join(root, 'outputs', asset.storagePath))).toEqual(Buffer.from(bytes));
  });

  it('rejects unsupported image MIME types before writing', () => {
    expect(() =>
      service.saveUpload({
        conversationId: 'c1',
        bytes: new Uint8Array([1]),
        mimeType: 'image/gif',
        width: null,
        height: null,
      }),
    ).toThrow('Unsupported image MIME type');
  });
});
