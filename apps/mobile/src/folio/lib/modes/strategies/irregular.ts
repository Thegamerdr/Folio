/**
 * Irregular strategy — full engine.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/irregular.ts`,
 * verbatim. No fixed payday. Safe Zone = *weeks of runway* from today: how
 * many whole weeks of upcoming bills the available balance covers.
 *
 *   weeklyBills = sum(active-sub costs in next 30d) / 4.33
 *   runway      = floor((balance − earmarked) / weeklyBills)
 *   storm  → runway < 2
 *   rainy  → runway < 4
 *   cloudy → runway < 8
 *   sunny  → runway >= 8
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';

const VOICE: MeloVoiceTint = {
  archetype: 'levelheaded',
  directive:
    'Mode: Irregular income. The user has no fixed payday. Speak in runway (weeks covered), not days-to-payday. Treat quiet months as data, not danger.',
};

function derive(inputs: ModeInputs): ModeState {
  const { currentBalance, subs, subPaused, pots, hour, ritualCompletedRecently } = inputs;
  const active = subs.filter((s) => !subPaused[s.name]);
  const upcoming = active
    .filter((s) => s.nextRenewalDaysAway >= 0 && s.nextRenewalDaysAway <= 30)
    .reduce((sum, s) => sum + s.cost, 0);
  const weeklyBills = Math.max(20, upcoming / 4.33);
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

  const verdict =
    weather === 'fog'
      ? 'Not enough to say yet — add a statement to sharpen this.'
      : runway < 2
        ? "Runway's short. Bring one bill forward or trim one."
        : runway < 4
          ? 'A few weeks of runway. Next invoice is the lever.'
          : 'Runway holds. The next invoice extends it.';

  return {
    mode: 'irregular',
    safeZone: {
      amount: runway,
      priority: 'extend runway',
      formula: 'weeks of bills covered',
      confidence:
        currentBalance.source === 'sample'
          ? 'low'
          : currentBalance.confidence === 'rough'
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
