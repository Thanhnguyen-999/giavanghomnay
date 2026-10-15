import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dev: chuyển /admin/v1 và /v1 sang Worker (wrangler dev ở 8787),
    // kèm header X-Dev-Email để bỏ qua Access khi phát triển.
    proxy: {
      '/admin/v1': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        headers: { 'X-Dev-Email': 'dev@local' },
      },
      '/v1': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
});
