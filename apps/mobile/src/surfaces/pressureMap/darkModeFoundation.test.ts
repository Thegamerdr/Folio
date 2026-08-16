import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Dark-mode foundation guards.
//
// Source-grep style (matching the sibling surface guards): these tests read the kit + theme source
// text rather than importing the components, so they stay Node-safe (no react-native / expo-secure-
// store runtime needed). They pin the contract a later per-surface sweep depends on:
//   • the LIGHT palette `paper` keeps its exact literals in kit.tsx (other tests grep these too);
//   • the DARK palette `paperDark` defines EVERY key the light palette does (no missing colour);
//   • the theme API (useTheme / useThemeMode / ThemeProvider / Palette / paperDark) is exported.

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8');
}

function collectSourceFiles(rel: string): readonly string[] {
  const root = fileURLToPath(new URL(rel, import.meta.url).href);
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`;
      if (entry === 'node_modules') continue;
      if (statSync(path).isDirectory()) {
        visit(path);
      } else if (!entry.includes('.test.') && /\.[cm]?[tj]sx?$/.test(entry)) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}

const kit = read('./kit.tsx');
const theme = read('./kitTheme.tsx');

// Extract the keys of an object literal `export const NAME = { ... }` (or `: Palette = { ... }`).
// Good enough for the flat, one-key-per-line palette objects in this codebase.
function paletteKeys(source: string, declarationStart: string): readonly string[] {
  const from = source.indexOf(declarationStart);
  if (from === -1) return [];
  const open = source.indexOf('{', from);
  // Walk to the matching close brace so we only read this object's body.
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(open + 1, end);
  const keys = new Set<string>();
  // Match `key:` at the start of a (trimmed) line — ignores values, comments, and nested content.
  for (const line of body.split('\n')) {
    const match = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:/.exec(line);
    const key = match?.[1];
    if (key !== undefined) keys.add(key);
  }
  return [...keys];
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe('dark-mode foundation — palette contract', () => {
  it('the light palette keeps its grepped literal hexes in kit.tsx', () => {
    // Pinned here AND in lovableImplementation.test.ts — the sweep must not move these out of kit.tsx.
    expect(kit).toContain("calm: '#DC5E33'");
    expect(kit).toContain("positive: '#3E8E5A'");
    expect(kit).toContain("positiveInk: '#2F7048'");
    expect(kit).toContain('export const paper = {');
  });

  it('paperDark defines every key the light paper does', () => {
    const lightKeys = paletteKeys(kit, 'export const paper = {');
    const darkKeys = paletteKeys(theme, 'export const paperDark');
    expect(lightKeys.length).toBeGreaterThan(20); // sanity: we actually parsed the object
    const missing = lightKeys.filter((key) => !darkKeys.includes(key));
    expect(missing).toEqual([]);
  });

  it('the dark palette uses the Lovable :root.dark web values for the specified keys', () => {
    expect(theme).toContain("canvas: '#1B1613'");
    expect(theme).toContain("surface: '#211B17'");
    expect(theme).toContain("inset: '#2A231D'");
    expect(theme).toContain("ink: '#F4EDDF'");
    expect(theme).toContain("muted: '#A69B8A'");
    expect(theme).toContain("hairline: '#3A3128'");
    expect(theme).toContain("calm: '#EE754C'");
    expect(theme).toContain("calmSoft: '#3E2418'");
    expect(theme).toContain("positive: '#7ABB93'");
    expect(theme).toContain("caution: '#E6C078'");
    expect(theme).toContain("repair: '#E9806C'");
  });

  it('uses dark ink on accent and ink/paper for primary actions at AA or better', () => {
    expect(kit).toContain("accentInk: '#1B1815'");
    expect(theme).toContain("accentInk: '#1B1815'");
    expect(kit).toContain('backgroundColor: t.ink');
    expect(kit).toContain('color: t.canvas');

    expect(contrastRatio('#1B1815', '#DC5E33')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#1B1815', '#EE754C')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#F6F4EE', '#B84A24')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#1B1613', '#F79A78')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#1B1815', '#F6F4EE')).toBeGreaterThanOrEqual(7);
    expect(contrastRatio('#F4EDDF', '#1B1613')).toBeGreaterThanOrEqual(7);

    expect(contrastRatio('#FFFFFF', '#DC5E33')).toBeLessThan(4.5);
    expect(contrastRatio('#FFFFFF', '#EE754C')).toBeLessThan(4.5);
  });

  it('does not use inverse as a text foreground in app UI', () => {
    // `inverse` is literal white. It fails on accent fills and also fails on dark-mode `ink`, because
    // `ink` becomes a light foreground token in the dark palette. UI text should use `accentInk` on
    // accent, and `canvas` on ink/dark knockout surfaces.
    const allowedInverseFiles = new Set<string>();
    const files = [...collectSourceFiles('../../folio'), ...collectSourceFiles('.')];
    const offenders = files
      .filter((file) => readFileSync(file, 'utf8').includes('color: t.inverse'))
      .map((file) => file.replaceAll('\\', '/').replaceAll('//', '/'))
      .filter((file) => {
        const rel = file.slice(file.indexOf('apps/mobile/src/'));
        return !allowedInverseFiles.has(rel);
      });

    expect(offenders).toEqual([]);
  });
});

describe('dark-mode foundation — theme API + pattern', () => {
  it('exports the theme API from the kit so surfaces have one import source', () => {
    for (const name of ['paperDark', 'useTheme', 'useThemeMode', 'ThemeProvider']) {
      expect(kit).toContain(name);
    }
    expect(kit).toContain('export type { Palette, ThemeMode }');
  });

  it('documents the makeStyles(t) render-time pattern at the top of the kit', () => {
    expect(kit).toContain('DARK-MODE PATTERN');
    expect(kit).toContain('makeStyles(t');
    expect(kit).toContain('useTheme()');
  });

  it('the provider resolves system / forced modes and defaults to system', () => {
    expect(theme).toContain('useColorScheme');
    expect(theme).toContain("useState<ThemeMode>('system')");
    expect(theme).toContain('export function ThemeProvider');
  });

  it('persists the chosen mode on device (expo-secure-store)', () => {
    expect(theme).toContain("import * as SecureStore from 'expo-secure-store'");
    expect(theme).toContain('SecureStore.setItemAsync');
    expect(theme).toContain('SecureStore.getItemAsync');
  });
});
