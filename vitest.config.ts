import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
      'tooling/**/*.test.ts',
      'tooling/**/*.test.mjs',
      'services/**/*.test.ts',
    ],
    passWithNoTests: true,
  },
});
