import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/generated-files': {
        target: 'http://127.0.0.1:8000', // Updated to correct backend port
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/generated-files/, '/generated-files'),
      },
      '/upload': {
        target: 'http://127.0.0.1:8000', // Updated to correct backend port
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/upload/, '/upload'),
      },
    },
  },
});