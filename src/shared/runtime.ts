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
