import { Box, Typography } from '@mui/material';

import { getState } from './api.ts';
import { usePolling } from './usePolling.ts';

const POLL_INTERVAL_MS = 2000;

/**
 * Polls and renders the live state of a single device as pretty-printed JSON.
 *
 * Used as the focused view shown inside the device `configUrl` iframe.
 *
 * @param {object} props - The component props.
 * @param {string} props.id - The deviceId whose state is shown.
 * @returns {JSX.Element} The rendered device state view.
 */
export function DeviceState({ id }: { id: string }) {
  const { data, error } = usePolling(() => getState(id), POLL_INTERVAL_MS);

  if (error) {
    return (
      <Typography sx={{ p: 2 }} color="error">
        {error}
      </Typography>
    );
  }

  if (data === null || data === undefined) {
    return (
      <Typography sx={{ p: 2 }} color="text.secondary">
        No state available for device "{id}".
      </Typography>
    );
  }

  return (
    <Box component="pre" sx={{ m: 0, p: 1.5, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'auto' }}>
      {data}
    </Box>
  );
}
