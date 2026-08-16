/**
 * Survival strategy — the shipped default.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/survival.ts`,
 * verbatim. Behaviour is intentionally byte-identical to the source's
 * pre-mode `deriveMeloState` so migrated users see zero drift.
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';

const CALM_FRACTION = 0.4;
const CONCERN_FRACTION = 0.15;

const VOICE: MeloVoiceTint = {
  archetype: 'protector',
  directive:
    'Mode: Survival. The user is watching their money to payday. Speak close, calm, and short. Name one concrete move. Never celebratory. Never dramatic.',
};

function derive(inputs: ModeInputs): ModeState {
  const {
    tightestSpare,
    tightestDate,
    onboarding,
    subs,
    subPaused,
    pots,
    unfamiliarSubCaught,
    ritualCompletedRecently,
    hour,
  } = inputs;

  const income = Math.max(1, onboarding.monthlyIncome);
  const safeRatio = tightestSpare / income;

  const nearRenewal = subs
    .filter((s) => !subPaused[s.name])
    .some((s) => s.nextRenewalDaysAway <= 3 && s.nextRenewalDaysAway >= 0);
  const anyPotHit = pots.some((p) => p.goal > 0 && p.saved >= p.goal);

  // Mood — matches the design source's state.ts § 2.1 exactly.
  let mood: MeloMood = 'calm';
  if (tightestSpare < 0) mood = 'concern';
  else if (safeRatio < CONCERN_FRACTION || unfamiliarSubCaught) mood = 'concern';
  else if (ritualCompletedRecently || anyPotHit) mood = 'cheer';
  else if (safeRatio < CALM_FRACTION || nearRenewal) mood = 'curious';
  else mood = 'calm';

  // Pose.
  let pose: MeloPose = 'none';
  if (unfamiliarSubCaught) pose = 'check';
  else if (mood === 'cheer' && ritualCompletedRecently) pose = 'sealed';
  else if (mood === 'calm' && safeRatio >= CALM_FRACTION) pose = 'safe';
  else if (mood === 'concern' && tightestSpare < 0) pose = 'check';

  // Weather.
  let weather: MeloWeather = 'cloudy';
  const soonBill = subs
    .filter((s) => !subPaused[s.name])
    .some((s) => s.nextRenewalDaysAway <= 1 && s.cost > tightestSpare);
  if (soonBill) weather = 'alarm';
  else if (tightestSpare < 0) weather = 'storm';
  else if (nearRenewal) weather = 'rainy';
  else if (safeRatio >= CALM_FRACTION) weather = 'sunny';
  else weather = 'cloudy';
  if (typeof hour === 'number' && hour >= 22 && weather === 'cloudy') {
    weather = 'night';
  }

  const spare = Math.max(0, Math.round(tightestSpare));
  const verdict =
    tightestSpare < 0
      ? "Something has to move. Let's look together."
      : safeRatio < CONCERN_FRACTION
        ? 'The middle of next week is the squeeze.'
        : safeRatio < CALM_FRACTION
          ? 'Tight — but the path holds.'
          : 'You make it to payday.';

  return {
    mode: 'survival',
    safeZone: {
      amount: spare,
      priority: 'reach payday',
      formula: 'at its lowest point',
      confidence: 'estimating',
      date: tightestDate,
    },
    verdict,
    spareLabel: 'spare',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const survivalStrategy: ModeStrategy = { mode: 'survival', derive };
