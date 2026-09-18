import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getImageRuntimeConfig } from './image-runtime';

describe('getImageRuntimeConfig', () => {
  it('defaults to mock so CI never requires ComfyUI or model weights', () => {
    expect(getImageRuntimeConfig({})).toEqual({ mode: 'mock' });
  });

  it('builds a loopback-only ComfyUI profile with portable local paths', () => {
    const rootDir = path.resolve(process.cwd(), './runtime/ComfyUI_windows_portable');

    expect(getImageRuntimeConfig({ UNRESTRICTED_AI_IMAGE_PROVIDER: 'comfyui' })).toEqual({
      mode: 'comfyui',
      rootDir,
      pythonPath: path.join(rootDir, 'python_embeded', 'python.exe'),
      mainPath: path.join(rootDir, 'ComfyUI', 'main.py'),
      host: '127.0.0.1',
      port: 8188,
      startupTimeoutMs: 180000,
      outputsDir: path.resolve(process.cwd(), './outputs'),
      uploadsDir: path.resolve(process.cwd(), './uploads'),
      generalProfile: 'flux2-klein-4b-fp8',
      adultCheckpoint: null,
      baseUrl: 'http://127.0.0.1:8188',
    });
  });

  it('accepts an explicitly configured adult checkpoint filename', () => {
    const config = getImageRuntimeConfig({
      UNRESTRICTED_AI_IMAGE_PROVIDER: 'comfyui',
      UNRESTRICTED_AI_IMAGE_ADULT_CHECKPOINT: 'adult-local.safetensors',
    });

    expect(config.mode).toBe('comfyui');
    if (config.mode === 'comfyui') expect(config.adultCheckpoint).toBe('adult-local.safetensors');
  });

  it.each([
    ['UNRESTRICTED_AI_COMFYUI_PORT', '0', 'port'],
    ['UNRESTRICTED_AI_COMFYUI_PORT', '70000', 'port'],
    ['UNRESTRICTED_AI_COMFYUI_STARTUP_TIMEOUT_MS', '0', 'startup timeout'],
  ])('rejects invalid %s values', (key, value, expectedMessage) => {
    expect(() => getImageRuntimeConfig({
      UNRESTRICTED_AI_IMAGE_PROVIDER: 'comfyui',
      [key]: value,
    })).toThrow(expectedMessage);
  });

  it('rejects unknown provider modes', () => {
    expect(() => getImageRuntimeConfig({
      UNRESTRICTED_AI_IMAGE_PROVIDER: 'cloud',
    })).toThrow('Image provider');
  });
});
