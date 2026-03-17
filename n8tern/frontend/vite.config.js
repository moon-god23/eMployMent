import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev only: proxy /api to backend. In production, VITE_API_URL points to Render.
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
