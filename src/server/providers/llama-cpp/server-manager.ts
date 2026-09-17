import { spawn } from 'node:child_process';
import type { LlamaCppRuntimeConfig } from '@/server/config/llm-runtime';
import type { HeavyWorkerLifecycle } from '@/server/resources/resource-manager';
import type {
  LlamaCppServerDependencies,
  LlamaCppServerStatus,
  ManagedChildProcess,
  SpawnProcessOptions,
} from './types';

const HEALTH_POLL_INTERVAL_MS = 250;

export function buildLlamaServerArgs(config: LlamaCppRuntimeConfig): string[] {
  return [
    '--hf-repo',
    config.model,
    '--offline',
    '--no-mmproj',
    '--host',
    config.host,
    '--port',
    String(config.port),
    '--ctx-size',
    String(config.contextSize),
    '--n-gpu-layers',
    String(config.gpuLayers),
    '--parallel',
    '1',
    '--flash-attn',
    'auto',
  ];
}

function defaultSpawnProcess(
  command: string,
  args: string[],
  options: SpawnProcessOptions,
): ManagedChildProcess {
  return spawn(command, args, {
    ...options,
    stdio: 'ignore',
  });
}

const defaultDependencies: LlamaCppServerDependencies = {
  spawnProcess: defaultSpawnProcess,
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function isHealthyPayload(value: unknown): value is { status: 'ok' } {
  if (typeof value !== 'object' || value === null) return false;
  return (value as Record<string, unknown>).status === 'ok';
}

function processExitError(code: number | null, signal: NodeJS.Signals | null): Error {
  const detail = code !== null ? `code ${code}` : `signal ${signal ?? 'unknown'}`;
  return new Error(`llama-server exited before becoming ready (${detail})`);
}

export class LlamaCppServerManager implements HeavyWorkerLifecycle {
  private status: LlamaCppServerStatus = 'stopped';
  private child: ManagedChildProcess | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(
    private readonly config: LlamaCppRuntimeConfig,
    private readonly dependencies: LlamaCppServerDependencies = defaultDependencies,
  ) {}

  getStatus(): LlamaCppServerStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.status === 'ready') return;
    if (this.startPromise) return this.startPromise;

    const promise = this.startInternal();
    this.startPromise = promise;
    try {
      await promise;
    } finally {
      if (this.startPromise === promise) this.startPromise = null;
    }
  }

  private async startInternal(): Promise<void> {
    this.status = 'starting';
    let startupFailure: Error | null = null;

    const child = this.dependencies.spawnProcess(
      this.config.executablePath,
      buildLlamaServerArgs(this.config),
      {
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          LLAMA_CACHE: this.config.cacheDir,
        },
      },
    );
    this.child = child;

    child.once('exit', (code, signal) => {
      if (this.child !== child) return;
      if (this.status === 'starting') {
        startupFailure = processExitError(code, signal);
      } else if (this.status === 'ready') {
        this.child = null;
        this.status = 'failed';
      }
    });
    child.once('error', (error) => {
      if (this.child !== child) return;
      if (this.status === 'starting') {
        startupFailure = new Error(`llama-server failed during startup: ${error.message}`);
      } else if (this.status === 'ready') {
        this.child = null;
        this.status = 'failed';
      }
    });

    const deadline = this.dependencies.now() + this.config.startupTimeoutMs;

    try {
      while (this.dependencies.now() < deadline) {
        if (startupFailure) throw startupFailure;

        let response: Response | null = null;
        try {
          response = await this.dependencies.fetch(`${this.config.baseUrl}/health`, {
            cache: 'no-store',
          });
        } catch {
          response = null;
        }

        if (startupFailure) throw startupFailure;

        if (response?.status === 200) {
          const payload: unknown = await response.json();
          if (!isHealthyPayload(payload)) {
            throw new Error('llama-server returned an invalid health response');
          }
          this.status = 'ready';
          return;
        }

        if (response && response.status !== 503) {
          throw new Error(`llama-server health check failed with HTTP ${response.status}`);
        }

        await this.dependencies.sleep(HEALTH_POLL_INTERVAL_MS);
      }

      throw new Error(`llama-server startup timed out after ${this.config.startupTimeoutMs} ms`);
    } catch (error: unknown) {
      if (this.child === child) {
        child.kill();
        this.child = null;
      }
      this.status = 'failed';
      throw error;
    }
  }

  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    this.status = 'stopped';
    if (child) child.kill();
    await Promise.resolve();
  }
}
