'use client';

import SendRounded from '@mui/icons-material/SendRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState } from 'react';

export interface ComposerProps {
  isGenerating: boolean;
  onSend(text: string): void;
  onStop(): void;
}

export function Composer({ isGenerating, onSend, onStop }: ComposerProps) {
  const [text, setText] = useState('');
  const canSend = !isGenerating && text.trim().length > 0;

  function submit() {
    const normalized = text.trim();
    if (!normalized || isGenerating) return;
    onSend(normalized);
    setText('');
  }

  return (
    <Stack direction="row" spacing={1} alignItems="flex-end">
      <TextField
        fullWidth
        multiline
        minRows={1}
        maxRows={6}
        placeholder="Message Unrestricted AI"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      {isGenerating ? (
        <IconButton aria-label="Stop generation" onClick={onStop} size="large">
          <StopRounded />
        </IconButton>
      ) : (
        <IconButton aria-label="Send message" onClick={submit} disabled={!canSend} size="large">
          <SendRounded />
        </IconButton>
      )}
    </Stack>
  );
}
