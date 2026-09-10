import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'SafeZoneSheet.tsx'),
  'utf8',
);

describe('Safe to spend working presentation', () => {
  it('shows the bounded total with a subordinate daily guide and each reserve category', () => {
    expect(source).toContain('SEE THE WORKING');
    expect(source).toContain('Daily guide: about');
    expect(source).toContain('plan.livingCostMinor');
    expect(source).toContain('plan.debtMinimumMinor');
    expect(source).toContain('selectFinancialPresentation');
  });

  it('keeps source-sized controls and the filled primary Melo action', () => {
    expect(source).toContain('width: 48');
    expect(source).toContain('height: 48');
    expect(source).toContain('{ backgroundColor: t.calm, borderColor: t.calm }');
    expect(source).toContain('{ color: t.inverse }');
  });
});
