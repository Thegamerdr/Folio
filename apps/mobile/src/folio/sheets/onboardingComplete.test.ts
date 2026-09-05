// OnboardingSheet complete/skip → clean store contract tests.
//
// What this proves: OnboardingSheet.done()/skipForNow() call the shared production mutation seam.
// Legacy sample cleanup is first-run-only; returning edits preserve the populated workspace while
// updating the payday/income context. These tests are Node-safe (no react-native or DOM).
//
// Imports go through the store's public surface, mirroring store.test.ts / editTxnSave.test.ts.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  addTransaction,
  type IncomeSource,
  type Pot,
  getState,
  hasAnyUserData,
  isEmptyForMeloImport,
  resetAll,
  resetToEmpty,
  setIncomeSources,
  setOnboarding,
  setPots,
} from '../store';
import { monthlyEquivalent } from '../lib/driftSignals';
import { commitOnboarding, skipOnboardingForNow } from '../lib/onboardingMutations';

// Reset to the demo seed before each test so we always start in the PRE-ONBOARDING regime that
// finishing onboarding must transition out of (resetAll seeds demo pots/subs/cycles/transactions +
// a 'sample'-source balance + onboarding.done=false).
beforeEach(() => {
  resetAll();
});

function dayOfMonthFromIso(iso: string): number {
  const day = Number(iso.slice(8, 10));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1;
}

// The test calls the exact production mutation used by OnboardingSheet.done().
function completeOnboarding(input: {
  name: string;
  payday: number;
  monthlyIncome: number;
  balance: number;
  pickedPots: ReadonlyArray<Omit<Pot, 'saved'>>;
  cadence?: IncomeSource['cadence'];
  anchorISO?: string;
  lastWorkingDayNumber?: number;
}) {
  const cadence = input.cadence ?? 'monthly';
  const anchorISO = input.anchorISO ?? '2026-07-01';
  const legacyPayday =
    cadence === 'monthly'
      ? input.payday
      : cadence === 'last-working-day'
        ? (input.lastWorkingDayNumber ?? 29)
        : dayOfMonthFromIso(anchorISO);
  commitOnboarding({
    name: input.name,
    payday: input.payday,
    monthlyIncome: input.monthlyIncome,
    balance: input.balance,
    pickedPots: input.pickedPots,
    cadence,
    anchorISO,
    legacyPayday,
    intentMode: 'survival',
    modeExtra: 100,
  });
}

describe('OnboardingSheet complete → clean app (demo is pre-onboarding only)', () => {
  it('starts from the demo regime before onboarding completes', () => {
    // Sanity: the pre-onboarding state IS the demo — seeded data + a sample balance + not-done.
    const s = getState();
    expect(hasAnyUserData(s)).toBe(true);
    expect(s.currentBalance.source).toBe('sample');
    expect(s.onboarding.done).toBe(false);
    expect(s.transactions.length).toBeGreaterThan(0);
  });

  it('wipes every demo data slot when onboarding is completed', () => {
    completeOnboarding({
      name: 'Ada',
      payday: 28,
      monthlyIncome: 2400,
      balance: 500,
      pickedPots: [
        { id: 'holiday', name: 'Holiday · September', goal: 1200, perWeek: 35, accent: true },
      ],
    });
    const s = getState();
    // No demo transactions / subs / cycles / pot-ledger / calendar events linger.
    expect(s.transactions).toEqual([]);
    expect(s.subs).toEqual([]);
    expect(s.cycles).toEqual([]);
    expect(s.potLedger).toEqual([]);
    expect(s.calendarEvents).toEqual([]);
  });

  it("writes the user's real onboarding identity over the clean state", () => {
    completeOnboarding({
      name: 'Ada',
      payday: 28,
      monthlyIncome: 2400,
      balance: 500,
      pickedPots: [],
    });
    const ob = getState().onboarding;
    expect(ob.name).toBe('Ada');
    expect(ob.payday).toBe(28);
    expect(ob.monthlyIncome).toBe(2400);
    expect(ob.done).toBe(true);
  });

  it("records the entered balance as the user's own (never a sample source)", () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 2180,
      balance: 720,
      pickedPots: [],
    });
    const bal = getState().currentBalance;
    expect(bal.amount).toBe(720);
    expect(bal.source).toBe('user-entered');
    expect(bal.confidence).toBe('rough');
    expect(bal.source).not.toBe('sample');
  });

  it('keeps the neutral £0 empty balance when the user leaves balance at zero (no demo £720)', () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 2180,
      balance: 0,
      pickedPots: [],
    });
    const bal = getState().currentBalance;
    expect(bal.amount).toBe(0);
    expect(bal.source).not.toBe('sample'); // the demo £720/sample balance is gone
  });

  it('creates the picked pots fresh at £0 saved — no demo saved amounts carry over', () => {
    // The demo seeds Holiday with £420 saved. After completing onboarding with Holiday picked, the
    // pot is brand-new at £0 — the user has not funded it yet; the £420 was never theirs.
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 2180,
      balance: 0,
      pickedPots: [
        { id: 'holiday', name: 'Holiday · September', goal: 1200, perWeek: 35, accent: true },
        { id: 'buffer', name: 'Buffer', goal: 500, perWeek: 20, accent: false },
      ],
    });
    const pots = getState().pots;
    expect(pots.length).toBe(2);
    expect(pots.every((p) => p.saved === 0)).toBe(true);
    expect(pots.find((p) => p.id === 'holiday')?.saved).toBe(0);
  });

  it('leaves Pots genuinely empty when the user picks none', () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 2180,
      balance: 0,
      pickedPots: [],
    });
    expect(getState().pots).toEqual([]);
  });

  it("the finished app holds ONLY the user's real data (chosen pots), nothing demo", () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 2180,
      balance: 500,
      pickedPots: [{ id: 'buffer', name: 'Buffer', goal: 500, perWeek: 20, accent: false }],
    });
    const s = getState();
    // hasAnyUserData is true (the user chose a pot), but every slot is the user's, not the demo's.
    expect(hasAnyUserData(s)).toBe(true);
    expect(s.transactions).toEqual([]);
    expect(s.subs).toEqual([]);
    expect(s.cycles).toEqual([]);
    expect(s.pots.length).toBe(1);
    expect(s.pots[0]!.id).toBe('buffer');
    expect(s.pots[0]!.saved).toBe(0);
  });

  it('a finished app with no pots and £0 balance is genuinely empty (ready for real data)', () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 2180,
      balance: 0,
      pickedPots: [],
    });
    const s = getState();
    expect(hasAnyUserData(s)).toBe(false); // a clean empty app, awaiting the user's first entry
    expect(s.onboarding.done).toBe(true); // but NOT re-onboarded
  });
});

describe('OnboardingSheet skip → honest empty account', () => {
  it('clears any legacy sample state while leaving onboarding incomplete', () => {
    skipOnboardingForNow();
    const s = getState();
    expect(s.onboarding.done).toBe(false);
    expect(hasAnyUserData(s)).toBe(false);
    expect(s.currentBalance).toMatchObject({ amount: 0, source: 'user-entered' });
    expect(s.transactions).toEqual([]);
    expect(isEmptyForMeloImport(s)).toBe(true);
  });
});

// Cadence step (new — "How does pay arrive?", ahead of the day picker). Proves completion writes
// BOTH the income-cadence model (`incomeSources[0]`, source 'onboarding') AND the legacy
// `onboarding.payday` day-of-month equivalent, for every cadence the picker offers.
describe('OnboardingSheet cadence step → incomeSources + legacy payday equivalent', () => {
  it('monthly (default) writes a monthly incomeSource matching the day-of-month slider', () => {
    completeOnboarding({
      name: 'Ada',
      payday: 28,
      monthlyIncome: 2400,
      balance: 0,
      pickedPots: [],
      cadence: 'monthly',
    });
    const s = getState();
    expect(s.onboarding.payday).toBe(28);
    expect(s.incomeSources).toHaveLength(1);
    const source = s.incomeSources![0]!;
    expect(source.cadence).toBe('monthly');
    expect(source.dayOfMonth).toBe(28);
    expect(source.anchorISO).toBeUndefined();
    expect(source.amount).toBe(2400);
    expect(source.source).toBe('onboarding');
    // Monthly cadence: monthlyEquivalent is a no-op, so the legacy slot matches the entered figure
    // byte-for-byte — pre-existing monthly-earner behaviour is unchanged by the cadence-aware write.
    expect(s.onboarding.monthlyIncome).toBe(2400);
  });

  it('weekly writes an anchorISO-based incomeSource and derives the legacy day-of-month from the anchor', () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25, // unused for week-based cadences — the day picker is hidden
      monthlyIncome: 1800,
      balance: 0,
      pickedPots: [],
      cadence: 'weekly',
      anchorISO: '2026-06-05',
    });
    const s = getState();
    expect(s.incomeSources).toHaveLength(1);
    const source = s.incomeSources![0]!;
    expect(source.cadence).toBe('weekly');
    expect(source.anchorISO).toBe('2026-06-05');
    expect(source.dayOfMonth).toBeUndefined();
    // Legacy single-number equivalent — the anchor's own day-of-month (05), not the unused slider value.
    expect(s.onboarding.payday).toBe(5);
  });

  // THE regression this program exists to fix: a weekly earner's PER-WEEK figure must not be
  // written verbatim into a slot several surfaces still read as "monthly income" (onboarding step 5
  // hardcoded '/ month' regardless of declared cadence — see OnboardingSheet.tsx doc-comment above
  // `monthlyIncomeEquivalent`). A £299/week earner is really earning ~£1,296.66/month
  // (299 * 4.334524), not £299/month — the ~4x understatement the owner's real Staffline data
  // exposed.
  it("a weekly earner's legacy monthlyIncome is the monthly-equivalent, not the raw per-week figure", () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 299, // per-week, matching the step-5 slider's weekly range
      balance: 0,
      pickedPots: [],
      cadence: 'weekly',
      anchorISO: '2026-06-05',
    });
    const s = getState();
    // incomeSources[0].amount stays the per-occurrence figure — engines that read it (lib/income.ts)
    // are already cadence-correct and must keep receiving the per-week amount, not a converted one.
    expect(s.incomeSources![0]!.amount).toBe(299);
    // The legacy slot, however, must be the monthly-equivalent — never 4x understated.
    expect(s.onboarding.monthlyIncome).toBeCloseTo(monthlyEquivalent(299, 'weekly'), 5);
    expect(s.onboarding.monthlyIncome).toBeGreaterThan(1000); // sanity: nowhere near the raw £299
  });

  it('fortnightly writes an anchorISO-based incomeSource and a monthly-equivalent legacy income', () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 900, // per-fortnight
      balance: 0,
      pickedPots: [],
      cadence: 'fortnightly',
      anchorISO: '2026-06-18',
    });
    const s = getState();
    const source = s.incomeSources![0]!;
    expect(source.cadence).toBe('fortnightly');
    expect(source.anchorISO).toBe('2026-06-18');
    expect(s.onboarding.payday).toBe(18);
    expect(s.onboarding.monthlyIncome).toBeCloseTo(monthlyEquivalent(900, 'fortnightly'), 5);
  });

  it('four-weekly writes an anchorISO-based incomeSource and a monthly-equivalent legacy income', () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 1800, // per-4-weeks
      balance: 0,
      pickedPots: [],
      cadence: 'four-weekly',
      anchorISO: '2026-06-11',
    });
    const s = getState();
    const source = s.incomeSources![0]!;
    expect(source.cadence).toBe('four-weekly');
    expect(source.anchorISO).toBe('2026-06-11');
    expect(s.onboarding.payday).toBe(11);
    expect(s.onboarding.monthlyIncome).toBeCloseTo(monthlyEquivalent(1800, 'four-weekly'), 5);
  });

  it('last-working-day writes a dayOfMonth/anchorISO-free incomeSource and a resolved legacy day-of-month', () => {
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 2000,
      balance: 0,
      pickedPots: [],
      cadence: 'last-working-day',
      lastWorkingDayNumber: 30,
    });
    const s = getState();
    const source = s.incomeSources![0]!;
    expect(source.cadence).toBe('last-working-day');
    expect(source.dayOfMonth).toBeUndefined();
    expect(source.anchorISO).toBeUndefined();
    // Legacy equivalent is whatever the current month's last working day resolves to — not the
    // (unused, hidden) day-of-month slider value.
    expect(s.onboarding.payday).toBe(30);
  });
});

describe('OnboardingSheet returning workspace safety', () => {
  it('updates only onboarding income context while preserving ledger, other income and pots', () => {
    resetToEmpty();
    addTransaction({ merchant: 'Groceries', amount: -42, category: 'food', source: 'manual' });
    setOnboarding({ name: 'Existing', payday: 12, monthlyIncome: 1800, done: true });
    setIncomeSources([
      {
        id: 'income-onboarding-pay',
        label: 'Pay',
        cadence: 'monthly',
        dayOfMonth: 12,
        amount: 1800,
        source: 'onboarding',
      },
      {
        id: 'income-side-work',
        label: 'Side work',
        cadence: 'weekly',
        anchorISO: '2026-08-07',
        amount: 125,
        source: 'manual',
      },
    ]);
    setPots([
      { id: 'holiday', name: 'Holiday', saved: 240, goal: 1200, perWeek: 35, accent: true },
      { id: 'custom', name: 'Custom', saved: 90, goal: 500, perWeek: 10, accent: false },
    ]);
    const beforePots = getState().pots;
    const beforeTransaction = getState().transactions[0];

    completeOnboarding({
      name: 'Updated',
      payday: 25,
      monthlyIncome: 2200,
      balance: 0,
      pickedPots: [],
    });

    const after = getState();
    expect(after.transactions).toEqual([beforeTransaction]);
    expect(after.pots).toEqual(beforePots);
    expect(after.incomeSources).toHaveLength(2);
    expect(after.incomeSources?.find((source) => source.id === 'income-side-work')).toMatchObject({
      amount: 125,
      source: 'manual',
    });
    expect(after.onboarding).toMatchObject({ name: 'Updated', payday: 25, monthlyIncome: 2200, done: true });
  });

  it('does not treat a sample balance alone as permission to delete a real transaction', () => {
    // This simulates a partially configured/legacy workspace where the balance marker is stale but
    // the ledger has a user-owned row. The production path must preserve that row.
    addTransaction({ merchant: 'Train', amount: -8, category: 'transport', source: 'manual' });
    const transaction = getState().transactions.find((row) => row.merchant === 'Train');
    completeOnboarding({
      name: 'Ada',
      payday: 25,
      monthlyIncome: 2180,
      balance: 0,
      pickedPots: [],
    });
    expect(getState().transactions).toContainEqual(transaction);
  });

  it('treats skip as cancellation on a returning workspace', () => {
    resetToEmpty();
    addTransaction({ merchant: 'Lunch', amount: -12, category: 'food', source: 'manual' });
    setOnboarding({ done: true, name: 'Ada', payday: 20, monthlyIncome: 2000 });
    const before = getState();
    skipOnboardingForNow();
    expect(getState().transactions).toEqual(before.transactions);
    expect(getState().onboarding).toEqual(before.onboarding);
  });
});
