import { getAppContainer } from '@/server/app-container';

export const runtime = 'nodejs';

export function GET() {
  return Response.json(getAppContainer().llmRuntime.getStatus());
}
