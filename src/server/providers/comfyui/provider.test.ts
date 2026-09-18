import { describe, expect, it, vi } from 'vitest';
import type { ComfyUiRuntimeConfig } from '@/server/config/image-runtime';
import { ComfyUiProvider, ImageProviderConfigurationError } from './provider';

function createConfig(
  overrides: Partial<ComfyUiRuntimeConfig> = {},
): ComfyUiRuntimeConfig {
  return {
    mode: 'comfyui',
    rootDir: 'C:\\runtime\\ComfyUI_windows_portable',
    pythonPath: 'C:\\runtime\\ComfyUI_windows_portable\\python_embeded\\python.exe',
    mainPath: 'C:\\runtime\\ComfyUI_windows_portable\\ComfyUI\\main.py',
    host: '127.0.0.1',
    port: 8188,
    startupTimeoutMs: 180000,
    outputsDir: 'C:\\outputs',
    uploadsDir: 'C:\\uploads',
    generalProfile: 'flux2-klein-4b-fp8',
    adultCheckpoint: 'adult-local.safetensors',
    baseUrl: 'http://127.0.0.1:8188',
    ...overrides,
  };
}

function createClient() {
  let queuedWorkflow: Record<string, { class_type: string; inputs: Record<string, unknown> }> | null = null;
  const uploadImage = vi.fn(async () => 'upload-id.png');
  const queue = vi.fn(async (workflow: typeof queuedWorkflow) => {
    queuedWorkflow = workflow;
    return { promptId: 'prompt-1' };
  });
  const waitForImage = vi.fn(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: 'image/png' as const,
  }));
  const cancel = vi.fn(async () => undefined);

  return {
    client: { uploadImage, queue, waitForImage, cancel },
    getQueuedWorkflow: () => queuedWorkflow,
    uploadImage,
    queue,
    waitForImage,
  };
}

describe('ComfyUiProvider', () => {
  it('routes general text-to-image generation to FLUX.2 Klein', async () => {
    const harness = createClient();
    const provider = new ComfyUiProvider(createConfig(), harness.client, () => 'request-1');

    await provider.generate({
      prompt: 'A glass city floating above the sea',
      contentMode: 'general',
      width: 768,
      height: 768,
      seed: 1234,
    });

    const workflow = harness.getQueuedWorkflow();
    expect(workflow?.['70']?.class_type).toBe('UNETLoader');
    expect(workflow?.['74']?.inputs.text).toBe('A glass city floating above the sea');
    expect(workflow?.['62']?.inputs.steps).toBe(4);
  });

  it('routes adult-explicit Rule 34 generation to the configured local SDXL checkpoint unchanged', async () => {
    const harness = createClient();
    const provider = new ComfyUiProvider(createConfig(), harness.client, () => 'request-2');
    const prompt = 'Rule 34, adult fictional woman, age 25, explicit nude';

    await provider.generate({
      prompt,
      contentMode: 'adult-explicit',
      width: 768,
      height: 768,
      seed: 7284,
    });

    const workflow = harness.getQueuedWorkflow();
    expect(workflow?.['4']).toEqual({
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'adult-local.safetensors' },
    });
    expect(workflow?.['6']?.inputs.text).toBe(prompt);
    expect(workflow?.['70']).toBeUndefined();
  });

  it('fails clearly when adult-explicit generation has no configured adult checkpoint', async () => {
    const harness = createClient();
    const provider = new ComfyUiProvider(
      createConfig({ adultCheckpoint: null }),
      harness.client,
      () => 'request-3',
    );

    await expect(provider.generate({
      prompt: 'Rule 34, adult fictional woman, age 25, explicit nude',
      contentMode: 'adult-explicit',
      width: 768,
      height: 768,
      seed: 12,
    })).rejects.toThrowError(
      new ImageProviderConfigurationError('Adult image checkpoint is not configured'),
    );
    expect(harness.queue).not.toHaveBeenCalled();
  });

  it('uploads an input image and uses the FLUX.2 edit workflow for general edits', async () => {
    const harness = createClient();
    const provider = new ComfyUiProvider(createConfig(), harness.client, () => 'request-4');

    await provider.generate({
      prompt: 'Turn the red car blue',
      contentMode: 'general',
      width: 768,
      height: 768,
      seed: 44,
      input: {
        bytes: new Uint8Array([9, 8, 7]),
        mimeType: 'image/png',
      },
    });

    expect(harness.uploadImage).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'request-4.png',
      'image/png',
    );
    expect(harness.getQueuedWorkflow()?.['80']).toEqual({
      class_type: 'LoadImage',
      inputs: { image: 'upload-id.png' },
    });
  });
});
