// Pure CTA-branch decision tests. The critical property under test: when billing is unavailable
// (today's reality — no Play listing yet), the resolved mode is always one of the pre-existing
// preview branches, never 'purchase'. This is what PaywallScreen.tsx's `ctaMode` const asserts
// against for its render branches (see lib/billing/ctaMode.ts header comment).
//
// Tier vocabulary since the Free/Full/Live restructure (MONEY_MODEL.md §2b): 'full' is the
// one-time purchase (lens trial applies), 'live' is the metered subscription (NO trial — it
// meters a real recurring cost, so without billing the Live door has nothing honest to offer).

import { describe, expect, it } from 'vitest';

import { ctaBranchFor, resolveCtaMode, type CtaMode, type CtaModeInputs } from './ctaMode';

const base: CtaModeInputs = {
  selected: 'full',
  canSell: true,
  billingAvailable: false,
  fullUnlocked: false,
  liveActive: false,
  trialCycleId: null,
};

describe('resolveCtaMode — availability-false path leaves preview behavior intact', () => {
  it('falls back to the existing trial CTA for Full when billing is unavailable', () => {
    expect(resolveCtaMode({ ...base, selected: 'full', billingAvailable: false })).toBe('trial');
  });

  it('resolves to none (never trial) for Live when billing is unavailable — nothing honest to offer', () => {
    expect(resolveCtaMode({ ...base, selected: 'live', billingAvailable: false })).toBe('none');
  });

  it('never resolves to purchase when billing is unavailable, regardless of canSell', () => {
    for (const canSell of [true, false]) {
      for (const selected of ['full', 'live'] as const) {
        const mode = resolveCtaMode({ ...base, selected, billingAvailable: false, canSell });
        expect(mode).not.toBe('purchase');
      }
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
  it('resolves to purchase for Full once billing is available and upsell is allowed', () => {
    expect(resolveCtaMode({ ...base, selected: 'full', billingAvailable: true })).toBe('purchase');
  });

  it('resolves to purchase for Live once billing is available and upsell is allowed', () => {
    expect(resolveCtaMode({ ...base, selected: 'live', billingAvailable: true })).toBe('purchase');
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

  it('resolves to unlocked when the user already owns Full', () => {
    for (const billingAvailable of [true, false]) {
      expect(
        resolveCtaMode({ ...base, selected: 'full', fullUnlocked: true, billingAvailable }),
      ).toBe('unlocked');
    }
  });

  it('resolves to unlocked when the user has an active Live subscription', () => {
    for (const billingAvailable of [true, false]) {
      expect(
        resolveCtaMode({ ...base, selected: 'live', liveActive: true, billingAvailable }),
      ).toBe('unlocked');
    }
  });

  it('owning Full does not mark the Live door unlocked (independent doors, not a ladder)', () => {
    expect(
      resolveCtaMode({ ...base, selected: 'live', fullUnlocked: true, billingAvailable: true }),
    ).toBe('purchase');
  });

  it('an active trial takes precedence over both purchase and the trial-start CTA on the Full door', () => {
    for (const billingAvailable of [true, false]) {
      expect(
        resolveCtaMode({ ...base, selected: 'full', trialCycleId: '2026-07-01', billingAvailable }),
      ).toBe('trial-active');
    }
  });

  it('an active lens trial never blocks buying Live — the trial grants lenses, not reads', () => {
    expect(
      resolveCtaMode({
        ...base,
        selected: 'live',
        trialCycleId: '2026-07-01',
        billingAvailable: true,
      }),
    ).toBe('purchase');
  });

  it('ownership takes precedence over an active trial', () => {
    expect(
      resolveCtaMode({
        ...base,
        selected: 'full',
        fullUnlocked: true,
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
