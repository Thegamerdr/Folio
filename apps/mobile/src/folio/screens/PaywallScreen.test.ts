// PaywallScreen — primary-CTA branch contract for the purchase/trial switch (screens/PaywallScreen.tsx).
//
// The screen's "Primary CTA" block (see its own header comment) is a single switch on a `ctaMode`
// const computed by the pure `resolveCtaMode` (lib/billing/ctaMode.ts) from the screen's live store
// reads. This test pins the specific promise this lane cares about: with `billingAvailable=true` (a
// real Play listing resolved) the screen's `ctaMode` resolves to `'purchase'` — the branch that
// renders the real buy Pressable — and with `billingAvailable=false` (today's default state, no
// listing) it resolves to `'trial'` — the branch that renders the existing free-trial CTA — for the
// screen's actual default selections (`selected: 'plus'` on mount, `canSell: true` baseline, no
// existing entitlement or active trial). lib/billing/ctaMode.test.ts already exhaustively covers
// `resolveCtaMode`'s own precedence table; this file instead pins that PaywallScreen's specific
// default inputs land on the two branches this lane was asked to verify, plus the pro selection,
// using `ctaBranchFor` to state the assertion in terms of the actual rendered branch name rather
// than the raw CtaMode value.
//
// Node-safe by design: PaywallScreen.tsx imports react-native, react-native-reanimated,
// react-native-safe-area-context, and JSX, so it cannot load under the Node test runner (the repo's
// vitest glob is `apps/**/*.test.ts`, .tsx is never collected — see TodayNudges.test.ts /
// VisualizerScreen.addAll.test.ts headers for the same constraint; a genuine attempt to render it
// via @testing-library/react-native under this vitest config failed at react-native's own
// Flow-typed entrypoint before any test code ran). The screen's CTA branch selection has already
// been extracted into the Node-safe, fully-tested `resolveCtaMode` specifically so this boundary
// doesn't block verifying it (see ctaMode.ts's own header) — this test exercises that exact
// function with the screen's real default inputs instead of re-deriving the logic inline.

import { describe, expect, it } from 'vitest';

import { ctaBranchFor, resolveCtaMode, type CtaModeInputs } from '../lib/billing/ctaMode';

// PaywallScreen's actual mount-time defaults relevant to the CTA switch:
//   - `selected` starts at 'plus' (useState<TierKey>('plus'))
//   - no existing entitlement: plusUnlocked/proUnlocked both false
//   - no active trial: trialCycleId null
//   - `canSell` true is the common case (canShowUpsell only false during storm/recovery/quiet-mode/
//     safe-zone-negative/weather-fog, each covered by its own guard test elsewhere)
const screenDefaults: CtaModeInputs = {
  selected: 'plus',
  canSell: true,
  billingAvailable: false,
  plusUnlocked: false,
  proUnlocked: false,
  trialCycleId: null,
};

describe('PaywallScreen — purchase button renders once billing is available', () => {
  it("resolves to the 'purchase' branch for the default Plus selection when billingAvailable is true", () => {
    const mode = resolveCtaMode({ ...screenDefaults, billingAvailable: true });
    expect(mode).toBe('purchase');
    expect(ctaBranchFor(mode)).toBe('purchase');
  });

  it("resolves to the 'purchase' branch for Pro selected, when billingAvailable is true", () => {
    const mode = resolveCtaMode({ ...screenDefaults, selected: 'pro', billingAvailable: true });
    expect(mode).toBe('purchase');
    expect(ctaBranchFor(mode)).toBe('purchase');
  });
});

describe('PaywallScreen — trial CTA renders while billing is unavailable', () => {
  it("resolves to the 'trial' branch for the default Plus selection when billingAvailable is false", () => {
    const mode = resolveCtaMode({ ...screenDefaults, billingAvailable: false });
    expect(mode).toBe('trial');
    expect(ctaBranchFor(mode)).toBe('trial');
  });

  it("resolves to the 'trial' branch for Pro selected, when billingAvailable is false", () => {
    const mode = resolveCtaMode({ ...screenDefaults, selected: 'pro', billingAvailable: false });
    expect(mode).toBe('trial');
    expect(ctaBranchFor(mode)).toBe('trial');
  });

  it('matches the screen mount default exactly: billingAvailable starts false until the probe resolves', () => {
    // PaywallScreen's `billingAvailable` useState initializes to false and only flips true after
    // `probeAvailability()` resolves — so the very first paint, with every other default held,
    // must land on 'trial', never 'purchase' (see ctaMode.ts's own header for why this matters).
    const mode = resolveCtaMode(screenDefaults);
    expect(mode).toBe('trial');
  });
});

describe('PaywallScreen — billingAvailable alone flips the branch, other defaults held constant', () => {
  it('flips purchase <-> trial purely on billingAvailable for both paid tiers', () => {
    for (const selected of ['plus', 'pro'] as const) {
      const withBilling = resolveCtaMode({ ...screenDefaults, selected, billingAvailable: true });
      const withoutBilling = resolveCtaMode({
        ...screenDefaults,
        selected,
        billingAvailable: false,
      });
      expect(withBilling).toBe('purchase');
      expect(withoutBilling).toBe('trial');
    }
  });
});
