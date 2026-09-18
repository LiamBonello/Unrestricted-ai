import { spawn } from 'node:child_process';
import type { ComfyUiRuntimeConfig } from '@/server/config/image-runtime';
import type { HeavyWorkerLifecycle } from '@/server/resources/resource-manager';
import type {
  ComfyUiManagedChildProcess,
  ComfyUiServerDependencies,
  ComfyUiServerStatus,
  ComfyUiSpawnProcessOptions,
} from './types';

const HEALTH_POLL_INTERVAL_MS = 250;

export function buildComfyUiArgs(config: ComfyUiRuntimeConfig): string[] {
  return [
    '-s',
    config.mainPath,
    '--windows-standalone-build',
    '--listen',
    config.host,
    '--port',
    String(config.port),
    '--enable-dynamic-vram',
    '--vram-headroom',
    '0.5',
  ];
}

function defaultSpawnProcess(
  command: string,
  args: string[],
  options: ComfyUiSpawnProcessOptions,
): ComfyUiManagedChildProcess {
  return spawn(command, args, {
    ...options,
    stdio: 'ignore',
  });
}

const defaultDependencies: ComfyUiServerDependencies = {
  spawnProcess: defaultSpawnProcess,
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function processExitError(code: number | null, signal: NodeJS.Signals | null): Error {
  const detail = code !== null ? `code ${code}` : `signal ${signal ?? 'unknown'}`;
  return new Error(`ComfyUI exited before becoming ready (${detail})`);
}

function isSystemStatsPayload(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

export class ComfyUiServerManager implements HeavyWorkerLifecycle {
  private status: ComfyUiServerStatus = 'stopped';
  private child: ComfyUiManagedChildProcess | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(
    private readonly config: ComfyUiRuntimeConfig,
    private readonly dependencies: ComfyUiServerDependencies = defaultDependencies,
  ) {}

  getStatus(): ComfyUiServerStatus {
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
      this.config.pythonPath,
      buildComfyUiArgs(this.config),
      {
        shell: false,
        windowsHide: true,
        cwd: this.config.rootDir,
        env: { ...process.env },
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
        startupFailure = new Error(`ComfyUI failed during startup: ${error.message}`);
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
          response = await this.dependencies.fetch(`${this.config.baseUrl}/system_stats`, {
            cache: 'no-store',
          });
        } catch {
          response = null;
        }

        if (startupFailure) throw startupFailure;

        if (response?.status === 200) {
          const payload: unknown = await response.json();
          if (!isSystemStatsPayload(payload)) {
            throw new Error('ComfyUI returned an invalid system stats response');
          }
          this.status = 'ready';
          return;
        }

        if (response && response.status !== 503) {
          throw new Error(`ComfyUI health check failed with HTTP ${response.status}`);
        }

        await this.dependencies.sleep(HEALTH_POLL_INTERVAL_MS);
      }

      throw new Error(`ComfyUI startup timed out after ${this.config.startupTimeoutMs} ms`);
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
