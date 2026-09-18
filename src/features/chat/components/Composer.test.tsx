import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from './Composer';

describe('Composer', () => {
  it('keeps Send disabled for whitespace-only input', () => {
    render(<Composer isGenerating={false} onSend={vi.fn()} onStop={vi.fn()} />);
    const input = screen.getByPlaceholderText('Message Unrestricted AI');
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('shows Stop while generation is active', () => {
    render(<Composer isGenerating onSend={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Stop generation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
  });

  it('switches to image intent and submits image mode without exposing model selection', () => {
    const onSend = vi.fn();
    render(<Composer isGenerating={false} onSend={onSend} onStop={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Image generation mode' }));
    fireEvent.change(screen.getByPlaceholderText('Describe an image'), {
      target: { value: 'A neon city in the rain' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSend).toHaveBeenCalledWith({
      mode: 'image',
      text: 'A neon city in the rain',
      attachment: null,
      consentConfirmed: false,
    });
    expect(screen.queryByText(/FLUX|SDXL|checkpoint/i)).not.toBeInTheDocument();
  });

  it('lets the user attach and remove one image without leaving image mode', () => {
    render(<Composer isGenerating={false} onSend={vi.fn()} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Image generation mode' }));

    const file = new File([new Uint8Array([1, 2, 3])], 'reference.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByLabelText('Attach image'), {
      target: { files: [file] },
    });

    expect(screen.getByText('reference.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove attached image' }));
    expect(screen.queryByText('reference.png')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe an image')).toBeInTheDocument();
  });

  it('requires consent confirmation only for explicit edits of an attached image', () => {
    const onSend = vi.fn();
    render(<Composer isGenerating={false} onSend={onSend} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Image generation mode' }));

    const file = new File([new Uint8Array([1])], 'adult-reference.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByLabelText('Attach image'), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe an image'), {
      target: { value: 'Make this adult person nude, explicit' },
    });

    const consent = screen.getByRole('checkbox', {
      name: /I confirm all depicted people are adults and I have consent/i,
    });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();

    fireEvent.click(consent);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSend).toHaveBeenCalledWith({
      mode: 'image',
      text: 'Make this adult person nude, explicit',
      attachment: file,
      consentConfirmed: true,
    });
  });
});
