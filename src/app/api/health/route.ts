export const runtime = 'nodejs';

export function GET() {
  return Response.json({ status: 'ok', app: 'Unrestricted AI', runtime: 'local' });
}
