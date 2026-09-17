export type HeavyCapability = 'llm' | 'image' | 'video';

export interface ResourceLease {
  capability: HeavyCapability;
  release(): void;
}

export class ResourceManager {
  private tail: Promise<void> = Promise.resolve();
  private active: HeavyCapability | null = null;

  getActiveCapability(): HeavyCapability | null {
    return this.active;
  }

  async acquire(capability: HeavyCapability): Promise<ResourceLease> {
    let releaseSlot!: () => void;
    const slot = new Promise<void>((resolve) => {
      releaseSlot = resolve;
    });

    const previous = this.tail;
    this.tail = previous.catch(() => undefined).then(() => slot);
    await previous.catch(() => undefined);
    this.active = capability;

    let released = false;
    return {
      capability,
      release: () => {
        if (released) return;
        released = true;
        this.active = null;
        releaseSlot();
      },
    };
  }
}
