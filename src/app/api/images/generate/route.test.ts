import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/images/generate', () => {
  it('generates an image in mock mode and returns conversation asset identifiers', async () => {
    process.env.UNRESTRICTED_AI_LLM_PROVIDER = 'mock';
    process.env.UNRESTRICTED_AI_IMAGE_PROVIDER = 'mock';
    process.env.UNRESTRICTED_AI_DATA_DIR = `./data/test-image-generate-${process.pid}`;
    process.env.UNRESTRICTED_AI_OUTPUTS_DIR = `./outputs/test-image-generate-${process.pid}`;
    process.env.UNRESTRICTED_AI_UPLOADS_DIR = `./uploads/test-image-generate-${process.pid}`;

    const request = new Request('http://127.0.0.1:3000/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'A tiny blue planet in deep space' }),
    });

    const response = await POST(request);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.conversationId).toEqual(expect.any(String));
    expect(body.messageId).toEqual(expect.any(String));
    expect(body.assetId).toEqual(expect.any(String));
  });

  it('rejects an empty image prompt before generation', async () => {
    const request = new Request('http://127.0.0.1:3000/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
