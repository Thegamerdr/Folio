// History-statistics tests — pure-logic coverage for
// apps/mobile/src/folio/lib/historyStats.ts.
//
// Node-safe: touches only the engine module (no react-native runtime, no
// DOM), collected by the apps/**/*.test.ts runner via relative imports.

import { describe, expect, it } from 'vitest';

import {
  detectAnnualCandidates,
  monthlyIncomeSeries,
  monthlySpendBaseline,
  percentile,
  type HistoryTransaction,
} from './historyStats';

function txn(
  when: string,
  amount: number,
  category?: string,
  merchant?: string,
): HistoryTransaction & { merchant?: string } {
  const base: HistoryTransaction & { merchant?: string } = { when, amount };
  if (category !== undefined) base.category = category;
  if (merchant !== undefined) base.merchant = merchant;
  return base;
}

// ---------------------------------------------------------------------------
// monthlyIncomeSeries
// ---------------------------------------------------------------------------
describe('monthlyIncomeSeries', () => {
  it('sums credits per past full month, oldest first', () => {
    const rows = [
      txn('2026-01-05', 1000),
      txn('2026-01-20', 500),
      txn('2026-02-03', 1200),
      txn('2026-03-01', -50), // debit, excluded from the sum entirely
    ];
    const series = monthlyIncomeSeries(rows, '2026-04-01');
    expect(series).toEqual([1500, 1200]);
  });

  it('excludes the current in-progress month', () => {
    const rows = [txn('2026-01-05', 1000), txn('2026-02-10', 900)];
    const series = monthlyIncomeSeries(rows, '2026-02-15');
    expect(series).toEqual([1000]);
  });

  it('omits a month entirely when it has zero credits, rather than reporting 0', () => {
    const rows = [txn('2026-01-05', 1000), txn('2026-02-10', -30)];
    const series = monthlyIncomeSeries(rows, '2026-03-01');
    expect(series).toEqual([1000]);
  });

  it('empty transactions -> empty series', () => {
    expect(monthlyIncomeSeries([], '2026-04-01')).toEqual([]);
  });

  it('excludes structural refunds and transfer legs from inferred income', () => {
    expect(
      monthlyIncomeSeries(
        [
          { ...txn('2026-01-05', 1000), financialAction: { kind: 'refund' } },
          { ...txn('2026-01-06', 500), financialAction: { kind: 'transfer' } },
          txn('2026-01-07', 1200),
        ],
        '2026-02-01',
      ),
    ).toEqual([1200]);
  });
});

// ---------------------------------------------------------------------------
// percentile
// ---------------------------------------------------------------------------
describe('percentile', () => {
  it('empty series -> 0', () => {
    expect(percentile([], 20)).toBe(0);
  });

  it('single-element series returns that element for any percentile', () => {
    expect(percentile([500], 0)).toBe(500);
    expect(percentile([500], 50)).toBe(500);
    expect(percentile([500], 100)).toBe(500);
  });

  it('exact-index case (p=50 on an odd-length sorted series) returns the middle value', () => {
    expect(percentile([100, 200, 300], 50)).toBe(200);
  });

  it('p=0 returns the minimum, p=100 returns the maximum', () => {
    const series = [300, 100, 500, 200, 400];
    expect(percentile(series, 0)).toBe(100);
    expect(percentile(series, 100)).toBe(500);
  });

  it('linear interpolation between two ranks for a small series', () => {
    // sorted: [100, 200, 300, 400] -> rank for p20 = 0.2*3 = 0.6
    // interpolate between index 0 (100) and index 1 (200): 100 + 0.6*100 = 160
    const series = [400, 100, 300, 200];
    expect(percentile(series, 20)).toBeCloseTo(160, 5);
  });

  it('does not sort the input in place', () => {
    const series = [400, 100, 300, 200];
    const copy = [...series];
    percentile(series, 50);
    expect(series).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// monthlySpendBaseline
// ---------------------------------------------------------------------------
describe('monthlySpendBaseline', () => {
  it('median of past-month spend totals, overall (no category filter)', () => {
    const rows = [
      txn('2026-01-10', -100),
      txn('2026-01-20', -50), // Jan total: 150
      txn('2026-02-05', -300), // Feb total: 300
      txn('2026-03-01', -900), // current month, excluded
    ];
    const baseline = monthlySpendBaseline(rows, '2026-03-15');
    expect(baseline.medianMonthlySpend).toBe(225); // median of [150, 300]
    expect(baseline.monthsObserved).toBe(2);
  });

  it('scopes to a category when given', () => {
    const rows = [
      txn('2026-01-10', -40, 'food'),
      txn('2026-01-15', -20, 'transport'),
      txn('2026-02-05', -60, 'food'),
    ];
    const baseline = monthlySpendBaseline(rows, '2026-03-01', 'food');
    expect(baseline.medianMonthlySpend).toBe(50); // median of [40, 60]
    expect(baseline.monthsObserved).toBe(2);
  });

  it('a month with zero matching spend is omitted, not counted as a 0', () => {
    const rows = [
      txn('2026-01-10', -40, 'food'),
      txn('2026-02-05', -20, 'transport'), // no food this month
    ];
    const baseline = monthlySpendBaseline(rows, '2026-03-01', 'food');
    expect(baseline.medianMonthlySpend).toBe(40);
    expect(baseline.monthsObserved).toBe(1);
  });

  it('no matching rows at all -> 0 median, 0 months observed', () => {
    const baseline = monthlySpendBaseline([], '2026-03-01');
    expect(baseline.medianMonthlySpend).toBe(0);
    expect(baseline.monthsObserved).toBe(0);
  });

  it('excludes internal transfer out legs from spend baselines', () => {
    const baseline = monthlySpendBaseline(
      [
        { ...txn('2026-01-10', -100), financialAction: { kind: 'transfer' } },
        txn('2026-01-11', -40),
      ],
      '2026-02-01',
    );
    expect(baseline.medianMonthlySpend).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// detectAnnualCandidates
// ---------------------------------------------------------------------------
describe('detectAnnualCandidates', () => {
  it('2-occurrence March insurance is detected as a possible annual candidate', () => {
    const rows = [
      txn('2025-03-14', -240, undefined, 'Admiral Insurance'),
      txn('2026-03-16', -252, undefined, 'Admiral Insurance'),
    ];
    const candidates = detectAnnualCandidates(rows);
    const admiral = candidates.find((c) => c.merchant === 'Admiral Insurance');
    expect(admiral).toBeDefined();
    expect(admiral?.status).toBe('possible');
    expect(admiral?.occurrences).toBe(2);
  });

  it('a 10-month-apart council tax pair is NOT annual', () => {
    const rows = [
      txn('2025-05-01', -150, undefined, 'Council Tax'),
      txn('2026-03-01', -150, undefined, 'Council Tax'), // 10 months apart
    ];
    const candidates = detectAnnualCandidates(rows);
    expect(candidates.find((c) => c.merchant === 'Council Tax')).toBeUndefined();
  });

  it('a single occurrence never qualifies (min 2)', () => {
    const rows = [txn('2026-03-14', -240, undefined, 'TV Licence')];
    const candidates = detectAnnualCandidates(rows);
    expect(candidates).toEqual([]);
  });

  it('credits (positive amounts) are ignored', () => {
    const rows = [
      txn('2025-03-14', 240, undefined, 'Refund Co'),
      txn('2026-03-16', 240, undefined, 'Refund Co'),
    ];
    expect(detectAnnualCandidates(rows)).toEqual([]);
  });

  it('a gap far outside both the day-band and the 11-13 month band is rejected', () => {
    const rows = [
      txn('2025-03-14', -240, undefined, 'Random Co'),
      txn('2025-09-14', -240, undefined, 'Random Co'), // 6 months apart
    ];
    expect(detectAnnualCandidates(rows).find((c) => c.merchant === 'Random Co')).toBeUndefined();
  });

  it('amounts that differ by more than the tolerance split the run', () => {
    const rows = [
      txn('2025-03-14', -100, undefined, 'Variable Co'),
      txn('2026-03-14', -500, undefined, 'Variable Co'), // too different to be the "same" bill
    ];
    expect(detectAnnualCandidates(rows).find((c) => c.merchant === 'Variable Co')).toBeUndefined();
  });
});
