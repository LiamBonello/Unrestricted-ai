export interface AssistantConfig {
  systemPrompt: string;
}

export function getAssistantConfig(env: NodeJS.ProcessEnv = process.env): AssistantConfig {
  return {
    systemPrompt:
      env.UNRESTRICTED_AI_SYSTEM_PROMPT?.trim()
      || 'You are Unrestricted AI, a private local AI assistant.',
  };
}
