import { describe, expect, it } from 'vitest';

import {
  calculateFinancialPlan,
  projectFinancialDebts,
  simulateFinancialAffordability,
  type FinancialPlanInput,
} from '../src/index.js';

const fixtureB: FinancialPlanInput = {
  asOf: '2026-09-09',
  accounts: { current: 180000 },
  income: [{ id: 'sep-pay', date: '2026-09-28', amountMinor: 180000, label: 'Monthly pay' }],
  commitments: [
    {
      id: 'rent-bills',
      date: '2026-09-12',
      amountMinor: 95000,
      label: 'Rent and bills',
      priority: 'housing',
    },
  ],
  livingCosts: [
    { id: 'food-before-pay', date: '2026-09-24', amountMinor: 19000, label: 'Food and essentials' },
  ],
  debts: [
    {
      id: 'card',
      name: 'Card',
      balanceMinor: 100000,
      aprBps: 2400,
      minimumPaymentMinor: 8000,
      dueDate: '2026-09-18',
    },
  ],
  bufferMinor: 20000,
};

describe('canonical financial plan fixtures', () => {
  it('Fixture B supports monthly pay, bundled housing, no transport, and deterministic safe-to-spend', () => {
    const result = calculateFinancialPlan(fixtureB);
    expect(result.nextIncomeDate).toBe('2026-09-28');
    expect(result.protectedBeforeIncomeMinor).toBe(122000);
    expect(result.safeToSpendMinor).toBe(38000);
    expect(result.shortfallMinor).toBe(0);
    expect(result.debtRecommendation.targetDebtId).toBe('card');
    expect(result.debtRecommendation.extraPaymentMinor).toBe(38000);
  });

  it('recalculates after an unexpected spend, buffer change, and unsafe affordability request', () => {
    const afterSpend = calculateFinancialPlan({
      ...fixtureB,
      cashflows: [
        { id: 'overspend', date: '2026-09-15', amountMinor: -12000, label: 'Unexpected spend' },
      ],
    });
    expect(afterSpend.safeToSpendMinor).toBe(26000);
    expect(calculateFinancialPlan({ ...fixtureB, bufferMinor: 0 }).safeToSpendMinor).toBe(58000);
    const check = simulateFinancialAffordability(fixtureB, 40000);
    expect(check).toMatchObject({
      affordable: false,
      safeToSpendBeforeMinor: 38000,
      safeToSpendAfterMinor: -2000,
      shortfallMinor: 2000,
    });
  });

  it('includes an affordability scenario on or after the next income date', () => {
    const check = simulateFinancialAffordability(fixtureB, 220000, '2026-10-01');
    expect(check).toMatchObject({
      affordable: false,
      safeToSpendAfterMinor: -2000,
      shortfallMinor: 2000,
      shortfallDate: '2026-10-01',
    });
  });

  it('Fixture A handles weekly variable income and separately dated obligations', () => {
    const result = calculateFinancialPlan({
      asOf: '2026-09-09',
      accounts: { current: 100000 },
      income: [
        { id: 'pay-1', date: '2026-09-11', amountMinor: 45000 },
        { id: 'pay-2', date: '2026-09-18', amountMinor: 60000 },
      ],
      commitments: [
        { id: 'fuel', date: '2026-09-12', amountMinor: 12000, label: 'Transport' },
        { id: 'insurance', date: '2026-09-16', amountMinor: 18000, label: 'Insurance' },
      ],
      livingCosts: [{ id: 'food', date: '2026-09-17', amountMinor: 20000, label: 'Food' }],
      bufferMinor: 15000,
    });
    expect(result.nextIncomeDate).toBe('2026-09-11');
    expect(result.safeToSpendMinor).toBe(85000);
  });

  it('Fixture C supports irregular mixed income, childcare, and no debt without a forced cadence', () => {
    const result = calculateFinancialPlan({
      asOf: '2026-09-09',
      accounts: { current: 70000 },
      income: [
        { id: 'contract-a', date: '2026-09-14', amountMinor: 35000 },
        { id: 'contract-b', date: '2026-09-25', amountMinor: 22000 },
      ],
      commitments: [
        {
          id: 'childcare',
          date: '2026-09-20',
          amountMinor: 25000,
          label: 'Childcare',
          priority: 'living',
        },
      ],
      livingCosts: [{ id: 'food-c', date: '2026-09-23', amountMinor: 12000, label: 'Food' }],
      bufferMinor: 10000,
    });
    expect(result.nextIncomeDate).toBe('2026-09-14');
    expect(result.debtRecommendation.targetDebtId).toBeNull();
    expect(result.safeToSpendMinor).toBe(60000);
  });

  it('reports the first shortage and its dated cause', () => {
    const result = calculateFinancialPlan({
      asOf: '2026-09-09',
      accounts: { current: 50000 },
      nextIncomeDate: '2026-09-28',
      commitments: [
        { id: 'rent', date: '2026-09-12', amountMinor: 70000, label: 'Rent', priority: 'housing' },
      ],
      bufferMinor: 10000,
    });
    expect(result.shortfallMinor).toBe(30000);
    expect(result.shortfallDate).toBe('2026-09-12');
    expect(result.shortfallCauses[0]).toMatchObject({
      eventId: 'rent',
      label: 'Rent',
      amountMinor: 70000,
    });
  });
});

describe('debt strategy and APR honesty', () => {
  const debts = [
    { id: 'a', name: 'Card A', balanceMinor: 10000, aprBps: 2400, minimumPaymentMinor: 8000 },
    { id: 'b', name: 'Card B', balanceMinor: 30000, aprBps: 1200, minimumPaymentMinor: 11000 },
  ] as const;

  it('rolls freed minimums into the selected cascade order', () => {
    const projection = projectFinancialDebts({
      debts,
      strategy: 'snowball',
      startDate: '2026-09-09',
      extraMonthlyMinor: 0,
    });
    expect(projection.cascade.some((event) => event.debtId === 'a')).toBe(true);
    expect(projection.cascade.find((event) => event.debtId === 'a')?.releasedMinimumMinor).toBe(
      8000,
    );
    expect(projection.payoffMonths).not.toBeNull();
  });

  it('keeps unknown APR explicit and does not promise a payoff date or interest total', () => {
    const projection = projectFinancialDebts({
      debts: [
        {
          id: 'unknown',
          name: 'Unknown APR debt',
          balanceMinor: 50000,
          minimumPaymentMinor: 10000,
        },
      ],
      strategy: 'avalanche',
      startDate: '2026-09-09',
    });
    expect(projection).toMatchObject({
      interestKnown: false,
      payoffDate: null,
      payoffMonths: null,
      totalInterestMinor: null,
      stalled: true,
    });
    expect(projection.unknownAprDebtIds).toEqual(['unknown']);
  });
});
