import { getAppContainer } from '@/server/app-container';
import { isImageMimeType } from '@/shared/image';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

interface UploadedImageFile {
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function isUploadedImageFile(value: FormDataEntryValue | null): value is FormDataEntryValue & UploadedImageFile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate.type === 'string'
    && typeof candidate.size === 'number'
    && typeof candidate.arrayBuffer === 'function'
  );
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const image = form.get('image');
  if (!isUploadedImageFile(image)) {
    return Response.json({ error: 'An image file is required' }, { status: 400 });
  }
  if (!isImageMimeType(image.type)) {
    return Response.json({ error: 'Unsupported image type' }, { status: 400 });
  }
  if (image.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: 'Image upload exceeds 25 MB' }, { status: 413 });
  }

  const container = getAppContainer();
  const requestedConversationId = form.get('conversationId');
  let conversationId: string;

  if (typeof requestedConversationId === 'string' && requestedConversationId.trim()) {
    conversationId = requestedConversationId.trim();
    if (!container.conversations.getConversation(conversationId)) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }
  } else {
    conversationId = container.conversations.createConversation().id;
  }

  const asset = container.assets.saveUpload({
    conversationId,
    bytes: new Uint8Array(await image.arrayBuffer()),
    mimeType: image.type,
    width: null,
    height: null,
  });

  return Response.json(
    {
      assetId: asset.id,
      conversationId,
      mimeType: asset.mimeType,
    },
    { status: 201 },
  );
}
