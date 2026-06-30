// Today pressure constants — the RN mirror of the web design's pressure helpers
// (folio-melo/.claude/worktrees/design-main/src/components/folio/types.ts → pressureMood /
// pressureLine / pressureLow), scoped to the Today wave.
//
// The RN `@/folio/types` (the shell nav vocabulary) defines the `Pressure` union but NOT these
// derived maps, so the Today wave keeps them here — one source the screen and its children share,
// so the hero number, the nudge, the path stroke, and the fallback tile never disagree (the same
// invariant the web kept by importing one constant).
//
// MELO MOOD RECONCILIATION (see TodayScreen.spec.md "moods" + fidelityRisks): the web kit's <Melo>
// took calm | soft | alert (pressureMood output). The canonical RN Melo (per MELO_MOODS.md) takes
// calm | curious | cheer | concern | celebrate. We reconcile to the documented set, preserving the
// web mapping intent (safe→calm, tight→curious, short→concern): soft → curious, pressured/overspent
// → concern. No new vocabulary is invented.

import type { MeloMood } from '@/folio/melo/Melo';
import type { Pressure } from '@/folio/types';

/** Melo's mood for each route pressure band — mapped onto the canonical Melo vocabulary. */
export const pressureMood: Readonly<Record<Pressure, MeloMood>> = {
  safe: 'calm',
  calm: 'calm',
  soft: 'curious',
  pressured: 'concern',
  overspent: 'concern',
};

/** The verdict line for each band — VERBATIM from the deck (TodayScreen.spec.md copyKeys). The one
 *  terracotta accent word is rendered italic by the screen. */
export const pressureLine: Readonly<Record<Pressure, string>> = {
  safe: 'Plenty of room. Breathe.',
  calm: 'You make it to payday.',
  soft: 'Tight — but the path holds.',
  pressured: 'The middle of next week is the squeeze.',
  overspent: "Something has to move. Let's look together.",
};

/** The fallback tightest-spare value for each band, used before the engine has computed (the mount
 *  gate) and by the low-point fallback tile. Mirrors the web `pressureLow`. */
export const pressureLow: Readonly<Record<Pressure, number>> = {
  safe: 612,
  calm: 325,
  soft: 184,
  pressured: 42,
  overspent: -86,
};

/** Derive the REAL money-pressure band from the route's tightest projected spare (£), using the
 *  pressureLow anchors as band floors so the derived band agrees with the per-band copy/visuals.
 *  This is what replaces the old hardcoded 'calm' default — so the whole app's tone (Melo's mood, the
 *  verdict line, the visuals) reflects the user's ACTUAL money situation, not a fixed pretend-calm. */
export function derivePressure(tightSpare: number): Pressure {
  if (tightSpare < 0) return 'overspent';
  if (tightSpare < pressureLow.soft) return 'pressured'; // 0..183 — the squeeze
  if (tightSpare < pressureLow.calm) return 'soft'; // 184..324 — tight but holds
  if (tightSpare < pressureLow.safe) return 'calm'; // 325..611 — you make it
  return 'safe'; // >=612 — plenty of room
}
