import { describe, expect, it, vi } from 'vitest';
import type { LLMStreamEvent } from '@/server/providers/types';
import { LlamaCppProvider } from './provider';

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function sseResponse(chunks: string[]): Response {
  return new Response(streamFromChunks(chunks), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function collect(stream: AsyncIterable<LLMStreamEvent>): Promise<LLMStreamEvent[]> {
  const events: LLMStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('LlamaCppProvider', () => {
  it('streams visible delta.content and sends only the provider message contract', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => sseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const provider = new LlamaCppProvider('http://127.0.0.1:8091', fetchImpl);
    const controller = new AbortController();
    const messages = [
      { role: 'system' as const, content: 'System' },
      { role: 'user' as const, content: 'Hello' },
    ];

    await expect(collect(provider.stream({ messages, signal: controller.signal }))).resolves.toEqual([
      { type: 'text-delta', text: 'Hello' },
      { type: 'text-delta', text: ' world' },
      { type: 'done' },
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8091/v1/chat/completions');
    expect(init?.method).toBe('POST');
    expect(init?.signal).toBe(controller.signal);
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'local',
      messages,
      stream: true,
    });
  });

  it('does not surface reasoning_content from model stream chunks', async () => {
    const fetchImpl = vi.fn(async () => sseResponse([
      'data: {"choices":[{"delta":{"reasoning_content":"private reasoning"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Final answer"}}]}\n\n',
      'data: [DONE]\n\n',
    ]));
    const provider = new LlamaCppProvider('http://127.0.0.1:8091', fetchImpl);

    await expect(collect(provider.stream({
      messages: [{ role: 'user', content: 'Question' }],
    }))).resolves.toEqual([
      { type: 'text-delta', text: 'Final answer' },
      { type: 'done' },
    ]);
  });

  it('rejects non-success HTTP responses', async () => {
    const provider = new LlamaCppProvider(
      'http://127.0.0.1:8091',
      vi.fn(async () => new Response('loading', { status: 503 })),
    );

    await expect(collect(provider.stream({
      messages: [{ role: 'user', content: 'Hello' }],
    }))).rejects.toThrow('HTTP 503');
  });

  it('rejects malformed JSON stream data as a provider error', async () => {
    const provider = new LlamaCppProvider(
      'http://127.0.0.1:8091',
      vi.fn(async () => sseResponse(['data: {not-json}\n\n'])),
    );

    await expect(collect(provider.stream({
      messages: [{ role: 'user', content: 'Hello' }],
    }))).rejects.toThrow('Invalid llama.cpp stream JSON');
  });
});
