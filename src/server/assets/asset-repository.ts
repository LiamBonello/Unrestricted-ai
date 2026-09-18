import type { DatabaseSync } from 'node:sqlite';
import type { ImageAsset, ImageAssetSource, ImageMimeType } from '@/shared/image';

interface AssetRow {
  id: string;
  conversation_id: string;
  source: ImageAssetSource;
  storage_path: string;
  mime_type: ImageMimeType;
  width: number | null;
  height: number | null;
  created_at: string;
}

function mapAsset(row: AssetRow): ImageAsset {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    source: row.source,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

export class AssetRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(asset: ImageAsset): void {
    this.db
      .prepare(`
        INSERT INTO assets (
          id, conversation_id, source, storage_path, mime_type, width, height, created_at
        )
        VALUES (
          @id, @conversationId, @source, @storagePath, @mimeType, @width, @height, @createdAt
        )
      `)
      .run({
        id: asset.id,
        conversationId: asset.conversationId,
        source: asset.source,
        storagePath: asset.storagePath,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        createdAt: asset.createdAt,
      });
  }

  getById(id: string): ImageAsset | null {
    const row = this.db
      .prepare(`
        SELECT id, conversation_id, source, storage_path, mime_type, width, height, created_at
        FROM assets
        WHERE id = ?
      `)
      .get(id) as unknown as AssetRow | undefined;

    return row ? mapAsset(row) : null;
  }
}
