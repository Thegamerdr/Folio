import { describe, expect, it } from 'vitest';
import { calculateFinancialPlan } from '../src/index.js';

describe('minimum protection with interest across an irregular-income horizon', () => {
  it.each([2400, null])(
    'retains later scheduled minimums when APR %s does not establish interest-free payoff',
    (aprBps) => {
      const plan = calculateFinancialPlan({
        asOf: '2026-09-13',
        accounts: { main: 10000 },
        nextIncomeDate: '2026-10-28',
        debts: [
          {
            id: 'card',
            name: 'Card',
            balanceMinor: 5000,
            minimumPaymentMinor: 4000,
            aprBps,
            minimumOccurrences: [
              { date: '2026-09-12', amountMinor: 4000 },
              { date: '2026-10-12', amountMinor: 4000 },
            ],
          },
        ],
      });
      expect(plan.debtMinimumMinor).toBe(8000);
      expect(plan.safeToSpendMinor).toBe(2000);
    },
  );

  it('keeps post-promo unknown interest protected rather than ending at the current principal', () => {
    const plan = calculateFinancialPlan({
      asOf: '2026-09-13',
      accounts: { main: 10000 },
      nextIncomeDate: '2026-10-28',
      debts: [
        {
          id: 'card',
          name: 'Card',
          balanceMinor: 5000,
          minimumPaymentMinor: 4000,
          aprBps: 0,
          promoUntil: '2026-09-30',
          postPromoAprBps: null,
          minimumOccurrences: [
            { date: '2026-09-15', amountMinor: 4000 },
            { date: '2026-10-15', amountMinor: 4000 },
          ],
        },
      ],
    });
    expect(plan.debtMinimumMinor).toBe(8000);
  });
});
