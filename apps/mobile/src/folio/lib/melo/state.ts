import type { CurrentBalance, Onboarding, Pot, Sub } from '../../store';
import type { MeloMood, MeloPose } from '../../melo/Melo';
import type { MeloWeather } from '../../ui/MeloWeatherGlyph';

export type MeloInputs = {
  tightestSpare: number;
  monthlyIncome: number;
  subs: readonly Sub[];
  subPaused: Readonly<Record<string, boolean>>;
  pots: readonly Pot[];
  currentBalance: CurrentBalance;
  onboarding: Onboarding;
  unfamiliarSubCaught?: boolean;
  ritualCompletedRecently?: boolean;
  hour?: number;
};

export type MeloDerivedState = {
  mood: MeloMood;
  pose: MeloPose;
  weather: MeloWeather;
};

const CALM_FRACTION = 0.4;
const CONCERN_FRACTION = 0.15;

/** Current refrozen Lovable Melo-state derivation, kept pure for native reuse. */
export function deriveMeloState(inputs: MeloInputs): MeloDerivedState {
  const income = Math.max(1, inputs.monthlyIncome);
  const safeRatio = inputs.tightestSpare / income;
  const nearRenewal = inputs.subs
    .filter((sub) => !inputs.subPaused[sub.name])
    .some((sub) => sub.nextRenewalDaysAway <= 3 && sub.nextRenewalDaysAway >= 0);
  const anyPotHit = inputs.pots.some((pot) => pot.goal > 0 && pot.saved >= pot.goal);

  let mood: MeloMood = 'calm';
  if (inputs.tightestSpare < 0) mood = 'concern';
  else if (safeRatio < CONCERN_FRACTION || inputs.unfamiliarSubCaught) mood = 'concern';
  else if (inputs.ritualCompletedRecently || anyPotHit) mood = 'cheer';
  else if (safeRatio < CALM_FRACTION || nearRenewal) mood = 'curious';

  let pose: MeloPose = 'none';
  if (inputs.unfamiliarSubCaught) pose = 'check';
  else if (mood === 'cheer' && inputs.ritualCompletedRecently) pose = 'sealed';
  else if (mood === 'calm' && safeRatio >= CALM_FRACTION) pose = 'safe';
  else if (mood === 'concern' && inputs.tightestSpare < 0) pose = 'check';

  let weather: MeloWeather = 'cloudy';
  const soonBill = inputs.subs
    .filter((sub) => !inputs.subPaused[sub.name])
    .some((sub) => sub.nextRenewalDaysAway <= 1 && sub.cost > inputs.tightestSpare);
  if (soonBill) weather = 'alarm';
  else if (inputs.tightestSpare < 0) weather = 'storm';
  else if (nearRenewal) weather = 'rainy';
  else if (safeRatio >= CALM_FRACTION) weather = 'sunny';
  if (typeof inputs.hour === 'number' && inputs.hour >= 22 && weather === 'cloudy') {
    weather = 'night';
  }

  return { mood, pose, weather };
}

/** Live plumage signal from the current refrozen Lovable source. */
export function deriveMeloVitality(inputs: MeloInputs): number {
  const income = Math.max(1, inputs.monthlyIncome);
  const safe = Math.max(0, Math.min(1, inputs.tightestSpare / income / CALM_FRACTION));
  const potShare =
    inputs.pots.length > 0
      ? inputs.pots.filter((pot) => pot.goal > 0 && pot.saved / pot.goal >= 0.6).length /
        inputs.pots.length
      : 0.5;
  const fresh = inputs.ritualCompletedRecently ? 0.08 : 0;
  let vitality = safe * 0.65 + potShare * 0.3 + fresh;
  if (inputs.tightestSpare < 0) vitality = Math.min(vitality, 0.22);
  return Math.max(0, Math.min(1, vitality));
}

export type Plumage = 'dim' | 'warm' | 'bright' | 'radiant';

export function vitalityLabel(vitality: number): Plumage {
  if (vitality < 0.28) return 'dim';
  if (vitality < 0.55) return 'warm';
  if (vitality < 0.82) return 'bright';
  return 'radiant';
}

export function weatherLabel(weather: MeloWeather): string {
  switch (weather) {
    case 'sunny':
      return 'clear';
    case 'cloudy':
      return 'steady';
    case 'rainy':
      return 'bill week';
    case 'storm':
      return 'tight';
    case 'rainbow':
      return 'back on';
    case 'night':
      return 'quiet';
    case 'alarm':
      return 'soon';
    case 'fog':
      return 'still learning';
    case 'windy':
      return 'variable';
    case 'heatwave':
      return 'running warm';
    case 'freeze':
      return 'held';
  }
}
