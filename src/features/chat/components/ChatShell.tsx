import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';

export interface ChatShellProps {
  sidebar: ReactNode;
  messages: ReactNode;
  composer: ReactNode;
}

export function ChatShell({ sidebar, messages, composer }: ChatShellProps) {
  return (
    <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Box
        component="aside"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: 280,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {sidebar}
      </Box>
      <Stack sx={{ minWidth: 0, flex: 1, height: '100%' }}>
        <Box component="main" sx={{ minHeight: 0, flex: 1, overflowY: 'auto' }}>
          {messages}
        </Box>
        <Box sx={{ flexShrink: 0, borderTop: 1, borderColor: 'divider', p: { xs: 1.5, md: 2 }, bgcolor: 'background.default' }}>
          <Box sx={{ maxWidth: 900, mx: 'auto' }}>{composer}</Box>
        </Box>
      </Stack>
    </Box>
  );
}
