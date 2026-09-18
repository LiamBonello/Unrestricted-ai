import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { ComfyUiRuntimeConfig } from '@/server/config/image-runtime';
import { buildComfyUiArgs, ComfyUiServerManager } from './server-manager';
import type {
  ComfyUiManagedChildProcess,
  ComfyUiServerDependencies,
} from './types';

function createConfig(overrides: Partial<ComfyUiRuntimeConfig> = {}): ComfyUiRuntimeConfig {
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
    adultCheckpoint: null,
    baseUrl: 'http://127.0.0.1:8188',
    ...overrides,
  };
}

class FakeChild extends EventEmitter implements ComfyUiManagedChildProcess {
  killed = false;

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

function createDependencies(input?: {
  responses?: Response[];
  child?: FakeChild;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}) {
  const child = input?.child ?? new FakeChild();
  const responses = [...(input?.responses ?? [Response.json({ system: {} })])];
  const spawnProcess = vi.fn(() => child);
  const fetchImpl = vi.fn(async () => responses.shift() ?? Response.json({ system: {} }));
  const dependencies: ComfyUiServerDependencies = {
    spawnProcess,
    fetch: fetchImpl,
    now: input?.now ?? (() => Date.now()),
    sleep: input?.sleep ?? (async () => undefined),
  };
  return { child, spawnProcess, fetchImpl, dependencies };
}

describe('buildComfyUiArgs', () => {
  it('binds ComfyUI to loopback with the constrained-memory profile', () => {
    expect(buildComfyUiArgs(createConfig())).toEqual([
      '-s',
      'C:\\runtime\\ComfyUI_windows_portable\\ComfyUI\\main.py',
      '--windows-standalone-build',
      '--listen',
      '127.0.0.1',
      '--port',
      '8188',
      '--enable-dynamic-vram',
      '--vram-headroom',
      '0.5',
    ]);
  });
});

describe('ComfyUiServerManager', () => {
  it('waits through transient readiness failures until system stats responds', async () => {
    const harness = createDependencies({
      responses: [new Response(null, { status: 503 }), Response.json({ system: {} })],
    });
    const manager = new ComfyUiServerManager(createConfig(), harness.dependencies);

    await manager.start();

    expect(manager.getStatus()).toBe('ready');
    expect(harness.fetchImpl).toHaveBeenCalledTimes(2);
    expect(harness.spawnProcess).toHaveBeenCalledWith(
      createConfig().pythonPath,
      expect.any(Array),
      expect.objectContaining({
        shell: false,
        windowsHide: true,
        cwd: createConfig().rootDir,
      }),
    );
  });

  it('fails when ComfyUI exits before readiness', async () => {
    const child = new FakeChild();
    const harness = createDependencies({
      child,
      responses: [new Response(null, { status: 503 })],
      sleep: async () => {
        child.emit('exit', 1, null);
      },
    });
    const manager = new ComfyUiServerManager(createConfig(), harness.dependencies);

    await expect(manager.start()).rejects.toThrow('exited before becoming ready');
    expect(manager.getStatus()).toBe('failed');
  });

  it('kills the child when startup times out', async () => {
    let now = 0;
    const harness = createDependencies({
      responses: [new Response(null, { status: 503 })],
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });
    const manager = new ComfyUiServerManager(
      createConfig({ startupTimeoutMs: 500 }),
      harness.dependencies,
    );

    await expect(manager.start()).rejects.toThrow('timed out');
    expect(harness.child.killed).toBe(true);
    expect(manager.getStatus()).toBe('failed');
  });

  it('does not spawn twice when ready and stops the owned process', async () => {
    const harness = createDependencies();
    const manager = new ComfyUiServerManager(createConfig(), harness.dependencies);

    await manager.start();
    await manager.start();

    expect(harness.spawnProcess).toHaveBeenCalledTimes(1);

    await manager.stop();
    expect(harness.child.killed).toBe(true);
    expect(manager.getStatus()).toBe('stopped');
  });
});
