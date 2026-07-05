/**
 * Low-Visibility strategy — full engine.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/lowVis.ts`,
 * verbatim. Folio doesn't yet have enough data to answer honestly. Instead
 * of faking a number, the strategy quantifies *coverage* (how much real
 * signal it has) and shows that as the Safe Zone. Every surface then knows
 * how much to soften.
 *
 *   coverage = weighted signal score 0-100
 *     +40 if currentBalance is not sample
 *     +20 per active sub (capped 30)
 *     +20 if any pot has a goal
 *     +10 if onboarding.monthlyIncome > 0
 *   fog until coverage >= 40
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';

const VOICE: MeloVoiceTint = {
  archetype: 'curious',
  directive:
    'Mode: Low-Visibility. Folio does not yet have enough data. Never state numbers as fact. Ask for one small piece of input per turn. Never survival vocabulary.',
};

function derive(inputs: ModeInputs): ModeState {
  const { currentBalance, subs, subPaused, pots, onboarding, hour } = inputs;
  const activeSubs = subs.filter((s) => !subPaused[s.name]).length;
  let coverage = 0;
  if (currentBalance.source !== 'sample') coverage += 40;
  coverage += Math.min(30, activeSubs * 20);
  if (pots.some((p) => p.goal > 0)) coverage += 20;
  if (onboarding.monthlyIncome > 0) coverage += 10;
  coverage = Math.min(100, coverage);

  let mood: MeloMood = 'curious';
  if (coverage >= 80) mood = 'calm';
  else if (coverage < 30) mood = 'concern';

  let pose: MeloPose = 'none';
  if (coverage >= 80) pose = 'safe';

  let weather: MeloWeather = 'fog';
  if (coverage >= 80) weather = 'sunny';
  else if (coverage >= 60) weather = 'cloudy';
  if (typeof hour === 'number' && hour >= 22 && (weather === 'sunny' || weather === 'cloudy'))
    weather = 'night';

  const verdict =
    coverage < 30
      ? "Not enough to say yet — add a statement and I'll sharpen this."
      : coverage < 60
        ? 'Rough shape only — one more input sharpens this.'
        : coverage < 80
          ? 'Getting clearer — a statement finishes the picture.'
          : 'Enough signal now. Ready to switch to a firmer mode.';

  return {
    mode: 'lowVis',
    safeZone: {
      amount: coverage,
      priority: 'get enough data to answer',
      formula: 'signal coverage · out of 100',
      confidence: coverage >= 80 ? 'estimating' : 'low',
      date: null,
    },
    verdict,
    spareLabel: 'signal',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const lowVisStrategy: ModeStrategy = { mode: 'lowVis', derive };
