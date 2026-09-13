import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/mobile/src/folio/screens/RecoveryScreen.tsx', 'utf8');

describe('Recovery result card large-text layout', () => {
  it('stacks the companion and full-width result body at large text without changing money tokens', () => {
    expect(source).toContain('const { fontScale } = useWindowDimensions();');
    expect(source).toContain('const largeText = fontScale >= 1.3;');
    expect(source).toContain('largeText ? styles.shortfallCardLarge : undefined');
    expect(source).toContain('largeText ? styles.shortfallBodyLarge : undefined');
    expect(source).toContain('largeText ? styles.afterValueLarge : undefined');
    expect(source).toContain("flexDirection: 'column'");
    expect(source).toContain("width: '100%'");
    expect(source).toContain('fontSize: 34');
  });
});
