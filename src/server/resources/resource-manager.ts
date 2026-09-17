export type HeavyCapability = 'llm' | 'image' | 'video';

export interface HeavyWorkerLifecycle {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface ResourceLease {
  capability: HeavyCapability;
  release(): void;
}

interface QueueSlot {
  previous: Promise<void>;
  releaseSlot(): void;
}

export class ResourceManager {
  private tail: Promise<void> = Promise.resolve();
  private active: HeavyCapability | null = null;
  private resident: HeavyCapability | null = null;
  private readonly workers = new Map<HeavyCapability, HeavyWorkerLifecycle>();

  registerWorker(capability: HeavyCapability, worker: HeavyWorkerLifecycle): void {
    this.workers.set(capability, worker);
  }

  getActiveCapability(): HeavyCapability | null {
    return this.active;
  }

  getResidentCapability(): HeavyCapability | null {
    return this.resident;
  }

  private reserveQueueSlot(): QueueSlot {
    let releaseSlot!: () => void;
    const slot = new Promise<void>((resolve) => {
      releaseSlot = resolve;
    });

    const previous = this.tail;
    this.tail = previous.catch(() => undefined).then(() => slot);
    return { previous, releaseSlot };
  }

  private async ensureResident(capability: HeavyCapability): Promise<void> {
    if (this.resident === capability) return;

    if (this.resident) {
      const residentWorker = this.workers.get(this.resident);
      if (residentWorker) await residentWorker.stop();
      this.resident = null;
    }

    const nextWorker = this.workers.get(capability);
    if (!nextWorker) return;

    await nextWorker.start();
    this.resident = capability;
  }

  async acquire(capability: HeavyCapability): Promise<ResourceLease> {
    const { previous, releaseSlot } = this.reserveQueueSlot();
    await previous.catch(() => undefined);

    try {
      await this.ensureResident(capability);
      this.active = capability;
    } catch (error: unknown) {
      this.active = null;
      releaseSlot();
      throw error;
    }

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

  async unloadResident(): Promise<void> {
    const { previous, releaseSlot } = this.reserveQueueSlot();
    await previous.catch(() => undefined);

    try {
      if (!this.resident) return;
      const worker = this.workers.get(this.resident);
      if (worker) await worker.stop();
      this.resident = null;
    } finally {
      releaseSlot();
    }
  }
}
