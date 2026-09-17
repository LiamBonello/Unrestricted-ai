import type { ChatStreamEvent } from '@/shared/chat';
import { ConversationService } from '@/server/conversations/service';
import type { LLMProvider } from '@/server/providers/types';
import { ResourceManager } from '@/server/resources/resource-manager';
import { toLLMMessages } from './to-llm-messages';

export interface ChatInput {
  conversationId?: string;
  text: string;
  signal?: AbortSignal;
}

export class ChatOrchestrator {
  constructor(
    private readonly conversations: ConversationService,
    private readonly llm: LLMProvider,
    private readonly resources: ResourceManager,
    private readonly systemPrompt: string,
  ) {}

  async *stream(input: ChatInput): AsyncIterable<ChatStreamEvent> {
    const text = input.text.trim();
    if (!text) throw new Error('Message text cannot be empty');

    let conversationId = input.conversationId;
    if (conversationId) {
      if (!this.conversations.getConversation(conversationId)) throw new Error('Conversation not found');
    } else {
      conversationId = this.conversations.createConversation().id;
      yield { type: 'conversation', conversationId };
    }

    this.conversations.appendTextMessage(conversationId, 'user', text);
    const conversation = this.conversations.getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found after appending message');

    const lease = await this.resources.acquire('llm');
    let assistantText = '';

    try {
      for await (const event of this.llm.stream({
        messages: toLLMMessages(conversation, this.systemPrompt),
        signal: input.signal,
      })) {
        if (event.type === 'text-delta') {
          assistantText += event.text;
          yield { type: 'delta', text: event.text };
        }
      }

      if (!assistantText.trim()) throw new Error('Provider returned an empty response');
      const message = this.conversations.appendTextMessage(conversationId, 'assistant', assistantText);
      yield { type: 'done', messageId: message.id };
    } finally {
      lease.release();
    }
  }
}
