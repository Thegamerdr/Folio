import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8');
}

const types = read('../types.ts');
const shell = read('./FolioShell.tsx');
const coverage = read('../../../../../docs/port/BATCH4_SHIPPING_SURFACE_COVERAGE.md');

function unionMembers(typeName: string, nextTypeName: string): string[] {
  const start = types.indexOf(`export type ${typeName} =`);
  const end = types.indexOf(`export type ${nextTypeName} =`, start);
  const block = types.slice(start, end === -1 ? types.length : end);
  return [...block.matchAll(/^\s*\|\s*'([^']+)'/gm)].map((match) => match[1]!);
}

function objectKeys(declaration: string): string[] {
  const start = shell.indexOf(declaration);
  const open = shell.indexOf('{', start);
  const close = shell.indexOf('\n};', open);
  const body = shell.slice(open, close === -1 ? shell.length : close);
  return [...body.matchAll(/^\s*['"]?([A-Za-z0-9-]+)['"]?\s*:/gm)].map((match) => match[1]!);
}

function setMembers(declaration: string): string[] {
  const start = shell.indexOf(declaration);
  const open = shell.indexOf('[', start);
  const close = shell.indexOf('\n]);', open);
  const body = shell.slice(open, close === -1 ? shell.length : close);
  return [...body.matchAll(/^\s*'([^']+)'[,]?$/gm)].map((match) => match[1]!);
}

function sameMembers(actual: readonly string[], expected: readonly string[]): void {
  expect([...new Set(actual)].sort()).toEqual([...new Set(expected)].sort());
}

const screens = unionMembers('ScreenId', 'SheetId');
const sheets = unionMembers('SheetId', 'MeloIntent');
const nonNullSheets = sheets.filter((sheet) => sheet !== 'null');
const screenView = shell.slice(
  shell.indexOf('function ScreenView'),
  shell.indexOf('// Screen error boundary'),
);
const sheetHost = shell.slice(
  shell.indexOf('Generic single-sheet host'),
  shell.indexOf('const shellStyles'),
);

describe('native shell registry — exact shipping coverage', () => {
  it('has exactly 53 ScreenIds and 27 non-null SheetIds', () => {
    expect(screens).toHaveLength(53);
    expect(nonNullSheets).toHaveLength(27);
    expect(new Set(screens).size).toBe(53);
    expect(new Set(nonNullSheets).size).toBe(27);
  });

  it('gives every ScreenId a title and a reachable ScreenView dispatch owner', () => {
    const titled = objectKeys('const SCREEN_TITLE:');
    sameMembers(titled, screens);

    const directScreens = screens.filter(
      (screen) => screen.startsWith('business-') || screenView.includes(`screen === '${screen}'`),
    );
    expect(directScreens).toHaveLength(53);
    expect(directScreens).toEqual(screens);
    expect(screenView).toContain("screen.startsWith('business-')");
  });

  it('gives every non-null SheetId a title, self-host registration and render branch', () => {
    const titled = objectKeys('const SHEET_TITLE:');
    const selfHosted = setMembers('const SELF_HOSTING_SHEETS:');
    sameMembers(titled, nonNullSheets);
    sameMembers(selfHosted, nonNullSheets);

    const missingBranches = nonNullSheets.filter(
      (sheet) => !sheetHost.includes(`sheet === '${sheet}'`),
    );
    expect(missingBranches).toEqual([]);
    expect(sheetHost).toContain('<AppearanceSheet visible onClose={closeSheet} />');
  });

  it('keeps the checked coverage artifact in exact union parity with the native registry', () => {
    const rows = [
      ...coverage.matchAll(
        /^\|\s*(Screen|Sheet)\s+\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*`([^`]+)`\s*\|/gm,
      ),
    ];
    const screenRows = rows.filter((row) => row[1] === 'Screen').map((row) => row[2]!);
    const sheetRows = rows.filter((row) => row[1] === 'Sheet').map((row) => row[2]!);
    expect(screenRows).toHaveLength(53);
    expect(sheetRows).toHaveLength(27);
    sameMembers(screenRows, screens);
    sameMembers(sheetRows, nonNullSheets);
    expect(rows.every((row) => row[3] === 'ported' && row[4] !== '')).toBe(true);
  });
});
