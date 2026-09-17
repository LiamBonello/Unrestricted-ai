import type { LLMProvider, LLMStreamRequest, LLMStreamEvent } from './types';

function getLastUserMessage(request: LLMStreamRequest): string {
  for (let index = request.messages.length - 1; index >= 0; index -= 1) {
    const message = request.messages[index];
    if (message?.role === 'user') return message.content;
  }
  throw new Error('LLM request does not contain a user message');
}

export class MockLLMProvider implements LLMProvider {
  readonly id = 'local-mock';

  async *stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent> {
    const response = `Local mock response: ${getLastUserMessage(request)}`;
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
