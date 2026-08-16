/**
 * Optimizer strategy — full engine.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/optimizer.ts`,
 * verbatim. The user's question isn't "will I make it?" — it's "where's the
 * money bleeding?". The Safe Zone reframes as *£ recoverable this month if
 * you cut the obvious leaks*, with an honest floor (never negative). Leaks
 * are ranked by a simple cost-to-use ratio using existing sub data — no
 * new store shape needed.
 *
 * Leak rules (all use existing `Sub` fields, no new data):
 *   quiet        → usesPerMonth === 0 OR lastUsedDaysAgo > 21
 *   overpriced   → cost >= £15 AND usesPerMonth <= 2
 *
 * Numeric surfaces:
 *   safeZone.amount = sum of active-sub costs flagged as leaks
 *   verdict         = leak count-aware framing
 *   weather         = leak severity, not spare
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';

const VOICE: MeloVoiceTint = {
  archetype: 'dry analyst',
  directive:
    "Mode: Optimizer. The user wants to cut waste. Name one leak per surface. Always show the £/mo. Never moralise, never celebrate spending, never soften with 'small treat'.",
};

export type OptimizerLeak = {
  name: string;
  cost: number;
  reason: 'quiet' | 'overpriced';
  detail: string;
};

export function computeLeaks(inputs: ModeInputs): OptimizerLeak[] {
  const { subs, subPaused } = inputs;
  const leaks: OptimizerLeak[] = [];
  for (const s of subs) {
    if (subPaused[s.name]) continue;
    if (s.usesPerMonth === 0 || s.lastUsedDaysAgo > 21) {
      leaks.push({
        name: s.name,
        cost: s.cost,
        reason: 'quiet',
        detail:
          s.usesPerMonth === 0 ? 'not opened this month' : `last opened ${s.lastUsedDaysAgo}d ago`,
      });
      continue;
    }
    if (s.cost >= 15 && s.usesPerMonth <= 2) {
      leaks.push({
        name: s.name,
        cost: s.cost,
        reason: 'overpriced',
        detail: `£${s.cost.toFixed(0)}/mo · ${s.usesPerMonth} use${s.usesPerMonth === 1 ? '' : 's'}`,
      });
    }
  }
  return leaks.sort((a, b) => b.cost - a.cost);
}

function derive(inputs: ModeInputs): ModeState {
  const { tightestSpare, ritualCompletedRecently, hour } = inputs;
  const leaks = computeLeaks(inputs);
  const recoverable = Math.round(leaks.reduce((s, l) => s + l.cost, 0));

  // Mood — cheer only when the user has actually acted (ritual). Concern
  // when leaks are large relative to spare. Never celebrate discovering
  // leaks — that's the whole point of the mode.
  let mood: MeloMood = 'calm';
  if (ritualCompletedRecently) mood = 'cheer';
  else if (leaks.length >= 4) mood = 'curious';
  else if (tightestSpare < 0 && recoverable > 0) mood = 'curious';
  else if (leaks.length === 0) mood = 'calm';

  let pose: MeloPose = 'none';
  if (mood === 'cheer' && ritualCompletedRecently) pose = 'sealed';
  else if (leaks.length === 0) pose = 'safe';

  // Weather — driven by leak severity, not spare.
  //   sunny  → zero leaks found
  //   cloudy → 1-2 small leaks
  //   rainy  → 3+ leaks OR one leak over £20
  //   storm  → recoverable > 15% of monthly income
  //   night  → after 22:00 when calm
  let weather: MeloWeather = 'sunny';
  const income = Math.max(1, inputs.onboarding.monthlyIncome);
  if (recoverable > income * 0.15) weather = 'storm';
  else if (leaks.length >= 3 || leaks.some((l) => l.cost >= 20)) weather = 'rainy';
  else if (leaks.length > 0) weather = 'cloudy';
  if (typeof hour === 'number' && hour >= 22 && (weather === 'sunny' || weather === 'cloudy')) {
    weather = 'night';
  }

  const verdict =
    leaks.length === 0
      ? 'Nothing obvious leaking. Clean run.'
      : leaks.length === 1
        ? `One leak — £${recoverable}/mo sitting idle.`
        : `${leaks.length} leaks — £${recoverable}/mo you could take back.`;

  return {
    mode: 'optimizer',
    safeZone: {
      amount: recoverable,
      priority: "close what isn't earning its cost",
      formula: 'recoverable if you cut the leaks',
      confidence: leaks.length > 0 ? 'estimating' : 'high',
      date: null,
    },
    verdict,
    spareLabel: 'recoverable /mo',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const optimizerStrategy: ModeStrategy = { mode: 'optimizer', derive };
