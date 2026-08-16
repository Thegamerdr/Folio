/**
 * Household strategy — the shared-bills lens.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/household.ts`,
 * verbatim. Reads the `household` slice from the store (partnerName +
 * defaultShare + per-sub share overrides) and computes the user's honest
 * share of upcoming bills in the next 30 days. The rest (their partner's
 * share, the shared pot summary) flows off the same allocations.
 *
 *   yourShare      = Σ sub.cost × (overrides[sub.name] ?? defaultShare)
 *   partnerShare   = Σ sub.cost × (1 − share)
 *   yourFreeShare  = balance − earmarked − yourShare − buffer
 *   weather        = exposure of the user's share
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { Sub, Household } from '../../../store';
import type { MeloMood, MeloPose } from '../../../melo/Melo';

const DEFAULT_BUFFER = 100;
const DEFAULT_HOUSEHOLD: Household = { partnerName: '', defaultShare: 0.5, subShareOverrides: {} };

const VOICE: MeloVoiceTint = {
  archetype: 'diplomatic',
  directive:
    "Mode: Household. The user shares bills with someone. Never assign blame across people. Talk about the shared pot and each person's share as neutral facts.",
};

/** One bill row with its computed split — consumed by the Today hero
 *  and by any future Household setup sheet so both surfaces agree
 *  byte-for-byte. */
export type BillSplit = {
  name: string;
  cost: number;
  daysAway: number;
  yourShare: number; // £
  partnerShare: number; // £
  sharePct: number; // 0..1 — user's share
  overridden: boolean; // true when the user set this explicitly
};

/** Compute per-bill splits for the next 30 days. Pure — safe to call
 *  from any surface. Skips paused subs and anything > 30 days out. */
export function computeBillSplits(
  subs: Sub[],
  subPaused: Record<string, boolean>,
  household: Household,
): BillSplit[] {
  return subs
    .filter((s) => !subPaused[s.name] && s.nextRenewalDaysAway >= 0 && s.nextRenewalDaysAway <= 30)
    .map<BillSplit>((s) => {
      const override = household.subShareOverrides[s.name];
      const overridden = typeof override === 'number';
      const sharePct = overridden ? (override as number) : household.defaultShare;
      const yourShare = s.cost * sharePct;
      return {
        name: s.name,
        cost: s.cost,
        daysAway: s.nextRenewalDaysAway,
        yourShare,
        partnerShare: s.cost - yourShare,
        sharePct,
        overridden,
      };
    })
    .sort((a, b) => a.daysAway - b.daysAway);
}

/** Totals used by both the strategy and the hero — kept here so the
 *  arithmetic lives in one file. */
export function summariseHousehold(splits: BillSplit[]): {
  totalShared: number;
  totalYours: number;
  totalPartner: number;
} {
  const totalShared = splits.reduce((s, b) => s + b.cost, 0);
  const totalYours = splits.reduce((s, b) => s + b.yourShare, 0);
  return { totalShared, totalYours, totalPartner: totalShared - totalYours };
}

function derive(inputs: ModeInputs): ModeState {
  const { currentBalance, subs, subPaused, pots, bufferAmount, hour, ritualCompletedRecently } =
    inputs;
  const household = inputs.household ?? DEFAULT_HOUSEHOLD;
  const buffer = bufferAmount ?? DEFAULT_BUFFER;

  const splits = computeBillSplits(subs, subPaused, household);
  const { totalYours } = summariseHousehold(splits);

  const earmarked = pots.reduce((s, p) => s + Math.max(0, p.saved), 0);
  const yourFree = Math.round(currentBalance.amount - earmarked - totalYours - buffer);

  let mood: MeloMood = 'calm';
  if (ritualCompletedRecently) mood = 'cheer';
  else if (yourFree < 0) mood = 'concern';
  else if (yourFree < buffer * 0.5) mood = 'curious';

  let pose: MeloPose = 'none';
  if (mood === 'cheer') pose = 'sealed';
  else if (yourFree >= buffer) pose = 'safe';

  let weather: MeloWeather = 'sunny';
  if (currentBalance.source === 'sample') weather = 'fog';
  else if (yourFree < 0) weather = 'storm';
  else if (yourFree < buffer * 0.5) weather = 'rainy';
  else if (yourFree < buffer) weather = 'cloudy';
  if (typeof hour === 'number' && hour >= 22 && (weather === 'sunny' || weather === 'cloudy'))
    weather = 'night';

  const partnerLabel = household.partnerName.trim() || 'them';
  const verdict =
    weather === 'fog'
      ? 'Not enough to say yet — add a statement to sharpen this.'
      : splits.length === 0
        ? 'Nothing shared in the next 30 days. Quiet stretch.'
        : yourFree < 0
          ? `Your share is exposed — worth flagging to ${partnerLabel}.`
          : yourFree < buffer * 0.5
            ? "Your share is covered — buffer's thin though."
            : 'Your share is covered. Shared pot is on track.';

  return {
    mode: 'household',
    safeZone: {
      amount: Math.max(0, yourFree),
      priority: 'cover your share',
      formula: `your half after £${Math.round(totalYours)} shared bills`,
      confidence:
        currentBalance.source === 'sample'
          ? 'low'
          : currentBalance.confidence === 'rough'
            ? 'estimating'
            : 'high',
      date: null,
    },
    verdict,
    spareLabel: 'your share',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const householdStrategy: ModeStrategy = { mode: 'household', derive };
