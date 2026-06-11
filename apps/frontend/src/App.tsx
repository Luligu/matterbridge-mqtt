import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { Alert, Box, Container, CssBaseline, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { useMemo, useState } from 'react';

import { getDevices, getMessages, getOutgoing } from './api.ts';
import matterbridgeLogo from './assets/matterbridge.svg';
import { DevicesTable } from './DevicesTable.tsx';
import { MessageFeed } from './MessageFeed.tsx';
import { createAppTheme, type ThemeMode } from './theme.ts';
import { usePolling } from './usePolling.ts';

const THEME_MODE_KEY = 'themeMode';
const POLL_INTERVAL_MS = 2000;

/**
 * Reads the initial theme mode from localStorage, falling back to the OS preference.
 *
 * @returns The initial theme mode.
 */
function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Single-page app for the matterbridge-mqtt plugin frontend.
 *
 * @returns The rendered page.
 */
export default function App() {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const toggleMode = () => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_MODE_KEY, next);
      return next;
    });
  };

  const devices = usePolling(getDevices, POLL_INTERVAL_MS);
  const messages = usePolling(getMessages, POLL_INTERVAL_MS);
  const outgoing = usePolling(getOutgoing, POLL_INTERVAL_MS);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img src={matterbridgeLogo} alt="Matterbridge" width={64} height={64} />
            <Typography variant="h4" component="h1">
              Matterbridge MQTT plugin
            </Typography>
          </Box>
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton onClick={toggleMode} color="inherit" aria-label="toggle light/dark theme">
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
        </Box>

        {(devices.error ?? messages.error ?? outgoing.error) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Cannot reach the plugin API: {devices.error ?? messages.error ?? outgoing.error}
          </Alert>
        )}

        <Typography variant="h6" sx={{ mb: 1 }}>
          Devices
        </Typography>
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <DevicesTable devices={devices.data ?? []} />
        </Paper>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Incoming MQTT messages
        </Typography>
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <MessageFeed messages={messages.data ?? []} emptyText="No incoming MQTT messages yet." />
        </Paper>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Outgoing MQTT messages
        </Typography>
        <Paper variant="outlined">
          <MessageFeed messages={outgoing.data ?? []} emptyText="No outgoing MQTT messages yet." />
        </Paper>
      </Container>
    </ThemeProvider>
  );
}
