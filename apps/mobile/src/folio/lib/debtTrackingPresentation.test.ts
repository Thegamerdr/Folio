import { describe, expect, it } from 'vitest';
import type { Debt, TimelineEvent, Transaction } from '../store';
import { selectDebtTrackingPresentation } from './debtTrackingPresentation';

function debt(id: string, addedAt: string, balance = 0): Debt {
  return {
    id,
    name: id,
    kind: 'card',
    balance,
    apr: 0,
    aprKnown: true,
    minPayment: 10,
    dueDom: 15,
    addedAt,
  };
}

function payment(id: string, when: string): Transaction {
  return {
    id: `payment-${id}-${when}`,
    when,
    merchant: `Debt payment: ${id}`,
    amount: -10,
    category: 'bills',
    source: 'manual',
    financialAction: { kind: 'debt-payment', debtId: id, principalAppliedMinor: 1000 },
  };
}

function removal(id: string, at: string): TimelineEvent {
  return {
    id: `removed-${id}-${at}`,
    at,
    kind: 'debt-removed',
    subject: id,
    entityId: id,
  };
}

describe('debt tracking history ordering', () => {
  it('orders cleared debts newest first by their real last-payment or added timestamp', () => {
    const result = selectDebtTrackingPresentation({
      // Deliberately pass the debts and transactions oldest first: the presentation owns history
      // order, while active debt order remains the recorded list order.
      debts: [
        debt('older', '2026-08-01'),
        debt('newer', '2026-08-02'),
        debt('added-zero', '2026-09-05'),
      ],
      transactions: [
        payment('newer', '2026-09-10T09:00:00.000Z'),
        payment('older', '2026-09-01T09:00:00.000Z'),
      ],
      timelineEvents: [],
    });

    expect(result.cleared.map(({ debt: row }) => row.id)).toEqual(['newer', 'added-zero', 'older']);
    expect(result.cleared.map(({ lastPaymentAt }) => lastPaymentAt)).toEqual([
      '2026-09-10T09:00:00.000Z',
      undefined,
      '2026-09-01T09:00:00.000Z',
    ]);
  });

  it('orders removed receipts newest first and keeps unknown-date legacy rows after dated rows', () => {
    const result = selectDebtTrackingPresentation({
      debts: [],
      transactions: [payment('legacy-old', '2026-08-01T09:00:00.000Z')],
      timelineEvents: [
        removal('removed-old', '2026-08-10T09:00:00.000Z'),
        removal('legacy-unknown', ''),
        removal('removed-new', '2026-09-10T09:00:00.000Z'),
      ],
    });

    expect(result.removed.map((row) => row.id)).toEqual([
      'removed-new',
      'removed-old',
      'legacy-unknown',
      'legacy-old',
    ]);
    expect(result.removed.find((row) => row.id === 'legacy-unknown')).not.toHaveProperty(
      'removedAt',
    );
    expect(result.removed.find((row) => row.id === 'legacy-old')).not.toHaveProperty('removedAt');
  });

  it('keeps equal timestamps in source order so chronology never drops or reshuffles history', () => {
    const result = selectDebtTrackingPresentation({
      debts: [],
      transactions: [],
      timelineEvents: [
        removal('first', '2026-09-10T09:00:00.000Z'),
        removal('second', '2026-09-10T09:00:00.000Z'),
      ],
    });

    expect(result.removed.map((row) => row.id)).toEqual(['first', 'second']);
  });
});
