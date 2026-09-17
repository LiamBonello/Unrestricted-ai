import { describe, expect, it } from 'vitest';
import { MockLLMProvider } from './mock-llm-provider';

describe('MockLLMProvider', () => {
  it('streams multiple deltas and then done', async () => {
    const provider = new MockLLMProvider();
    const events = [];
    for await (const event of provider.stream({ prompt: 'Hello' })) events.push(event);

    expect(events.at(-1)).toEqual({ type: 'done' });
    expect(events.filter((event) => event.type === 'text-delta').length).toBeGreaterThan(1);
  });
});
