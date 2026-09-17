import { describe, expect, it } from 'vitest';
import { encodeNdjson } from './ndjson';

describe('encodeNdjson', () => {
  it('encodes exactly one event per line', () => {
    expect(encodeNdjson({ type: 'delta', text: 'hello' })).toBe(
      '{"type":"delta","text":"hello"}\n',
    );
  });
});
