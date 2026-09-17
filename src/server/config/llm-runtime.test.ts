import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getLlmRuntimeConfig } from './llm-runtime';

describe('getLlmRuntimeConfig', () => {
  it('defaults to the mock provider so CI never requires model weights', () => {
    expect(getLlmRuntimeConfig({})).toEqual({ mode: 'mock' });
  });

  it('builds a loopback-only offline llama.cpp profile with conservative 8 GB defaults', () => {
    const config = getLlmRuntimeConfig({ UNRESTRICTED_AI_LLM_PROVIDER: 'llama-cpp' });

    expect(config).toEqual({
      mode: 'llama-cpp',
      executablePath: 'llama-server',
      model: 'unsloth/Qwen3.5-9B-GGUF:Q4_K_M',
      cacheDir: path.resolve(process.cwd(), './models/llama-cache'),
      host: '127.0.0.1',
      port: 8091,
      contextSize: 8192,
      gpuLayers: 'auto',
      startupTimeoutMs: 120000,
      offline: true,
      baseUrl: 'http://127.0.0.1:8091',
    });
  });

  it.each([
    ['UNRESTRICTED_AI_LLAMA_PORT', '0', 'port'],
    ['UNRESTRICTED_AI_LLAMA_PORT', '70000', 'port'],
    ['UNRESTRICTED_AI_LLAMA_CONTEXT_SIZE', '0', 'context size'],
    ['UNRESTRICTED_AI_LLAMA_STARTUP_TIMEOUT_MS', '-1', 'startup timeout'],
    ['UNRESTRICTED_AI_LLAMA_GPU_LAYERS', '-2', 'GPU layers'],
    ['UNRESTRICTED_AI_LLAMA_GPU_LAYERS', 'sometimes', 'GPU layers'],
  ])('rejects invalid %s values', (key, value, expectedMessage) => {
    expect(() => getLlmRuntimeConfig({
      UNRESTRICTED_AI_LLM_PROVIDER: 'llama-cpp',
      [key]: value,
    })).toThrow(expectedMessage);
  });

  it('accepts an exact non-negative GPU layer count', () => {
    const config = getLlmRuntimeConfig({
      UNRESTRICTED_AI_LLM_PROVIDER: 'llama-cpp',
      UNRESTRICTED_AI_LLAMA_GPU_LAYERS: '24',
    });

    expect(config.mode).toBe('llama-cpp');
    if (config.mode === 'llama-cpp') expect(config.gpuLayers).toBe(24);
  });

  it('rejects unknown provider modes instead of silently falling back', () => {
    expect(() => getLlmRuntimeConfig({ UNRESTRICTED_AI_LLM_PROVIDER: 'cloud' })).toThrow(
      'LLM provider',
    );
  });
});
