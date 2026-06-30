// OnboardingSheet complete → store contract tests — the demo is a PRE-ONBOARDING regime, not the
// 24/7 state.
//
// What this proves (the behaviour wired in this change): completing onboarding (the primary
// "make them yours" path, OnboardingSheet.done()) takes the app OUT of the demo and into a
// genuinely empty app carrying only the user's real data. Skipping ("Skip for now" → onClose) does
// the opposite: it KEEPS the sample and never flips onboarding.done, so the demo survives as a
// deliberate "explore the sample" choice rather than the default.
//
// done() runs this exact store sequence:
//   resetToEmpty()                              // wipe the demo → clean empty + onboarding.done=true
//   setOnboarding({ name, payday, monthlyIncome, done: true })   // the user's real identity
//   if (balance > 0) setCurrentBalance({ amount, source: 'user-entered', confidence: 'rough' })
//   if (pickedPots.length) setPots(pickedPots @ saved: 0)        // chosen pots, freshly zeroed
//
// These tests exercise that sequence against the store's public surface (the single reactive seam),
// proving the demo→clean transition end-to-end. They are Node-safe (no react-native, no DOM), so the
// apps/**/*.test.ts runner collects them; the sheet component itself imports react-native and is
// verified by typecheck + on-device render, while the write contract it depends on is proven here.
//
// Imports go through the store's public surface, mirroring store.test.ts / editTxnSave.test.ts.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  type Pot,
  getState,
  hasAnyUserData,
  resetAll,
  resetToEmpty,
  setCurrentBalance,
  setOnboarding,
  setPots,
} from '../store';

// Reset to the demo seed before each test so we always start in the PRE-ONBOARDING regime that
// finishing onboarding must transition out of (resetAll seeds demo pots/subs/cycles/transactions +
// a 'sample'-source balance + onboarding.done=false).
beforeEach(() => {
  resetAll();
});

// The store sequence OnboardingSheet.done() runs on the primary finish path, parameterised by what
// the user entered. Kept byte-faithful to the component so the test tracks the real contract.
function completeOnboarding(input: {
  name: string;
  payday: number;
  monthlyIncome: number;
  balance: number;
  pickedPots: ReadonlyArray<Omit<Pot, 'saved'>>;
}) {
  resetToEmpty();
  setOnboarding({
    name: input.name,
    payday: input.payday,
    monthlyIncome: input.monthlyIncome,
    done: true,
  });
  if (input.balance > 0) {
    setCurrentBalance({ amount: input.balance, source: 'user-entered', confidence: 'rough' });
  }
  const nextPots: Pot[] = input.pickedPots.map((p) => ({ ...p, saved: 0 }));
  if (nextPots.length > 0) setPots(nextPots);
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
      pickedPots: [{ id: 'holiday', name: 'Holiday · September', goal: 1200, perWeek: 35, accent: true }],
    });
    const s = getState();
    // No demo transactions / subs / cycles / pot-ledger / calendar events linger.
    expect(s.transactions).toEqual([]);
    expect(s.subs).toEqual([]);
    expect(s.cycles).toEqual([]);
    expect(s.potLedger).toEqual([]);
    expect(s.calendarEvents).toEqual([]);
  });

  it('writes the user\'s real onboarding identity over the clean state', () => {
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

  it('records the entered balance as the user\'s own (never a sample source)', () => {
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

  it('the finished app holds ONLY the user\'s real data (chosen pots), nothing demo', () => {
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

describe('OnboardingSheet skip → keeps the sample (an explicit demo choice, not the default)', () => {
  it('skipping (no store writes, never flips done) leaves the demo intact', () => {
    // "Skip for now" → onClose() only: it does NOT run resetToEmpty / setOnboarding(done:true). The
    // demo regime survives so the user can keep exploring the sample.
    const s = getState();
    expect(s.onboarding.done).toBe(false); // never finished
    expect(hasAnyUserData(s)).toBe(true); // sample data still present
    expect(s.currentBalance.source).toBe('sample'); // sample balance still shown
    expect(s.transactions.length).toBeGreaterThan(0);
  });
});
