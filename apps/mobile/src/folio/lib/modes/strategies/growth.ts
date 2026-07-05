/**
 * Growth strategy — full engine.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/growth.ts`,
 * verbatim. The user's bills are handled; the question is *pace*. Safe Zone
 * reframes as £ free to save this cycle (balance − earmarked − upcoming
 * bills − buffer), and weather tracks pot-goal pace against elapsed cycle
 * days.
 *
 *   pace = sum(saved) / sum(target)
 *   elapsedShare = (30 - daysToPayday) / 30   (rough — no real cycle yet)
 *   ahead   → pace >= elapsedShare + 0.05
 *   onPace  → within ±5%
 *   behind  → pace <  elapsedShare - 0.05
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';

const DEFAULT_BUFFER = 100;

const VOICE: MeloVoiceTint = {
  archetype: 'coach',
  directive:
    "Mode: Growth. The user's bills are handled and they're building. Speak in months and cadence, not days. Celebrate pace, not one-offs. Never survival vocabulary.",
};

function derive(inputs: ModeInputs): ModeState {
  const {
    currentBalance,
    subs,
    subPaused,
    pots,
    bufferAmount,
    hour,
    tightestDate,
    ritualCompletedRecently,
  } = inputs;
  const buffer = bufferAmount ?? DEFAULT_BUFFER;

  const upcomingBills = subs
    .filter((s) => !subPaused[s.name] && s.nextRenewalDaysAway >= 0 && s.nextRenewalDaysAway <= 30)
    .reduce((sum, s) => sum + s.cost, 0);
  const earmarked = pots.reduce((s, p) => s + Math.max(0, p.saved), 0);
  const freeToSave = Math.max(
    0,
    Math.round(currentBalance.amount - earmarked - upcomingBills - buffer),
  );

  const targetSum = pots.reduce((s, p) => s + Math.max(0, p.goal), 0);
  const savedSum = pots.reduce((s, p) => s + Math.max(0, p.saved), 0);
  const pace = targetSum > 0 ? savedSum / targetSum : 0;

  // Rough elapsed share of the cycle — tightestDate is the payday marker.
  let elapsedShare = 0.5;
  if (tightestDate) {
    const days = Math.max(
      0,
      Math.round((new Date(tightestDate).getTime() - Date.now()) / 86400000),
    );
    elapsedShare = Math.min(1, Math.max(0, (30 - days) / 30));
  }
  const delta = pace - elapsedShare;

  let mood: MeloMood = 'calm';
  if (ritualCompletedRecently) mood = 'cheer';
  else if (delta >= 0.05) mood = 'cheer';
  else if (delta <= -0.1) mood = 'curious';

  let pose: MeloPose = 'none';
  if (mood === 'cheer') pose = 'sealed';
  else if (delta >= 0) pose = 'safe';

  let weather: MeloWeather = 'sunny';
  if (currentBalance.source === 'sample') weather = 'fog';
  else if (delta <= -0.15) weather = 'rainy';
  else if (delta <= -0.05) weather = 'cloudy';
  else weather = 'sunny';
  if (typeof hour === 'number' && hour >= 22 && (weather === 'sunny' || weather === 'cloudy'))
    weather = 'night';

  const verdict =
    weather === 'fog'
      ? 'Not enough to say yet — add a statement to sharpen this.'
      : targetSum === 0
        ? 'Room to move — pick a pot to feed.'
        : delta >= 0.05
          ? 'Ahead of pace. Cadence is holding.'
          : delta <= -0.05
            ? 'A little behind — one nudge brings it back.'
            : 'On pace. Keep the rhythm.';

  return {
    mode: 'growth',
    safeZone: {
      amount: freeToSave,
      priority: 'grow the buffer',
      formula: 'free to save this cycle',
      confidence:
        currentBalance.source === 'sample'
          ? 'low'
          : currentBalance.confidence === 'rough'
            ? 'estimating'
            : 'high',
      date: null,
    },
    verdict,
    spareLabel: 'free to save',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const growthStrategy: ModeStrategy = { mode: 'growth', derive };
