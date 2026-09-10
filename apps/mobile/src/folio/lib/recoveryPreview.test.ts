import { resetSampleFixture as resetAll } from '../test/sampleFixture';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getState, setPartial, togglePaused } from '../store';
import { buildRecoveryRoutePreview, isDiscretionarySubscription } from './recoveryPreview';
import { routeFromStore } from './storeRoute';
import { deriveShortfallBudget } from './shortfallBudget';

const NOW = new Date('2026-07-15T12:00:00.000Z');

beforeEach(() => resetAll());

describe('buildRecoveryRoutePreview', () => {
  it('uses the same exact penny gap as Shortfall and the exact canonical lift', () => {
    const base = getState();
    setPartial({
      accounts: [],
      pots: [],
      debts: [],
      calendarEvents: [],
      transactions: [],
      modeExtras: {},
      bufferAmount: 0,
      subPaused: {},
      subOverrides: {},
      onboarding: { ...base.onboarding, payday: 28, monthlyIncome: 1000 },
      incomeSources: [],
      currentBalance: {
        amount: -0.01,
        source: 'user-entered',
        confidence: 'corrected',
        setAt: NOW.toISOString(),
      },
      subs: [
        {
          name: 'Entertainment streaming',
          cost: 10.45,
          nextRenewalISO: '2026-07-18',
          nextRenewalDaysAway: 3,
          lastUsedDaysAgo: 0,
          usesPerMonth: 1,
        },
      ],
    });
    const state = getState();
    const preview = buildRecoveryRoutePreview(state, NOW);
    expect(preview.shortfall).toBe(10.46);
    expect(preview.shortfall).toBe(deriveShortfallBudget(routeFromStore(state, NOW)).gap);
    expect(preview.subscriptionLift).toBe(10.45);
  });
  it('only offers discretionary subscriptions as a pause move', () => {
    expect(
      isDiscretionarySubscription({
        name: 'Rent + bills',
      }),
    ).toBe(false);
    expect(
      isDiscretionarySubscription({
        name: 'Entertainment streaming',
      }),
    ).toBe(true);
  });

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
          name: 'Entertainment streaming',
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
    expect(preview.holdLift).toBe(0); // A cap cannot create money or reduce already protected costs.
    expect(preview.flexibleBill?.name).toBe('Entertainment streaming');
    expect(preview.pausableSubscription?.name).toBe('Entertainment streaming');
    expect(preview.basePoints.length).toBeGreaterThan(1);
    expect(preview.candidatePoints['move-bill']?.length).toBe(preview.basePoints.length);
    expect(preview.candidatePoints['pause-sub']?.length).toBe(preview.basePoints.length);
    expect(preview.paydayIndex).toBeGreaterThanOrEqual(0);
    const candidate = routeFromStore(
      {
        ...getState(),
        subOverrides: {
          ...getState().subOverrides,
          'Entertainment streaming': 5,
        },
      },
      NOW,
    );
    expect(preview.billLift).toBe(
      Math.max(
        0,
        Math.round((candidate.safeToSpend ?? candidate.tightPoint.amount) - preview.baseTight),
      ),
    );
    expect(JSON.stringify(getState())).toBe(before);
  });
});

it('pause preview matches the actual saved pause while an overdue occurrence stays reserved', () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  try {
    const base = getState();
    setPartial({
      ...base,
      accounts: [],
      pots: [],
      debts: [],
      calendarEvents: [],
      transactions: [],
      subOverrides: {},
      subPaused: {},
      currentBalance: {
        amount: 300,
        source: 'user-entered',
        confidence: 'corrected',
        setAt: NOW.toISOString(),
      },
      onboarding: { ...base.onboarding, payday: 31, monthlyIncome: 1000 },
      subs: [
        {
          name: 'Entertainment streaming',
          cost: 80,
          nextRenewalISO: '2026-07-17',
          obligationAnchorISO: '2026-06-17',
          nextRenewalDaysAway: 2,
          lastUsedDaysAgo: 0,
          usesPerMonth: 1,
        },
      ],
    });
    const preview = buildRecoveryRoutePreview(getState(), NOW);
    togglePaused('Entertainment streaming', true);
    const saved = routeFromStore(getState(), NOW);
    expect(preview.subscriptionLift).toBe(
      Math.max(0, Math.round((saved.safeToSpend ?? saved.tightPoint.amount) - preview.baseTight)),
    );
    expect(preview.candidatePoints['pause-sub']).toEqual(saved.points);
    expect(preview.subscriptionLift).toBe(80);
  } finally {
    vi.useRealTimers();
  }
});
