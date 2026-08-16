/**
 * Irregular strategy — full engine.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/irregular.ts`,
 * verbatim, PLUS the DATA_INTELLIGENCE.md phase ⑥ history-fed income floor.
 * No fixed payday. Safe Zone = *weeks of runway* from today: how many whole
 * weeks of upcoming bills the available balance covers.
 *
 *   weeklyBills = sum(active-sub costs in next 30d) / 4.33
 *   runway      = floor((balance − earmarked) / weeklyBillsFloor)
 *
 * `weeklyBillsFloor` is the ORIGINAL `Math.max(20, upcoming / 4.33)` unless
 * >= 3 FULL past calendar months of income history exist (`transactions` +
 * `incomeSources` both provided, `monthlyIncomeSeries` yields >= 3 points —
 * see historyStats.ts). When that history exists, the floor becomes
 * `p20(monthlyIncomeSeries) / 4.33` instead of the hardcoded £20 — this is
 * the mode's own premise ("no fixed payday, judge runway against what
 * actually lands") finally fed by the income side, per MONEY_MODES.md §2.5's
 * documented (but previously unimplemented) intent. Below 3 months of
 * history the original hardcoded-£20 behaviour is UNCHANGED — this is a
 * strict superset, never a regression for a thin-history user.
 *
 *   storm  → runway < 2
 *   rainy  → runway < 4
 *   cloudy → runway < 8
 *   sunny  → runway >= 8
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';
import type { Transaction } from '../../../store';
import { monthlyIncomeSeries, percentile } from '../../historyStats';

const VOICE: MeloVoiceTint = {
  archetype: 'levelheaded',
  directive:
    'Mode: Irregular income. The user has no fixed payday. Speak in runway (weeks covered), not days-to-payday. Treat quiet months as data, not danger.',
};

/** Original hardcoded weekly-bills floor — kept as the fallback below 3
 *  months of income history (see module doc). */
const LEGACY_WEEKLY_FLOOR = 20;

/** Minimum full past calendar months of income history required before the
 *  p20 floor replaces the legacy hardcoded £20 (DATA_INTELLIGENCE.md phase
 *  ⑥ task brief: "when >= 3 full months of income history exist"). */
const MIN_HISTORY_MONTHS = 3;

/** Whole weeks in a year / 12 — the same month-to-week conversion the
 *  original engine already used for `upcoming / 4.33`. */
const WEEKS_PER_MONTH = 4.33;

/** The lower 20th percentile of a monthly income series — a conservative
 *  "worst-ish realistic month" figure to floor the weekly-bills denominator
 *  against, so runway can't be read as longer than a lean month would allow. */
const INCOME_FLOOR_PERCENTILE = 20;

/**
 * The weekly-bills floor to use for the runway calc: `p20(monthlyIncomeSeries)
 * / 4.33` when `>= MIN_HISTORY_MONTHS` full past months of income history
 * exist, else the original hardcoded `LEGACY_WEEKLY_FLOOR` (£20) — an
 * ESTIMATE derived from however much history is available, never presented
 * as a guaranteed figure (see historyStats.ts's module header). Pure.
 */
function weeklyBillsFloor(
  transactions: readonly Transaction[] | undefined,
  todayISO: string | undefined,
): number {
  if (transactions === undefined || transactions.length === 0 || todayISO === undefined) {
    return LEGACY_WEEKLY_FLOOR;
  }
  const series = monthlyIncomeSeries(transactions, todayISO);
  if (series.length < MIN_HISTORY_MONTHS) return LEGACY_WEEKLY_FLOOR;
  const p20Monthly = percentile(series, INCOME_FLOOR_PERCENTILE);
  return p20Monthly / WEEKS_PER_MONTH;
}

function derive(inputs: ModeInputs): ModeState {
  const {
    currentBalance,
    subs,
    subPaused,
    pots,
    hour,
    ritualCompletedRecently,
    transactions,
    todayISO,
  } = inputs;
  const active = subs.filter((s) => !subPaused[s.name]);
  const upcoming = active
    .filter((s) => s.nextRenewalDaysAway >= 0 && s.nextRenewalDaysAway <= 30)
    .reduce((sum, s) => sum + s.cost, 0);
  const historyFloor = weeklyBillsFloor(transactions, todayISO);
  const usingHistoryFloor = historyFloor !== LEGACY_WEEKLY_FLOOR;
  const weeklyBills = Math.max(historyFloor, upcoming / WEEKS_PER_MONTH);
  const earmarked = pots.reduce((s, p) => s + Math.max(0, p.saved), 0);
  const available = Math.max(0, currentBalance.amount - earmarked);
  const runway = Math.floor(available / weeklyBills);

  let mood: MeloMood = 'calm';
  if (ritualCompletedRecently) mood = 'cheer';
  else if (runway < 2) mood = 'concern';
  else if (runway < 4) mood = 'curious';

  let pose: MeloPose = 'none';
  if (mood === 'cheer') pose = 'sealed';
  else if (runway >= 8) pose = 'safe';

  let weather: MeloWeather = 'sunny';
  if (currentBalance.source === 'sample') weather = 'fog';
  else if (runway < 2) weather = 'storm';
  else if (runway < 4) weather = 'rainy';
  else if (runway < 8) weather = 'cloudy';
  if (typeof hour === 'number' && hour >= 22 && (weather === 'sunny' || weather === 'cloudy'))
    weather = 'night';

  // Estimate-ness must show up in copy wherever the history-fed floor changed
  // the number — a p20 figure from a handful of months is honestly an
  // estimate, never a guaranteed floor (fake certainty is banned).
  const verdict =
    weather === 'fog'
      ? 'Not enough to say yet — add a statement to sharpen this.'
      : runway < 2
        ? "Runway's short. Bring one bill forward or trim one."
        : runway < 4
          ? 'A few weeks of runway. Next invoice is the lever.'
          : usingHistoryFloor
            ? 'Runway holds, estimating from your recent income pattern.'
            : 'Runway holds. The next invoice extends it.';

  return {
    mode: 'irregular',
    safeZone: {
      amount: runway,
      priority: 'extend runway',
      formula: usingHistoryFloor
        ? 'weeks of bills covered, estimated from recent income'
        : 'weeks of bills covered',
      confidence:
        currentBalance.source === 'sample'
          ? 'low'
          : currentBalance.confidence === 'rough' || usingHistoryFloor
            ? 'estimating'
            : 'high',
      date: null,
    },
    verdict,
    spareLabel: 'wk runway',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const irregularStrategy: ModeStrategy = { mode: 'irregular', derive };
