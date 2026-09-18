import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/runtime/llm', () => {
  it('returns safe diagnostics without filesystem paths or environment variables', async () => {
    delete process.env.UNRESTRICTED_AI_LLM_PROVIDER;
    process.env.UNRESTRICTED_AI_DATA_DIR = `./data/test-llm-runtime-${process.pid}`;

    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      mode: 'mock',
      configured: false,
      status: 'mock',
      residentCapability: null,
      model: null,
      baseUrl: null,
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(process.cwd());
    expect(serialized).not.toContain('UNRESTRICTED_AI_');
  });
});
