import { describe, expect, it } from 'vitest';

import { projectDebtSchedule } from '../src/index.js';

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
