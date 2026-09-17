'use client';

import { useEffect, useRef, useState } from 'react';
import type { Message, ConversationSummary } from '@/shared/conversation';
import { getConversation, listConversations, streamChat } from '@/features/chat/api/chat-api';
import { ChatShell } from './ChatShell';
import { Composer } from './Composer';
import { ConversationSidebar } from './ConversationSidebar';
import { MessageList } from './MessageList';

export function ChatClient() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listConversations()
      .then((items) => {
        if (!cancelled) setConversations(items);
      })
      .catch((error: unknown) => console.error(error));
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  async function handleSend(text: string) {
    if (isGenerating) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);

    const optimisticUserId = crypto.randomUUID();
    const optimisticAssistantId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    setMessages((current) => [
      ...current,
      { id: optimisticUserId, conversationId: activeId ?? 'pending', role: 'user', parts: [{ type: 'text', text }], createdAt },
      { id: optimisticAssistantId, conversationId: activeId ?? 'pending', role: 'assistant', parts: [{ type: 'text', text: '' }], createdAt },
    ]);

    let resolvedConversationId = activeId;
    try {
      for await (const event of streamChat({ conversationId: activeId ?? undefined, message: text, signal: controller.signal })) {
        if (event.type === 'conversation') {
          resolvedConversationId = event.conversationId;
          setActiveId(event.conversationId);
        }
        if (event.type === 'delta') {
          setMessages((current) => current.map((message) =>
            message.id === optimisticAssistantId
              ? { ...message, parts: [{ type: 'text', text: `${message.parts[0]?.type === 'text' ? message.parts[0].text : ''}${event.text}` }] }
              : message,
          ));
        }
      }

      if (resolvedConversationId) {
        const [conversation, summaries] = await Promise.all([
          getConversation(resolvedConversationId),
          listConversations(),
        ]);
        setMessages(conversation.messages);
        setConversations(summaries);
      }
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) console.error(error);
      if (resolvedConversationId) {
        const conversation = await getConversation(resolvedConversationId).catch(() => null);
        if (conversation) setMessages(conversation.messages);
      }
    } finally {
      abortRef.current = null;
      setIsGenerating(false);
    }
  }

  async function handleSelect(id: string) {
    const conversation = await getConversation(id);
    setActiveId(id);
    setMessages(conversation.messages);
  }

  function handleNew() {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <ChatShell
      sidebar={(
        <ConversationSidebar
          conversations={conversations}
          activeId={activeId}
          onNew={handleNew}
          onSelect={(id) => void handleSelect(id).catch((error: unknown) => console.error(error))}
        />
      )}
      messages={<MessageList messages={messages} />}
      composer={<Composer isGenerating={isGenerating} onSend={(text) => void handleSend(text)} onStop={handleStop} />}
    />
  );
}
