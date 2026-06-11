import { createTheme, type Theme } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

/**
 * Creates the MUI theme for the matterbridge-mqtt frontend.
 *
 * @param mode - The palette mode (`light` or `dark`).
 * @returns The MUI theme for the given mode.
 */
export function createAppTheme(mode: ThemeMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: '#1976d2' },
    },
  });
}
