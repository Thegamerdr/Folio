import { describe, expect, it } from 'vitest';

import { ctaBranchFor, resolveCtaMode, type CtaMode, type CtaModeInputs } from './ctaMode';

const base: CtaModeInputs = {
  selected: 'plus',
  canSell: true,
  billingAvailable: false,
  plusUnlocked: false,
  proUnlocked: false,
  trialCycleId: null,
  trialEndedCycleId: null,
};

describe('resolveCtaMode — live Plus/Pro model', () => {
  it('keeps Free free and applies Pro as a Plus superset', () => {
    expect(resolveCtaMode({ ...base, selected: 'free' })).toBe('free-note');
    expect(resolveCtaMode({ ...base, plusUnlocked: true })).toBe('unlocked');
    expect(resolveCtaMode({ ...base, proUnlocked: true })).toBe('unlocked');
    expect(resolveCtaMode({ ...base, selected: 'pro', proUnlocked: true })).toBe('unlocked');
  });

  it('offers the one-cycle trial from Plus only when billing is unavailable', () => {
    expect(resolveCtaMode(base)).toBe('trial');
    expect(resolveCtaMode({ ...base, selected: 'pro' })).toBe('none');
    expect(resolveCtaMode({ ...base, trialEndedCycleId: '2026-07-01' })).toBe('none');
  });

  it('shows an active trial for either paid tier', () => {
    expect(resolveCtaMode({ ...base, trialCycleId: '2026-07-01' })).toBe('trial-active');
    expect(resolveCtaMode({ ...base, selected: 'pro', trialCycleId: '2026-07-01' })).toBe(
      'trial-active',
    );
  });

  it('purchases either paid tier only when the store and upsell guard allow it', () => {
    expect(resolveCtaMode({ ...base, billingAvailable: true })).toBe('purchase');
    expect(resolveCtaMode({ ...base, selected: 'pro', billingAvailable: true })).toBe('purchase');
    expect(resolveCtaMode({ ...base, billingAvailable: true, canSell: false })).toBe('none');
  });

  it('ownership wins over a running trial', () => {
    expect(
      resolveCtaMode({
        ...base,
        plusUnlocked: true,
        trialCycleId: '2026-07-01',
        billingAvailable: true,
      }),
    ).toBe('unlocked');
  });
});

describe('ctaBranchFor', () => {
  it('maps every mode one-to-one to its identically named render branch', () => {
    const modes: CtaMode[] = ['free-note', 'unlocked', 'trial-active', 'purchase', 'trial', 'none'];
    expect(modes.map(ctaBranchFor)).toEqual(modes);
  });
});
