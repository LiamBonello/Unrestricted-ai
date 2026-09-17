import AddRounded from '@mui/icons-material/AddRounded';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ConversationSummary } from '@/shared/conversation';

export interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  onNew(): void;
  onSelect(id: string): void;
}

export function ConversationSidebar({ conversations, activeId, onNew, onSelect }: ConversationSidebarProps) {
  return (
    <Stack sx={{ height: '100%', p: 2 }} spacing={2}>
      <Typography variant="h6" sx={{ px: 1, fontWeight: 700 }}>
        Unrestricted AI
      </Typography>
      <Button startIcon={<AddRounded />} variant="outlined" onClick={onNew} fullWidth>
        New conversation
      </Button>
      <List disablePadding sx={{ overflowY: 'auto' }}>
        {conversations.map((conversation) => (
          <ListItemButton
            key={conversation.id}
            selected={conversation.id === activeId}
            onClick={() => onSelect(conversation.id)}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemText
              primary={conversation.title}
              slotProps={{ primary: { noWrap: true } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Stack>
  );
}
