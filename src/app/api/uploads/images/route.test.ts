// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/uploads/images', () => {
  it('stores an uploaded image under an app-generated asset ID', async () => {
    process.env.UNRESTRICTED_AI_LLM_PROVIDER = 'mock';
    process.env.UNRESTRICTED_AI_IMAGE_PROVIDER = 'mock';
    process.env.UNRESTRICTED_AI_DATA_DIR = `./data/test-image-upload-${process.pid}`;
    process.env.UNRESTRICTED_AI_OUTPUTS_DIR = `./outputs/test-image-upload-${process.pid}`;
    process.env.UNRESTRICTED_AI_UPLOADS_DIR = `./uploads/test-image-upload-${process.pid}`;

    const form = new FormData();
    form.append(
      'image',
      new File([new Uint8Array([1, 2, 3])], 'user-controlled-name.png', {
        type: 'image/png',
      }),
    );

    const response = await POST(new Request(
      'http://127.0.0.1:3000/api/uploads/images',
      { method: 'POST', body: form },
    ));
    const body = await response.json() as Record<string, unknown>;

    expect({ status: response.status, body }).toEqual({
      status: 201,
      body: expect.objectContaining({
        assetId: expect.any(String),
        conversationId: expect.any(String),
      }),
    });
    expect(JSON.stringify(body)).not.toContain('user-controlled-name.png');
    expect(JSON.stringify(body)).not.toContain(process.cwd());
  });
});
