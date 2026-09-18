import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDatabase } from '@/server/db/database';
import type { ComfyUiSpawnProcess } from '@/server/providers/comfyui/types';
import type {
  ManagedChildProcess,
  SpawnProcess,
} from '@/server/providers/llama-cpp/types';
import { createAppContainer } from './app-container';

class FakeChildProcess implements ManagedChildProcess {
  once(
    _event: 'exit',
    _listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  once(_event: 'error', _listener: (error: Error) => void): this;
  once(
    _event: 'exit' | 'error',
    _listener:
      | ((code: number | null, signal: NodeJS.Signals | null) => void)
      | ((error: Error) => void),
  ): this {
    return this;
  }

  kill(): boolean {
    return true;
  }
}

const openDatabases: DatabaseSync[] = [];

function memoryDatabase(): DatabaseSync {
  const db = createDatabase(':memory:');
  openDatabases.push(db);
  return db;
}

afterEach(() => {
  while (openDatabases.length > 0) openDatabases.pop()?.close();
});

describe('createAppContainer', () => {
  it('composes mock mode without a resident heavyweight worker', async () => {
    const container = createAppContainer(
      { mode: 'mock' },
      { database: memoryDatabase(), assistantConfig: { systemPrompt: 'System test prompt' } },
    );

    const events = [];
    for await (const event of container.chat.stream({ text: 'Hello' })) events.push(event);

    expect(events.filter((event) => event.type === 'delta').map((event) => event.text).join(''))
      .toBe('Local mock response: Hello');
    expect(container.resources.getResidentCapability()).toBeNull();
    expect(container.llmRuntime.getStatus()).toEqual({
      mode: 'mock',
      configured: false,
      status: 'mock',
      residentCapability: null,
      model: null,
      baseUrl: null,
    });
  });

  it('registers llama.cpp lazily and reports only safe runtime details', async () => {
    let spawnCount = 0;
    const spawnProcess: SpawnProcess = () => {
      spawnCount += 1;
      return new FakeChildProcess();
    };

    const config = {
      mode: 'llama-cpp' as const,
      executablePath: 'C:\\tools\\llama-server.exe',
      model: 'unsloth/Qwen3.5-9B-GGUF:Q4_K_M',
      cacheDir: 'C:\\private\\llama-cache',
      host: '127.0.0.1' as const,
      port: 8091,
      contextSize: 8192,
      gpuLayers: 'auto' as const,
      startupTimeoutMs: 120000,
      offline: true as const,
      baseUrl: 'http://127.0.0.1:8091',
    };

    const container = createAppContainer(config, {
      database: memoryDatabase(),
      assistantConfig: { systemPrompt: 'System test prompt' },
      llamaServerDependencies: {
        spawnProcess,
        fetch: async () => Response.json({ status: 'ok' }),
        now: () => 0,
        sleep: async () => undefined,
      },
    });

    expect(spawnCount).toBe(0);
    expect(container.llmRuntime.getStatus()).toEqual({
      mode: 'llama-cpp',
      configured: true,
      status: 'stopped',
      residentCapability: null,
      model: config.model,
      baseUrl: config.baseUrl,
    });

    const lease = await container.resources.acquire('llm');

    expect(spawnCount).toBe(1);
    expect(container.llmRuntime.getStatus()).toEqual({
      mode: 'llama-cpp',
      configured: true,
      status: 'ready',
      residentCapability: 'llm',
      model: config.model,
      baseUrl: config.baseUrl,
    });
    expect(JSON.stringify(container.llmRuntime.getStatus())).not.toContain('C:\\private');
    expect(JSON.stringify(container.llmRuntime.getStatus())).not.toContain('llama-server.exe');

    lease.release();
    await container.resources.unloadResident();
  });

  it('registers ComfyUI lazily and exposes only safe image runtime diagnostics', async () => {
    let spawnCount = 0;
    const spawnProcess: ComfyUiSpawnProcess = () => {
      spawnCount += 1;
      return new FakeChildProcess();
    };

    const imageConfig = {
      mode: 'comfyui' as const,
      rootDir: 'C:\\private\\ComfyUI_windows_portable',
      pythonPath: 'C:\\private\\ComfyUI_windows_portable\\python_embeded\\python.exe',
      mainPath: 'C:\\private\\ComfyUI_windows_portable\\ComfyUI\\main.py',
      host: '127.0.0.1' as const,
      port: 8188,
      startupTimeoutMs: 180000,
      outputsDir: 'C:\\private\\outputs',
      uploadsDir: 'C:\\private\\uploads',
      generalProfile: 'flux2-klein-4b-fp8' as const,
      adultCheckpoint: null,
      baseUrl: 'http://127.0.0.1:8188',
    };

    const container = createAppContainer(
      { mode: 'mock' },
      {
        database: memoryDatabase(),
        assistantConfig: { systemPrompt: 'System test prompt' },
        imageRuntimeConfig: imageConfig,
        comfyUiServerDependencies: {
          spawnProcess,
          fetch: async () => Response.json({ system: {} }),
          now: () => 0,
          sleep: async () => undefined,
        },
      },
    );

    expect(spawnCount).toBe(0);
    expect(container.imageRuntime.getStatus()).toEqual({
      mode: 'comfyui',
      configured: true,
      status: 'stopped',
      residentCapability: null,
      profile: 'flux2-klein-4b-fp8',
      baseUrl: 'http://127.0.0.1:8188',
    });

    const lease = await container.resources.acquire('image');

    expect(spawnCount).toBe(1);
    expect(container.imageRuntime.getStatus()).toEqual({
      mode: 'comfyui',
      configured: true,
      status: 'ready',
      residentCapability: 'image',
      profile: 'flux2-klein-4b-fp8',
      baseUrl: 'http://127.0.0.1:8188',
    });
    expect(JSON.stringify(container.imageRuntime.getStatus())).not.toContain('C:\\private');

    lease.release();
    await container.resources.unloadResident();
  });

});
