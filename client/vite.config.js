import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le proxy redirige les appels /api vers le backend Express (port 3001)
// afin d'éviter les problèmes de CORS en développement.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
