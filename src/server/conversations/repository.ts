import type Database from 'better-sqlite3';
import type {
  Conversation,
  ConversationSummary,
  Message,
  MessagePart,
  MessageRole,
  TextPart,
} from '@/shared/conversation';

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  parts_json: string;
  created_at: string;
}

function isTextPart(value: unknown): value is TextPart {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.type === 'text' && typeof candidate.text === 'string';
}

function parseParts(value: string): MessagePart[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(isTextPart)) {
    throw new Error('Stored message parts are invalid');
  }
  return parsed;
}

function mapConversation(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    parts: parseParts(row.parts_json),
    createdAt: row.created_at,
  };
}

export class ConversationRepository {
  constructor(private readonly db: Database.Database) {}

  createConversation(conversation: ConversationSummary): void {
    this.db
      .prepare(`
        INSERT INTO conversations (id, title, created_at, updated_at)
        VALUES (@id, @title, @createdAt, @updatedAt)
      `)
      .run(conversation);
  }

  listConversations(): ConversationSummary[] {
    const rows = this.db
      .prepare(`
        SELECT id, title, created_at, updated_at
        FROM conversations
        ORDER BY updated_at DESC, id DESC
      `)
      .all() as ConversationRow[];
    return rows.map(mapConversation);
  }

  getConversation(id: string): Conversation | null {
    const row = this.db
      .prepare('SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?')
      .get(id) as ConversationRow | undefined;
    if (!row) return null;

    const messageRows = this.db
      .prepare(`
        SELECT id, conversation_id, role, parts_json, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `)
      .all(id) as MessageRow[];

    return { ...mapConversation(row), messages: messageRows.map(mapMessage) };
  }

  insertMessage(message: Message): void {
    this.db
      .prepare(`
        INSERT INTO messages (id, conversation_id, role, parts_json, created_at)
        VALUES (@id, @conversationId, @role, @partsJson, @createdAt)
      `)
      .run({
        id: message.id,
        conversationId: message.conversationId,
        role: message.role,
        partsJson: JSON.stringify(message.parts),
        createdAt: message.createdAt,
      });
  }

  touchConversation(id: string, updatedAt: string): void {
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(updatedAt, id);
  }
}
