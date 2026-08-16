/**
 * Stability strategy — second prototype.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/stability.ts`,
 * verbatim. The user's problem isn't "will I make it?" — it's "am I safe
 * this month and what's changing?". So the Safe Zone anchors to *bills
 * covered + user buffer intact*, not to spare-at-tightest-point. Weather
 * thresholds shift: `storm` in Stability = a bill collision within 7 days,
 * not spare going negative. `sunny` = every scheduled bill covered with
 * buffer intact.
 *
 * The path/curve is still drawn by the same engine; only the *interpretation*
 * (headline number, verdict line, weather threshold) changes here.
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';

const DEFAULT_BUFFER = 100;

const VOICE: MeloVoiceTint = {
  archetype: 'calm guide',
  directive:
    "Mode: Stability. The user is safe this month and wants visibility. Speak in a longer horizon: the month, the shape, what's changing. Never urgent. Never survival vocabulary (avoid 'run out', 'survive', 'make it', 'tight').",
};

function derive(inputs: ModeInputs): ModeState {
  const {
    currentBalance,
    subs,
    subPaused,
    pots,
    bufferAmount,
    tightestSpare,
    ritualCompletedRecently,
    hour,
  } = inputs;

  const buffer = bufferAmount ?? DEFAULT_BUFFER;

  // Bills-covered accounting. The calendar engine's near-term window already
  // includes bills + sub renewals for the cycle; the strategy sums active-sub
  // costs falling in the next 30 days as a proxy.
  const upcomingBills = subs
    .filter((s) => !subPaused[s.name])
    .filter((s) => s.nextRenewalDaysAway >= 0 && s.nextRenewalDaysAway <= 30)
    .reduce((sum, s) => sum + s.cost, 0);

  const earmarked = pots.reduce((s, p) => s + Math.max(0, p.saved), 0);
  const monthSafeAmount = currentBalance.amount - earmarked - upcomingBills - buffer;

  // Bill collision detection — two or more active bills falling within any
  // 3-day window in the next 7 days.
  const near = subs
    .filter((s) => !subPaused[s.name])
    .filter((s) => s.nextRenewalDaysAway >= 0 && s.nextRenewalDaysAway <= 7)
    .map((s) => s.nextRenewalDaysAway)
    .sort((a, b) => a - b);
  let collision = false;
  for (let i = 1; i < near.length; i++) {
    if ((near[i] ?? 0) - (near[i - 1] ?? 0) <= 3) collision = true;
  }

  const bufferIntact = monthSafeAmount >= 0;
  const bufferBreach = monthSafeAmount < 0;

  // Mood — Stability rarely gets to `concern`. The mode assumes the user
  // is safe; concern only fires on a real buffer breach or bill collision.
  let mood: MeloMood = 'calm';
  if (bufferBreach || collision) mood = 'curious';
  if (ritualCompletedRecently) mood = 'cheer';
  if (tightestSpare < 0) mood = 'concern'; // still honest if actuals disagree

  // Pose — mostly `none` in Stability. Reading/thinking come from readers.
  let pose: MeloPose = 'none';
  if (mood === 'cheer' && ritualCompletedRecently) pose = 'sealed';
  else if (mood === 'calm' && bufferIntact && !collision) pose = 'safe';

  // Weather — thresholds shift.
  //   sunny   → bills covered + buffer intact + no collision
  //   cloudy  → covered but buffer tight (< 50% of default)
  //   rainy   → single near-term bill inside the buffer
  //   storm   → bill collision within 7 days OR buffer breached
  //   fog     → sample/low-confidence balance (mode-specific: honesty gate)
  //   night   → after 22:00 local when calm
  //   alarm   → reserved for a bill due ≤ 24h that can't be covered
  let weather: MeloWeather = 'sunny';
  if (currentBalance.source === 'sample' || currentBalance.confidence === 'sample') {
    weather = 'fog';
  } else if (bufferBreach || collision) {
    weather = 'storm';
  } else if (monthSafeAmount < buffer * 0.5) {
    weather = 'cloudy';
  } else {
    weather = 'sunny';
  }
  const soonBig = subs
    .filter((s) => !subPaused[s.name])
    .some((s) => s.nextRenewalDaysAway <= 1 && s.cost > monthSafeAmount);
  if (soonBig && weather !== 'storm') weather = 'alarm';
  if (typeof hour === 'number' && hour >= 22 && (weather === 'sunny' || weather === 'cloudy')) {
    weather = 'night';
  }

  const amount = Math.max(0, Math.round(monthSafeAmount));

  // Verdict — mode-specific copy. One accent word per headline, marked by
  // the caller (ScreenToday renders the em). Include the word in `verdict`
  // as plain text; consumers pick the accent word by convention.
  // Storm has two distinct causes; the verdict must name the true one. A buffer
  // breach with zero near-term bills used to claim "Bill collision this week"
  // (seen live: balance £0, 0 bills scheduled, buffer £100 → storm).
  const verdict =
    weather === 'fog'
      ? 'Not enough to say yet — add a statement to sharpen this.'
      : weather === 'storm'
        ? collision
          ? 'Bill collision this week. One small move covers it.'
          : 'Buffer not covered right now. The month needs a look.'
        : weather === 'cloudy'
          ? "Bills covered. Buffer's a little thin."
          : 'Bills covered. The month holds.';

  return {
    mode: 'stability',
    safeZone: {
      amount,
      priority: "protect this month's bills",
      // The strategy owns the whole caption (the screen renders it bare) so the
      // buffer claim can only ever match the accounting above: "protected" was
      // previously hardcoded on the screen and shown even mid-breach.
      formula: bufferIntact
        ? `safe to spend this month · buffer £${buffer} protected`
        : `safe to spend this month · buffer £${buffer} not fully covered`,
      confidence:
        currentBalance.source === 'sample'
          ? 'low'
          : currentBalance.confidence === 'rough'
            ? 'estimating'
            : 'high',
      date: null,
    },
    verdict,
    spareLabel: 'safe',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const stabilityStrategy: ModeStrategy = { mode: 'stability', derive };
