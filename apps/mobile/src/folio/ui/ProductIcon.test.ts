import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

const productIcon = readFileSync(
  fileURLToPath(new URL('./ProductIcon.tsx', import.meta.url)),
  'utf8',
);
const sharedHeader = readFileSync(
  fileURLToPath(new URL('./ScreenHeader.tsx', import.meta.url)),
  'utf8',
);
const businessKit = readFileSync(
  fileURLToPath(new URL('../screens/business/BusinessUi.tsx', import.meta.url)),
  'utf8',
);

describe('canonical product icon contract', () => {
  it('uses Lucide behind one bounded size and stroke wrapper', () => {
    expect(productIcon).toContain("from 'lucide-react-native'");
    expect(productIcon).toContain('size?: 16 | 20');
    expect(productIcon).toContain('strokeWidth={1.8}');
    expect(productIcon).toContain('absoluteStrokeWidth');
  });

  it('keeps shared personal and business chrome free of text-arrow controls', () => {
    expect(sharedHeader).toContain('<ProductIcon color={t.muted} name="back" />');
    expect(businessKit).toContain('<ProductIcon color={t.muted} name="back" />');
    expect(businessKit).toContain('<ProductIcon color={t.calmStrong} name="forward" />');
    expect(businessKit).toContain('<ProductIcon color={t.muted} name="close" />');
    expect(businessKit).not.toContain('>←</Text>');
    expect(businessKit).not.toContain('>→</Text>');
    expect(businessKit).not.toContain('>×</Text>');
  });
});
