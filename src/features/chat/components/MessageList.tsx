import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Message } from '@/shared/conversation';

export interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box sx={{ minHeight: '100%', display: 'grid', placeItems: 'center', px: 3 }}>
        <Stack spacing={1} alignItems="center">
          <Typography variant="h4" fontWeight={600}>Unrestricted AI</Typography>
          <Typography color="text.secondary" textAlign="center">
            Your private, local-first AI assistant.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ width: '100%', maxWidth: 900, mx: 'auto', py: 4, px: { xs: 2, md: 4 } }}>
      {messages.map((message) => {
        const text = message.parts
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('');
        const isUser = message.role === 'user';

        return (
          <Box
            key={message.id}
            sx={{
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: isUser ? '78%' : '92%',
              borderRadius: 3,
              px: isUser ? 2 : 0,
              py: isUser ? 1.25 : 0.5,
              bgcolor: isUser ? 'action.selected' : 'transparent',
            }}
          >
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
