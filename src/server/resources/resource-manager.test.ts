import { describe, expect, it } from 'vitest';
import type { HeavyWorkerLifecycle } from './resource-manager';
import { ResourceManager } from './resource-manager';

function createWorker(name: string, events: string[], options?: { failStart?: boolean }): HeavyWorkerLifecycle {
  return {
    async start() {
      events.push(`${name}:start`);
      if (options?.failStart) throw new Error(`${name} failed to start`);
    },
    async stop() {
      events.push(`${name}:stop`);
    },
  };
}

describe('ResourceManager', () => {
  it('serializes heavyweight capability leases in FIFO order', async () => {
    const manager = new ResourceManager();
    const llmLease = await manager.acquire('llm');
    expect(manager.getActiveCapability()).toBe('llm');

    let imageAcquired = false;
    const imageLeasePromise = manager.acquire('image').then((lease) => {
      imageAcquired = true;
      return lease;
    });

    await Promise.resolve();
    expect(imageAcquired).toBe(false);

    llmLease.release();
    const imageLease = await imageLeasePromise;
    expect(imageAcquired).toBe(true);
    expect(manager.getActiveCapability()).toBe('image');

    imageLease.release();
    expect(manager.getActiveCapability()).toBeNull();
  });

  it('starts a registered worker on the first lease and reuses it while resident', async () => {
    const events: string[] = [];
    const manager = new ResourceManager();
    manager.registerWorker('llm', createWorker('llm', events));

    const first = await manager.acquire('llm');
    expect(events).toEqual(['llm:start']);
    expect(manager.getResidentCapability()).toBe('llm');
    first.release();

    const second = await manager.acquire('llm');
    expect(events).toEqual(['llm:start']);
    expect(manager.getResidentCapability()).toBe('llm');
    second.release();
  });

  it('stops the resident worker before starting a different capability', async () => {
    const events: string[] = [];
    const manager = new ResourceManager();
    manager.registerWorker('llm', createWorker('llm', events));
    manager.registerWorker('image', createWorker('image', events));

    const llm = await manager.acquire('llm');
    llm.release();
    const image = await manager.acquire('image');

    expect(events).toEqual(['llm:start', 'llm:stop', 'image:start']);
    expect(manager.getResidentCapability()).toBe('image');
    image.release();
  });

  it('recovers the queue when worker startup fails', async () => {
    const events: string[] = [];
    const manager = new ResourceManager();
    manager.registerWorker('llm', createWorker('llm', events, { failStart: true }));
    manager.registerWorker('image', createWorker('image', events));

    await expect(manager.acquire('llm')).rejects.toThrow('llm failed to start');
    expect(manager.getResidentCapability()).toBeNull();
    expect(manager.getActiveCapability()).toBeNull();

    const image = await manager.acquire('image');
    expect(manager.getActiveCapability()).toBe('image');
    expect(manager.getResidentCapability()).toBe('image');
    image.release();
  });

  it('waits for the active lease before unloading the resident worker', async () => {
    const events: string[] = [];
    const manager = new ResourceManager();
    manager.registerWorker('llm', createWorker('llm', events));

    const lease = await manager.acquire('llm');
    let unloaded = false;
    const unloadPromise = manager.unloadResident().then(() => {
      unloaded = true;
    });

    await Promise.resolve();
    expect(unloaded).toBe(false);
    expect(events).toEqual(['llm:start']);

    lease.release();
    await unloadPromise;
    expect(events).toEqual(['llm:start', 'llm:stop']);
    expect(manager.getResidentCapability()).toBeNull();
  });
});
