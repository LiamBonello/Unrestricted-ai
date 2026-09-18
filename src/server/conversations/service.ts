import { randomUUID } from 'node:crypto';
import type { Conversation, ConversationSummary, Message, MessageRole } from '@/shared/conversation';
import { ConversationRepository } from './repository';

export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  createConversation(title = 'New conversation'): ConversationSummary {
    const timestamp = this.now();
    const conversation: ConversationSummary = {
      id: this.createId(),
      title: title.trim() || 'New conversation',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.repository.createConversation(conversation);
    return conversation;
  }

  listConversations(): ConversationSummary[] {
    return this.repository.listConversations();
  }

  getConversation(id: string): Conversation | null {
    return this.repository.getConversation(id);
  }

  appendTextMessage(conversationId: string, role: MessageRole, text: string): Message {
    const normalized = text.trim();
    if (!normalized) throw new Error('Message text cannot be empty');
    if (!this.repository.getConversation(conversationId)) throw new Error('Conversation not found');

    const createdAt = this.now();
    const message: Message = {
      id: this.createId(),
      conversationId,
      role,
      parts: [{ type: 'text', text: normalized }],
      createdAt,
    };
    this.repository.insertMessage(message);
    this.repository.touchConversation(conversationId, createdAt);
    return message;
  }

  appendImageMessage(
    conversationId: string,
    role: MessageRole,
    assetId: string,
    alt = 'Generated image',
  ): Message {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) throw new Error('Image asset ID cannot be empty');
    if (!this.repository.getConversation(conversationId)) throw new Error('Conversation not found');

    const createdAt = this.now();
    const message: Message = {
      id: this.createId(),
      conversationId,
      role,
      parts: [{
        type: 'image',
        assetId: normalizedAssetId,
        alt: alt.trim() || 'Generated image',
      }],
      createdAt,
    };
    this.repository.insertMessage(message);
    this.repository.touchConversation(conversationId, createdAt);
    return message;
  }
}
