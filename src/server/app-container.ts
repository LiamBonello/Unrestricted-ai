import { mkdirSync } from 'node:fs';
import { ChatOrchestrator } from '@/server/chat/chat-orchestrator';
import { getDataPaths } from '@/server/config/paths';
import { ConversationRepository } from '@/server/conversations/repository';
import { ConversationService } from '@/server/conversations/service';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import { MockLLMProvider } from '@/server/providers/mock-llm-provider';
import { ResourceManager } from '@/server/resources/resource-manager';

export interface AppContainer {
  conversations: ConversationService;
  chat: ChatOrchestrator;
  resources: ResourceManager;
}

const globalState = globalThis as typeof globalThis & {
  __unrestrictedAiContainer?: AppContainer;
};

function createContainer(): AppContainer {
  const paths = getDataPaths();
  mkdirSync(paths.dataDir, { recursive: true });
  const db = createDatabase(paths.databaseFile);
  runMigrations(db);

  const repository = new ConversationRepository(db);
  const conversations = new ConversationService(repository);
  const resources = new ResourceManager();
  const llm = new MockLLMProvider();

  return {
    conversations,
    resources,
    chat: new ChatOrchestrator(conversations, llm, resources),
  };
}

export function getAppContainer(): AppContainer {
  globalState.__unrestrictedAiContainer ??= createContainer();
  return globalState.__unrestrictedAiContainer;
}
