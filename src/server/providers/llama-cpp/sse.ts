function abortError(signal?: AbortSignal): unknown {
  if (!signal?.aborted) return undefined;
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function findEventBoundary(buffer: string): { index: number; length: number } | undefined {
  const matches = [
    { index: buffer.indexOf('\r\n\r\n'), length: 4 },
    { index: buffer.indexOf('\n\n'), length: 2 },
    { index: buffer.indexOf('\r\r'), length: 2 },
  ].filter((match) => match.index >= 0);

  if (matches.length === 0) return undefined;
  return matches.reduce((earliest, current) => current.index < earliest.index ? current : earliest);
}

function getEventData(event: string): string | undefined {
  const dataLines = event
    .split(/\r\n|\n|\r/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''));

  return dataLines.length > 0 ? dataLines.join('\n') : undefined;
}

export async function* parseSseDataLines(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const initialAbort = abortError(signal);
  if (initialAbort) throw initialAbort;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const onAbort = () => {
    void reader.cancel(signal?.reason);
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      const readAbort = abortError(signal);
      if (readAbort) throw readAbort;

      if (value) buffer += decoder.decode(value, { stream: !done });
      if (done) buffer += decoder.decode();

      let boundary = findEventBoundary(buffer);
      while (boundary) {
        const event = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const data = getEventData(event);
        if (data !== undefined) yield data;
        boundary = findEventBoundary(buffer);
      }

      if (done) break;
    }

    if (buffer.length > 0) {
      const data = getEventData(buffer);
      if (data !== undefined) yield data;
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}
