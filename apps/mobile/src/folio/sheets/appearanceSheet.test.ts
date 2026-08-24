import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), rel), 'utf8');
}

describe('appearance picker — native theme authority contract', () => {
  it('offers exactly System, Light and Dark', () => {
    const source = read('./AppearanceSheet.tsx');
    expect(source).toContain("mode: 'system'");
    expect(source).toContain("mode: 'light'");
    expect(source).toContain("mode: 'dark'");
    expect(source).toContain('useThemeMode()');
  });

  it('is reached from More and hosted as the appearance SheetId', () => {
    const more = read('../screens/MoreScreen.tsx');
    const shell = read('../shell/FolioShell.tsx');
    expect(more).toContain("sheet: 'appearance'");
    expect(shell).toContain("sheet === 'appearance'");
    expect(shell).toContain("'appearance'");
  });

  it('leaves candidate correction with Review detail only', () => {
    const types = read('../types.ts');
    const shell = read('../shell/FolioShell.tsx');
    const shortfall = read('../screens/ShortfallScreen.tsx');
    expect(types).not.toContain("| 'edit-item'");
    expect(shell).not.toContain("sheet === 'edit-item'");
    expect(shortfall).toContain("nav.go('subs')");
  });
});
