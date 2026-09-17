import { getAppContainer } from '@/server/app-container';

export const runtime = 'nodejs';

export function GET() {
  return Response.json(getAppContainer().conversations.listConversations());
}

export function POST() {
  return Response.json(getAppContainer().conversations.createConversation(), { status: 201 });
}
