import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Mounted mobile tests use the same source alias as their focused config.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./apps/mobile/src', import.meta.url)) },
  },
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'tooling/**/*.test.ts',
      'services/**/*.test.ts',
    ],
    passWithNoTests: true,
  },
});
