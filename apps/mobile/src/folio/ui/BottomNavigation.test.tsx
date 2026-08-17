import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

const personal = readFileSync(
  fileURLToPath(new URL('./PersonalBottomNav.tsx', import.meta.url)),
  'utf8',
);
const business = readFileSync(
  fileURLToPath(new URL('./BusinessBottomNav.tsx', import.meta.url)),
  'utf8',
);
const shell = readFileSync(
  fileURLToPath(new URL('../shell/FolioShell.tsx', import.meta.url)),
  'utf8',
);
const companion = readFileSync(
  fileURLToPath(new URL('../companion/MeloCompanionHost.tsx', import.meta.url)),
  'utf8',
);

describe('bottom navigation contracts', () => {
  it('renders the selected Personal tabs and delegates presses', () => {
    expect(personal).toContain("{ id: 'today', label: 'Today'");
    expect(personal).toContain("{ id: 'plan', label: 'Plan'");
    expect(personal).toContain("{ id: 'review', label: 'Review'");
    expect(personal).toContain("{ id: 'more', label: 'More'");
    expect(personal).toContain('accessibilityRole="tab"');
    expect(personal).toContain('accessibilityState={{ selected }}');
    expect(personal).toContain('onPress={() => onChange(tab.id)}');
    expect(personal).toContain('<ProductIcon');
    expect(personal).not.toContain('glyph:');
    expect(personal).not.toContain('Talk to Melo');
  });

  it('renders the selected Business tabs and delegates presses', () => {
    expect(business).toContain("{ id: 'today', label: 'Today'");
    expect(business).toContain("{ id: 'money', label: 'Money'");
    expect(business).toContain("{ id: 'review', label: 'Review'");
    expect(business).toContain("{ id: 'more', label: 'More'");
    expect(business).toContain('accessibilityRole="tab"');
    expect(business).toContain('accessibilityState={{ selected }}');
    expect(business).toContain('onPress={() => onChange(tab.id)}');
    expect(business).toContain('<ProductIcon');
    expect(business).not.toContain('glyph:');
    expect(business).not.toContain("label: 'Filings'");
  });

  it('keeps Melo as a labelled contextual action in the shell', () => {
    expect(shell).toContain('onOpenMelo={openMelo}');
    expect(shell).toContain('onChange={selectPrimaryTab}');
    expect(shell).toContain('selectWorkspaceTab(current, tab)');
    expect(companion).toContain('accessibilityLabel={`Melo companion, ${performance.label}`}');
    expect(companion).toContain('accessibilityRole="button"');
    expect(companion).toContain('onPress={engage}');
  });
});
