import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { Alert, Box, Container, CssBaseline, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { useCallback, useMemo, useState } from 'react';

import { getDevices, getMessages, getOutgoing } from './api.ts';
import matterbridgeLogo from './assets/matterbridge.svg';
import { DevicesTable } from './DevicesTable.tsx';
import { DeviceState } from './DeviceState.tsx';
import { MessageFeed } from './MessageFeed.tsx';
import { createAppTheme, type ThemeMode } from './theme.ts';
import { usePolling } from './usePolling.ts';

const THEME_MODE_KEY = 'themeMode';
const POLL_INTERVAL_MS = 2000;

/**
 * Reads the initial theme mode from localStorage, falling back to the OS preference.
 *
 * @returns {ThemeMode} The initial theme mode.
 */
function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * The common page header: plugin logo, title and the light/dark theme toggle.
 *
 * @param {object} props - The component props.
 * @param {ThemeMode} props.mode - The active theme mode, for the toggle icon and tooltip.
 * @param {() => void} props.onToggleMode - Handler that toggles between light and dark mode.
 * @returns {JSX.Element} The rendered header.
 */
function Header({ mode, onToggleMode }: { mode: ThemeMode; onToggleMode: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <img src={matterbridgeLogo} alt="Matterbridge" width={64} height={64} />
        <Typography variant="h4" component="h1">
          Matterbridge MQTT plugin
        </Typography>
      </Box>
      <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        <IconButton onClick={onToggleMode} color="inherit" aria-label="toggle light/dark theme">
          {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/**
 * The full plugin dashboard: devices table and incoming/outgoing MQTT message feeds.
 *
 * @param {object} props - The component props.
 * @param {ThemeMode} props.mode - The active theme mode, for the toggle icon and tooltip.
 * @param {() => void} props.onToggleMode - Handler that toggles between light and dark mode.
 * @returns {JSX.Element} The rendered dashboard.
 */
function Dashboard({ mode, onToggleMode }: { mode: ThemeMode; onToggleMode: () => void }) {
  const devices = usePolling(getDevices, POLL_INTERVAL_MS);
  const messages = usePolling(getMessages, POLL_INTERVAL_MS);
  const outgoing = usePolling(getOutgoing, POLL_INTERVAL_MS);

  const deviceRows = useMemo(() => devices.data ?? [], [devices.data]);
  const incomingMessages = useMemo(() => messages.data ?? [], [messages.data]);
  const outgoingMessages = useMemo(() => outgoing.data ?? [], [outgoing.data]);

  return (
    <Container maxWidth="lg" sx={{ pb: 4 }}>
      <Header mode={mode} onToggleMode={onToggleMode} />

      {(devices.error ?? messages.error ?? outgoing.error) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Cannot reach the plugin API: {devices.error ?? messages.error ?? outgoing.error}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Devices
      </Typography>
      <Paper variant="outlined" sx={{ mb: 4 }}>
        <DevicesTable devices={deviceRows} />
      </Paper>

      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Incoming MQTT messages
      </Typography>
      <Paper variant="outlined" sx={{ mb: 4 }}>
        <MessageFeed messages={incomingMessages} emptyText="No incoming MQTT messages yet." />
      </Paper>

      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Outgoing MQTT messages
      </Typography>
      <Paper variant="outlined">
        <MessageFeed messages={outgoingMessages} emptyText="No outgoing MQTT messages yet." />
      </Paper>
    </Container>
  );
}

/**
 * The focused single-device view: the common header above that device's live state.
 *
 * @param {object} props - The component props.
 * @param {string} props.id - The deviceId whose state is shown.
 * @param {ThemeMode} props.mode - The active theme mode, for the toggle icon and tooltip.
 * @param {() => void} props.onToggleMode - Handler that toggles between light and dark mode.
 * @returns {JSX.Element} The rendered device state page.
 */
function DashboardState({ id, mode, onToggleMode }: { id: string; mode: ThemeMode; onToggleMode: () => void }) {
  return (
    <Container maxWidth="lg" sx={{ pb: 4 }}>
      <Header mode={mode} onToggleMode={onToggleMode} />

      <Typography variant="h6" sx={{ mb: 1 }}>
        {id} state
      </Typography>
      <Paper variant="outlined">
        <DeviceState id={id} />
      </Paper>
    </Container>
  );
}

/**
 * Single-page app for the matterbridge-mqtt plugin frontend.
 *
 * Shows the full dashboard, or a focused single-device state view when opened from a device
 * `configUrl` (`/plugins/matterbridge-mqtt/?id=<deviceId>`).
 *
 * @returns {JSX.Element} The rendered page.
 */
export default function App() {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  // When opened from a device configUrl, show only that device's state.
  const deviceId = new URLSearchParams(window.location.search).get('id');

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_MODE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {deviceId ? <DashboardState id={deviceId} mode={mode} onToggleMode={toggleMode} /> : <Dashboard mode={mode} onToggleMode={toggleMode} />}
    </ThemeProvider>
  );
}
