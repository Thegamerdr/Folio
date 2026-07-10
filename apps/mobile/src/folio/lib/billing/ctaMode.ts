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
  /** Tier vocabulary since the Free/Full/Live restructure (MONEY_MODEL.md §2b). */
  selected: 'free' | 'full' | 'live';
  canSell: boolean;
  billingAvailable: boolean;
  /** Owns the one-time Full purchase (or a grandfathered legacy Plus/Pro sub). */
  fullUnlocked: boolean;
  /** Has an active Live subscription (metered AI reads). Lens trials never grant this. */
  liveActive: boolean;
  trialCycleId: string | null;
  /** The ended-trial anchor (`lens.trialEndedCycleId`). A spent trial must never resolve back to
   *  the 'trial' CTA — the store refuses a second `startLensTrial` anyway, so offering one would
   *  be a dead button wearing a live promise. */
  trialEndedCycleId?: string | null;
};

export function resolveCtaMode(i: CtaModeInputs): CtaMode {
  if (i.selected === 'free') return 'free-note';
  if (i.selected === 'full' && i.fullUnlocked) return 'unlocked';
  if (i.selected === 'live' && i.liveActive) return 'unlocked';
  if (i.selected === 'full' && i.trialCycleId) return 'trial-active';
  if (!i.canSell) return 'none';
  // canSell is true past this point.
  if (i.billingAvailable) return 'purchase';
  // No billing (today's reality — no Play listing). The one-cycle trial is a LENS trial, so it is
  // only an honest fallback for the Full door; Live meters a real recurring cost and has no
  // offline equivalent to offer.
  if (i.selected === 'live') return 'none';
  if (i.trialEndedCycleId) return 'none'; // trial spent + no billing — nothing honest to offer.
  return 'trial';
}

/** The CTA-block render branch each `CtaMode` maps to. PaywallScreen's `ctaBlock` JSX switches on
 *  `ctaMode` with exactly these branch names (`free-note` / `unlocked` / `trial-active` /
 *  `purchase` / `trial` render their own Surface/Pressable block; `none` renders nothing) — this
 *  map is the render-independent pin that the mapping is 1:1 and total, so a future edit to either
 *  `resolveCtaMode` or the JSX switch can't silently drift the two apart without a test failing. */
export type CtaBranch = 'free-note' | 'unlocked' | 'trial-active' | 'purchase' | 'trial' | 'none';

const CTA_BRANCH_BY_MODE: Readonly<Record<CtaMode, CtaBranch>> = {
  'free-note': 'free-note',
  unlocked: 'unlocked',
  'trial-active': 'trial-active',
  purchase: 'purchase',
  trial: 'trial',
  none: 'none',
};

export function ctaBranchFor(mode: CtaMode): CtaBranch {
  return CTA_BRANCH_BY_MODE[mode];
}
