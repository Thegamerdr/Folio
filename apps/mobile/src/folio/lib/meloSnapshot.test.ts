// meloSnapshot tests — the pure store→MeloSnapshot builder (apps/mobile/src/folio/lib/meloSnapshot.ts)
// that feeds MeloChatSheet's gateway context. Node-safe: imports the pure builder + the store
// singleton (both node-safe, no react-native runtime), so it is collected by the apps/**/*.test.ts
// vitest runner. Relative imports — the runner has no `@` alias (mirrors storeRoute.test.ts /
// widgetSnapshot.test.ts).
//
// This test exists for the honesty fix: `daysToPayday` and `monthlyIncome` used to be frozen
// web-prototype literals (11 / onboarding-only) that could go stale the moment the user's real cycle
// or declared income sources moved on. Both must now track the SAME live engines every other surface
// reads — `routeFromStore` (daysToPayday) and the cadence-normalised income total (monthlyIncome).

import { beforeEach, describe, expect, it } from 'vitest';

import { buildMeloSnapshot, liveMonthlyIncome, PRESSURE_LOW } from './meloSnapshot';
import { routeFromStore } from './storeRoute';
import {
  addTransaction,
  getState,
  resetAll,
  setIncomeSources,
  setOnboarding,
  setPartial,
  type IncomeSource,
} from '../store';

beforeEach(() => {
  resetAll();
});

// A fixed mid-month "today" well before the seed payday (25th), matching storeRoute.test.ts's own
// fixture day, so daysToPayday is unambiguously positive and comparable across both derivations.
const NOW = '2026-06-10';

describe('buildMeloSnapshot — daysToPayday tracks the live route, never a frozen literal', () => {
  it('equals routeFromStore(state, now).daysToPayday exactly, not the old hardcoded 11', () => {
    const state = getState();
    const snapshot = buildMeloSnapshot(state, 'calm', NOW);
    const route = routeFromStore(state, NOW);

    expect(snapshot.daysToPayday).toBe(route.daysToPayday);
    expect(snapshot.daysToPayday).not.toBe(11);
  });

  it('changes when the declared payday changes, proving it is live-derived', () => {
    const before = buildMeloSnapshot(getState(), 'calm', NOW);

    setOnboarding({ payday: 12 }); // moves payday to just after NOW (the 10th)
    const after = buildMeloSnapshot(getState(), 'calm', NOW);

    expect(after.daysToPayday).not.toBe(before.daysToPayday);
    expect(after.daysToPayday).toBe(routeFromStore(getState(), NOW).daysToPayday);
  });
});

describe('buildMeloSnapshot — monthlyIncome', () => {
  it('falls back to onboarding.monthlyIncome when no incomeSources are declared (legacy parity)', () => {
    setOnboarding({ monthlyIncome: 2500 });
    setIncomeSources([]);

    const snapshot = buildMeloSnapshot(getState(), 'calm', NOW);

    expect(snapshot.monthlyIncome).toBe(2500);
    expect(liveMonthlyIncome(getState())).toBe(2500);
  });

  it('sums monthly-equivalent income across declared sources instead of the stale onboarding lump', () => {
    setOnboarding({ monthlyIncome: 2180 }); // the legacy lump — must NOT be what gets reported
    const sources: IncomeSource[] = [
      {
        id: 'src-weekly',
        label: 'Weekly Employer',
        cadence: 'weekly',
        anchorISO: '2026-06-05',
        amount: 470,
        source: 'inferred',
      },
    ];
    setIncomeSources(sources);

    const snapshot = buildMeloSnapshot(getState(), 'calm', NOW);

    // Weekly £470 at the engine's nominal 4.33 occurrences/month (driftSignals.ts
    // OCCURRENCES_PER_MONTH, reused verbatim) ≈ £2035.10 monthly-equivalent — NOT the £2180
    // onboarding lump.
    expect(snapshot.monthlyIncome).not.toBe(2180);
    expect(snapshot.monthlyIncome).toBeCloseTo(470 * 4.33, 2);
  });

  it('sums multiple declared sources across mixed cadences (weekly + monthly)', () => {
    const sources: IncomeSource[] = [
      {
        id: 'src-weekly',
        label: 'Side gig',
        cadence: 'weekly',
        anchorISO: '2026-06-05',
        amount: 100,
        source: 'manual',
      },
      {
        id: 'src-monthly',
        label: 'Pension',
        cadence: 'monthly',
        dayOfMonth: 1,
        amount: 400,
        source: 'onboarding',
      },
    ];
    setIncomeSources(sources);

    const snapshot = buildMeloSnapshot(getState(), 'calm', NOW);
    const expected = 100 * 4.33 + 400; // weekly nominal factor + monthly (factor 1)

    expect(snapshot.monthlyIncome).toBeCloseTo(expected, 2);
  });
});

describe('buildMeloSnapshot — other fields unaffected by the rewire', () => {
  it('still resolves tightPoint from the pressure table and carries the pressure through', () => {
    const snapshot = buildMeloSnapshot(getState(), 'pressured', NOW);

    expect(snapshot.pressure).toBe('pressured');
    expect(snapshot.tightPoint).toBe(PRESSURE_LOW.pressured);
  });

  it('only folds in transactions from the last 14 days', () => {
    // Clear the demo seed first — resetAll's seedTransactions() dates its rows off the REAL
    // wall-clock `Date.now()` (not the fixed `NOW` this test uses), and since the store's date-correct
    // retention sort (`applyTransactionRetention`) now genuinely orders by `when` rather than
    // insertion, those real-clock-dated seed rows could otherwise outrank/crowd out this test's own
    // fixed-date fixture in `lastFewTransactions`'s top-8. Isolating to just this test's two rows
    // keeps the assertion about the 14-day cutoff, not about clock drift.
    setPartial({ transactions: [] });
    addTransaction({
      merchant: 'Old Shop',
      amount: -50,
      category: 'shopping',
      source: 'manual',
      when: '2026-05-01T00:00:00.000Z', // >14 days before NOW — must be excluded
    });
    addTransaction({
      merchant: 'Recent Shop',
      amount: -20,
      category: 'shopping',
      source: 'manual',
      when: '2026-06-09T00:00:00.000Z', // 1 day before NOW — must be included
    });

    const snapshot = buildMeloSnapshot(getState(), 'calm', NOW);
    const merchants = snapshot.lastFewTransactions.map((t) => t.merchant);

    expect(merchants).toContain('Recent Shop');
    expect(merchants).not.toContain('Old Shop');
  });

  it('is stable across two consecutive builds against the same state (pure — no hidden clock read)', () => {
    const first = buildMeloSnapshot(getState(), 'calm', NOW);
    const second = buildMeloSnapshot(getState(), 'calm', NOW);

    expect(second).toEqual(first);
  });
});
