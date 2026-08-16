// InsightsScreen — Node-safe coverage for the DATA_INTELLIGENCE.md phase ④ reconstructed-cycle
// wiring (screens/InsightsScreen.tsx).
//
// InsightsScreen.tsx imports react-native/react-native-svg/reanimated and JSX, so it cannot load
// under the Node test runner (the repo's vitest glob is `apps/**/*.test.ts`, .tsx is never
// collected — same constraint every sibling screen test in this repo documents, e.g.
// TodayNudges.ritual.test.ts). This file restates the screen's two pure derivations 1:1 and
// exercises them against the REAL `synthesizeHistoryCycles`/`getRetrospect` engines, so the
// contract under test is "what the screen actually computes", not a reimplementation of the engines
// themselves:
//
//   1. Stat tiles / trend chart aggregate ALL cycles (lived + reconstructed) — no filtering, since
//      `getRetrospect`/the trend `useMemo` both read the raw `cycles` slice unfiltered.
//   2. "Notes from past you" (`livedNotes`) filters OUT reconstructed cycles entirely.
//   3. The chart's reconstructed-caption trigger (`trend.some(isReconstructed)`) fires only when the
//      6-month trend window actually contains a reconstructed month.

import { describe, expect, it } from 'vitest';

import type { CycleRecord } from '../store';
import { synthesizeHistoryCycles, type ReconstructedCycleRecord } from '../lib/historyCycles';
import { getRetrospect } from '../lib/modes/retrospect';

// 1:1 restatement of the screen's local helper (InsightsScreen.tsx `isReconstructed`).
function isReconstructed(c: CycleRecord): boolean {
  return c.reconstructed === true;
}

// 1:1 restatement of the screen's `livedNotes` derivation.
function livedNotesOf(cycles: readonly CycleRecord[]): CycleRecord[] {
  return cycles.filter((c) => !isReconstructed(c)).slice(0, 4);
}

// 1:1 restatement of the screen's `trend` derivation (oldest → newest, windowed to 6).
function trendOf(cycles: readonly CycleRecord[]): CycleRecord[] {
  return cycles.slice(0, 6).reverse();
}

function txn(
  when: string,
  amount: number,
): {
  id: string;
  when: string;
  merchant: string;
  amount: number;
  category: 'other';
  source: 'manual';
} {
  return {
    id: `t-${when}-${amount}`,
    when,
    merchant: 'M',
    amount,
    category: 'other',
    source: 'manual',
  };
}

function fiveRowsIn(monthPrefix: string) {
  return Array.from({ length: 5 }, (_, i) => txn(`${monthPrefix}-0${i + 1}T00:00:00.000Z`, -10));
}

const TODAY = '2026-07-06';

describe('InsightsScreen — reconstructed-cycle aggregation (DATA_INTELLIGENCE.md phase ④)', () => {
  it('stat tiles / retrospect aggregate reconstructed cycles alongside lived ones (unfiltered)', () => {
    const lived: CycleRecord = {
      closedAt: '2026-05-25',
      label: 'May (lived)',
      spare: 100,
      tightPoint: 20,
      setAside: 10,
      note: 'ritual-sealed',
    };
    const withReconstructed = synthesizeHistoryCycles(fiveRowsIn('2026-06'), [], [lived], TODAY);
    expect(withReconstructed.length).toBe(2);

    // getRetrospect (the real engine InsightsScreen calls) must count BOTH cycles — the reconstructed
    // month is real spend/income history, just not a ritual-sealed one.
    const retro = getRetrospect('survival', withReconstructed, 0);
    expect(retro.eyebrow).toBe('2 months done');

    // Same story for the trend chart window: both cycles appear, oldest-first.
    const trend = trendOf(withReconstructed);
    expect(trend.length).toBe(2);
    expect(trend[0]!.closedAt).toBe('2026-05-25');
    expect(trend[1]!.closedAt).toBe('2026-06-30');
  });

  it('"Notes from past you" excludes every reconstructed cycle, keeping only lived ones', () => {
    const lived: CycleRecord = {
      closedAt: '2026-05-25',
      label: 'May (lived)',
      spare: 100,
      tightPoint: 20,
      setAside: 10,
      note: 'a real ritual note',
    };
    const merged = synthesizeHistoryCycles(fiveRowsIn('2026-06'), [], [lived], TODAY);
    const notes = livedNotesOf(merged);
    expect(notes).toEqual([lived]);
    expect(notes.some(isReconstructed)).toBe(false);
  });

  it('"Notes from past you" is empty when every cycle is reconstructed (no fabricated notes)', () => {
    const onlyReconstructed = synthesizeHistoryCycles(fiveRowsIn('2026-06'), [], [], TODAY);
    expect(onlyReconstructed.every(isReconstructed)).toBe(true);
    expect(livedNotesOf(onlyReconstructed)).toEqual([]);
  });

  it('the trend window still shows 4 lived notes when more than 4 lived cycles exist, ignoring reconstructed noise', () => {
    const livedCycles: CycleRecord[] = Array.from({ length: 5 }, (_, i) => ({
      closedAt: `2026-0${i + 1}-28`,
      label: `M${i}`,
      spare: 1,
      tightPoint: 1,
      setAside: 0,
      note: `note ${i}`,
    }));
    const reconstructed: ReconstructedCycleRecord = {
      closedAt: '2026-06-30',
      label: 'June 2026',
      spare: 0,
      tightPoint: 0,
      setAside: 0,
      note: 'estimate',
      reconstructed: true,
    };
    const notes = livedNotesOf([reconstructed, ...livedCycles]);
    expect(notes.length).toBe(4);
    expect(notes.every((c) => !isReconstructed(c))).toBe(true);
  });

  it('the chart reconstructed-caption trigger fires only when the trend window contains a reconstructed month', () => {
    const lived: CycleRecord = {
      closedAt: '2026-05-25',
      label: 'May (lived)',
      spare: 1,
      tightPoint: 1,
      setAside: 0,
      note: 'n',
    };
    const noReconstructed = trendOf([lived]);
    expect(noReconstructed.some(isReconstructed)).toBe(false);

    const withReconstructed = trendOf(
      synthesizeHistoryCycles(fiveRowsIn('2026-06'), [], [lived], TODAY),
    );
    expect(withReconstructed.some(isReconstructed)).toBe(true);
  });
});
