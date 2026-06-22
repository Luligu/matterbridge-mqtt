// vite.config.ts 1.0.1

// This Vite configuration is designed for a Vite/React/Typescript frontend using ESM modules.

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  // Use the Matterbridge plugin path in development so the SPA and API proxy use the
  // same URLs as Matterbridge. Use relative paths in production so the built SPA and
  // API resolve correctly when Matterbridge serves the plugin.
  const base = command === 'serve' ? '/plugins/matterbridge-mqtt/' : './';

  return {
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
  };
});
