import type { ImageMimeType } from '@/shared/image';
import { isImageMimeType } from '@/shared/image';
import type { ComfyWorkflow } from './types';

export interface ComfyImageJob {
  promptId: string;
}

export interface ComfyImageOutput {
  bytes: Uint8Array;
  mimeType: ImageMimeType;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface ComfyOutputImageReference {
  filename: string;
  subfolder: string;
  type: string;
}

const HISTORY_POLL_INTERVAL_MS = 250;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function parsePromptId(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record?.prompt_id === 'string' && record.prompt_id.length > 0
    ? record.prompt_id
    : null;
}

function parseUploadedFilename(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record?.name === 'string' && record.name.length > 0
    ? record.name
    : null;
}

function findImageReference(value: unknown): ComfyOutputImageReference | null {
  const root = asRecord(value);
  if (!root) return null;

  for (const entry of Object.values(root)) {
    const historyItem = asRecord(entry);
    const outputs = asRecord(historyItem?.outputs);
    if (!outputs) continue;

    for (const output of Object.values(outputs)) {
      const outputRecord = asRecord(output);
      const images = outputRecord?.images;
      if (!Array.isArray(images)) continue;

      for (const image of images) {
        const imageRecord = asRecord(image);
        if (
          typeof imageRecord?.filename === 'string'
          && typeof imageRecord.subfolder === 'string'
          && typeof imageRecord.type === 'string'
        ) {
          return {
            filename: imageRecord.filename,
            subfolder: imageRecord.subfolder,
            type: imageRecord.type,
          };
        }
      }
    }
  }

  return null;
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError');
}

export class ComfyUiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly sleep: (ms: number) => Promise<void> = (
      ms,
    ) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async queue(
    workflow: ComfyWorkflow,
    clientId: string,
    promptId: string,
  ): Promise<ComfyImageJob> {
    const response = await this.fetchImpl(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: workflow,
        client_id: clientId,
        prompt_id: promptId,
      }),
    });

    if (!response.ok) {
      throw new Error(`ComfyUI prompt queue failed with HTTP ${response.status}`);
    }

    const body: unknown = await response.json();
    const returnedPromptId = parsePromptId(body);
    if (!returnedPromptId) throw new Error('ComfyUI returned an invalid prompt response');

    return { promptId: returnedPromptId };
  }

  async uploadImage(
    bytes: Uint8Array,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    const form = new FormData();
    const payload = Uint8Array.from(bytes);
    form.append('image', new Blob([payload], { type: mimeType }), filename);
    form.append('type', 'input');
    form.append('overwrite', 'true');

    const response = await this.fetchImpl(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      throw new Error(`ComfyUI image upload failed with HTTP ${response.status}`);
    }

    const body: unknown = await response.json();
    const returnedFilename = parseUploadedFilename(body);
    if (!returnedFilename) throw new Error('ComfyUI returned an invalid upload response');
    return returnedFilename;
  }

  async waitForImage(
    promptId: string,
    signal?: AbortSignal,
  ): Promise<ComfyImageOutput> {
    while (true) {
      if (signal?.aborted) {
        await this.cancel(promptId);
        throw abortError();
      }

      const historyResponse = await this.fetchImpl(
        `${this.baseUrl}/history/${encodeURIComponent(promptId)}`,
        { cache: 'no-store', signal },
      );

      if (!historyResponse.ok) {
        throw new Error(
          `ComfyUI history request failed with HTTP ${historyResponse.status}`,
        );
      }

      const history: unknown = await historyResponse.json();
      const image = findImageReference(history);
      if (image) {
        const query = new URLSearchParams({
          filename: image.filename,
          subfolder: image.subfolder,
          type: image.type,
        });
        const imageResponse = await this.fetchImpl(
          `${this.baseUrl}/view?${query.toString()}`,
          { cache: 'no-store', signal },
        );
        if (!imageResponse.ok) {
          throw new Error(
            `ComfyUI image retrieval failed with HTTP ${imageResponse.status}`,
          );
        }

        const contentType = imageResponse.headers
          .get('content-type')
          ?.split(';', 1)[0]
          ?.trim();
        if (!contentType || !isImageMimeType(contentType)) {
          throw new Error(`ComfyUI returned unsupported image type: ${contentType ?? 'unknown'}`);
        }

        return {
          bytes: new Uint8Array(await imageResponse.arrayBuffer()),
          mimeType: contentType,
        };
      }

      await this.sleep(HISTORY_POLL_INTERVAL_MS);
    }
  }

  async cancel(promptId: string): Promise<void> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/api/jobs/${encodeURIComponent(promptId)}/cancel`,
      { method: 'POST' },
    );
    if (!response.ok) {
      throw new Error(`ComfyUI cancellation failed with HTTP ${response.status}`);
    }
  }
}
