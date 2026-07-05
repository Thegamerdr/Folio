// Lens trial-end tests — the 21-day trial floor (lib/lens.ts's `trialEndDate`).
//
// Pure, deterministic, Node-safe: `trialEndDate` has no react-native/DOM dependency (only
// `./income.ts`'s date arithmetic), so `lens.ts` loads fine under the Node test runner even
// though it also exports the `useLens()` React hook — this file only exercises the pure export.
//
// Contract under test:
//   trialEndDate(sources, startIso) -> ISO date | null
//     = the FIRST income occurrence at least 21 days after startIso.

import { describe, expect, it } from 'vitest';

import { trialEndDate } from './lens';
import type { IncomeSource } from '../store';

function source(
  partial: Partial<IncomeSource> & Pick<IncomeSource, 'id' | 'cadence'>,
): IncomeSource {
  return {
    label: partial.label ?? 'Pay',
    amount: partial.amount ?? 2000,
    source: partial.source ?? 'onboarding',
    ...partial,
  };
}

describe('trialEndDate', () => {
  it('returns null when there are no income sources', () => {
    expect(trialEndDate([], '2026-06-01')).toBeNull();
  });

  it('a monthly earner is unaffected by the floor — first occurrence already clears 21 days', () => {
    const s = source({ id: 'm1', cadence: 'monthly', dayOfMonth: 25 });
    // 2026-06-01 -> 2026-06-25 is the first occurrence, 24 days out (>= 21).
    expect(trialEndDate([s], '2026-06-01')).toBe('2026-06-25');
  });

  it('a weekly earner is walked past the first (and second) cycle to clear the 21-day floor', () => {
    // Anchored on a Friday. From 2026-06-01, weekly occurrences are 06-05, 06-12, 06-19, 06-26 —
    // 4, 11, 18, 25 days out respectively. The first that clears 21 days is 06-26 (25 days out),
    // not the very next payday (06-05, only 4 days out).
    const s = source({ id: 'w1', cadence: 'weekly', anchorISO: '2026-06-05' });
    expect(trialEndDate([s], '2026-06-01')).toBe('2026-06-26');
  });

  it('a fortnightly earner is walked forward past a too-soon first occurrence', () => {
    // Occurrences from 2026-06-01: 06-05 (4 days), 06-19 (18 days), 07-03 (32 days). First to
    // clear 21 days is 07-03.
    const s = source({ id: 'f1', cadence: 'fortnightly', anchorISO: '2026-06-05' });
    expect(trialEndDate([s], '2026-06-01')).toBe('2026-07-03');
  });

  it('a four-weekly earner whose very first occurrence already clears 21 days needs no walk', () => {
    // Occurrence from 2026-06-01 is 06-05 (4 days) then 07-03 (32 days) — first to clear 21 is
    // 07-03, same as the fortnightly case but via a 28-day step.
    const s = source({ id: 'fw1', cadence: 'four-weekly', anchorISO: '2026-06-05' });
    expect(trialEndDate([s], '2026-06-01')).toBe('2026-07-03');
  });

  it('picks the EARLIEST qualifying date across multiple sources, not the earliest occurrence overall', () => {
    // Weekly source's first qualifying (>=21 days) occurrence is later than the monthly source's
    // first occurrence in this window, so the monthly date should win.
    const weekly = source({ id: 'multi-w', cadence: 'weekly', anchorISO: '2026-06-05' });
    const monthly = source({ id: 'multi-m', cadence: 'monthly', dayOfMonth: 20 });
    // Monthly: 2026-06-20 is 19 days out (doesn't qualify) -> next is 2026-07-20 (49 days out).
    // Weekly qualifies first at 2026-06-26 (25 days out).
    expect(trialEndDate([weekly, monthly], '2026-06-01')).toBe('2026-06-26');
  });

  it('never returns a date fewer than 21 days after the start, for any cadence', () => {
    const cadences: IncomeSource[] = [
      source({ id: 'c1', cadence: 'weekly', anchorISO: '2026-01-02' }),
      source({ id: 'c2', cadence: 'fortnightly', anchorISO: '2026-01-02' }),
      source({ id: 'c3', cadence: 'four-weekly', anchorISO: '2026-01-02' }),
      source({ id: 'c4', cadence: 'monthly', dayOfMonth: 1 }),
      source({ id: 'c5', cadence: 'last-working-day' }),
    ];
    for (const s of cadences) {
      const startIso = '2026-03-15';
      const end = trialEndDate([s], startIso);
      expect(end).not.toBeNull();
      const startMs = new Date(`${startIso}T00:00:00`).getTime();
      const endMs = new Date(`${end}T00:00:00`).getTime();
      const daysOut = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
      expect(daysOut).toBeGreaterThanOrEqual(21);
    }
  });
});
