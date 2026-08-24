import { beforeEach, describe, expect, it } from 'vitest';

import { getState, resetAll, setPartial } from '../store';
import { buildRecoveryRoutePreview } from './recoveryPreview';
import { routeFromStore } from './storeRoute';

const NOW = new Date('2026-07-15T12:00:00.000Z');

beforeEach(() => resetAll());

describe('buildRecoveryRoutePreview', () => {
  it('returns no recovery gap for a state without a real money picture', () => {
    const preview = buildRecoveryRoutePreview(getState(), NOW);
    expect(preview.hasShortfall).toBe(false);
    expect(preview.shortfall).toBe(0);
  });

  it('derives moves from real recurring and transaction data without mutating state', () => {
    setPartial({
      onboarding: { done: true, name: '', payday: 31, monthlyIncome: 1_000 },
      currentBalance: {
        amount: -100,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      accounts: [
        {
          id: 'recovery-current',
          name: 'Private recovery account',
          kind: 'bank',
          isLiability: false,
          balanceMinor: -100,
          balanceAsOfISO: NOW.toISOString(),
          addedAt: NOW.toISOString(),
        },
      ],
      subs: [
        {
          name: 'Private recurring name',
          cost: 80,
          nextRenewalDaysAway: 2,
          lastUsedDaysAgo: 0,
          usesPerMonth: 1,
        },
      ],
      subPaused: {},
      transactions: [
        {
          id: 'private-spend-id',
          merchant: 'Private merchant',
          amount: -300,
          when: '2026-07-10T12:00:00.000Z',
          category: 'shopping',
          source: 'manual',
        },
      ],
    });
    const before = JSON.stringify(getState());
    const preview = buildRecoveryRoutePreview(getState(), NOW);

    expect(preview.hasMoneyPicture).toBe(true);
    expect(preview.holdDailyCap).toBe(5);
    expect(preview.holdLift).toBe(15);
    expect(preview.flexibleBill?.name).toBe('Private recurring name');
    expect(preview.pausableSubscription?.name).toBe('Private recurring name');
    expect(preview.basePoints.length).toBeGreaterThan(1);
    expect(preview.candidatePoints['move-bill']?.length).toBe(preview.basePoints.length);
    expect(preview.candidatePoints['pause-sub']?.length).toBe(preview.basePoints.length);
    expect(preview.paydayIndex).toBeGreaterThanOrEqual(0);
    const candidate = routeFromStore(
      {
        ...getState(),
        subOverrides: {
          ...getState().subOverrides,
          'Private recurring name': 5,
        },
      },
      NOW,
    );
    expect(preview.billLift).toBe(
      Math.max(0, Math.round(candidate.tightPoint.amount - preview.baseTight)),
    );
    expect(JSON.stringify(getState())).toBe(before);
  });
});
