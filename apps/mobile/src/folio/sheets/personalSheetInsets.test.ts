import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PERSONAL_SHEET_BODIES = [
  'AddPlanSheet.tsx',
  'AffordCheckSheet.tsx',
  'AppearanceSheet.tsx',
  'ChartStyleSheet.tsx',
  'HouseholdSetupSheet.tsx',
  'LensPickerSheet.tsx',
  'LogSpendSheet.tsx',
  'SafeZoneSheet.tsx',
  'ShelfSheet.tsx',
] as const;

function read(rel: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), rel), 'utf8');
}

function bodyStyle(source: string): string {
  const match = source.match(/body:\s*\{([\s\S]*?)\},/);
  expect(match, 'expected a body style').not.toBeNull();
  return match?.[1] ?? '';
}

describe('personal sheet content inset contract', () => {
  it('keeps the canonical 24dp horizontal inset in the shared Sheet panel', () => {
    const sheet = read('../../surfaces/pressureMap/Sheet.tsx');
    const panelStyle = sheet.match(/panel:\s*\{([\s\S]*?)\},/);

    expect(panelStyle, 'expected the shared Sheet panel style').not.toBeNull();
    expect(panelStyle?.[1]).toContain('paddingHorizontal: gap.xl');
  });

  it.each(PERSONAL_SHEET_BODIES)('%s does not add a second horizontal inset', (file) => {
    expect(bodyStyle(read(`./${file}`))).not.toContain('paddingHorizontal');
  });
});
