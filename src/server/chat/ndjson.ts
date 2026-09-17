export function encodeNdjson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}
