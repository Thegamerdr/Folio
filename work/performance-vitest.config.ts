import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: {
      '@folio/domain': path.join(root, 'packages/domain/src/index.ts'),
    },
  },
  test: {
    include: ['apps/mobile/src/folio/lib/performanceEvidence.test.ts'],
    passWithNoTests: false,
  },
});
