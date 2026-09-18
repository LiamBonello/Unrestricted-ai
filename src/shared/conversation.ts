import type { ImagePart } from './image';

export type MessageRole = 'user' | 'assistant';

export interface TextPart {
  type: 'text';
  text: string;
}

export type MessagePart = TextPart | ImagePart;

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  parts: MessagePart[];
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}
