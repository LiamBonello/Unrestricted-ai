import { randomUUID } from 'node:crypto';
import type { ComfyUiRuntimeConfig } from '@/server/config/image-runtime';
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from '@/server/providers/types';
import { ComfyUiClient } from './client';
import type { ComfyImageJob, ComfyImageOutput } from './client';
import type { ComfyWorkflow } from './types';
import {
  buildFlux2KleinImageEditWorkflow,
  buildFlux2KleinTextToImageWorkflow,
} from './workflows/flux2-klein';
import {
  buildSdxlImageEditWorkflow,
  buildSdxlTextToImageWorkflow,
} from './workflows/sdxl';

export class ImageProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageProviderConfigurationError';
  }
}

export interface ComfyUiProviderClient {
  uploadImage(bytes: Uint8Array, filename: string, mimeType: string): Promise<string>;
  queue(workflow: ComfyWorkflow, clientId: string, promptId: string): Promise<ComfyImageJob>;
  waitForImage(promptId: string, signal?: AbortSignal): Promise<ComfyImageOutput>;
  cancel(promptId: string): Promise<void>;
}

const fluxModels = {
  unetName: 'flux-2-klein-4b.safetensors',
  clipName: 'qwen_3_4b.safetensors',
  vaeName: 'flux2-vae.safetensors',
} as const;

function inputExtension(mimeType: ImageGenerationRequest['input'] extends infer T
  ? T extends { mimeType: infer M }
    ? M
    : never
  : never): string {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return '.png';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError');
}

export class ComfyUiProvider implements ImageProvider {
  readonly id = 'comfyui';

  constructor(
    private readonly config: ComfyUiRuntimeConfig,
    private readonly client: ComfyUiProviderClient = new ComfyUiClient(config.baseUrl),
    private readonly createId: () => string = randomUUID,
  ) {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    throwIfAborted(request.signal);

    const requestId = this.createId();
    let inputFilename: string | undefined;

    if (request.input) {
      inputFilename = await this.client.uploadImage(
        request.input.bytes,
        `${requestId}${inputExtension(request.input.mimeType)}`,
        request.input.mimeType,
      );
    }

    const workflow = this.buildWorkflow(request, inputFilename);
    const job = await this.client.queue(workflow, requestId, requestId);
    return this.client.waitForImage(job.promptId, request.signal);
  }

  private buildWorkflow(
    request: ImageGenerationRequest,
    inputFilename?: string,
  ): ComfyWorkflow {
    if (request.contentMode === 'adult-explicit') {
      const checkpoint = this.config.adultCheckpoint;
      if (!checkpoint) {
        throw new ImageProviderConfigurationError('Adult image checkpoint is not configured');
      }

      if (inputFilename) {
        return buildSdxlImageEditWorkflow({
          checkpoint,
          prompt: request.prompt,
          negativePrompt: '',
          inputFilename,
          seed: request.seed,
          denoise: 0.72,
        });
      }

      return buildSdxlTextToImageWorkflow({
        checkpoint,
        prompt: request.prompt,
        negativePrompt: '',
        width: request.width,
        height: request.height,
        seed: request.seed,
      });
    }

    if (inputFilename) {
      return buildFlux2KleinImageEditWorkflow({
        ...fluxModels,
        prompt: request.prompt,
        inputFilename,
        seed: request.seed,
      });
    }

    return buildFlux2KleinTextToImageWorkflow({
      ...fluxModels,
      prompt: request.prompt,
      width: request.width,
      height: request.height,
      seed: request.seed,
    });
  }
}
