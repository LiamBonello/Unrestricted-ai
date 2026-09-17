import type {
  LLMProvider,
  LLMStreamEvent,
  LLMStreamRequest,
} from '@/server/providers/types';
import { parseSseDataLines } from './sse';

type FetchLike = typeof fetch;

interface LlamaCppDelta {
  content?: unknown;
  reasoning_content?: unknown;
}

interface LlamaCppChunk {
  choices?: Array<{
    delta?: LlamaCppDelta;
  }>;
}

export class LlamaCppProvider implements LLMProvider {
  readonly id = 'llama-cpp';

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async *stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent> {
    const response = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'local',
          messages: request.messages,
          stream: true,
        }),
        signal: request.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`llama.cpp request failed with HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('llama.cpp response did not include a stream body');
    }

    for await (const data of parseSseDataLines(response.body, request.signal)) {
      if (data === '[DONE]') {
        yield { type: 'done' };
        return;
      }

      let chunk: LlamaCppChunk;
      try {
        chunk = JSON.parse(data) as LlamaCppChunk;
      } catch {
        throw new Error('Invalid llama.cpp stream JSON');
      }

      const content = chunk.choices?.[0]?.delta?.content;
      if (typeof content === 'string' && content.length > 0) {
        yield { type: 'text-delta', text: content };
      }
    }

    yield { type: 'done' };
  }
}
