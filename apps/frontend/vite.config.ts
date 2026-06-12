import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The plugin frontend is served by Matterbridge core under /plugins/<plugin-name>/.
// Using an absolute base ties the bundle to this path so assets and API calls resolve
// correctly regardless of a trailing slash on the document URL.
const base = '/plugins/matterbridge-mqtt/';

export default defineConfig({
  base,
  plugins: [react()],
  cacheDir: '.cache',
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // Proxy plugin API calls to a locally running Matterbridge during development.
      [`${base}api`]: {
        target: 'http://localhost:8283',
        changeOrigin: true,
      },
    },
  },
});
