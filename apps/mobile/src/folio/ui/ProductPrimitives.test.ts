import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uiDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(uiDirectory, 'ProductPrimitives.tsx'), 'utf8');

const patterns = [
  'Screen',
  'Section',
  'Card',
  'Row',
  'Figure',
  'Field',
  'Button',
  'Chip',
  'SegmentedControl',
  'ChartFrame',
  'CalendarCell',
  'ListGroup',
  'MeloPerch',
  'ExplainSheet',
] as const;

describe('canonical product primitives', () => {
  it.each(patterns)('exports %s', (pattern) => {
    expect(source).toContain(`export function ${pattern}`);
  });

  it('uses semantic type and radius roles', () => {
    expect(source).not.toMatch(/fontSize:\s*\d/u);
    expect(source).not.toMatch(/borderRadius:\s*\d/u);
  });

  it('keeps interactive control geometry at or above 44dp', () => {
    expect(source).toContain('minHeight: 48');
    expect(source).toContain('minHeight: 44');
    expect(source).toContain('height: 44');
    expect(source).toContain('width: 44');
  });
});
