import { describe, expect, it } from 'vitest';
import { parseSseDataLines } from './sse';

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const values: string[] = [];
  for await (const value of stream) values.push(value);
  return values;
}

describe('parseSseDataLines', () => {
  it('parses data lines across arbitrary chunks with CRLF and LF separators', async () => {
    const body = streamFromChunks([
      'data: first\r\n\r\nda',
      'ta: second\n\ndata: thi',
      'rd\n\n',
    ]);

    await expect(collect(parseSseDataLines(body))).resolves.toEqual(['first', 'second', 'third']);
  });

  it('propagates an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      collect(parseSseDataLines(streamFromChunks(['data: never\n\n']), controller.signal)),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
