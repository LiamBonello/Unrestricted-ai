export const imageMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type ImageMimeType = (typeof imageMimeTypes)[number];
export type ImageAssetSource = 'upload' | 'generated';

export interface ImageAsset {
  id: string;
  conversationId: string;
  source: ImageAssetSource;
  storagePath: string;
  mimeType: ImageMimeType;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface ImagePart {
  type: 'image';
  assetId: string;
  alt: string;
}

export function isImageMimeType(value: string): value is ImageMimeType {
  return imageMimeTypes.some((mimeType) => mimeType === value);
}
