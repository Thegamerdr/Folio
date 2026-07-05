/**
 * Reset strategy — full engine.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/reset.ts`,
 * verbatim. Recovery mode. The Safe Zone stops being "£ spare" and becomes
 * "days of essentials covered" — the only number that matters after a
 * shock. Essentials daily = (monthlyIncome × 0.4) / 30 as an honest proxy
 * until the RN port has a categorised essentials line.
 *
 *   daysCovered = floor((balance − earmarked) / essentialsPerDay)
 *   storm   → daysCovered < 3
 *   rainy   → daysCovered < 7
 *   cloudy  → daysCovered < 14
 *   sunny   → daysCovered >= 14
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';

const VOICE: MeloVoiceTint = {
  archetype: 'gentle triage',
  directive:
    'Mode: Reset. The user is recovering. One tiny move per surface. Never a plan longer than this week. Never celebratory.',
};

function derive(inputs: ModeInputs): ModeState {
  const { currentBalance, pots, onboarding, hour, ritualCompletedRecently } = inputs;

  const essentialsPerDay = Math.max(5, (onboarding.monthlyIncome * 0.4) / 30);
  const earmarked = pots.reduce((s, p) => s + Math.max(0, p.saved), 0);
  const available = Math.max(0, currentBalance.amount - earmarked);
  const daysCovered = Math.floor(available / essentialsPerDay);

  let mood: MeloMood = 'calm';
  if (ritualCompletedRecently) mood = 'cheer';
  else if (daysCovered < 3) mood = 'concern';
  else if (daysCovered < 7) mood = 'curious';

  let pose: MeloPose = 'none';
  if (mood === 'cheer') pose = 'sealed';
  else if (daysCovered >= 14) pose = 'safe';

  let weather: MeloWeather = 'sunny';
  if (currentBalance.source === 'sample') weather = 'fog';
  else if (daysCovered < 3) weather = 'storm';
  else if (daysCovered < 7) weather = 'rainy';
  else if (daysCovered < 14) weather = 'cloudy';
  if (typeof hour === 'number' && hour >= 22 && (weather === 'sunny' || weather === 'cloudy'))
    weather = 'night';

  const verdict =
    weather === 'fog'
      ? 'Not enough to say yet — add a statement to sharpen this.'
      : daysCovered < 3
        ? 'Something has to move. Smallest thing first.'
        : daysCovered < 7
          ? 'A few days held. One step at a time.'
          : daysCovered < 14
            ? 'Essentials are held. Rest the plan.'
            : 'Steadier ground. Nothing else to do today.';

  return {
    mode: 'reset',
    safeZone: {
      amount: daysCovered,
      priority: 'cover essentials',
      formula: 'days of essentials covered',
      confidence:
        currentBalance.source === 'sample'
          ? 'low'
          : currentBalance.confidence === 'rough'
            ? 'estimating'
            : 'high',
      date: null,
    },
    verdict,
    spareLabel: 'days covered',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const resetStrategy: ModeStrategy = { mode: 'reset', derive };
