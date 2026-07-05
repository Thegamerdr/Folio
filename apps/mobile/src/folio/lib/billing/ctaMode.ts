// Pure CTA-branch decision for the paywall's primary button — no expo-iap import, so this is
// Node-testable (unlike ./iap.ts, which pulls in react-native transitively and can only be
// verified by typecheck + on-device, same boundary ../vaultKey.ts / ../persist.ts already have).
//
// PaywallScreen calls this to decide which of its existing CTA branches to render. The critical
// property this guarantees: when `billingAvailable` is false — today's reality with no Play
// listing — the resolved mode is ALWAYS one of the pre-existing preview branches
// ('trial' | 'trial-active' | 'free-note' | 'unlocked' | 'none'), never 'purchase'. Real purchase
// buttons only ever appear once billing has been proven reachable.

export type CtaMode =
  | 'free-note' // selected tier is Free — nothing to buy.
  | 'unlocked' // the user already owns the selected tier.
  | 'trial-active' // a one-cycle trial is currently running.
  | 'purchase' // billing is available — show the real buy button.
  | 'trial' // billing is unavailable — fall back to the existing free-trial CTA.
  | 'none'; // upsell suppressed (storm/recovery/etc.) and nothing else applies.

export type CtaModeInputs = {
  selected: 'free' | 'plus' | 'pro';
  canSell: boolean;
  billingAvailable: boolean;
  plusUnlocked: boolean;
  proUnlocked: boolean;
  trialCycleId: string | null;
};

export function resolveCtaMode(i: CtaModeInputs): CtaMode {
  if (i.selected === 'free') return 'free-note';
  if (i.selected === 'plus' && i.plusUnlocked) return 'unlocked';
  if (i.selected === 'pro' && i.proUnlocked) return 'unlocked';
  if (i.trialCycleId) return 'trial-active';
  if (!i.canSell) return 'none';
  // canSell is true past this point.
  if (i.billingAvailable) return 'purchase';
  return 'trial';
}
