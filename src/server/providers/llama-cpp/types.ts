export type LlamaCppServerStatus = 'stopped' | 'starting' | 'ready' | 'failed';

export interface ManagedChildProcess {
  once(
    event: 'exit',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  once(event: 'error', listener: (error: Error) => void): this;
  kill(signal?: NodeJS.Signals | number): boolean;
}

export interface SpawnProcessOptions {
  shell: false;
  windowsHide: true;
  env: NodeJS.ProcessEnv;
}

export type SpawnProcess = (
  command: string,
  args: string[],
  options: SpawnProcessOptions,
) => ManagedChildProcess;

export interface LlamaCppServerDependencies {
  spawnProcess: SpawnProcess;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}
