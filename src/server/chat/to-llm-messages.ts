import type { Conversation } from '@/shared/conversation';
import type { LLMMessage } from '@/server/providers/types';

export function toLLMMessages(conversation: Conversation, systemPrompt: string): LLMMessage[] {
  const messages: LLMMessage[] = [];
  const normalizedSystemPrompt = systemPrompt.trim();

  if (normalizedSystemPrompt) {
    messages.push({ role: 'system', content: normalizedSystemPrompt });
  }

  for (const message of conversation.messages) {
    const content = message.parts
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('');

    if (!content) continue;
    messages.push({ role: message.role, content });
  }

  return messages;
}
