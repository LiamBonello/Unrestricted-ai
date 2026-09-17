import { describe, expect, it } from 'vitest';
import { MockLLMProvider } from './mock-llm-provider';

describe('MockLLMProvider', () => {
  it('streams multiple deltas from the final user message and then done', async () => {
    const provider = new MockLLMProvider();
    const events = [];
    for await (const event of provider.stream({
      messages: [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hello' },
      ],
    })) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({ type: 'done' });
    expect(events.filter((event) => event.type === 'text-delta').length).toBeGreaterThan(1);
    expect(
      events
        .filter((event) => event.type === 'text-delta')
        .map((event) => (event.type === 'text-delta' ? event.text : ''))
        .join(''),
    ).toBe('Local mock response: Hello');
  });
});
