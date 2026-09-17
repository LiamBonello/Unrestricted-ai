import type { ChatTransportEvent } from '@/shared/chat';
import { getAppContainer } from '@/server/app-container';
import { encodeNdjson } from '@/server/chat/ndjson';

export const runtime = 'nodejs';

interface ChatRequestBody {
  conversationId?: string;
  message: string;
}

function isChatRequestBody(value: unknown): value is ChatRequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.message === 'string' &&
    (record.conversationId === undefined || typeof record.conversationId === 'string')
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isChatRequestBody(body) || !body.message.trim()) {
    return Response.json({ error: 'A non-empty message is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of getAppContainer().chat.stream({
          conversationId: body.conversationId,
          text: body.message,
          signal: request.signal,
        })) {
          controller.enqueue(encoder.encode(encodeNdjson(event)));
        }
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === 'AbortError') && !request.signal.aborted) {
          console.error(error);
          const safeError: ChatTransportEvent = { type: 'error', message: 'Generation failed' };
          controller.enqueue(encoder.encode(encodeNdjson(safeError)));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
