import { describe, expect, it, vi } from 'vitest';
import type { ComfyWorkflow } from './types';
import { ComfyUiClient } from './client';

const workflow: ComfyWorkflow = {
  '1': {
    class_type: 'SaveImage',
    inputs: {
      filename_prefix: 'UnrestrictedAI',
      images: ['2', 0],
    },
  },
};

describe('ComfyUiClient', () => {
  it('queues an API-format workflow with explicit client and prompt IDs', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        prompt: workflow,
        client_id: 'client-1',
        prompt_id: 'prompt-1',
      });
      return Response.json({ prompt_id: 'prompt-1', number: 1, node_errors: {} });
    });
    const client = new ComfyUiClient('http://127.0.0.1:8188', fetchImpl);

    await expect(client.queue(workflow, 'client-1', 'prompt-1')).resolves.toEqual({
      promptId: 'prompt-1',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8188/prompt',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uploads image bytes using the local ComfyUI upload endpoint', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.get('type')).toBe('input');
      const image = form.get('image');
      expect(image).toBeInstanceOf(Blob);
      expect((image as Blob).type).toBe('image/png');
      return Response.json({ name: 'upload-id.png', subfolder: '', type: 'input' });
    });
    const client = new ComfyUiClient('http://127.0.0.1:8188', fetchImpl);

    await expect(
      client.uploadImage(new Uint8Array([1, 2, 3]), 'upload-id.png', 'image/png'),
    ).resolves.toBe('upload-id.png');
  });

  it('polls history and retrieves the first completed image output', async () => {
    let historyCalls = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/history/prompt-1')) {
        historyCalls += 1;
        if (historyCalls === 1) return Response.json({});
        return Response.json({
          'prompt-1': {
            outputs: {
              '9': {
                images: [
                  { filename: 'UnrestrictedAI_00001_.png', subfolder: '', type: 'output' },
                ],
              },
            },
          },
        });
      }

      if (url.includes('/view?')) {
        return new Response(new Uint8Array([9, 8, 7]), {
          headers: { 'content-type': 'image/png' },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    const sleep = vi.fn(async () => undefined);
    const client = new ComfyUiClient('http://127.0.0.1:8188', fetchImpl, sleep);

    const result = await client.waitForImage('prompt-1');

    expect(result.mimeType).toBe('image/png');
    expect([...result.bytes]).toEqual([9, 8, 7]);
    expect(historyCalls).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('cancels the exact prompt and aborts waiting when the signal is aborted', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/jobs/prompt-1/cancel')) {
        expect(init?.method).toBe('POST');
        return Response.json({ canceled: true });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const client = new ComfyUiClient('http://127.0.0.1:8188', fetchImpl);
    const controller = new AbortController();
    controller.abort();

    await expect(client.waitForImage('prompt-1', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8188/api/jobs/prompt-1/cancel',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects malformed queue responses instead of guessing a prompt ID', async () => {
    const client = new ComfyUiClient(
      'http://127.0.0.1:8188',
      async () => Response.json({ prompt_id: 123 }),
    );

    await expect(client.queue(workflow, 'client-1', 'prompt-1')).rejects.toThrow(
      'invalid prompt response',
    );
  });
});
