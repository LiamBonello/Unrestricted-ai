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
});
