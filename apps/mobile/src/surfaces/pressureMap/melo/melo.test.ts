import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MELO_COPY, MELO_MOOD, meloLine, type MeloState } from './meloStates.js';

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8');
}

const ALL_STATES: readonly MeloState[] = [
  'melo_idle',
  'melo_start',
  'melo_guiding_input',
  'melo_review_waiting',
  'melo_review_safe_to_add',
  'melo_path_explaining',
  'melo_uncertainty',
  'melo_file_unreadable',
  'melo_privacy_trust',
  'melo_success_saved',
  'melo_reduced_motion',
];

const coreScreens: Readonly<Record<string, string>> = {
  start: read('../startScreen.tsx'),
  guidedInput: read('../roughFirstAnswer.tsx'),
  review: read('../reviewDecision.tsx'),
  today: read('../todayPath.tsx'),
  data: read('../trustControl.tsx'),
  fileWorkbench: read('../fileWorkbench.tsx'),
};
const presence = read('./MeloPresence.tsx');
const figure = read('./MeloFigure.tsx');

describe('Melo — core product asset', () => {
  it('appears across the core slice', () => {
    for (const [name, src] of Object.entries(coreScreens)) {
      expect(src, name).toContain('MeloPresence');
    }
  });

  it('has state-based copy + mood for every state', () => {
    for (const state of ALL_STATES) {
      expect(MELO_COPY[state].primary.length).toBeGreaterThan(0);
      expect(MELO_MOOD[state]).toBeDefined();
    }
  });

  it('keeps copy short — one primary line, at most one supporting, no paragraphs', () => {
    for (const state of ALL_STATES) {
      const c = MELO_COPY[state];
      expect(c.primary).not.toContain('\n');
      expect(c.primary.length).toBeLessThanOrEqual(64);
      if (c.supporting !== undefined) {
        expect(c.supporting).not.toContain('\n');
        expect(c.supporting.length).toBeLessThanOrEqual(72);
      }
    }
  });

  it('never advises, shames, or overclaims certainty', () => {
    const banned = [
      'you should',
      'you must',
      'best decision',
      'pay this first',
      'your score',
      'confidence score',
      'guaranteed',
      'definitely',
      'for sure',
      'low confidence',
    ];
    for (const state of ALL_STATES) {
      const text = `${MELO_COPY[state].primary} ${MELO_COPY[state].supporting ?? ''}`.toLowerCase();
      for (const phrase of banned) expect(text, `${state} / ${phrase}`).not.toContain(phrase);
    }
  });

  it('does not repeat the hero answer', () => {
    expect(MELO_COPY.melo_path_explaining.primary).not.toMatch(/£\s?\d/);
    expect(MELO_COPY.melo_path_explaining.primary.toLowerCase()).not.toContain('you make it');
  });

  it('cannot write state — MeloPresence is presentational only', () => {
    for (const banned of [
      'onConfirm',
      'onAdd',
      'onDismiss',
      'onSave',
      'commitLocalLedger',
      'addTransaction',
      'setLocalLedger',
      'dismissImportDraft',
      'ThroughCanonicalRepository',
    ]) {
      expect(presence, banned).not.toContain(banned);
    }
  });

  it('has one replaceable visual component, ready for a future 3D/animated runtime', () => {
    expect(presence).toContain('MeloFigure');
    expect(figure).toContain('reduceMotion');
    expect(ALL_STATES).toContain('melo_reduced_motion');
  });

  it('keeps a context override to a single line', () => {
    const overridden = meloLine('melo_path_explaining', 'This drop is bills.');
    expect(overridden.primary).toBe('This drop is bills.');
    expect(overridden.supporting).toBeUndefined();
  });
});
