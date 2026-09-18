import { mkdirSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { ChatOrchestrator } from '@/server/chat/chat-orchestrator';
import { getAssistantConfig, type AssistantConfig } from '@/server/config/assistant';
import {
  getLlmRuntimeConfig,
  type LlmRuntimeConfig,
} from '@/server/config/llm-runtime';
import { getDataPaths } from '@/server/config/paths';
import { ConversationRepository } from '@/server/conversations/repository';
import { ConversationService } from '@/server/conversations/service';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import { LlamaCppProvider } from '@/server/providers/llama-cpp/provider';
import { LlamaCppServerManager } from '@/server/providers/llama-cpp/server-manager';
import type { LlamaCppServerDependencies } from '@/server/providers/llama-cpp/types';
import { MockLLMProvider } from '@/server/providers/mock-llm-provider';
import type { LLMProvider } from '@/server/providers/types';
import { ResourceManager } from '@/server/resources/resource-manager';
import type { LlmRuntimeStatus } from '@/shared/runtime';

export interface LlmRuntimeHandle {
  getStatus(): LlmRuntimeStatus;
}

export interface AppContainer {
  conversations: ConversationService;
  chat: ChatOrchestrator;
  resources: ResourceManager;
  llmRuntime: LlmRuntimeHandle;
}

export interface AppContainerDependencies {
  database?: DatabaseSync;
  assistantConfig?: AssistantConfig;
  llamaServerDependencies?: LlamaCppServerDependencies;
  llamaFetch?: typeof fetch;
}

const globalState = globalThis as typeof globalThis & {
  __unrestrictedAiContainer?: AppContainer;
};

function createProductionDatabase(): DatabaseSync {
  const paths = getDataPaths();
  mkdirSync(paths.dataDir, { recursive: true });
  return createDatabase(paths.databaseFile);
}

function createMockRuntime(resources: ResourceManager): LlmRuntimeHandle {
  return {
    getStatus: () => ({
      mode: 'mock',
      configured: false,
      status: 'mock',
      residentCapability: resources.getResidentCapability(),
      model: null,
      baseUrl: null,
    }),
  };
}

export function createAppContainer(
  config: LlmRuntimeConfig = getLlmRuntimeConfig(),
  dependencies: AppContainerDependencies = {},
): AppContainer {
  const db = dependencies.database ?? createProductionDatabase();
  runMigrations(db);

  const repository = new ConversationRepository(db);
  const conversations = new ConversationService(repository);
  const resources = new ResourceManager();
  const assistant = dependencies.assistantConfig ?? getAssistantConfig();

  let llm: LLMProvider;
  let llmRuntime: LlmRuntimeHandle;

  if (config.mode === 'mock') {
    llm = new MockLLMProvider();
    llmRuntime = createMockRuntime(resources);
  } else {
    const serverManager = dependencies.llamaServerDependencies
      ? new LlamaCppServerManager(config, dependencies.llamaServerDependencies)
      : new LlamaCppServerManager(config);
    const provider = dependencies.llamaFetch
      ? new LlamaCppProvider(config.baseUrl, dependencies.llamaFetch)
      : new LlamaCppProvider(config.baseUrl);

    resources.registerWorker('llm', serverManager);
    llm = provider;
    llmRuntime = {
      getStatus: () => ({
        mode: 'llama-cpp',
        configured: true,
        status: serverManager.getStatus(),
        residentCapability: resources.getResidentCapability(),
        model: config.model,
        baseUrl: config.baseUrl,
      }),
    };
  }

  return {
    conversations,
    resources,
    llmRuntime,
    chat: new ChatOrchestrator(conversations, llm, resources, assistant.systemPrompt),
  };
}

export function getAppContainer(): AppContainer {
  globalState.__unrestrictedAiContainer ??= createAppContainer();
  return globalState.__unrestrictedAiContainer;
}
