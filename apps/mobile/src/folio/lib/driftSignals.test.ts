// Drift-signal DETECTION tests — pure-logic coverage for
// apps/mobile/src/folio/lib/driftSignals.ts.
//
// Node-safe: touches only engine modules (no react-native runtime, no DOM),
// collected by the apps/**/*.test.ts runner via relative imports.

import { describe, expect, it } from 'vitest';

import {
  detectBillDrift,
  detectIncomeDrift,
  type DriftCatalogEntry,
  type DriftIncomeSource,
  type DriftTransaction,
} from './driftSignals';
import type { Charge } from './subSignals';

function plusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function creditSeries(
  merchant: string,
  amount: number,
  startIso: string,
  every: number,
  count: number,
): DriftTransaction[] {
  const rows: DriftTransaction[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ merchant, amount, date: plusDays(startIso, i * every) });
  }
  return rows;
}

function debitSeries(
  merchant: string,
  amount: number,
  startIso: string,
  every: number,
  count: number,
): Charge[] {
  const rows: Charge[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ merchant, amount: -Math.abs(amount), date: plusDays(startIso, i * every) });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// detectIncomeDrift
// ---------------------------------------------------------------------------
describe('detectIncomeDrift', () => {
  const baseSource: DriftIncomeSource = {
    id: 'src-1',
    label: 'Acme Payroll',
    cadence: 'monthly',
    amount: 2000,
    source: 'onboarding',
  };

  it('flags amount drift when the detected median deviates > 15% from stored', () => {
    // Detected median ~2500, stored 2000 -> 25% deviation, over threshold.
    const transactions = creditSeries('Acme Payroll', 2500, '2026-01-01', 30, 4);
    const signals = detectIncomeDrift([baseSource], transactions);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.reason).toBe('amount');
    expect(signals[0]?.storedAmount).toBe(2000);
    expect(signals[0]?.detectedAmount).toBeCloseTo(2500, 5);
  });

  it('does not flag when the detected amount is within 15% of stored', () => {
    // 2000 stored vs ~2200 detected = 10% deviation, under threshold.
    const transactions = creditSeries('Acme Payroll', 2200, '2026-01-01', 30, 4);
    const signals = detectIncomeDrift([baseSource], transactions);
    expect(signals).toEqual([]);
  });

  it('flags cadence drift when the detector now classifies a different cadence', () => {
    // Stored monthly £2000, but the merchant now pays weekly at £470 (4 weeks
    // * 470 ≈ 1880-2000/month, well within the 15% amount tolerance) — only
    // the cadence differs, isolating the 'cadence'-only reason.
    const transactions = creditSeries('Acme Payroll', 470, '2026-01-05', 7, 4);
    const signals = detectIncomeDrift([baseSource], transactions);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.reason).toBe('cadence');
    expect(signals[0]?.storedCadence).toBe('monthly');
    expect(signals[0]?.detectedCadence).toBe('weekly');
  });

  it('never re-checks a manually-entered source', () => {
    const manual: DriftIncomeSource = { ...baseSource, source: 'manual' };
    const transactions = creditSeries('Acme Payroll', 5000, '2026-01-01', 30, 4);
    expect(detectIncomeDrift([manual], transactions)).toEqual([]);
  });

  it('re-checks an inferred source the same as onboarding', () => {
    const inferred: DriftIncomeSource = { ...baseSource, source: 'inferred' };
    const transactions = creditSeries('Acme Payroll', 2500, '2026-01-01', 30, 4);
    const signals = detectIncomeDrift([inferred], transactions);
    expect(signals).toHaveLength(1);
  });

  it('no matching merchant in the transactions -> no signal (a "went quiet" fact, not drift)', () => {
    const signals = detectIncomeDrift([baseSource], []);
    expect(signals).toEqual([]);
  });

  it('carries no verdict/cancel/instruction field — facts only', () => {
    const transactions = creditSeries('Acme Payroll', 2500, '2026-01-01', 30, 4);
    const signals = detectIncomeDrift([baseSource], transactions);
    const signal = signals[0] as unknown as Record<string, unknown>;
    expect(signal.verdict).toBeUndefined();
    expect(signal.instruction).toBeUndefined();
    expect(signal.shouldUpdate).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// detectBillDrift
// ---------------------------------------------------------------------------
describe('detectBillDrift', () => {
  it('flags a price rise beyond 15%', () => {
    const catalog: DriftCatalogEntry[] = [{ name: 'Netflix', cost: 10 }];
    // Recent charges at £13 — 30% rise over stored £10.
    const transactions = debitSeries('Netflix', 13, '2026-01-01', 30, 3);
    const signals = detectBillDrift(catalog, transactions);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.storedCost).toBe(10);
    expect(signals[0]?.detectedCost).toBeCloseTo(13, 5);
  });

  it('flags a price DROP beyond 15% too (facts only, not direction-scoped)', () => {
    const catalog: DriftCatalogEntry[] = [{ name: 'Netflix', cost: 20 }];
    const transactions = debitSeries('Netflix', 10, '2026-01-01', 30, 3);
    const signals = detectBillDrift(catalog, transactions);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.detectedCost).toBeCloseTo(10, 5);
  });

  it('does not flag a bill within 15% of stored cost', () => {
    const catalog: DriftCatalogEntry[] = [{ name: 'Netflix', cost: 10 }];
    const transactions = debitSeries('Netflix', 10.5, '2026-01-01', 30, 3);
    const signals = detectBillDrift(catalog, transactions);
    expect(signals).toEqual([]);
  });

  it('no matching detected series -> no signal', () => {
    const catalog: DriftCatalogEntry[] = [{ name: 'Netflix', cost: 10 }];
    expect(detectBillDrift(catalog, [])).toEqual([]);
  });

  it('empty catalog -> no signals regardless of transactions', () => {
    const transactions = debitSeries('Netflix', 13, '2026-01-01', 30, 3);
    expect(detectBillDrift([], transactions)).toEqual([]);
  });
});
