import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const screens = dirname(fileURLToPath(import.meta.url));
const source = (name: string) => readFileSync(join(screens, name), 'utf8');

describe('production sample entry-point boundaries', () => {
  it('offers only user text in the live paste-to-ledger flow', () => {
    const paste = source('PasteSuccessScreen.tsx');
    expect(paste).not.toMatch(/const SAMPLE_PASTE_TEXT|setDraft\(SAMPLE_|or try the sample/u);
    expect(paste).toContain("useState(pasteText ?? '')");
    expect(paste).toContain('parseSheet(draft');
  });

  it('never substitutes merchant-keyed fixture dates or categories into real review candidates', () => {
    for (const file of ['PasteSuccessScreen.tsx', 'VisualizerScreen.tsx']) {
      expect(source(file)).not.toMatch(/const SAMPLE_(?:DATE_LABELS|ROW_META)/u);
    }
  });

  it('requires actual money setup before offering a What If calculation', () => {
    const whatIf = source('WhatIfScreen.tsx');
    expect(whatIf).toContain('selectFinancialPresentation(appState, plan)');
    expect(whatIf).toContain("state === 'empty' || !presentation.complete");
    expect(whatIf).not.toMatch(/const pressureLow/u);
  });

  it('keeps the mutating sample fixture out of every production source import', () => {
    const walk = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      });
    const liveFiles = walk(join(screens, '..', '..')).filter(
      (file) => /\.tsx?$/u.test(file) && !/\.test\.tsx?$|[\\/]test[\\/]/u.test(file),
    );
    expect(liveFiles.length).toBeGreaterThan(100);
    for (const file of liveFiles) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"][^'"]*sampleFixture['"]/u);
    }
  });
});
