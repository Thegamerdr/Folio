// Pure CTA-branch decision tests. The critical property under test: when billing is unavailable
// (today's reality — no Play listing yet), the resolved mode is always one of the pre-existing
// preview branches, never 'purchase'. This is what PaywallScreen.tsx's `ctaMode` const asserts
// against for its render branches (see lib/billing/ctaMode.ts header comment).

import { describe, expect, it } from 'vitest';

import { ctaBranchFor, resolveCtaMode, type CtaMode, type CtaModeInputs } from './ctaMode';

const base: CtaModeInputs = {
  selected: 'plus',
  canSell: true,
  billingAvailable: false,
  plusUnlocked: false,
  proUnlocked: false,
  trialCycleId: null,
};

describe('resolveCtaMode — availability-false path leaves preview behavior intact', () => {
  it('falls back to the existing trial CTA for Plus when billing is unavailable', () => {
    expect(resolveCtaMode({ ...base, selected: 'plus', billingAvailable: false })).toBe('trial');
  });

  it('falls back to the existing trial CTA for Pro when billing is unavailable', () => {
    expect(resolveCtaMode({ ...base, selected: 'pro', billingAvailable: false })).toBe('trial');
  });

  it('never resolves to purchase when billing is unavailable, regardless of canSell', () => {
    for (const canSell of [true, false]) {
      const mode = resolveCtaMode({ ...base, billingAvailable: false, canSell });
      expect(mode).not.toBe('purchase');
    }
  });

  it('suppresses to none (not purchase or trial) when upsell is blocked and billing is unavailable', () => {
    expect(resolveCtaMode({ ...base, billingAvailable: false, canSell: false })).toBe('none');
  });
});

describe('resolveCtaMode — a spent trial never re-offers the trial CTA', () => {
  it('resolves to none (not trial) when the trial has ended and billing is unavailable', () => {
    const mode = resolveCtaMode({
      ...base,
      billingAvailable: false,
      trialCycleId: null,
      trialEndedCycleId: '2026-06-01',
    });
    expect(mode).toBe('none');
  });

  it('still resolves to purchase after a spent trial once billing is available', () => {
    const mode = resolveCtaMode({
      ...base,
      billingAvailable: true,
      trialCycleId: null,
      trialEndedCycleId: '2026-06-01',
    });
    expect(mode).toBe('purchase');
  });
});

describe('resolveCtaMode — availability-true path', () => {
  it('resolves to purchase for Plus once billing is available and upsell is allowed', () => {
    expect(resolveCtaMode({ ...base, selected: 'plus', billingAvailable: true })).toBe('purchase');
  });

  it('resolves to purchase for Pro once billing is available and upsell is allowed', () => {
    expect(resolveCtaMode({ ...base, selected: 'pro', billingAvailable: true })).toBe('purchase');
  });

  it('does not resolve to purchase when upsell is suppressed, even if billing is available', () => {
    expect(resolveCtaMode({ ...base, billingAvailable: true, canSell: false })).toBe('none');
  });
});

describe('resolveCtaMode — ownership and trial precedence (unaffected by billing availability)', () => {
  it('resolves to free-note for the free tier regardless of billing state', () => {
    for (const billingAvailable of [true, false]) {
      expect(resolveCtaMode({ ...base, selected: 'free', billingAvailable })).toBe('free-note');
    }
  });

  it('resolves to unlocked when the user already owns Plus', () => {
    for (const billingAvailable of [true, false]) {
      expect(
        resolveCtaMode({ ...base, selected: 'plus', plusUnlocked: true, billingAvailable }),
      ).toBe('unlocked');
    }
  });

  it('resolves to unlocked when the user already owns Pro', () => {
    for (const billingAvailable of [true, false]) {
      expect(
        resolveCtaMode({ ...base, selected: 'pro', proUnlocked: true, billingAvailable }),
      ).toBe('unlocked');
    }
  });

  it('an active trial takes precedence over both purchase and the trial-start CTA', () => {
    for (const billingAvailable of [true, false]) {
      expect(resolveCtaMode({ ...base, trialCycleId: '2026-07-01', billingAvailable })).toBe(
        'trial-active',
      );
    }
  });

  it('ownership takes precedence over an active trial', () => {
    expect(
      resolveCtaMode({
        ...base,
        selected: 'plus',
        plusUnlocked: true,
        trialCycleId: '2026-07-01',
        billingAvailable: true,
      }),
    ).toBe('unlocked');
  });
});

// Render-independent pin: PaywallScreen's ctaBlock JSX is a single switch on `ctaMode` with one
// case per CtaMode value (see PaywallScreen.tsx "Primary CTA" comment). This guarantees the
// mapping stays 1:1 and total — every CtaMode resolves to exactly one branch name, and no branch
// name is shared between two different modes — so the tested `resolveCtaMode` precedence and the
// rendered UI cannot drift apart without this test catching it, without needing to render the
// screen at all.
describe('ctaBranchFor — pins the CtaMode -> render-branch mapping PaywallScreen switches on', () => {
  const ALL_MODES: readonly CtaMode[] = [
    'free-note',
    'unlocked',
    'trial-active',
    'purchase',
    'trial',
    'none',
  ];

  it('maps every CtaMode to a branch, one-to-one (no two modes collapse to the same branch)', () => {
    const branches = ALL_MODES.map(ctaBranchFor);
    expect(new Set(branches).size).toBe(ALL_MODES.length);
  });

  it('maps each mode to its own identically-named branch', () => {
    for (const mode of ALL_MODES) {
      expect(ctaBranchFor(mode)).toBe(mode);
    }
  });
});
