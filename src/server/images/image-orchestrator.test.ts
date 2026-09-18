import type { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetRepository } from '@/server/assets/asset-repository';
import { AssetService } from '@/server/assets/asset-service';
import { ConversationRepository } from '@/server/conversations/repository';
import { ConversationService } from '@/server/conversations/service';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import type { ImageGenerationRequest, ImageProvider } from '@/server/providers/types';
import type { HeavyWorkerLifecycle } from '@/server/resources/resource-manager';
import { ResourceManager } from '@/server/resources/resource-manager';
import { ImageOrchestrator } from './image-orchestrator';

let db: DatabaseSync;
let root: string;
let conversations: ConversationService;
let assets: AssetService;
let resources: ResourceManager;

beforeEach(() => {
  db = createDatabase(':memory:');
  runMigrations(db);
  root = mkdtempSync(join(tmpdir(), 'unrestricted-ai-image-orchestrator-'));

  const conversationRepository = new ConversationRepository(db);
  conversations = new ConversationService(
    conversationRepository,
    (() => {
      let value = 0;
      return () => `conversation-id-${++value}`;
    })(),
    () => '2026-09-18T10:00:00.000Z',
  );
  assets = new AssetService(
    new AssetRepository(db),
    {
      outputsDir: join(root, 'outputs'),
      uploadsDir: join(root, 'uploads'),
    },
    (() => {
      let value = 0;
      return () => `asset-id-${++value}`;
    })(),
    () => '2026-09-18T10:00:01.000Z',
  );
  resources = new ResourceManager();
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

function createProvider(
  generate: (request: ImageGenerationRequest) => Promise<{
    bytes: Uint8Array;
    mimeType: 'image/png';
  }> = async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: 'image/png',
  }),
): ImageProvider {
  return {
    id: 'fake-image',
    generate,
  };
}

function worker(name: string, events: string[]): HeavyWorkerLifecycle {
  return {
    async start() {
      events.push(`${name}:start`);
    },
    async stop() {
      events.push(`${name}:stop`);
    },
  };
}

describe('ImageOrchestrator', () => {
  it('persists the prompt, generated asset, and assistant image message', async () => {
    let capturedRequest: ImageGenerationRequest | null = null;
    const provider = createProvider(async (request) => {
      capturedRequest = request;
      return { bytes: new Uint8Array([7, 7, 7]), mimeType: 'image/png' };
    });
    const orchestrator = new ImageOrchestrator(conversations, assets, provider, resources);

    const result = await orchestrator.generate({
      prompt: 'A cinematic lighthouse in a storm',
      width: 768,
      height: 768,
      seed: 123,
    });

    const conversation = conversations.getConversation(result.conversationId);
    expect(conversation?.messages).toHaveLength(2);
    expect(conversation?.messages[0]?.parts).toEqual([
      { type: 'text', text: 'A cinematic lighthouse in a storm' },
    ]);
    expect(conversation?.messages[1]?.parts).toEqual([
      { type: 'image', assetId: result.assetId, alt: 'Generated image' },
    ]);

    const asset = assets.getById(result.assetId);
    expect(asset).toMatchObject({
      id: result.assetId,
      conversationId: result.conversationId,
      source: 'generated',
      mimeType: 'image/png',
      width: 768,
      height: 768,
    });
    expect([...assets.readBytes(asset!)]).toEqual([7, 7, 7]);
    expect(capturedRequest).toMatchObject({
      contentMode: 'general',
      prompt: 'A cinematic lighthouse in a storm',
      width: 768,
      height: 768,
      seed: 123,
    });
  });

  it('rejects disallowed sexual content before acquiring the GPU resource', async () => {
    let imageStarts = 0;
    resources.registerWorker('image', {
      async start() {
        imageStarts += 1;
      },
      async stop() {},
    });
    const orchestrator = new ImageOrchestrator(
      conversations,
      assets,
      createProvider(),
      resources,
    );

    await expect(orchestrator.generate({
      prompt: 'Rule 34 explicit 17-year-old character',
      width: 768,
      height: 768,
      seed: 1,
    })).rejects.toThrow('Sexual content involving minors is not allowed');

    expect(imageStarts).toBe(0);
    expect(resources.getActiveCapability()).toBeNull();
  });

  it('releases the image lease when generation is cancelled', async () => {
    const provider = createProvider(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    const orchestrator = new ImageOrchestrator(conversations, assets, provider, resources);

    await expect(orchestrator.generate({
      prompt: 'A mountain lake',
      width: 768,
      height: 768,
      seed: 1,
    })).rejects.toMatchObject({ name: 'AbortError' });

    expect(resources.getActiveCapability()).toBeNull();
    const nextLease = await resources.acquire('image');
    nextLease.release();
  });

  it('stops a resident LLM worker before starting the image worker', async () => {
    const events: string[] = [];
    resources.registerWorker('llm', worker('llm', events));
    resources.registerWorker('image', worker('image', events));

    const llmLease = await resources.acquire('llm');
    llmLease.release();

    const orchestrator = new ImageOrchestrator(
      conversations,
      assets,
      createProvider(),
      resources,
    );
    await orchestrator.generate({
      prompt: 'A blue geometric sculpture',
      width: 768,
      height: 768,
      seed: 5,
    });

    expect(events).toEqual(['llm:start', 'llm:stop', 'image:start']);
    expect(resources.getResidentCapability()).toBe('image');
  });
});
