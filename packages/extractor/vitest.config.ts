import { defineConfig } from 'vitest/config';

export default defineConfig({
  // esbuild của vite chưa nhận "es2024"; dùng esnext để tránh cảnh báo.
  esbuild: { target: 'esnext' },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
