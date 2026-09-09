import { describe, expect, it } from 'vitest';

import { calculateFinancialPlan, type FinancialPlanInput } from '../src/index.js';

const addDays = (day: string, count: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10);

function monthly(asOf = '2026-09-28'): FinancialPlanInput {
  return {
    asOf,
    accounts: { current: 180000 },
    // An adapter may still report today's scheduled payday. It must not suppress the next one.
    nextIncomeDate: '2026-09-28',
    income: [
      { id: 'salary-sep', date: '2026-09-28', amountMinor: 180000, kind: 'income' },
      { id: 'salary-oct', date: '2026-10-28', amountMinor: 180000, kind: 'income' },
    ],
    commitments: [
      { id: 'rent-bills', date: '2026-10-12', amountMinor: 95000, label: 'Rent and bills' },
    ],
    livingCosts: Array.from({ length: 40 }, (_, day) => ({
      id: `essentials:${day}`,
      date: addDays(asOf, day),
      amountMinor: 1000,
      label: 'Essentials (£70 weekly)',
    })),
    horizonEndDate: addDays(asOf, 40),
    bufferMinor: 20000,
  };
}

describe('current-cash and payday boundary invariants', () => {
  it('uses the same receipt invariant when scheduled income is supplied through cashflows', () => {
    const input = monthly();
    const result = calculateFinancialPlan({ ...input, income: [], cashflows: input.income ?? [] });
    expect(result.nextIncomeDate).toBe('2026-10-28');
    expect(result.safeToSpendMinor).toBe(35000);
    expect(result.timeline.flatMap((point) => point.eventIds)).not.toContain('salary-sep');
    expect(result.timeline.filter((point) => point.eventIds.includes('salary-oct'))).toHaveLength(
      1,
    );
  });

  it('keeps explicitly hypothetical untagged cashflow deltas separate from posted actual history', () => {
    const input = monthly();
    expect(
      calculateFinancialPlan({
        ...input,
        cashflows: [{ id: 'hypothetical-spend', date: input.asOf, amountMinor: -6000 }],
      }).safeToSpendMinor,
    ).toBe(29000);
  });

  it('exact release reproduction protects £950 bills, £300 essentials and £200 buffer from £1800', () => {
    const result = calculateFinancialPlan(monthly());
    expect(result.safeToSpendMinor).toBe(35000);
    expect(result.nextIncomeDate).toBe('2026-10-28');
    expect(result.protectedBeforeIncomeMinor).toBe(125000);
    expect(result.livingCostMinor).toBe(30000);
    expect(result.timeline.flatMap((point) => point.eventIds)).not.toContain('salary-sep');
  });

  it.each([
    ['2026-09-27', '2026-09-28', 159000, 1000],
    ['2026-09-28', '2026-10-28', 35000, 30000],
    ['2026-09-29', '2026-10-28', 36000, 29000],
  ])(
    'monthly %s uses future boundary %s with no scheduled money available early',
    (asOf, next, safe, living) => {
      const result = calculateFinancialPlan(monthly(asOf as string));
      expect(result.nextIncomeDate).toBe(next);
      expect(result.safeToSpendMinor).toBe(safe);
      expect(result.livingCostMinor).toBe(living);
    },
  );

  it.each([
    ['weekly', '2026-09-27', '2026-10-05', '2026-09-28', 1],
    ['weekly', '2026-09-29', '2026-10-05', '2026-10-05', 6],
    ['irregular', '2026-09-27', '2026-10-09', '2026-09-28', 1],
    ['irregular', '2026-09-29', '2026-10-09', '2026-10-09', 10],
  ] as const)(
    '%s on %s preserves the day-before/day-after boundary',
    (_cadence, asOf, following, next, days) => {
      const input = monthly(asOf);
      const result = calculateFinancialPlan({
        ...input,
        commitments: [],
        income: [
          { id: 'first', date: '2026-09-28', amountMinor: 36000 },
          { id: 'following', date: following, amountMinor: 22000 },
        ],
      });
      expect(result.nextIncomeDate).toBe(next);
      expect(result.safeToSpendMinor).toBe(160000 - days * 1000);
    },
  );

  it('does not merge different legitimate receipts on the same day, and rejects repeated event IDs', () => {
    const input: FinancialPlanInput = {
      asOf: '2026-09-27',
      accounts: { current: 10000 },
      income: [
        { id: 'salary', date: '2026-09-28', amountMinor: 20000 },
        { id: 'client', date: '2026-09-28', amountMinor: 30000 },
      ],
    };
    const result = calculateFinancialPlan(input);
    expect(result.safeToSpendMinor).toBe(10000);
    expect(result.timeline[0]?.closingMinor).toBe(60000);
    expect(() =>
      calculateFinancialPlan({ ...input, income: [input.income![0]!, input.income![0]!] }),
    ).toThrow('Duplicate financial event id: salary');
  });

  it('unreceived salary today is never credited; confirming it changes only the current balance', () => {
    const input = monthly();
    const pending = calculateFinancialPlan({ ...input, accounts: { current: 20000 } });
    expect(pending.safeToSpendMinor).toBe(-125000);
    const confirmed = calculateFinancialPlan({
      ...input,
      cashflows: [{ id: 'posted-salary', date: input.asOf, amountMinor: 160000, kind: 'actual' }],
    });
    expect(confirmed.safeToSpendMinor).toBe(35000);
    expect(confirmed.currentBalanceMinor).toBe(180000);
    expect(confirmed.timeline.flatMap((point) => point.eventIds)).not.toContain('posted-salary');
  });

  it('posted cash movements of either sign today and in history are already in the balance', () => {
    const input = monthly();
    expect(
      calculateFinancialPlan({
        ...input,
        cashflows: [
          { id: 'posted-bonus', date: input.asOf, amountMinor: 20000, kind: 'actual' },
          { id: 'posted-spend', date: input.asOf, amountMinor: -4000, kind: 'actual' },
          { id: 'historic-income', date: '2026-08-28', amountMinor: 180000, kind: 'actual' },
        ],
      }).safeToSpendMinor,
    ).toBe(35000);
  });

  it.each([
    ['weekly', '2026-10-05', 7],
    ['irregular', '2026-10-09', 11],
  ])(
    '%s income today moves protection to the next actual dated receipt',
    (_cadence, next, days) => {
      const input = monthly();
      const result = calculateFinancialPlan({
        ...input,
        commitments: [],
        income: [
          { id: 'due-today', date: input.asOf, amountMinor: 50000 },
          { id: 'next-receipt', date: next as string, amountMinor: 36000 },
        ],
      });
      expect(result.nextIncomeDate).toBe(next);
      expect(result.safeToSpendMinor).toBe(160000 - Number(days) * 1000);
      expect(result.livingCostMinor).toBe(Number(days) * 1000);
    },
  );

  it('one-off unconfirmed income today cannot create a known future payday or extra cash', () => {
    const result = calculateFinancialPlan({
      asOf: '2026-09-28',
      accounts: { current: 10000 },
      nextIncomeDate: '2026-09-28',
      income: [{ id: 'unconfirmed', date: '2026-09-28', amountMinor: 50000 }],
      commitments: [{ id: 'bill', date: '2026-10-01', amountMinor: 15000, label: 'Bill' }],
    });
    expect(result.nextIncomeDate).toBeNull();
    expect(result.safeToSpendMinor).toBe(-5000);
  });

  it('counts a future receipt once in the forecast and excludes its entire day from pre-income spending', () => {
    const input = monthly('2026-09-27');
    const result = calculateFinancialPlan({
      ...input,
      commitments: [
        { id: 'payday-bill', date: '2026-09-28', amountMinor: 50000, label: 'Payday bill' },
      ],
    });
    expect(result.safeToSpendMinor).toBe(159000);
    expect(result.protectedBeforeIncomeMinor).toBe(1000);
    expect(result.timeline.filter((point) => point.eventIds.includes('salary-sep'))).toHaveLength(
      1,
    );
    expect(result.timeline.find((point) => point.date === '2026-09-28')?.netChangeMinor).toBe(
      129000,
    );
  });
});
