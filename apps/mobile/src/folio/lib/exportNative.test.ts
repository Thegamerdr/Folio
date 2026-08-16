import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./exportNative.ts', import.meta.url).href),
  'utf8',
);

describe('native export containment', () => {
  it('stages plaintext exports in cache and cleans them up after sharing', () => {
    expect(source).toContain('FileSystem.cacheDirectory');
    expect(source).toContain('FileSystem.deleteAsync(exportDir');
    expect(source).not.toContain('const dir = FileSystem.documentDirectory');
    expect(source).not.toContain('shared: available');
  });
});
