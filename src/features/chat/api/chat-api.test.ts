import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamChat } from './chat-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamChat', () => {
  it('parses NDJSON events split across arbitrary response chunks', async () => {
    const chunks = [
      '{"type":"conversation","conversationId":"c1"}\n{"type":"del',
      'ta","text":"Hel"}\n{"type":"delta","text":"lo"}\n',
      '{"type":"done","messageId":"m2"}\n',
    ];
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });

    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));

    const events = [];
    for await (const event of streamChat({ message: 'Hello', signal: new AbortController().signal })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(['conversation', 'delta', 'delta', 'done']);
    expect(events[1]).toEqual({ type: 'delta', text: 'Hel' });
    expect(events[2]).toEqual({ type: 'delta', text: 'lo' });
  });
});
