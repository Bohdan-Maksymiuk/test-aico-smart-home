import { defineConfig } from 'tsup';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  entry: ['src/server/main.ts'],
  outDir: 'dist/server',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  esbuildOptions(options) {
    options.alias = {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    };
  },
  noExternal: [/^@shared\//],
  clean: true,
});
