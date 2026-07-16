import { describe, expect, it } from 'vitest';

import { projectDebtPortfolio, projectDebtSchedule } from '../src/index.js';

describe('debt schedule primitive', () => {
  it('projects integer-minor-unit interest, payments, and payoff date deterministically', () => {
    const schedule = projectDebtSchedule({
      principalMinor: 100000,
      annualRateBps: 1200,
      monthlyPaymentMinor: 30000,
      startDate: '2026-07-31',
      currency: 'GBP',
      maxMonths: 12,
    });

    expect(schedule.rows[0]).toEqual({
      period: 1,
      dueDate: '2026-07-31',
      openingPrincipalMinor: 100000,
      interestMinor: 1000,
      paymentMinor: 30000,
      principalPaidMinor: 29000,
      closingPrincipalMinor: 71000,
    });
    expect(schedule.rows.at(-1)).toMatchObject({
      period: 4,
      dueDate: '2026-10-31',
      closingPrincipalMinor: 0,
    });
    expect(schedule.payoffDate).toBe('2026-10-31');
    expect(schedule.totalInterestMinor).toBe(2248);
  });

  it('refuses schedules where the payment does not cover modelled interest', () => {
    expect(() =>
      projectDebtSchedule({
        principalMinor: 100000,
        annualRateBps: 2400,
        monthlyPaymentMinor: 1000,
        startDate: '2026-07-31',
      }),
    ).toThrow(/does not cover/);
  });
});

describe('debt portfolio projection', () => {
  const debts = [
    {
      id: 'card',
      principalMinor: 100000,
      annualRateBps: 2400,
      minimumPaymentMinor: 5000,
    },
    {
      id: 'bnpl',
      principalMinor: 30000,
      annualRateBps: 0,
      minimumPaymentMinor: 10000,
    },
  ] as const;

  it('keeps contractual minimums attached to each debt and models 0% BNPL exactly', () => {
    const projection = projectDebtPortfolio({
      debts,
      strategy: 'contractual-minimums',
      startDate: '2026-07-31',
    });

    expect(projection).toMatchObject({
      debtCount: 2,
      startingPrincipalMinor: 130000,
      contractualMinimumMinor: 15000,
      extraMonthlyMinor: 0,
      stalled: false,
    });
    expect(projection.months).toBeGreaterThan(3);
    expect(projection.payoffDate).not.toBeNull();
    expect(projection.rows[2]?.closingPrincipalMinor).toBeGreaterThan(0);
  });

  it('applies an explicit fixed extra under either user-selected order', () => {
    const avalanche = projectDebtPortfolio({
      debts,
      strategy: 'highest-rate-first',
      extraMonthlyMinor: 5000,
      startDate: '2026-07-31',
    });
    const snowball = projectDebtPortfolio({
      debts,
      strategy: 'lowest-balance-first',
      extraMonthlyMinor: 5000,
      startDate: '2026-07-31',
    });
    const minimums = projectDebtPortfolio({
      debts,
      strategy: 'contractual-minimums',
      startDate: '2026-07-31',
    });

    expect(avalanche.months).not.toBeNull();
    expect(snowball.months).not.toBeNull();
    expect(avalanche.months!).toBeLessThan(minimums.months!);
    expect(snowball.months!).toBeLessThan(minimums.months!);
    expect(avalanche.totalInterestMinor).toBeLessThanOrEqual(snowball.totalInterestMinor);
  });

  it('reports a stalled projection without pretending there is a payoff date', () => {
    const projection = projectDebtPortfolio({
      debts: [
        {
          id: 'interest-only-gap',
          principalMinor: 100000,
          annualRateBps: 2400,
          minimumPaymentMinor: 1000,
        },
      ],
      strategy: 'contractual-minimums',
      startDate: '2026-07-31',
      maxMonths: 24,
    });

    expect(projection).toMatchObject({ months: null, payoffDate: null, stalled: true });
    expect(projection.rows).toHaveLength(24);
  });
});
