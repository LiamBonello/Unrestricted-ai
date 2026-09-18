import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatClient } from './ChatClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChatClient image flow', () => {
  it('uses the image generation endpoint when the composer is in image mode', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/conversations' && (!init?.method || init.method === 'GET')) {
        return Response.json([]);
      }
      if (url === '/api/images/generate' && init?.method === 'POST') {
        return Response.json({
          conversationId: 'c1',
          messageId: 'm2',
          assetId: 'a1',
        }, { status: 201 });
      }
      if (url === '/api/conversations/c1') {
        return Response.json({
          id: 'c1',
          title: 'New conversation',
          createdAt: '2026-09-18T10:00:00.000Z',
          updatedAt: '2026-09-18T10:00:01.000Z',
          messages: [
            {
              id: 'm1',
              conversationId: 'c1',
              role: 'user',
              parts: [{ type: 'text', text: 'A silver robot' }],
              createdAt: '2026-09-18T10:00:00.000Z',
            },
            {
              id: 'm2',
              conversationId: 'c1',
              role: 'assistant',
              parts: [{ type: 'image', assetId: 'a1', alt: 'Generated image' }],
              createdAt: '2026-09-18T10:00:01.000Z',
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ChatClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/conversations',
      { cache: 'no-store' },
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Image generation mode' }));
    fireEvent.change(screen.getByPlaceholderText('Describe an image'), {
      target: { value: 'A silver robot' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/images/generate',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await screen.findByRole('img', { name: 'Generated image' });
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
