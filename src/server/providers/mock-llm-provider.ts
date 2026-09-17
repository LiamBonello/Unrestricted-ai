import type { LLMProvider, LLMStreamRequest, LLMStreamEvent } from './types';

export class MockLLMProvider implements LLMProvider {
  readonly id = 'local-mock';

  async *stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent> {
    const response = `Local mock response: ${request.prompt}`;
    const chunks = response.match(/.{1,8}/g) ?? [];

    for (const text of chunks) {
      if (request.signal?.aborted) throw new DOMException('Generation aborted', 'AbortError');
      await Promise.resolve();
      yield { type: 'text-delta', text };
    }

    if (request.signal?.aborted) throw new DOMException('Generation aborted', 'AbortError');
    yield { type: 'done' };
  }
}
