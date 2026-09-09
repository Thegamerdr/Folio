import { describe, expect, it } from 'vitest';
import { expandObligationOccurrences, remainingObligationMinor } from '../src/obligations.js';
import { calculateFinancialPlan } from '../src/financialPlan.js';

describe('canonical obligation occurrence semantics', () => {
  it('distinguishes every unpaid monthly recurrence from the next scheduled one', () => {
    expect(
      expandObligationOccurrences({
        anchor: '2026-09-12',
        through: '2026-11-13',
        amountMinor: 95_000,
      }),
    ).toEqual([
      { date: '2026-09-12', amountMinor: 95_000 },
      { date: '2026-10-12', amountMinor: 95_000 },
      { date: '2026-11-12', amountMinor: 95_000 },
    ]);
  });

  it('settles just the specified paid/cancelled cycles and retains a partial remainder', () => {
    expect(
      expandObligationOccurrences({
        anchor: '2026-08-31',
        through: '2026-12-31',
        amountMinor: 10_000,
        resolutions: {
          '2026-08-31': { status: 'paid' },
          '2026-09-30': { status: 'partial', paidMinor: 2_500 },
          '2026-10-31': { status: 'cancelled' },
          '2026-11-30': { status: 'settled' },
        },
      }),
    ).toEqual([
      { date: '2026-09-30', amountMinor: 7_500 },
      { date: '2026-12-31', amountMinor: 10_000 },
    ]);
  });

  it('keeps weekly and irregular fixed-day occurrences exact', () => {
    expect(
      expandObligationOccurrences({
        anchor: '2026-09-01',
        through: '2026-09-23',
        amountMinor: 1_000,
        periodDays: 7,
      }).map((item) => item.date),
    ).toEqual(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22']);
    expect(
      expandObligationOccurrences({
        anchor: '2026-09-01',
        through: '2026-09-23',
        amountMinor: 1_000,
        periodDays: 10,
      }).map((item) => item.date),
    ).toEqual(['2026-09-01', '2026-09-11', '2026-09-21']);
  });

  it('preserves accrued original dates and amounts after changing the future schedule', () => {
    expect(
      expandObligationOccurrences({
        anchor: '2026-11-18',
        through: '2026-12-31',
        amountMinor: 5_000,
        dayOfMonth: 18,
        resolutions: {
          '2026-09-12': { status: 'paid' },
          '2026-10-12': { status: 'unpaid', amountMinor: 8_000 },
        },
      }),
    ).toEqual([
      { date: '2026-10-12', amountMinor: 8_000 },
      { date: '2026-11-18', amountMinor: 5_000 },
      { date: '2026-12-18', amountMinor: 5_000 },
    ]);
  });

  it('caps aggregate outstanding minimums at the remaining principal', () => {
    const plan = calculateFinancialPlan({
      asOf: '2026-09-13',
      accounts: { main: 10_000 },
      horizonEndDate: '2026-10-13',
      debts: [
        {
          id: 'card',
          name: 'Card',
          balanceMinor: 5_000,
          aprBps: 0,
          minimumPaymentMinor: 4_000,
          minimumOccurrences: [
            { date: '2026-09-12', amountMinor: 4_000 },
            { date: '2026-10-12', amountMinor: 4_000 },
          ],
        },
      ],
    });
    expect(plan.debtMinimumMinor).toBe(5_000);
    expect(plan.timeline.map((day) => day.protectedOutflowMinor)).toEqual([4_000, 1_000]);
  });

  it('rejects invalid payment amounts and never makes an overpaid occurrence negative', () => {
    expect(remainingObligationMinor(1_000, { paidMinor: 2_000 })).toBe(0);
    for (const paidMinor of [-1, 0.5, NaN, Infinity])
      expect(() => remainingObligationMinor(1_000, { paidMinor })).toThrow();
  });
});
