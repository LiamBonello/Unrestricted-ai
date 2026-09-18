// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { POST as uploadImage } from '@/app/api/uploads/images/route';
import { GET } from './route';

describe('GET /api/assets/[id]', () => {
  it('streams stored image bytes with the recorded MIME type and no filesystem path', async () => {
    process.env.UNRESTRICTED_AI_LLM_PROVIDER = 'mock';
    process.env.UNRESTRICTED_AI_IMAGE_PROVIDER = 'mock';
    process.env.UNRESTRICTED_AI_DATA_DIR = `./data/test-image-asset-${process.pid}`;
    process.env.UNRESTRICTED_AI_OUTPUTS_DIR = `./outputs/test-image-asset-${process.pid}`;
    process.env.UNRESTRICTED_AI_UPLOADS_DIR = `./uploads/test-image-asset-${process.pid}`;

    const form = new FormData();
    form.append(
      'image',
      new File([new Uint8Array([9, 8, 7])], 'private-name.png', {
        type: 'image/png',
      }),
    );
    const uploadResponse = await uploadImage(new Request(
      'http://127.0.0.1:3000/api/uploads/images',
      { method: 'POST', body: form },
    ));
    const uploaded = await uploadResponse.json() as Record<string, unknown>;
    expect({ status: uploadResponse.status, body: uploaded }).toEqual({
      status: 201,
      body: expect.objectContaining({ assetId: expect.any(String) }),
    });
    const assetId = String(uploaded.assetId);

    const response = await GET(
      new Request(`http://127.0.0.1:3000/api/assets/${assetId}`),
      { params: Promise.resolve({ id: assetId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([9, 8, 7]);
    expect(response.headers.get('x-local-path')).toBeNull();
  });
});
