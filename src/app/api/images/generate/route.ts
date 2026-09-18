import { randomInt } from 'node:crypto';
import { getAppContainer } from '@/server/app-container';
import { MediaPolicyError } from '@/server/policy/media-policy';
import { ImageProviderConfigurationError } from '@/server/providers/comfyui/provider';

export const runtime = 'nodejs';

interface GenerateImageRequestBody {
  conversationId?: string;
  prompt: string;
  inputAssetId?: string;
  consentConfirmed?: boolean;
}

function isGenerateImageRequestBody(value: unknown): value is GenerateImageRequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.prompt === 'string'
    && (record.conversationId === undefined || typeof record.conversationId === 'string')
    && (record.inputAssetId === undefined || typeof record.inputAssetId === 'string')
    && (record.consentConfirmed === undefined || typeof record.consentConfirmed === 'boolean')
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isGenerateImageRequestBody(body) || !body.prompt.trim()) {
    return Response.json({ error: 'A non-empty image prompt is required' }, { status: 400 });
  }

  try {
    const result = await getAppContainer().images.generate({
      conversationId: body.conversationId,
      prompt: body.prompt,
      inputAssetId: body.inputAssetId,
      consentConfirmed: body.consentConfirmed,
      width: 768,
      height: 768,
      seed: randomInt(0, 2_147_483_647),
      signal: request.signal,
    });

    return Response.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof MediaPolicyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ImageProviderConfigurationError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof DOMException && error.name === 'AbortError') throw error;

    console.error(error);
    return Response.json({ error: 'Image generation failed' }, { status: 500 });
  }
}
