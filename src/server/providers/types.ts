export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMStreamRequest {
  messages: readonly LLMMessage[];
  signal?: AbortSignal;
}

export type LLMStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'done' };

export interface LLMProvider {
  readonly id: string;
  stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent>;
}

export interface ImageGenerationRequest {
  prompt: string;
  contentMode: 'general' | 'adult-explicit';
  width: number;
  height: number;
  seed: number;
  input?: {
    bytes: Uint8Array;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  };
  signal?: AbortSignal;
}

export interface ImageGenerationResult {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface ImageProvider {
  readonly id: string;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export type VideoGenerationRequest =
  | { mode: 'text-to-video'; prompt: string }
  | { mode: 'image-to-video'; prompt: string; inputImagePath: string };

export interface VideoProvider {
  readonly id: string;
  generate(request: VideoGenerationRequest): Promise<{ outputPath: string }>;
}
