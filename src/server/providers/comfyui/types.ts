export type ComfyUiServerStatus = 'stopped' | 'starting' | 'ready' | 'failed';

export interface ComfyUiManagedChildProcess {
  once(
    event: 'exit',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  once(event: 'error', listener: (error: Error) => void): this;
  kill(signal?: NodeJS.Signals | number): boolean;
}

export interface ComfyUiSpawnProcessOptions {
  shell: false;
  windowsHide: true;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export type ComfyUiSpawnProcess = (
  command: string,
  args: string[],
  options: ComfyUiSpawnProcessOptions,
) => ComfyUiManagedChildProcess;

export interface ComfyUiServerDependencies {
  spawnProcess: ComfyUiSpawnProcess;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

export interface ComfyWorkflowNode {
  class_type: string;
  inputs: Record<string, unknown>;
}

export type ComfyWorkflow = Record<string, ComfyWorkflowNode>;
