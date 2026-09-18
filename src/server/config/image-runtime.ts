import path from 'node:path';

export type ImageRuntimeMode = 'mock' | 'comfyui';
export type ImageRuntimeEnvironment = Readonly<Record<string, string | undefined>>;
export type GeneralImageProfile = 'flux2-klein-4b-fp8';

export interface MockImageRuntimeConfig {
  mode: 'mock';
}

export interface ComfyUiRuntimeConfig {
  mode: 'comfyui';
  rootDir: string;
  pythonPath: string;
  mainPath: string;
  host: '127.0.0.1';
  port: number;
  startupTimeoutMs: number;
  outputsDir: string;
  uploadsDir: string;
  generalProfile: GeneralImageProfile;
  adultCheckpoint: string | null;
  baseUrl: string;
}

export type ImageRuntimeConfig = MockImageRuntimeConfig | ComfyUiRuntimeConfig;

function parseInteger(
  value: string | undefined,
  fallback: number,
  label: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const raw = value?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid image ${label}: ${value}`);

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid image ${label}: ${value}`);
  }
  return parsed;
}

export function getImageRuntimeConfig(
  env: ImageRuntimeEnvironment = process.env,
): ImageRuntimeConfig {
  const mode = env.UNRESTRICTED_AI_IMAGE_PROVIDER?.trim() || 'mock';
  if (mode === 'mock') return { mode: 'mock' };
  if (mode !== 'comfyui') throw new Error(`Invalid Image provider: ${mode}`);

  const rootDir = path.resolve(
    process.cwd(),
    env.UNRESTRICTED_AI_COMFYUI_ROOT?.trim() || './runtime/ComfyUI_windows_portable',
  );
  const port = parseInteger(env.UNRESTRICTED_AI_COMFYUI_PORT, 8188, 'port', 1, 65535);
  const startupTimeoutMs = parseInteger(
    env.UNRESTRICTED_AI_COMFYUI_STARTUP_TIMEOUT_MS,
    180000,
    'startup timeout',
    1,
  );
  const adultCheckpoint = env.UNRESTRICTED_AI_IMAGE_ADULT_CHECKPOINT?.trim() || null;

  return {
    mode: 'comfyui',
    rootDir,
    pythonPath: path.join(rootDir, 'python_embeded', 'python.exe'),
    mainPath: path.join(rootDir, 'ComfyUI', 'main.py'),
    host: '127.0.0.1',
    port,
    startupTimeoutMs,
    outputsDir: path.resolve(
      process.cwd(),
      env.UNRESTRICTED_AI_OUTPUTS_DIR?.trim() || './outputs',
    ),
    uploadsDir: path.resolve(
      process.cwd(),
      env.UNRESTRICTED_AI_UPLOADS_DIR?.trim() || './uploads',
    ),
    generalProfile: 'flux2-klein-4b-fp8',
    adultCheckpoint,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}
