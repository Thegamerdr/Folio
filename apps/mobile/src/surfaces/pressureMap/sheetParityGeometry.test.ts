import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./Sheet.tsx', import.meta.url).href), 'utf8');

describe('shared sheet parity geometry', () => {
  it('keeps the pinned 36x3 grip and 27px content start across every sheet', () => {
    expect(source).toContain('const HANDLE_WIDTH = 36;');
    expect(source).toContain('const HANDLE_HEIGHT = 3;');
    expect(source).toContain('paddingTop: gap.md');
    expect(source).toContain('marginBottom: gap.md');
  });
});
