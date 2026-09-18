import { describe, expect, it } from 'vitest';
import { MockImageProvider } from './mock-image-provider';

describe('MockImageProvider', () => {
  it('returns deterministic local image bytes without an external runtime', async () => {
    const provider = new MockImageProvider();

    const result = await provider.generate({
      prompt: 'A test image',
      contentMode: 'general',
      width: 512,
      height: 512,
      seed: 1,
    });

    expect(provider.id).toBe('mock-image');
    expect(result.mimeType).toBe('image/png');
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });
});
