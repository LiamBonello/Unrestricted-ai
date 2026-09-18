import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateImage, uploadImage } from './image-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('image API', () => {
  it('uploads an image and returns only the local asset reference', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      assetId: 'a1',
      conversationId: 'c1',
      mimeType: 'image/png',
    }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const file = new File([new Uint8Array([1])], 'reference.png', {
      type: 'image/png',
    });
    const controller = new AbortController();
    const result = await uploadImage({
      file,
      conversationId: 'c1',
      signal: controller.signal,
    });

    expect(result).toEqual({
      assetId: 'a1',
      conversationId: 'c1',
      mimeType: 'image/png',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/uploads/images',
      expect.objectContaining({
        method: 'POST',
        signal: controller.signal,
        body: expect.any(FormData),
      }),
    );
  });

  it('maps an image request to the local generation endpoint', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      conversationId: 'c1',
      messageId: 'm2',
      assetId: 'a2',
    }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const result = await generateImage({
      conversationId: 'c1',
      prompt: 'Turn the car blue',
      inputAssetId: 'a1',
      consentConfirmed: false,
      signal: controller.signal,
    });

    expect(result).toEqual({
      conversationId: 'c1',
      messageId: 'm2',
      assetId: 'a2',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'c1',
        prompt: 'Turn the car blue',
        inputAssetId: 'a1',
        consentConfirmed: false,
      }),
      signal: controller.signal,
    });
  });
});
