import { getAppContainer } from '@/server/app-container';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const conversation = getAppContainer().conversations.getConversation(id);
  if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });
  return Response.json(conversation);
}
