import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src/web', import.meta.url).pathname,
      '@shared': new URL('./src/shared', import.meta.url).pathname,
    },
  },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
