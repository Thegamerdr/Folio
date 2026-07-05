/**
 * Planning strategy — full engine.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/planning.ts`,
 * verbatim. The user has one or more declared big-ticket plans (see `Plan`
 * in `../../store`). This strategy reads them via `summarisePlans` and
 * derives Safe Zone as "£ still to go" for the most urgent plan. Weather
 * tracks pace: on-track = sunny, short but reachable = cloudy, short and
 * close to deadline = rainy/storm. When no plans exist we fall back to the
 * largest pot with a goal so the lens still says something honest.
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';
import { summarisePlans, daysUntilLabel } from '../planEngine';

const VOICE: MeloVoiceTint = {
  archetype: 'quiet strategist',
  directive:
    'Mode: Planning. The user has a target ahead. Every move relates to pace toward it. Never generic saving advice.',
};

function derive(inputs: ModeInputs): ModeState {
  const { plans = [], pots, currentBalance, hour, ritualCompletedRecently, tightestSpare } = inputs;

  const summary = summarisePlans(plans);
  const focus = summary.focus;

  // Fallback path: no plans declared — use the largest pot with a goal
  // so the lens still surfaces *something* until the user adds one.
  const fallbackPot = focus
    ? null
    : pots.filter((p) => p.goal > 0).sort((a, b) => b.goal - a.goal)[0];
  const fallbackRemaining = fallbackPot ? Math.max(0, fallbackPot.goal - fallbackPot.saved) : 0;
  const fallbackPace =
    fallbackPot && fallbackPot.goal > 0 ? fallbackPot.saved / fallbackPot.goal : 0;

  let mood: MeloMood = 'calm';
  if (ritualCompletedRecently) mood = 'cheer';
  else if (focus) {
    if (focus.onTrack && focus.progress >= 0.5) mood = 'cheer';
    else if (!focus.onTrack && focus.daysUntil > 0 && focus.daysUntil < 28) mood = 'curious';
  } else if (fallbackPot && fallbackPace >= 0.75) {
    mood = 'cheer';
  }
  if (tightestSpare < 0) mood = 'curious';

  let pose: MeloPose = 'none';
  if (mood === 'cheer') pose = 'sealed';
  else if (focus?.onTrack || fallbackPace >= 0.5) pose = 'safe';

  let weather: MeloWeather = 'sunny';
  if (currentBalance.source === 'sample') weather = 'fog';
  else if (!focus && !fallbackPot) weather = 'cloudy';
  else if (focus) {
    if (focus.daysUntil < 0) weather = 'cloudy';
    else if (!focus.onTrack && focus.daysUntil < 14) weather = 'storm';
    else if (!focus.onTrack && focus.daysUntil < 28) weather = 'rainy';
    else if (!focus.onTrack) weather = 'cloudy';
    else weather = 'sunny';
  } else if (fallbackPot) {
    if (fallbackPace < 0.25) weather = 'rainy';
    else if (fallbackPace < 0.5) weather = 'cloudy';
  }
  if (typeof hour === 'number' && hour >= 22 && (weather === 'sunny' || weather === 'cloudy'))
    weather = 'night';

  const amount = focus ? Math.round(focus.remaining) : Math.round(fallbackRemaining);
  const priority = focus
    ? `reach ${focus.plan.name}`
    : fallbackPot
      ? `reach ${fallbackPot.name}`
      : 'reach the goal';

  let formula = 'pick a plan or a pot with a target';
  if (focus) {
    const req = Number.isFinite(focus.requiredPerWeek) ? Math.ceil(focus.requiredPerWeek) : null;
    if (focus.remaining <= 0) {
      formula = 'target reached — pick the next one';
    } else if (req !== null) {
      formula = `~£${req}/wk needed · ${daysUntilLabel(focus.daysUntil)} left`;
    } else {
      formula = `${daysUntilLabel(focus.daysUntil)} left`;
    }
  } else if (fallbackPot) {
    formula = `£ to go · pot cadence £${fallbackPot.perWeek}/wk`;
  }

  let verdict = 'Steady wins this.';
  if (weather === 'fog') {
    verdict = 'Not enough to say yet — add a statement to sharpen this.';
  } else if (focus) {
    if (focus.remaining <= 0) verdict = 'Target reached — pick the next one.';
    else if (focus.onTrack) verdict = `On pace — £${Math.round(focus.remaining)} to go.`;
    else if (focus.daysUntil < 14) verdict = 'Pace short — either lift cadence or move the date.';
    else verdict = 'Behind — a small bump brings it back.';
  } else if (fallbackPot) {
    if (fallbackPace >= 0.75) verdict = `Almost there — £${Math.round(fallbackRemaining)} to go.`;
    else verdict = 'No plan yet — add a target with a date.';
  } else {
    verdict = 'No plan yet — add a target with a date.';
  }

  return {
    mode: 'planning',
    safeZone: {
      amount,
      priority,
      formula,
      confidence:
        currentBalance.source === 'sample' ? 'low' : focus || fallbackPot ? 'estimating' : 'low',
      date: focus?.plan.byDate ?? null,
    },
    verdict,
    spareLabel: focus || fallbackPot ? 'to go' : 'no target yet',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const planningStrategy: ModeStrategy = { mode: 'planning', derive };
