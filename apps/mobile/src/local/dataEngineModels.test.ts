import { describe, expect, it } from 'vitest';

import { createEmptyLocalLedgerState, type LocalLedgerState } from './localLedger.js';
import {
  addCycleThroughCanonicalRepository,
  addToPotThroughCanonicalRepository,
  bulkPauseQuietThroughCanonicalRepository,
  cancelSubscriptionThroughCanonicalRepository,
  createPotThroughCanonicalRepository,
  pauseSubscriptionThroughCanonicalRepository,
  reallocateBetweenPotsThroughCanonicalRepository,
  recordSubscriptionUseThroughCanonicalRepository,
  resumeSubscriptionThroughCanonicalRepository,
} from './canonicalLedgerMutations.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { buildLocalPotsModel } from './localPotsAdapter.js';
import { buildLocalSubscriptionsModel } from './localSubscriptionsAdapter.js';
import { buildLocalInsightsModel } from './localInsightsAdapter.js';

// A starting picture with one real money event, so the canonical financial snapshot is non-trivial
// and we can prove the durable-container mutations leave it untouched.
function seededLedger(): LocalLedgerState {
  return {
    ...createEmptyLocalLedgerState('2026-06-22'),
    cashOnHandMinor: 50_000,
  };
}

function canonicalTransactionCount(state: LocalLedgerState): number {
  return createCanonicalRepositoryForLocalLedgerState(state).transactions.count();
}

describe('data-engine pot mutations through the canonical boundary', () => {
  it('creates a pot without touching the canonical financial snapshot', () => {
    const base = seededLedger();
    const baseTransactions = canonicalTransactionCount(base);

    const withPot = createPotThroughCanonicalRepository(base, {
      name: 'New phone',
      goalMinor: 60_000,
      perWeekMinor: 2_000,
      accent: true,
    });

    // The mutation projects cleanly (no throw above) and does not invent any transaction.
    expect(canonicalTransactionCount(withPot)).toBe(baseTransactions);
    expect(withPot.pots).toHaveLength(1);
    expect(withPot.pots[0]).toMatchObject({
      name: 'New phone',
      accent: true,
      goal: { minorUnits: 60_000 },
      saved: { minorUnits: 0 },
      perWeek: { minorUnits: 2_000 },
    });
  });

  it('adds money to a pot and reallocates between pots immutably', () => {
    const withPots = createPotThroughCanonicalRepository(
      createPotThroughCanonicalRepository(seededLedger(), {
        name: 'Holiday',
        goalMinor: 100_000,
        perWeekMinor: 5_000,
      }),
      { name: 'Buffer', goalMinor: 50_000, perWeekMinor: 1_000 },
    );
    const holidayId = String(withPots.pots.find((pot) => pot.name === 'Holiday')?.id);
    const bufferId = String(withPots.pots.find((pot) => pot.name === 'Buffer')?.id);

    const funded = addToPotThroughCanonicalRepository(withPots, holidayId, 30_000);
    expect(funded.pots.find((pot) => pot.name === 'Holiday')?.saved.minorUnits).toBe(30_000);
    // Original state is not mutated.
    expect(withPots.pots.find((pot) => pot.name === 'Holiday')?.saved.minorUnits).toBe(0);

    const reallocated = reallocateBetweenPotsThroughCanonicalRepository(
      funded,
      holidayId,
      bufferId,
      10_000,
    );
    expect(reallocated.pots.find((pot) => pot.name === 'Holiday')?.saved.minorUnits).toBe(20_000);
    expect(reallocated.pots.find((pot) => pot.name === 'Buffer')?.saved.minorUnits).toBe(10_000);
  });

  it('rejects reallocation beyond the source pot balance', () => {
    const withPots = createPotThroughCanonicalRepository(
      createPotThroughCanonicalRepository(seededLedger(), {
        name: 'A',
        goalMinor: 10_000,
        perWeekMinor: 0,
      }),
      { name: 'B', goalMinor: 10_000, perWeekMinor: 0 },
    );
    const aId = String(withPots.pots.find((pot) => pot.name === 'A')?.id);
    const bId = String(withPots.pots.find((pot) => pot.name === 'B')?.id);

    expect(() =>
      reallocateBetweenPotsThroughCanonicalRepository(withPots, aId, bId, 5_000),
    ).toThrow(/only holds/i);
  });
});

describe('local pots read-adapter', () => {
  it('returns rows with progress and totals from durable pots', () => {
    const withPot = addToPotThroughCanonicalRepository(
      createPotThroughCanonicalRepository(seededLedger(), {
        name: 'Car',
        goalMinor: 40_000,
        perWeekMinor: 2_000,
        accent: true,
      }),
      // pot id is the only one present
      'pot_0001',
      10_000,
    );
    const model = buildLocalPotsModel(withPot);

    expect(model.potCount).toBe(1);
    expect(model.sumSavedMinor).toBe(10_000);
    expect(model.sumSaved).toBe('£100');
    expect(model.rows[0]).toMatchObject({
      name: 'Car',
      savedMinor: 10_000,
      goalMinor: 40_000,
      perWeekMinor: 2_000,
      accent: true,
      progress: 0.25,
    });
  });

  it('treats a goal of zero as fully covered', () => {
    const withPot = createPotThroughCanonicalRepository(seededLedger(), {
      name: 'Open',
      goalMinor: 0,
      perWeekMinor: 0,
    });
    const model = buildLocalPotsModel(withPot);
    expect(model.rows[0]?.progress).toBe(1);
  });
});

describe('data-engine subscription mutations through the canonical boundary', () => {
  // Subscriptions are seeded directly on state (intake is out of scope for this slice); the mutators
  // then pause/resume/use/cancel them.
  function ledgerWithSubscriptions(): LocalLedgerState {
    const base = seededLedger();
    return {
      ...base,
      subscriptions: [
        {
          id: 'subscription_quiet_0001' as never,
          workspaceId: 'workspace_personal_local' as never,
          name: 'Old streaming',
          cost: { minorUnits: 999, currency: 'GBP' as never },
          cadence: 'monthly',
          nextRenewalDaysAway: 12,
          lastUsedDaysAgo: 90,
          usesPerMonth: 0,
          paused: false,
          version: { revision: 1, dataVersion: 'revision:1' as never },
        },
        {
          id: 'subscription_active_0002' as never,
          workspaceId: 'workspace_personal_local' as never,
          name: 'Daily app',
          cost: { minorUnits: 499, currency: 'GBP' as never },
          cadence: 'monthly',
          nextRenewalDaysAway: 3,
          lastUsedDaysAgo: 1,
          usesPerMonth: 20,
          paused: false,
          version: { revision: 1, dataVersion: 'revision:1' as never },
        },
      ],
    };
  }

  it('pauses, resumes, records use and cancels without touching the financial snapshot', () => {
    const base = ledgerWithSubscriptions();
    const baseTransactions = canonicalTransactionCount(base);

    const paused = pauseSubscriptionThroughCanonicalRepository(base, 'subscription_quiet_0001');
    expect(canonicalTransactionCount(paused)).toBe(baseTransactions);
    expect(paused.subscriptions.find((item) => item.name === 'Old streaming')?.paused).toBe(true);

    const resumed = resumeSubscriptionThroughCanonicalRepository(paused, 'subscription_quiet_0001');
    expect(resumed.subscriptions.find((item) => item.name === 'Old streaming')?.paused).toBe(false);

    const used = recordSubscriptionUseThroughCanonicalRepository(base, 'subscription_quiet_0001');
    expect(used.subscriptions.find((item) => item.name === 'Old streaming')?.usesPerMonth).toBe(1);
    expect(used.subscriptions.find((item) => item.name === 'Old streaming')?.lastUsedDaysAgo).toBe(
      0,
    );

    const cancelled = cancelSubscriptionThroughCanonicalRepository(
      base,
      'subscription_active_0002',
    );
    expect(cancelled.subscriptions).toHaveLength(1);
    expect(cancelled.subscriptions[0]?.name).toBe('Old streaming');
  });

  it('bulk-pauses only quiet, still-active subscriptions', () => {
    const paused = bulkPauseQuietThroughCanonicalRepository(ledgerWithSubscriptions());
    expect(paused.subscriptions.find((item) => item.name === 'Old streaming')?.paused).toBe(true);
    // The well-used app stays active.
    expect(paused.subscriptions.find((item) => item.name === 'Daily app')?.paused).toBe(false);
  });

  it('builds value score, pulse, monthly total and saved-from-pauses', () => {
    const model = buildLocalSubscriptionsModel(ledgerWithSubscriptions());

    expect(model.activeCount).toBe(2);
    expect(model.monthlyTotalMinor).toBe(999 + 499);
    expect(model.quietActiveCount).toBe(1);

    const quiet = model.rows.find((row) => row.name === 'Old streaming');
    const daily = model.rows.find((row) => row.name === 'Daily app');
    // Zero uses => worst value score and a 'no' pulse.
    expect(quiet?.valueScore).toBe(Number.POSITIVE_INFINITY);
    expect(quiet?.pulse).toBe('no');
    expect(quiet?.quiet).toBe(true);
    // 20 uses for 499p => ~25p per use, regular usage.
    expect(daily?.valueScore).toBeCloseTo(499 / 20);
    expect(daily?.pulse).toBe('yes');

    const afterPause = bulkPauseQuietThroughCanonicalRepository(ledgerWithSubscriptions());
    const pausedModel = buildLocalSubscriptionsModel(afterPause);
    expect(pausedModel.savedFromPausesMinor).toBe(999);
    expect(pausedModel.monthlyTotalMinor).toBe(499);
  });

  // A subscription the user has never logged a use for (a just-added one, or one they simply never
  // tap "used" on) has no usage signal at all: usesPerMonth 0 AND lastUsedDaysAgo 0. It must read as
  // "not tracked", never be scored as the worst value, and never be swept into the "quiet ones".
  function ledgerWithNeverTrackedSubscription(): LocalLedgerState {
    const base = seededLedger();
    return {
      ...base,
      subscriptions: [
        {
          id: 'subscription_fresh_0003' as never,
          workspaceId: 'workspace_personal_local' as never,
          name: 'Just added',
          cost: { minorUnits: 1299, currency: 'GBP' as never },
          cadence: 'monthly',
          nextRenewalDaysAway: 20,
          // Never tracked: no use this month, and no recorded last-used point.
          lastUsedDaysAgo: 0,
          usesPerMonth: 0,
          paused: false,
          version: { revision: 1, dataVersion: 'revision:1' as never },
        },
        {
          id: 'subscription_active_0002' as never,
          workspaceId: 'workspace_personal_local' as never,
          name: 'Daily app',
          cost: { minorUnits: 499, currency: 'GBP' as never },
          cadence: 'monthly',
          nextRenewalDaysAway: 3,
          lastUsedDaysAgo: 1,
          usesPerMonth: 20,
          paused: false,
          version: { revision: 1, dataVersion: 'revision:1' as never },
        },
      ],
    };
  }

  it('reads a never-tracked subscription as neutral, not worst value, and not quiet', () => {
    const model = buildLocalSubscriptionsModel(ledgerWithNeverTrackedSubscription());

    const fresh = model.rows.find((row) => row.name === 'Just added');
    const daily = model.rows.find((row) => row.name === 'Daily app');

    // Untracked: honest "not tracked yet" framing, no worst-value verdict.
    expect(fresh?.tracked).toBe(false);
    expect(fresh?.pulse).toBe('unknown');
    expect(fresh?.valueScore).toBe(0);
    expect(fresh?.valueScore).not.toBe(Number.POSITIVE_INFINITY);
    expect(fresh?.valueScoreLabel).toBe('Not tracked yet');
    // Not "quiet" — so it is excluded from the quiet count and the bulk "pause the quiet ones" move.
    expect(fresh?.quiet).toBe(false);
    expect(model.quietActiveCount).toBe(0);

    // The genuinely tracked sub keeps its real value score + pulse intact.
    expect(daily?.tracked).toBe(true);
    expect(daily?.valueScore).toBeCloseTo(499 / 20);
    expect(daily?.pulse).toBe('yes');
  });

  it('does not pause a never-tracked subscription as if it were quiet', () => {
    const paused = bulkPauseQuietThroughCanonicalRepository(ledgerWithNeverTrackedSubscription());
    // Nothing is quiet here, so nothing should be paused.
    expect(paused.subscriptions.find((item) => item.name === 'Just added')?.paused).toBe(false);
    expect(paused.subscriptions.find((item) => item.name === 'Daily app')?.paused).toBe(false);
  });

  it('still scores a tracked-then-abandoned subscription as the worst value', () => {
    // "Old streaming" was used 90 days ago (lastUsedDaysAgo 90) — it IS tracked, just abandoned, so it
    // keeps the worst-value verdict. Only never-tracked subs are spared that label.
    const model = buildLocalSubscriptionsModel(ledgerWithSubscriptions());
    const abandoned = model.rows.find((row) => row.name === 'Old streaming');
    expect(abandoned?.tracked).toBe(true);
    expect(abandoned?.valueScore).toBe(Number.POSITIVE_INFINITY);
    expect(abandoned?.pulse).toBe('no');
    expect(abandoned?.quiet).toBe(true);
  });
});

describe('data-engine cycle mutations and insights read-adapter', () => {
  it('records closed cycles without touching the financial snapshot', () => {
    const base = seededLedger();
    const baseTransactions = canonicalTransactionCount(base);

    const closed = addCycleThroughCanonicalRepository(base, {
      label: 'June',
      spareMinor: 12_000,
      tightPointMinor: 4_000,
      setAsideMinor: 8_000,
      note: 'tight mid-month',
    });

    expect(canonicalTransactionCount(closed)).toBe(baseTransactions);
    expect(closed.cycles).toHaveLength(1);
    expect(closed.cycles[0]).toMatchObject({
      label: 'June',
      spare: { minorUnits: 12_000 },
      tightPoint: { minorUnits: 4_000 },
      setAside: { minorUnits: 8_000 },
      note: 'tight mid-month',
    });
  });

  it('computes KPIs and a newest-last trend across cycles, including pot balances', () => {
    let state = seededLedger();
    state = createPotThroughCanonicalRepository(state, {
      name: 'Buffer',
      goalMinor: 50_000,
      perWeekMinor: 0,
    });
    state = addToPotThroughCanonicalRepository(state, 'pot_0001', 15_000);

    // Close three cycles oldest -> newest. addCycle prepends, so the newest is first on state.
    state = addCycleThroughCanonicalRepository(state, {
      label: 'April',
      spareMinor: 10_000,
      tightPointMinor: 2_000,
      setAsideMinor: 6_000,
    });
    state = addCycleThroughCanonicalRepository(state, {
      label: 'May',
      spareMinor: 14_000,
      tightPointMinor: 4_000,
      setAsideMinor: 8_000,
    });
    state = addCycleThroughCanonicalRepository(state, {
      label: 'June',
      spareMinor: 18_000,
      tightPointMinor: 6_000,
      setAsideMinor: 10_000,
    });

    const insights = buildLocalInsightsModel(state);

    expect(insights.cycleCount).toBe(3);
    // savedAcrossCycles = sum of setAside = 6k + 8k + 10k
    expect(insights.kpis.savedAcrossCyclesMinor).toBe(24_000);
    // inPotsNow comes from the pots model
    expect(insights.kpis.inPotsNowMinor).toBe(15_000);
    // averages of tightPoint (2k,4k,6k) and setAside (6k,8k,10k)
    expect(insights.kpis.avgTightPointMinor).toBe(4_000);
    expect(insights.kpis.avgSetAsideMinor).toBe(8_000);
    // trend newest last
    expect(insights.trend.map((point) => point.label)).toEqual(['April', 'May', 'June']);
    expect(insights.trend.map((point) => point.tightPointMinor)).toEqual([2_000, 4_000, 6_000]);
  });

  it('keeps only the last six tight points in the trend, newest last', () => {
    let state = seededLedger();
    for (let index = 0; index < 8; index += 1) {
      state = addCycleThroughCanonicalRepository(state, {
        label: `C${index}`,
        spareMinor: 1_000,
        tightPointMinor: index * 1_000,
        setAsideMinor: 500,
      });
    }
    const insights = buildLocalInsightsModel(state);
    expect(insights.trend).toHaveLength(6);
    // Oldest two (C0,C1) dropped; newest (C7) last.
    expect(insights.trend.map((point) => point.label)).toEqual([
      'C2',
      'C3',
      'C4',
      'C5',
      'C6',
      'C7',
    ]);
  });
});
