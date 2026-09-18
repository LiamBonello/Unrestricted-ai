import { getAppContainer } from '@/server/app-container';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const container = getAppContainer();
  const asset = container.assets.getById(id);

  if (!asset) {
    return Response.json({ error: 'Asset not found' }, { status: 404 });
  }

  const bytes = container.assets.readBytes(asset);
  const body = new Blob([Uint8Array.from(bytes)], { type: asset.mimeType });

  return new Response(body, {
    headers: {
      'Content-Type': asset.mimeType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
