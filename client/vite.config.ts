import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const CLIENT_PORT = 5173;
const API_TARGET = 'http://localhost:3000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: CLIENT_PORT,
    strictPort: true,
    proxy: {
      // All backend endpoints live under /api; forward them to Express in development.
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
