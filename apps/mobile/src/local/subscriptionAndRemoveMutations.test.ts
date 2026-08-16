import { describe, expect, it } from 'vitest';

import { createEmptyLocalLedgerState, type LocalLedgerState } from './localLedger.js';
import {
  createSubscriptionThroughCanonicalRepository,
  recordManualTransactionThroughCanonicalRepository,
  removeTransactionThroughCanonicalRepository,
} from './canonicalLedgerMutations.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { buildLocalSubscriptionsModel } from './localSubscriptionsAdapter.js';

// These two mutations were the engine gaps the functional audit found: the Subscriptions screen had
// no way to create a subscription (the whole surface was inert), and a mis-logged Today spend could
// not be undone (no removeTransaction). Both go through the canonical boundary, so the assertions
// prove the durable-container/transaction projection stays valid after each.

function seededLedger(): LocalLedgerState {
  return {
    ...createEmptyLocalLedgerState('2026-06-28'),
    cashOnHandMinor: 50_000,
  };
}

function canonicalTransactionCount(state: LocalLedgerState): number {
  return createCanonicalRepositoryForLocalLedgerState(state).transactions.count();
}

describe('createSubscription through the canonical boundary', () => {
  it('adds a real subscription that the Subscriptions model projects', () => {
    const base = seededLedger();
    const baseTransactions = canonicalTransactionCount(base);

    const withSub = createSubscriptionThroughCanonicalRepository(base, {
      name: 'Netflix',
      costMinor: 1099,
      cadence: 'monthly',
    });

    // A subscription is a durable container, not a money event: it must not invent a transaction.
    expect(canonicalTransactionCount(withSub)).toBe(baseTransactions);
    expect(withSub.subscriptions).toHaveLength(1);
    expect(withSub.subscriptions[0]).toMatchObject({
      name: 'Netflix',
      cost: { minorUnits: 1099 },
      paused: false,
    });

    // The read model the screen renders now sees a live, active subscription.
    const model = buildLocalSubscriptionsModel(withSub);
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.name).toBe('Netflix');
    expect(model.activeCount).toBe(1);
    expect(model.pausedCount).toBe(0);
    expect(model.monthlyTotalMinor).toBeGreaterThan(0);
  });

  it('does not mutate the source ledger', () => {
    const base = seededLedger();
    createSubscriptionThroughCanonicalRepository(base, {
      name: 'Spotify',
      costMinor: 1199,
      cadence: 'monthly',
    });
    expect(base.subscriptions).toHaveLength(0);
  });

  it('rejects a non-positive cost', () => {
    const base = seededLedger();
    expect(() =>
      createSubscriptionThroughCanonicalRepository(base, {
        name: 'Free thing',
        costMinor: 0,
        cadence: 'monthly',
      }),
    ).toThrow();
  });
});

describe('subscription cadence is normalized to a per-month figure (FIX 4)', () => {
  // The old model summed raw costMinor across cadences, so £10/week showed "Every month £10.00"
  // (true: ~£43.33/mo) and £120/year showed "Every month £120.00" (12x). Cadence is now stored on
  // the subscription and normalized to whole pence per month. These cases fail against the old code.

  it('stores cadence on the created subscription', () => {
    const withSub = createSubscriptionThroughCanonicalRepository(seededLedger(), {
      name: 'Gym',
      costMinor: 1000,
      cadence: 'weekly',
    });
    expect(withSub.subscriptions[0]?.cadence).toBe('weekly');
  });

  it('normalizes a £10/week subscription to £43.33/month (1000 -> 4333 minor)', () => {
    const withSub = createSubscriptionThroughCanonicalRepository(seededLedger(), {
      name: 'Weekly thing',
      costMinor: 1000,
      cadence: 'weekly',
    });
    const model = buildLocalSubscriptionsModel(withSub);

    // round(1000 * 52 / 12) = 4333.
    expect(model.monthlyTotalMinor).toBe(4333);
    expect(model.rows[0]?.monthlyMinor).toBe(4333);
    // The row keeps its own per-cadence cost for display ("£10.00 / week").
    expect(model.rows[0]?.costMinor).toBe(1000);
    expect(model.rows[0]?.cadence).toBe('weekly');
  });

  it('normalizes a £120/year subscription to £10.00/month (12000 -> 1000 minor)', () => {
    const withSub = createSubscriptionThroughCanonicalRepository(seededLedger(), {
      name: 'Yearly thing',
      costMinor: 12_000,
      cadence: 'yearly',
    });
    const model = buildLocalSubscriptionsModel(withSub);

    // round(12000 / 12) = 1000.
    expect(model.monthlyTotalMinor).toBe(1000);
    expect(model.rows[0]?.monthlyMinor).toBe(1000);
    expect(model.rows[0]?.costMinor).toBe(12_000);
    expect(model.rows[0]?.cadence).toBe('yearly');
  });

  it('leaves a monthly subscription at face value', () => {
    const withSub = createSubscriptionThroughCanonicalRepository(seededLedger(), {
      name: 'Monthly thing',
      costMinor: 1099,
      cadence: 'monthly',
    });
    const model = buildLocalSubscriptionsModel(withSub);

    expect(model.monthlyTotalMinor).toBe(1099);
    expect(model.rows[0]?.monthlyMinor).toBe(1099);
  });
});

describe('removeTransaction through the canonical boundary', () => {
  function withOneSpend() {
    const before = seededLedger();
    const after = recordManualTransactionThroughCanonicalRepository(before, {
      title: 'Coffee',
      amountText: '3.50',
      kind: 'spend',
    });
    const added = after.transactions.find(
      (transaction) => !before.transactions.some((existing) => existing.id === transaction.id),
    );
    if (added === undefined) throw new Error('test setup: manual spend was not added');
    return { before, after, added };
  }

  it('removes the logged spend and rebuilds from what is left', () => {
    const { before, after, added } = withOneSpend();
    const baselineCount = before.transactions.length;
    expect(after.transactions.length).toBe(baselineCount + 1);

    const removed = removeTransactionThroughCanonicalRepository(after, added.id);

    expect(removed.transactions.some((transaction) => transaction.id === added.id)).toBe(false);
    expect(removed.transactions.length).toBe(baselineCount);
  });

  it('no-ops cleanly for an id that is not present', () => {
    const { after } = withOneSpend();
    const unchanged = removeTransactionThroughCanonicalRepository(
      after,
      'transaction_does_not_exist',
    );
    expect(unchanged.transactions.length).toBe(after.transactions.length);
  });

  it('does not mutate the source ledger', () => {
    const { after, added } = withOneSpend();
    const lengthBefore = after.transactions.length;
    removeTransactionThroughCanonicalRepository(after, added.id);
    expect(after.transactions.length).toBe(lengthBefore);
    expect(after.transactions.some((transaction) => transaction.id === added.id)).toBe(true);
  });
});
