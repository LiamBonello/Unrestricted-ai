import path from 'node:path';

export type LlmProviderMode = 'mock' | 'llama-cpp';
export type GpuLayers = 'auto' | 'all' | number;
export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export interface MockLlmRuntimeConfig {
  mode: 'mock';
}

export interface LlamaCppRuntimeConfig {
  mode: 'llama-cpp';
  executablePath: string;
  model: string;
  cacheDir: string;
  host: '127.0.0.1';
  port: number;
  contextSize: number;
  gpuLayers: GpuLayers;
  startupTimeoutMs: number;
  offline: true;
  baseUrl: string;
}

export type LlmRuntimeConfig = MockLlmRuntimeConfig | LlamaCppRuntimeConfig;

function parseInteger(
  value: string | undefined,
  fallback: number,
  label: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const raw = value?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid ${label}: ${value}`);

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function parseGpuLayers(value: string | undefined): GpuLayers {
  const raw = value?.trim() || 'auto';
  if (raw === 'auto' || raw === 'all') return raw;
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid GPU layers: ${value}`);

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid GPU layers: ${value}`);
  }
  return parsed;
}

export function getLlmRuntimeConfig(env: RuntimeEnvironment = process.env): LlmRuntimeConfig {
  const mode = env.UNRESTRICTED_AI_LLM_PROVIDER?.trim() || 'mock';
  if (mode === 'mock') return { mode: 'mock' };
  if (mode !== 'llama-cpp') throw new Error(`Invalid LLM provider: ${mode}`);

  const port = parseInteger(env.UNRESTRICTED_AI_LLAMA_PORT, 8091, 'port', 1, 65535);
  const contextSize = parseInteger(
    env.UNRESTRICTED_AI_LLAMA_CONTEXT_SIZE,
    8192,
    'context size',
    1,
  );
  const startupTimeoutMs = parseInteger(
    env.UNRESTRICTED_AI_LLAMA_STARTUP_TIMEOUT_MS,
    120000,
    'startup timeout',
    1,
  );

  return {
    mode: 'llama-cpp',
    executablePath: env.UNRESTRICTED_AI_LLAMA_SERVER_PATH?.trim() || 'llama-server',
    model: env.UNRESTRICTED_AI_LLAMA_MODEL?.trim() || 'unsloth/Qwen3.5-9B-GGUF:Q4_K_M',
    cacheDir: path.resolve(
      process.cwd(),
      env.UNRESTRICTED_AI_LLAMA_CACHE_DIR?.trim() || './models/llama-cache',
    ),
    host: '127.0.0.1',
    port,
    contextSize,
    gpuLayers: parseGpuLayers(env.UNRESTRICTED_AI_LLAMA_GPU_LAYERS),
    startupTimeoutMs,
    offline: true,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}
