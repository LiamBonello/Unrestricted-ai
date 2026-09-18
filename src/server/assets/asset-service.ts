import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ImageAsset, ImageAssetSource, ImageMimeType } from '@/shared/image';
import { isImageMimeType } from '@/shared/image';
import { AssetRepository } from './asset-repository';

export interface AssetStoragePaths {
  outputsDir: string;
  uploadsDir: string;
}

export interface SaveImageAssetInput {
  conversationId: string;
  bytes: Uint8Array;
  mimeType: string;
  width: number | null;
  height: number | null;
}

const extensions: Readonly<Record<ImageMimeType, string>> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export class AssetService {
  constructor(
    private readonly repository: AssetRepository,
    private readonly paths: AssetStoragePaths,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  saveGeneratedImage(input: SaveImageAssetInput): ImageAsset {
    return this.save('generated', this.paths.outputsDir, input);
  }

  saveUpload(input: SaveImageAssetInput): ImageAsset {
    return this.save('upload', this.paths.uploadsDir, input);
  }

  getById(id: string): ImageAsset | null {
    return this.repository.getById(id);
  }

  readBytes(asset: ImageAsset): Uint8Array {
    const root = asset.source === 'generated' ? this.paths.outputsDir : this.paths.uploadsDir;
    return new Uint8Array(readFileSync(path.join(root, asset.storagePath)));
  }

  private save(
    source: ImageAssetSource,
    rootDir: string,
    input: SaveImageAssetInput,
  ): ImageAsset {
    if (!isImageMimeType(input.mimeType)) {
      throw new Error(`Unsupported image MIME type: ${input.mimeType}`);
    }

    const id = this.createId();
    const storagePath = path.posix.join('images', `${id}${extensions[input.mimeType]}`);
    const absolutePath = path.join(rootDir, storagePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, input.bytes);

    const asset: ImageAsset = {
      id,
      conversationId: input.conversationId,
      source,
      storagePath,
      mimeType: input.mimeType,
      width: input.width,
      height: input.height,
      createdAt: this.now(),
    };

    this.repository.create(asset);
    return asset;
  }
}
