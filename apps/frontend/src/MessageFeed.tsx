import { Box, Chip, Typography } from '@mui/material';

import { type ApiMessage } from './api.ts';
import { formatTime } from './format.ts';

const SUBTOPIC_COLOR: Record<string, 'default' | 'primary' | 'success' | 'info' | 'warning'> = {
  config: 'primary',
  state: 'success',
  subscribe: 'info',
  write: 'warning',
};

/**
 * Renders a live feed of MQTT messages (newest first) in a compact scrollable panel.
 *
 * @param props - The feed props.
 * @param props.messages - The recent MQTT messages to render.
 * @param props.emptyText - The text shown when there are no messages.
 * @returns The rendered message feed.
 */
export function MessageFeed({ messages, emptyText = 'No MQTT messages yet.' }: { messages: ApiMessage[]; emptyText?: string }) {
  if (messages.length === 0) {
    return (
      <Typography sx={{ p: 2 }} color="text.secondary">
        {emptyText}
      </Typography>
    );
  }

  return (
    <Box sx={{ maxHeight: 260, overflow: 'auto' }}>
      {messages.map((message, index) => (
        <Box key={`${message.time}-${index}`} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, px: 1.5, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {formatTime(message.time)}
          </Typography>
          <Chip label={message.subTopic} size="small" variant="outlined" color={SUBTOPIC_COLOR[message.subTopic] ?? 'default'} sx={{ height: 18 }} />
          <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {message.topic}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {message.payload}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
