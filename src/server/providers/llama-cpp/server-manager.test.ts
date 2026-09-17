import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { LlamaCppRuntimeConfig } from '@/server/config/llm-runtime';
import { buildLlamaServerArgs, LlamaCppServerManager } from './server-manager';
import type { LlamaCppServerDependencies, ManagedChildProcess } from './types';

function createConfig(overrides: Partial<LlamaCppRuntimeConfig> = {}): LlamaCppRuntimeConfig {
  return {
    mode: 'llama-cpp',
    executablePath: 'llama-server',
    model: 'unsloth/Qwen3.5-9B-GGUF:Q4_K_M',
    cacheDir: 'C:\\models\\llama-cache',
    host: '127.0.0.1',
    port: 8091,
    contextSize: 8192,
    gpuLayers: 'auto',
    startupTimeoutMs: 120000,
    offline: true,
    baseUrl: 'http://127.0.0.1:8091',
    ...overrides,
  };
}

class FakeChild extends EventEmitter implements ManagedChildProcess {
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
  const responses = [...(input?.responses ?? [Response.json({ status: 'ok' })])];
  const spawnProcess = vi.fn(() => child);
  const fetchImpl = vi.fn(async () => responses.shift() ?? Response.json({ status: 'ok' }));
  const dependencies: LlamaCppServerDependencies = {
    spawnProcess,
    fetch: fetchImpl,
    now: input?.now ?? (() => Date.now()),
    sleep: input?.sleep ?? (async () => undefined),
  };
  return { child, spawnProcess, fetchImpl, dependencies };
}

describe('buildLlamaServerArgs', () => {
  it('builds the offline text-only server profile without a shell command string', () => {
    expect(buildLlamaServerArgs(createConfig())).toEqual([
      '--hf-repo',
      'unsloth/Qwen3.5-9B-GGUF:Q4_K_M',
      '--offline',
      '--no-mmproj',
      '--host',
      '127.0.0.1',
      '--port',
      '8091',
      '--ctx-size',
      '8192',
      '--n-gpu-layers',
      'auto',
      '--parallel',
      '1',
      '--flash-attn',
      'auto',
    ]);
  });
});

describe('LlamaCppServerManager', () => {
  it('treats 503 health responses as loading until status becomes ok', async () => {
    const harness = createDependencies({
      responses: [new Response(null, { status: 503 }), Response.json({ status: 'ok' })],
    });
    const manager = new LlamaCppServerManager(createConfig(), harness.dependencies);

    await manager.start();

    expect(manager.getStatus()).toBe('ready');
    expect(harness.fetchImpl).toHaveBeenCalledTimes(2);
    expect(harness.spawnProcess).toHaveBeenCalledWith(
      'llama-server',
      expect.any(Array),
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
  });

  it('fails when the process exits before readiness', async () => {
    const child = new FakeChild();
    const harness = createDependencies({
      child,
      responses: [new Response(null, { status: 503 })],
      sleep: async () => {
        child.emit('exit', 1, null);
      },
    });
    const manager = new LlamaCppServerManager(createConfig(), harness.dependencies);

    await expect(manager.start()).rejects.toThrow('exited before becoming ready');
    expect(manager.getStatus()).toBe('failed');
  });

  it('kills the child and fails when startup times out', async () => {
    let now = 0;
    const harness = createDependencies({
      responses: [new Response(null, { status: 503 }), new Response(null, { status: 503 })],
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });
    const manager = new LlamaCppServerManager(
      createConfig({ startupTimeoutMs: 500 }),
      harness.dependencies,
    );

    await expect(manager.start()).rejects.toThrow('timed out');
    expect(harness.child.killed).toBe(true);
    expect(manager.getStatus()).toBe('failed');
  });

  it('does not spawn twice when already ready and stops the owned process', async () => {
    const harness = createDependencies();
    const manager = new LlamaCppServerManager(createConfig(), harness.dependencies);

    await manager.start();
    await manager.start();
    expect(harness.spawnProcess).toHaveBeenCalledTimes(1);

    await manager.stop();
    expect(harness.child.killed).toBe(true);
    expect(manager.getStatus()).toBe('stopped');
  });
});
