export type LlmRuntimeMode = 'mock' | 'llama-cpp';

export type LlmRuntimeWorkerStatus = 'mock' | 'stopped' | 'starting' | 'ready' | 'failed';

export interface LlmRuntimeStatus {
  mode: LlmRuntimeMode;
  configured: boolean;
  status: LlmRuntimeWorkerStatus;
  residentCapability: 'llm' | 'image' | 'video' | null;
  model: string | null;
  baseUrl: string | null;
}

export type ImageRuntimeMode = 'mock' | 'comfyui';

export type ImageRuntimeWorkerStatus = 'mock' | 'stopped' | 'starting' | 'ready' | 'failed';

export interface ImageRuntimeStatus {
  mode: ImageRuntimeMode;
  configured: boolean;
  status: ImageRuntimeWorkerStatus;
  residentCapability: 'llm' | 'image' | 'video' | null;
  profile: string | null;
  baseUrl: string | null;
}
