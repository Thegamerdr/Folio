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
      minimumPaymentMinor: 6000,
      dueDate: '2026-09-18',
    },
    {
      id: 'loan',
      name: 'Loan',
      balanceMinor: 80000,
      aprBps: 1200,
      minimumPaymentMinor: 2000,
      dueDate: '2026-09-20',
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
    const input: FinancialPlanInput = {
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
      debts: [
        {
          id: 'due-10',
          name: 'Card due 10th',
          balanceMinor: 50000,
          aprBps: 2400,
          minimumPaymentMinor: 5000,
          dueDate: '2026-09-10',
        },
        {
          id: 'due-16',
          name: 'Card due 16th',
          balanceMinor: 60000,
          aprBps: 1800,
          minimumPaymentMinor: 6000,
          dueDate: '2026-09-16',
        },
        {
          id: 'due-20',
          name: 'Card due 20th',
          balanceMinor: 70000,
          aprBps: 1200,
          minimumPaymentMinor: 7000,
          dueDate: '2026-09-20',
        },
      ],
      bufferMinor: 15000,
      horizonEndDate: '2026-09-25',
    };
    const result = calculateFinancialPlan(input);
    expect(result.nextIncomeDate).toBe('2026-09-11');
    expect(result.safeToSpendMinor).toBe(80000);
    expect(
      result.timeline.some((point) => point.eventIds.includes('debt-minimum:due-16:2026-09-16')),
    ).toBe(true);
    expect(simulateFinancialAffordability(input, 30000, '2026-09-09').affordable).toBe(true);
    expect(
      calculateFinancialPlan({
        ...input,
        cashflows: [{ id: 'unexpected', date: '2026-09-09', amountMinor: -12000 }],
      }).safeToSpendMinor,
    ).toBe(68000);
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
          date: '2026-09-12',
          amountMinor: 25000,
          label: 'Childcare',
          priority: 'living',
        },
      ],
      livingCosts: [{ id: 'food-c', date: '2026-09-13', amountMinor: 12000, label: 'Food' }],
      bufferMinor: 10000,
    });
    expect(result.nextIncomeDate).toBe('2026-09-14');
    expect(result.debtRecommendation.targetDebtId).toBeNull();
    expect(result.safeToSpendMinor).toBe(23000);
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
  it('reserves an overdue commitment today and caps a minimum at remaining balance', () => {
    const result = calculateFinancialPlan({
      asOf: '2026-09-09',
      accounts: { current: 100000 },
      nextIncomeDate: '2026-09-20',
      horizonEndDate: '2026-09-20',
      commitments: [
        { id: 'overdue-rent', date: '2026-09-01', amountMinor: 20000, label: 'Overdue rent' },
      ],
      debts: [
        {
          id: 'small-card',
          name: 'Small card',
          balanceMinor: 3000,
          aprBps: 0,
          minimumPaymentMinor: 5000,
          dueDate: '2026-09-10',
        },
      ],
      bufferMinor: 10000,
    });
    expect(result.timeline[0]).toMatchObject({ date: '2026-09-09', eventIds: ['overdue-rent'] });
    expect(result.timeline.find((point) => point.date === '2026-09-10')?.netChangeMinor).toBe(
      -3000,
    );
    expect(result.debtMinimumMinor).toBe(3000);
    expect(result.safeToSpendMinor).toBe(67000);
  });

  it('retains a debt day-31 anchor across February in minima and payoff rows', () => {
    const input: FinancialPlanInput = {
      asOf: '2026-01-01',
      accounts: { current: 10000 },
      horizonEndDate: '2026-03-31',
      debts: [
        {
          id: 'jan31',
          name: 'January 31 card',
          balanceMinor: 3000,
          aprBps: 0,
          minimumPaymentMinor: 1000,
          dueDate: '2026-01-31',
        },
      ],
      bufferMinor: 0,
    };
    const plan = calculateFinancialPlan(input);
    expect(
      plan.timeline
        .flatMap((point) => point.eventIds)
        .filter((id) => id.startsWith('debt-minimum:jan31:')),
    ).toEqual([
      'debt-minimum:jan31:2026-01-31',
      'debt-minimum:jan31:2026-02-28',
      'debt-minimum:jan31:2026-03-31',
    ]);

    const projection = projectFinancialDebts({
      debts: input.debts ?? [],
      strategy: 'hybrid',
      startDate: '2026-01-01',
      maxMonths: 3,
    });
    expect(projection.rows.map((row) => row.dueDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
    expect(projection.payoffDate).toBe('2026-03-31');

    const adapterAnchored = projectFinancialDebts({
      debts: [
        {
          ...input.debts![0]!,
          dueDate: '2026-02-28',
          dueDayOfMonth: 31,
        },
      ],
      strategy: 'hybrid',
      startDate: '2026-02-01',
      maxMonths: 2,
    });
    expect(adapterAnchored.rows.map((row) => row.dueDate)).toEqual(['2026-02-28', '2026-03-31']);
  });

  it('applies a one-off debt extra once while monthly extras recur', () => {
    const debt = {
      id: 'extra',
      name: 'Extra payment card',
      balanceMinor: 6000,
      aprBps: 0,
      minimumPaymentMinor: 1000,
      dueDate: '2026-01-31',
    };
    const monthly = projectFinancialDebts({
      debts: [debt],
      strategy: 'hybrid',
      startDate: '2026-01-01',
      extraMonthlyMinor: 500,
      maxMonths: 3,
    });
    const once = projectFinancialDebts({
      debts: [debt],
      strategy: 'hybrid',
      startDate: '2026-01-01',
      oneOffExtraMinor: 1500,
      maxMonths: 3,
    });
    expect(monthly.rows.map((row) => row.paymentMinor)).toEqual([1500, 1500, 1500]);
    expect(once.rows.map((row) => row.paymentMinor)).toEqual([2500, 1000, 1000]);
    expect(once.oneOffExtraMinor).toBe(1500);
    expect(once.extraMonthlyMinor).toBe(0);

    const immediate = projectFinancialDebts({
      debts: [{ ...debt, balanceMinor: 10000, aprBps: 3650, minimumPaymentMinor: 0 }],
      strategy: 'hybrid',
      startDate: '2026-01-01',
      oneOffExtraMinor: 10000,
      maxMonths: 3,
    });
    expect(immediate.payoffDate).toBe('2026-01-01');
    expect(immediate.totalInterestMinor).toBe(0);

    const datedInterest = projectFinancialDebts({
      debts: [{ ...debt, balanceMinor: 10000, aprBps: 3650 }],
      strategy: 'hybrid',
      startDate: '2026-01-01',
      oneOffExtraMinor: 1000,
      maxMonths: 2,
    });
    expect(datedInterest.rows.map((row) => row.interestMinor)).toEqual([270, 232]);
    expect(datedInterest.rows.map((row) => row.closingPrincipalMinor)).toEqual([8270, 7502]);
    const promo = projectFinancialDebts({
      debts: [
        {
          ...debt,
          balanceMinor: 10000,
          aprBps: 0,
          promoUntil: '2026-01-15',
          postPromoAprBps: 3650,
        },
      ],
      strategy: 'hybrid',
      startDate: '2026-01-01',
      oneOffExtraMinor: 1000,
      maxMonths: 1,
    });
    expect(promo.totalInterestMinor).toBe(135);
  });

  it('counts weekly debt extras on their real seven-day schedule and caps all pre-income payments', () => {
    const weekly = projectFinancialDebts({
      debts: [
        {
          id: 'weekly-extra',
          name: 'Weekly extra card',
          balanceMinor: 20000,
          aprBps: 0,
          minimumPaymentMinor: 1000,
          dueDate: '2026-01-31',
        },
      ],
      strategy: 'hybrid',
      startDate: '2026-01-01',
      extraWeeklyMinor: 200,
      maxMonths: 3,
    });
    expect(weekly.rows.map((row) => row.paymentMinor)).toEqual([2000, 1800, 1800]);

    const midCycle = projectFinancialDebts({
      debts: [
        {
          id: 'mid-cycle',
          name: 'Mid-cycle card',
          balanceMinor: 1000,
          aprBps: 3650,
          minimumPaymentMinor: 0,
          dueDate: '2026-01-31',
        },
      ],
      strategy: 'hybrid',
      startDate: '2026-01-01',
      extraWeeklyMinor: 500,
      maxMonths: 2,
    });
    expect(midCycle.payoffDate).toBe('2026-01-15');
    expect(midCycle.totalInterestMinor).toBe(4);

    const plan = calculateFinancialPlan({
      asOf: '2026-01-01',
      accounts: { current: 500 },
      nextIncomeDate: '2026-01-31',
      debts: [
        {
          id: 'weekly-extra',
          name: 'Weekly extra card',
          balanceMinor: 20000,
          aprBps: 0,
          minimumPaymentMinor: 0,
          dueDate: '2026-01-31',
        },
      ],
      extraDebtPaymentMinor: 200,
      extraDebtPaymentCadence: 'weekly',
      bufferMinor: 0,
    });
    expect(plan.debtRecommendation.extraPaymentMinor).toBe(100);
    expect(plan.debtProjection?.extraWeeklyMinor).toBe(100);
    expect(plan.extraPaymentCountBeforeIncome).toBe(5);
    expect(plan.extraPaymentTotalBeforeIncomeMinor).toBe(500);
  });

  it('keeps debt due dates, promo uncertainty, and extra-payment cascade explicit', () => {
    const dated = calculateFinancialPlan({
      asOf: '2026-09-09',
      accounts: { current: 100000 },
      nextIncomeDate: '2026-09-30',
      horizonEndDate: '2026-09-30',
      debts: [
        {
          id: 'first',
          name: 'First due',
          balanceMinor: 30000,
          aprBps: 0,
          minimumPaymentMinor: 4000,
          dueDate: '2026-09-10',
        },
        {
          id: 'second',
          name: 'Second due',
          balanceMinor: 30000,
          aprBps: 0,
          minimumPaymentMinor: 5000,
          dueDate: '2026-09-20',
        },
      ],
      bufferMinor: 0,
    });
    expect(
      dated.timeline.some(
        (point) =>
          point.date === '2026-09-10' && point.eventIds.includes('debt-minimum:first:2026-09-10'),
      ),
    ).toBe(true);
    expect(
      dated.timeline.some(
        (point) =>
          point.date === '2026-09-20' && point.eventIds.includes('debt-minimum:second:2026-09-20'),
      ),
    ).toBe(true);
    const promo = projectFinancialDebts({
      debts: [
        {
          id: 'promo',
          name: 'Promo debt',
          balanceMinor: 50000,
          aprBps: 0,
          postPromoAprBps: null,
          promoUntil: '2026-10-01',
          minimumPaymentMinor: 10000,
          dueDate: '2026-09-10',
        },
      ],
      strategy: 'avalanche',
      startDate: '2026-09-09',
    });
    expect(promo).toMatchObject({
      unknownAprDebtIds: ['promo'],
      interestKnown: false,
      payoffDate: null,
      totalInterestMinor: null,
    });
    const cascade = projectFinancialDebts({
      debts: [
        { id: 'small', name: 'Small', balanceMinor: 10000, aprBps: 0, minimumPaymentMinor: 3000 },
        { id: 'large', name: 'Large', balanceMinor: 20000, aprBps: 0, minimumPaymentMinor: 3000 },
      ],
      strategy: 'snowball',
      startDate: '2026-09-09',
      extraMonthlyMinor: 9000,
    });
    expect(cascade.cascade.some((event) => event.debtId === 'small' && event.period === 1)).toBe(
      true,
    );
    expect(cascade.cascade.some((event) => event.debtId === 'large' && event.period === 2)).toBe(
      true,
    );
  });

  it('honors explicit priority, promotional, and user-selected debt strategies', () => {
    const debts = [
      {
        id: 'arrears',
        name: 'Arrears',
        balanceMinor: 10000,
        aprBps: 1200,
        minimumPaymentMinor: 1000,
        arrears: true,
      },
      {
        id: 'promo',
        name: 'Promo',
        balanceMinor: 20000,
        aprBps: 0,
        minimumPaymentMinor: 1000,
        promoUntil: '2026-09-15',
      },
      {
        id: 'selected',
        name: 'Selected',
        balanceMinor: 30000,
        aprBps: 2400,
        minimumPaymentMinor: 1000,
      },
    ];
    const plan = (
      strategy: Exclude<FinancialPlanInput['strategy'], undefined>,
      selectedDebtId?: string,
      candidateDebts = debts,
    ) =>
      calculateFinancialPlan({
        asOf: '2026-09-09',
        accounts: { current: 100000 },
        horizonEndDate: '2026-09-09',
        debts: candidateDebts,
        strategy,
        ...(selectedDebtId === undefined ? {} : { selectedDebtId }),
      });
    expect(plan('priority').debtRecommendation.order[0]).toBe('arrears');
    expect(
      plan(
        'promo',
        undefined,
        debts.filter((debt) => debt.id !== 'arrears'),
      ).debtRecommendation.order[0],
    ).toBe('promo');
    expect(plan('user-selected', 'selected').debtRecommendation.order[0]).toBe('selected');
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
