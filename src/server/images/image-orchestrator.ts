import { AssetService } from '@/server/assets/asset-service';
import { ConversationService } from '@/server/conversations/service';
import { enforceMediaPolicy } from '@/server/policy/media-policy';
import type { ImageProvider } from '@/server/providers/types';
import { ResourceManager } from '@/server/resources/resource-manager';

export interface ImageGenerateInput {
  conversationId?: string;
  prompt: string;
  inputAssetId?: string;
  consentConfirmed?: boolean;
  width: number;
  height: number;
  seed: number;
  signal?: AbortSignal;
}

export interface ImageGenerateResult {
  conversationId: string;
  messageId: string;
  assetId: string;
}

export class ImageOrchestrator {
  constructor(
    private readonly conversations: ConversationService,
    private readonly assets: AssetService,
    private readonly provider: ImageProvider,
    private readonly resources: ResourceManager,
  ) {}

  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    const prompt = input.prompt.trim();
    if (!prompt) throw new Error('Image prompt cannot be empty');

    const inputAsset = input.inputAssetId
      ? this.assets.getById(input.inputAssetId)
      : null;
    if (input.inputAssetId && !inputAsset) throw new Error('Input image asset not found');

    const policy = enforceMediaPolicy({
      prompt,
      hasUploadedInput: inputAsset !== null,
      consentConfirmed: input.consentConfirmed,
    });

    let conversationId = input.conversationId;
    if (conversationId) {
      if (!this.conversations.getConversation(conversationId)) {
        throw new Error('Conversation not found');
      }
    } else if (inputAsset) {
      conversationId = inputAsset.conversationId;
    } else {
      conversationId = this.conversations.createConversation().id;
    }

    if (inputAsset && inputAsset.conversationId !== conversationId) {
      throw new Error('Input image asset does not belong to this conversation');
    }

    this.conversations.appendTextMessage(conversationId, 'user', prompt);

    const lease = await this.resources.acquire('image');
    try {
      const generated = await this.provider.generate({
        prompt: policy.normalizedPrompt,
        contentMode: policy.contentMode,
        width: input.width,
        height: input.height,
        seed: input.seed,
        input: inputAsset
          ? {
              bytes: this.assets.readBytes(inputAsset),
              mimeType: inputAsset.mimeType,
            }
          : undefined,
        signal: input.signal,
      });

      const asset = this.assets.saveGeneratedImage({
        conversationId,
        bytes: generated.bytes,
        mimeType: generated.mimeType,
        width: input.width,
        height: input.height,
      });
      const message = this.conversations.appendImageMessage(
        conversationId,
        'assistant',
        asset.id,
        'Generated image',
      );

      return {
        conversationId,
        messageId: message.id,
        assetId: asset.id,
      };
    } finally {
      lease.release();
    }
  }
}
