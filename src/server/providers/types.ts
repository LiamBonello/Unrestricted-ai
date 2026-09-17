export interface LLMStreamRequest {
  prompt: string;
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
  inputImagePath?: string;
}

export interface ImageProvider {
  readonly id: string;
  generate(request: ImageGenerationRequest): Promise<{ outputPath: string }>;
}

export type VideoGenerationRequest =
  | { mode: 'text-to-video'; prompt: string }
  | { mode: 'image-to-video'; prompt: string; inputImagePath: string };

export interface VideoProvider {
  readonly id: string;
  generate(request: VideoGenerationRequest): Promise<{ outputPath: string }>;
}
