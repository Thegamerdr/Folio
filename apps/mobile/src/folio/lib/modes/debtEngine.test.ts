import { describe, expect, it } from 'vitest';

import type { Debt } from '../../store';
import { orderAvalanche, orderSnowball, payoffMonths, summarise } from './debtEngine';

const debts: Debt[] = [
  {
    id: 'card',
    name: 'Card',
    kind: 'card',
    balance: 1_000,
    apr: 24,
    minPayment: 50,
    dueDom: 10,
    addedAt: '2026-07-01T12:00:00.000Z',
  },
  {
    id: 'loan',
    name: 'Loan',
    kind: 'loan',
    balance: 500,
    apr: 6,
    minPayment: 40,
    dueDom: 20,
    addedAt: '2026-07-01T12:00:00.000Z',
  },
];

describe('live Lovable debt schedule engine contract', () => {
  it('reports an impossible payoff when the payment does not cover interest', () => {
    expect(payoffMonths(1_000, 24, 20)).toBe(Number.POSITIVE_INFINITY);
  });

  it('orders avalanche by APR and snowball by balance', () => {
    expect(orderAvalanche(debts).map((debt) => debt.id)).toEqual(['card', 'loan']);
    expect(orderSnowball(debts).map((debt) => debt.id)).toEqual(['loan', 'card']);
  });

  it('shows a shorter payoff and non-negative interest reduction when extra is added', () => {
    const minimums = summarise(debts, 0, new Date('2026-07-01T12:00:00Z'));
    const extra = summarise(debts, 100, new Date('2026-07-01T12:00:00Z'));

    expect(extra.monthsWithExtra).toBeLessThan(minimums.monthsAtMin);
    expect(extra.interestSaved).toBeGreaterThanOrEqual(0);
    expect(extra.total).toBe(1_500);
    expect(extra.minSum).toBe(90);
  });
});
