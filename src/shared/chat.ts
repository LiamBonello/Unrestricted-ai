export type ChatStreamEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string };

export type ChatTransportEvent =
  | ChatStreamEvent
  | { type: 'error'; message: string };
