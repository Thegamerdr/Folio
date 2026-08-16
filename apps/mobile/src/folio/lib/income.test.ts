// Income-cadence engine tests — Phase ① of the data-intelligence program.
//
// Pure, deterministic, Node-safe: exercises only date arithmetic on plain
// strings/numbers (no react-native, no DOM), so it is a plain `.test.ts`
// collected by the apps/**/*.test.ts runner. Relative imports — the runner has
// no `@` alias.
//
// Contract under test:
//   projectIncomeEvents(sources, fromIso, windowDays) -> IncomeEvent[]
//   nextIncomeDate(sources, todayIso) -> ISO date | null
//   daysToNextIncome(sources, todayIso) -> number | null

import { beforeEach, describe, expect, it } from 'vitest';

import {
  daysToNextIncome,
  hasAnyUserData,
  nextIncomeDate,
  projectIncomeEvents,
  selectMonthlyIncome,
  selectMonthlySpend,
} from './income';
import {
  addAccount,
  addStatementAsHistory,
  addTransaction,
  getState,
  resetAll,
  resetToEmpty,
  setCurrentBalance,
  setIncomeSources,
  setOnboarding,
} from '../store';
import type { IncomeSource } from '../store';
import type { CandidateMoneyItem } from './importSheet';

function source(
  partial: Partial<IncomeSource> & Pick<IncomeSource, 'id' | 'cadence'>,
): IncomeSource {
  return {
    label: partial.label ?? 'Pay',
    amount: partial.amount ?? 2000,
    source: partial.source ?? 'onboarding',
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// monthly — delegates to the existing payday engine (Feb clamp + weekend shift)
// ---------------------------------------------------------------------------
describe('projectIncomeEvents — monthly', () => {
  it('projects one occurrence per month across a multi-month window', () => {
    const s = source({ id: 'm1', cadence: 'monthly', dayOfMonth: 15 });
    const events = projectIncomeEvents([s], '2026-06-01', 60);
    // 2026-06-15 (Mon) and 2026-07-15 (Wed) both fall inside a 60-day window from Jun 1.
    expect(events.map((e) => e.date)).toEqual(['2026-06-15', '2026-07-15']);
    expect(events.every((e) => e.sourceId === 'm1' && e.amount === 2000)).toBe(true);
  });

  it('clamps Feb 31 to Feb 28 in a non-leap year (never rolls to March)', () => {
    // 2026-02-28 is a Saturday; `income.ts` always uses the payday engine's default
    // weekend-previous shift (no per-source weekendRule override exists), so the
    // clamped date additionally shifts back to Friday 2026-02-27 — the clamp itself
    // (28, never Mar 3) is what this test pins.
    const s = source({ id: 'm2', cadence: 'monthly', dayOfMonth: 31 });
    const events = projectIncomeEvents([s], '2026-02-01', 27);
    expect(events.map((e) => e.date)).toEqual(['2026-02-27']);
  });

  it('clamps Feb 31 to Feb 29 in a leap year', () => {
    const s = source({ id: 'm3', cadence: 'monthly', dayOfMonth: 31 });
    const events = projectIncomeEvents([s], '2024-02-01', 28);
    expect(events.map((e) => e.date)).toEqual(['2024-02-29']);
  });

  it('applies the default weekend-previous shift (matches payday.ts)', () => {
    // 2026-08-15 is a Saturday -> previous working day 2026-08-14 (Friday).
    const s = source({ id: 'm4', cadence: 'monthly', dayOfMonth: 15 });
    const events = projectIncomeEvents([s], '2026-08-01', 20);
    expect(events).toEqual([expect.objectContaining({ date: '2026-08-14' })]);
  });

  it('rolls correctly across a year boundary (Dec -> Jan)', () => {
    const s = source({ id: 'm5', cadence: 'monthly', dayOfMonth: 28 });
    const events = projectIncomeEvents([s], '2026-12-01', 60);
    expect(events.map((e) => e.date)).toEqual(['2026-12-28', '2027-01-28']);
  });

  it('throws if a monthly source is missing dayOfMonth', () => {
    const s = source({ id: 'm6', cadence: 'monthly' });
    expect(() => projectIncomeEvents([s], '2026-06-01', 10)).toThrow(/dayOfMonth/);
  });
});

// ---------------------------------------------------------------------------
// weekly / fortnightly / four-weekly — anchor-stepped cadences
// ---------------------------------------------------------------------------
describe('projectIncomeEvents — weekly', () => {
  it('projects every 7 days from the anchor', () => {
    const s = source({ id: 'w1', cadence: 'weekly', anchorISO: '2026-06-05' });
    const events = projectIncomeEvents([s], '2026-06-01', 28);
    expect(events.map((e) => e.date)).toEqual([
      '2026-06-05',
      '2026-06-12',
      '2026-06-19',
      '2026-06-26',
    ]);
  });

  it('when fromIso is already an anchor-aligned date, includes it', () => {
    const s = source({ id: 'w2', cadence: 'weekly', anchorISO: '2026-06-05' });
    const events = projectIncomeEvents([s], '2026-06-05', 7);
    expect(events.map((e) => e.date)).toEqual(['2026-06-05', '2026-06-12']);
  });

  it('anchor drift holds across month boundaries (no reset on the 1st)', () => {
    const s = source({ id: 'w3', cadence: 'weekly', anchorISO: '2026-06-26' });
    const events = projectIncomeEvents([s], '2026-06-27', 21);
    // Next occurrences after Jun 27 keep the Fri-anchored cadence into July.
    expect(events.map((e) => e.date)).toEqual(['2026-07-03', '2026-07-10', '2026-07-17']);
  });

  it('works with a PAST anchor date (anchor need not be in the future)', () => {
    const s = source({ id: 'w4', cadence: 'weekly', anchorISO: '2020-01-03' }); // a Friday
    const events = projectIncomeEvents([s], '2026-06-01', 6);
    // 2026-06-05 is a Friday and anchor-aligned (Fridays, every 7 days since 2020-01-03).
    expect(events.map((e) => e.date)).toEqual(['2026-06-05']);
  });

  it('throws if a weekly source is missing anchorISO', () => {
    const s = source({ id: 'w5', cadence: 'weekly' });
    expect(() => projectIncomeEvents([s], '2026-06-01', 10)).toThrow(/anchorISO/);
  });

  it('shifts a Saturday-scheduled weekly payday to the Friday before (weekend-previous, matches payday.ts)', () => {
    // 2026-06-06 is a Saturday -> emitted as Friday 2026-06-05. The grid arithmetic
    // stays anchored to the unshifted Saturday date, so the FOLLOWING week's
    // occurrence is still 7 days after the Saturday grid date (2026-06-13, also a
    // Saturday) -> shifted to Friday 2026-06-12. The cadence must not drift earlier
    // by accumulating the weekend shift week over week.
    const s = source({ id: 'w6', cadence: 'weekly', anchorISO: '2026-06-06' });
    const events = projectIncomeEvents([s], '2026-06-01', 21);
    expect(events.map((e) => e.date)).toEqual(['2026-06-05', '2026-06-12', '2026-06-19']);
  });
});

describe('projectIncomeEvents — fortnightly', () => {
  it('projects every 14 days from the anchor', () => {
    const s = source({ id: 'f1', cadence: 'fortnightly', anchorISO: '2026-06-05' });
    const events = projectIncomeEvents([s], '2026-06-01', 35);
    expect(events.map((e) => e.date)).toEqual(['2026-06-05', '2026-06-19', '2026-07-03']);
  });

  it('holds cadence across a year boundary', () => {
    const s = source({ id: 'f2', cadence: 'fortnightly', anchorISO: '2026-12-18' });
    const events = projectIncomeEvents([s], '2026-12-20', 26);
    expect(events.map((e) => e.date)).toEqual(['2027-01-01', '2027-01-15']);
  });
});

describe('projectIncomeEvents — four-weekly', () => {
  it('projects every 28 days from the anchor', () => {
    const s = source({ id: 'fw1', cadence: 'four-weekly', anchorISO: '2026-06-05' });
    const events = projectIncomeEvents([s], '2026-06-01', 60);
    expect(events.map((e) => e.date)).toEqual(['2026-06-05', '2026-07-03', '2026-07-31']);
  });
});

// ---------------------------------------------------------------------------
// last-working-day — last non-weekend day of each month
// ---------------------------------------------------------------------------
describe('projectIncomeEvents — last-working-day', () => {
  it('resolves to the last weekday when the calendar last day is a Saturday', () => {
    // Feb 2026's last day (28th) is a Saturday -> Friday 27th.
    const s = source({ id: 'lwd1', cadence: 'last-working-day' });
    const events = projectIncomeEvents([s], '2026-02-01', 27);
    expect(events.map((e) => e.date)).toEqual(['2026-02-27']);
  });

  it('resolves to the last weekday when the calendar last day is a Sunday', () => {
    // May 2026's last day (31st) is a Sunday -> Friday 29th.
    const s = source({ id: 'lwd2', cadence: 'last-working-day' });
    const events = projectIncomeEvents([s], '2026-05-01', 30);
    expect(events.map((e) => e.date)).toEqual(['2026-05-29']);
  });

  it('is the calendar last day itself when it is a weekday', () => {
    // 2026-04-30 is a Thursday.
    const s = source({ id: 'lwd3', cadence: 'last-working-day' });
    const events = projectIncomeEvents([s], '2026-04-01', 29);
    expect(events.map((e) => e.date)).toEqual(['2026-04-30']);
  });

  it('projects across several months, each independently resolved', () => {
    const s = source({ id: 'lwd4', cadence: 'last-working-day' });
    const events = projectIncomeEvents([s], '2026-10-01', 91);
    // Oct 2026 last day (31st) is Sat -> Fri 30th. Nov 2026 last day (30th) is Mon -> unchanged.
    // Dec 2026 last day (31st) is Thu -> unchanged.
    expect(events.map((e) => e.date)).toEqual(['2026-10-30', '2026-11-30', '2026-12-31']);
  });

  it("rolls to next month when today is already past this month's last working day", () => {
    const s = source({ id: 'lwd5', cadence: 'last-working-day' });
    // 2027-01-31 is a Sunday -> last working day is 2027-01-29. Querying from Jan 30
    // (after it) should roll straight to February's last working day (26th; Feb 28
    // 2027 is a Sunday -> shifts back to Friday the 26th).
    const events = projectIncomeEvents([s], '2027-01-30', 27);
    expect(events.map((e) => e.date)).toEqual(['2027-02-26']);
  });
});

// ---------------------------------------------------------------------------
// Multiple sources — merged, sorted by date
// ---------------------------------------------------------------------------
describe('projectIncomeEvents — multiple sources', () => {
  it('merges and sorts events from different cadences by date', () => {
    const weekly = source({
      id: 'multi-w',
      cadence: 'weekly',
      anchorISO: '2026-06-05',
      amount: 300,
    });
    const monthly = source({ id: 'multi-m', cadence: 'monthly', dayOfMonth: 25, amount: 1800 });
    const events = projectIncomeEvents([weekly, monthly], '2026-06-01', 30);
    const dates = events.map((e) => e.date);
    // Dates must be non-decreasing.
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! >= dates[i - 1]!).toBe(true);
    }
    expect(events.some((e) => e.sourceId === 'multi-w')).toBe(true);
    expect(events.some((e) => e.sourceId === 'multi-m')).toBe(true);
  });

  it('returns an empty list for an empty source list', () => {
    expect(projectIncomeEvents([], '2026-06-01', 30)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// nextIncomeDate / daysToNextIncome
// ---------------------------------------------------------------------------
describe('nextIncomeDate', () => {
  it('returns null for an empty source list', () => {
    expect(nextIncomeDate([], '2026-06-01')).toBeNull();
  });

  it('returns the single next date for one source', () => {
    const s = source({ id: 'n1', cadence: 'monthly', dayOfMonth: 25 });
    expect(nextIncomeDate([s], '2026-06-01')).toBe('2026-06-25');
  });

  it('returns the EARLIEST date across multiple sources', () => {
    const weekly = source({ id: 'n2', cadence: 'weekly', anchorISO: '2026-06-05' });
    const monthly = source({ id: 'n3', cadence: 'monthly', dayOfMonth: 25 });
    // From 2026-06-10: weekly next fires 2026-06-12, monthly fires 2026-06-25.
    expect(nextIncomeDate([weekly, monthly], '2026-06-10')).toBe('2026-06-12');
  });
});

describe('daysToNextIncome', () => {
  it('returns null for an empty source list', () => {
    expect(daysToNextIncome([], '2026-06-01')).toBeNull();
  });

  it('returns 0 when income lands today', () => {
    const s = source({ id: 'd1', cadence: 'weekly', anchorISO: '2026-06-10' });
    expect(daysToNextIncome([s], '2026-06-10')).toBe(0);
  });

  it('returns the correct whole-day count for a weekly earner (never more than 7)', () => {
    const s = source({ id: 'd2', cadence: 'weekly', anchorISO: '2026-06-05' });
    for (let i = 0; i < 14; i++) {
      const day = new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10);
      const days = daysToNextIncome([s], day);
      expect(days).not.toBeNull();
      expect(days as number).toBeGreaterThanOrEqual(0);
      expect(days as number).toBeLessThanOrEqual(7);
    }
  });

  it('returns the correct day count for a monthly earner', () => {
    const s = source({ id: 'd3', cadence: 'monthly', dayOfMonth: 25 });
    expect(daysToNextIncome([s], '2026-06-10')).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------
describe('projectIncomeEvents — determinism', () => {
  it('is referentially stable across repeated calls', () => {
    const s = source({ id: 'det1', cadence: 'monthly', dayOfMonth: 25 });
    const a = projectIncomeEvents([s], '2026-06-01', 30);
    const b = projectIncomeEvents([s], '2026-06-01', 30);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// selectMonthlyIncome / selectMonthlySpend — the canonical selectors
// (task: SURFACE SELECTOR PROMOTION). Uses the real store singleton, same
// pattern as meloSnapshot.test.ts, since these selectors read `AppState`
// directly rather than plain arrays.
// ---------------------------------------------------------------------------
describe('selectMonthlyIncome — cadence correctness', () => {
  beforeEach(() => {
    resetAll();
  });

  it('cadence-normalises a weekly £299 earner to ~£1295/mo, not the raw weekly figure', () => {
    setIncomeSources([
      {
        id: 'staffline',
        label: 'Staffline',
        cadence: 'weekly',
        anchorISO: '2026-06-05',
        amount: 299,
        source: 'inferred',
      },
    ]);

    const monthly = selectMonthlyIncome(getState());

    // 299 * 4.33 (driftSignals.ts's OCCURRENCES_PER_MONTH.weekly) = 1294.67.
    expect(monthly).toBeCloseTo(299 * 4.33, 2);
    expect(monthly).toBeGreaterThan(1290);
    expect(monthly).toBeLessThan(1300);
    // Must not be mistaken for a monthly-sized figure equal to the raw weekly amount.
    expect(monthly).not.toBe(299);
  });

  it('falls back to onboarding.monthlyIncome when no incomeSources are declared', () => {
    setOnboarding({ monthlyIncome: 2500 });
    setIncomeSources([]);

    expect(selectMonthlyIncome(getState())).toBe(2500);
  });

  it('falls back to the median of realized monthlyIncomeSeries when nothing is declared at all', () => {
    resetToEmpty(); // no seeded demo transactions — a genuinely clean ledger
    setOnboarding({ monthlyIncome: 0 });
    setIncomeSources([]);
    // Two PAST full months of credits; the current in-progress month must be excluded from the
    // median per historyStats.ts's monthlyIncomeSeries contract.
    addTransaction({
      merchant: 'Employer',
      amount: 1800,
      category: 'income',
      source: 'manual',
      when: '2026-04-15T00:00:00.000Z',
    });
    addTransaction({
      merchant: 'Employer',
      amount: 2200,
      category: 'income',
      source: 'manual',
      when: '2026-05-15T00:00:00.000Z',
    });

    const monthly = selectMonthlyIncome(getState());

    // Median of [1800, 2200] = 2000 — an honest history-derived estimate, never a hard £0.
    expect(monthly).toBe(2000);
  });

  it('returns 0 when there are no declared sources, no onboarding lump, and no history', () => {
    resetToEmpty(); // no seeded demo transactions — a genuinely clean ledger
    setOnboarding({ monthlyIncome: 0 });
    setIncomeSources([]);

    expect(selectMonthlyIncome(getState())).toBe(0);
  });
});

describe('selectMonthlySpend — realized median monthly spend', () => {
  beforeEach(() => {
    resetToEmpty(); // no seeded demo transactions — a genuinely clean ledger
  });

  it('returns 0 when there is no transaction history', () => {
    expect(selectMonthlySpend(getState())).toBe(0);
  });

  it('returns the median PAST-month debit total across the ledger', () => {
    addTransaction({
      merchant: 'Rent',
      amount: -900,
      category: 'bills',
      source: 'manual',
      when: '2026-04-01T00:00:00.000Z',
    });
    addTransaction({
      merchant: 'Groceries',
      amount: -300,
      category: 'shopping',
      source: 'manual',
      when: '2026-04-10T00:00:00.000Z',
    });
    addTransaction({
      merchant: 'Rent',
      amount: -900,
      category: 'bills',
      source: 'manual',
      when: '2026-05-01T00:00:00.000Z',
    });
    addTransaction({
      merchant: 'Groceries',
      amount: -500,
      category: 'shopping',
      source: 'manual',
      when: '2026-05-10T00:00:00.000Z',
    });

    // April total = 1200, May total = 1400 -> median of [1200, 1400] = 1300.
    expect(selectMonthlySpend(getState())).toBe(1300);
  });

  it('excludes credit-card transactions from the realized bank-side spend figure (ACCOUNTS_MODEL.md §2.4)', () => {
    const card = addAccount({ name: 'Amex Gold', kind: 'credit-card' });

    addTransaction({
      merchant: 'Rent',
      amount: -900,
      category: 'bills',
      source: 'manual',
      when: '2026-04-01T00:00:00.000Z',
    });
    addTransaction({
      merchant: 'Rent',
      amount: -900,
      category: 'bills',
      source: 'manual',
      when: '2026-05-01T00:00:00.000Z',
    });
    // Card spend in the same months — must not inflate the bank-only median.
    addTransaction({
      merchant: 'Netflix',
      amount: -5000,
      category: 'other',
      source: 'manual',
      when: '2026-04-20T00:00:00.000Z',
      accountId: card.id,
    });
    addTransaction({
      merchant: 'Netflix',
      amount: -5000,
      category: 'other',
      source: 'manual',
      when: '2026-05-20T00:00:00.000Z',
      accountId: card.id,
    });

    // Bank-only median: [900, 900] -> 900, not [5900, 5900] -> 5900.
    expect(selectMonthlySpend(getState())).toBe(900);
  });
});

// ---------------------------------------------------------------------------
// hasAnyUserData — the sample-numbers-nudge gate (task: consume-income + empties).
// Distinct from `onboarding.done`: a user who bulk-imports a statement without
// ever opening the onboarding sheet has real data even though `onboarding.done`
// stays false.
// ---------------------------------------------------------------------------
describe('hasAnyUserData', () => {
  beforeEach(() => {
    // resetToEmpty() itself sets a non-sample ('user-entered') EMPTY_BALANCE, so every check here
    // pins the balance back to 'sample' explicitly to model a genuinely untouched, sample-data store
    // (the actual pre-any-action shape `hasAnyUserData` needs to read as "no real data yet").
    resetToEmpty();
    setCurrentBalance({ amount: 0, source: 'sample', confidence: 'sample' });
  });

  it('is false on a genuinely clean, sample-balance store', () => {
    expect(hasAnyUserData(getState())).toBe(false);
  });

  it('is true once a transaction has been imported, regardless of onboarding.done', () => {
    addTransaction({
      merchant: 'Employer',
      amount: 1800,
      category: 'income',
      source: 'manual',
      when: '2026-04-15T00:00:00.000Z',
    });

    expect(hasAnyUserData(getState())).toBe(true);
  });

  it('is true once an income source is declared', () => {
    setIncomeSources([
      {
        id: 'staffline',
        label: 'Staffline',
        cadence: 'weekly',
        anchorISO: '2026-06-05',
        amount: 299,
        source: 'inferred',
      },
    ]);

    expect(hasAnyUserData(getState())).toBe(true);
  });

  it('is true once the balance source is no longer sample', () => {
    // Only currentBalance flips away from 'sample' — no transactions, no income sources.
    setCurrentBalance({ amount: 1234, source: 'user-entered', confidence: 'corrected' });

    expect(hasAnyUserData(getState())).toBe(true);
  });

  it('is true after a bulk statement import lands real transactions, regardless of onboarding.done', () => {
    // Regression for the diagnosed coherence gap: TodayStabilityScreen used to gate its sample-numbers
    // nudge on `!onboarding.done` alone, so it kept nagging a user who had already bulk-imported a
    // real statement without ever opening the onboarding sheet. `hasAnyUserData` is what all three
    // Today screens (Survival / mode-parked / Stability) now gate on ALONGSIDE `!onboarding.done`.
    const candidate: CandidateMoneyItem = {
      id: 'cand-1',
      source: 'pdf',
      kind: 'income',
      merchant: 'Employer',
      amount: 1800,
      confidence: 'high',
      date: '2026-04-15',
    };
    addStatementAsHistory([candidate]);

    expect(hasAnyUserData(getState())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Today-screen sample-numbers nudge gate — the shared `!onboarding.done && !hasRealData` expression
// TodayScreen / TodayModeScreen / TodayStabilityScreen all evaluate identically (task: coherence-fix).
// Modeled here at the data layer since none of the three screens are rendered in this Node-safe test
// runner (no RTL/DOM harness in this project — see rules/ecc/web/testing.md's DOM-env guidance,
// which does not apply to these pure `.test.ts` files).
// ---------------------------------------------------------------------------
describe('Today sample-numbers nudge gate (!onboarding.done && !hasRealData)', () => {
  function nudgeVisible(): boolean {
    const s = getState();
    return !s.onboarding.done && !hasAnyUserData(s);
  }

  it('is visible on a fresh, un-onboarded, sample-data store', () => {
    resetToEmpty();
    setCurrentBalance({ amount: 0, source: 'sample', confidence: 'sample' });
    setOnboarding({ done: false });

    expect(nudgeVisible()).toBe(true);
  });

  it('is suppressed once onboarding.done is true, even with no real data', () => {
    resetToEmpty();
    setCurrentBalance({ amount: 0, source: 'sample', confidence: 'sample' });
    setOnboarding({ done: true });

    expect(nudgeVisible()).toBe(false);
  });

  it('is suppressed after a real statement import even though onboarding.done stays false — the exact bug TodayStabilityScreen had and its siblings did not', () => {
    resetToEmpty();
    setCurrentBalance({ amount: 0, source: 'sample', confidence: 'sample' });
    setOnboarding({ done: false });
    expect(nudgeVisible()).toBe(true); // sanity: nudge showing before the import

    const candidate: CandidateMoneyItem = {
      id: 'cand-2',
      source: 'pdf',
      kind: 'spend',
      merchant: 'Tesco',
      amount: -42,
      confidence: 'high',
      date: '2026-04-15',
    };
    addStatementAsHistory([candidate]);

    expect(nudgeVisible()).toBe(false);
  });
});
