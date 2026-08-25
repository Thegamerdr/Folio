import { readFileSync } from 'node:fs';
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

describe('dark-mode foundation — palette contract', () => {
  it('the light palette keeps its grepped literal hexes in kit.tsx', () => {
    // Pinned here AND in lovableImplementation.test.ts — the sweep must not move these out of kit.tsx.
    expect(kit).toContain("calm: '#9E3C18'");
    expect(kit).toContain("positive: '#2C7345'");
    expect(kit).toContain("positiveInk: '#2C7345'");
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
    expect(theme).toContain("canvas: '#14100D'");
    expect(theme).toContain("surface: '#211B17'");
    expect(theme).toContain("inset: '#2A231D'");
    expect(theme).toContain("ink: '#F4EDDF'");
    expect(theme).toContain("muted: '#A69B8A'");
    expect(theme).toContain("hairline: '#3A3128'");
    expect(theme).toContain("calm: '#EE754C'");
    expect(theme).toContain("calmSoft: '#3E2418'");
    expect(theme).toContain("positive: '#7ABB93'");
    expect(theme).toContain("caution: '#E6BB6A'");
    expect(theme).toContain("repair: '#E9806C'");
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
