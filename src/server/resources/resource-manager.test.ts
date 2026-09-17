import { describe, expect, it } from 'vitest';
import { ResourceManager } from './resource-manager';

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
});
