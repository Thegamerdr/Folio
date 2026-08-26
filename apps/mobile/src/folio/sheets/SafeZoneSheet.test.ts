import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'SafeZoneSheet.tsx'),
  'utf8',
);

describe('Safe Zone sheet source parity', () => {
  it('keeps the source heading hierarchy instead of merging the daily figure into the total', () => {
    expect(source).toContain('<Text style={s.eyebrow}>YOUR SAFE ZONE</Text>');
    expect(source).toContain('<Text style={s.headline}>About £{zone.perDay}/day</Text>');
    expect(source).not.toContain('numberCaption');
  });

  it('keeps source-sized controls and the filled primary Melo action', () => {
    expect(source).toContain('width: 44');
    expect(source).toContain('height: 44');
    expect(source).toContain('{ backgroundColor: t.calm, borderColor: t.calm }');
    expect(source).toContain('{ color: t.inverse }');
  });
});
