import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from './types';

const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
    'base64',
  ),
);

export class MockImageProvider implements ImageProvider {
  readonly id = 'mock-image';

  async generate(_request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    return {
      bytes: Uint8Array.from(ONE_PIXEL_PNG),
      mimeType: 'image/png',
    };
  }
}
