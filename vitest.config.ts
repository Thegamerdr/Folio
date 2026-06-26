import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'tooling/**/*.test.ts'],
    passWithNoTests: true,
  },
});
