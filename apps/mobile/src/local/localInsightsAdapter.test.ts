import { describe, expect, it } from 'vitest';

import { addCycle, createEmptyLocalLedgerState, formatMinorAmount } from './localLedger.js';
import { buildLocalInsightsModel } from './localInsightsAdapter.js';

// The fix: Insights must show REAL current-cycle data on session one, before any payday ritual has
// closed a cycle — not an all-zero dashboard. The provisional point/KPI come from the live route's
// projected lowest balance, framed honestly as the still-open current cycle. Once real cycles exist,
// closed history leads and the provisional point is gone (a still-open cycle is never settled fact).

describe('local insights adapter — current-cycle seed', () => {
  it('seeds a provisional current-cycle low point from the live route when 0 cycles are closed', () => {
    const ledger = createEmptyLocalLedgerState('2026-06-22');
    expect(ledger.cycles).toEqual([]);

    const model = buildLocalInsightsModel(ledger, {
      currentCycle: { label: 'June', tightestBalanceMinor: -3000 },
    });

    // Honest counters: nothing has actually been closed.
    expect(model.cycleCount).toBe(0);
    expect(model.hasOnlyCurrentCycle).toBe(true);

    // The trend is NOT empty: it carries one provisional point labelled as the current cycle, using
    // the magnitude of the route's projected dip (|-3000| = 3000), not 0.
    expect(model.trend).toHaveLength(1);
    expect(model.trend[0]).toMatchObject({
      label: 'June',
      tightPointMinor: 3000,
      tightPoint: formatMinorAmount(3000),
      provisional: true,
    });

    // The headline "average low balance" KPI is seeded from the same live figure, not £0.
    expect(model.kpis.avgTightPointMinor).toBe(3000);
    expect(model.kpis.avgTightPoint).toBe(formatMinorAmount(3000));

    // The summary tells the truth: no cycles closed, here is the projected low.
    expect(model.accessibilitySummary).toContain('No cycles closed yet');
    expect(model.accessibilitySummary).toContain(formatMinorAmount(3000));
  });

  it('treats a positive projected balance as a zero-depth dip (magnitude), still provisional', () => {
    const ledger = createEmptyLocalLedgerState('2026-06-22');

    const model = buildLocalInsightsModel(ledger, {
      currentCycle: { label: 'June', tightestBalanceMinor: 12_000 },
    });

    expect(model.trend).toHaveLength(1);
    expect(model.trend[0]?.tightPointMinor).toBe(12_000);
    expect(model.trend[0]?.provisional).toBe(true);
    expect(model.kpis.avgTightPointMinor).toBe(12_000);
  });

  it('falls back to an empty trend and zero average when no current cycle is threaded in', () => {
    const ledger = createEmptyLocalLedgerState('2026-06-22');

    const model = buildLocalInsightsModel(ledger);

    expect(model.trend).toEqual([]);
    expect(model.hasOnlyCurrentCycle).toBe(false);
    expect(model.kpis.avgTightPointMinor).toBe(0);
  });

  it('lets closed history lead once real cycles exist — no provisional point, no double-count', () => {
    let ledger = createEmptyLocalLedgerState('2026-06-22');
    ledger = addCycle(ledger, {
      label: 'April',
      spareMinor: 5_000,
      tightPointMinor: 2_000,
      setAsideMinor: 1_000,
    });
    ledger = addCycle(ledger, {
      label: 'May',
      spareMinor: 6_000,
      tightPointMinor: 4_000,
      setAsideMinor: 1_500,
    });

    const model = buildLocalInsightsModel(ledger, {
      currentCycle: { label: 'June', tightestBalanceMinor: -9_999 },
    });

    // Two cycles closed — history leads, oldest first, and the still-open June is NOT appended.
    expect(model.cycleCount).toBe(2);
    expect(model.hasOnlyCurrentCycle).toBe(false);
    expect(model.trend.map((point) => point.label)).toEqual(['April', 'May']);
    expect(model.trend.every((point) => point.provisional !== true)).toBe(true);

    // Average low balance is the mean of the closed tight points (2000, 4000), not the live route.
    expect(model.kpis.avgTightPointMinor).toBe(3_000);
  });
});
