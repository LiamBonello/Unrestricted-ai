import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '@/shared/conversation';
import { MessageList } from './MessageList';

describe('MessageList', () => {
  it('renders ordered text and generated image parts through the local asset endpoint', () => {
    const messages: Message[] = [{
      id: 'm1',
      conversationId: 'c1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Here is the result' },
        { type: 'image', assetId: 'asset-1', alt: 'Generated image' },
      ],
      createdAt: '2026-09-18T10:00:00.000Z',
    }];

    render(<MessageList messages={messages} />);

    expect(screen.getByText('Here is the result')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Generated image' })).toHaveAttribute(
      'src',
      '/api/assets/asset-1',
    );
  });
});
