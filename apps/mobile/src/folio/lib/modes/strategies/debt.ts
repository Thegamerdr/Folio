/**
 * Debt strategy — reads real Debt items from the store.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/debt.ts`,
 * verbatim. Safe Zone = balance − earmarked − nearest minimum payment −
 * buffer. That's the honest "what's left after this month's minimum won't
 * embarrass you" number. Weather reflects payment exposure: a min due
 * inside 7 days that spare can't cover pushes weather to storm.
 *
 * Empty state: when the user has declared no debts, the strategy points
 * them at adding one with a soft verdict — never invents payoff numbers
 * from thin air.
 */
import type { ModeInputs, ModeState, ModeStrategy, MeloVoiceTint, MeloWeather } from '../types';
import type { MeloMood, MeloPose } from '../../../melo/Melo';
import { summarise } from '../debtEngine';

const DEFAULT_BUFFER = 100;

const VOICE: MeloVoiceTint = {
  archetype: 'steady partner',
  directive:
    'Mode: Debt. The user is repaying and needs progress, not guilt. Frame every move around freeing up repayment room. Never shame, never celebratory over spending.',
};

function derive(inputs: ModeInputs): ModeState {
  const {
    currentBalance,
    pots,
    bufferAmount,
    hour,
    ritualCompletedRecently,
    tightestSpare,
    debts,
  } = inputs;
  const buffer = bufferAmount ?? DEFAULT_BUFFER;
  const list = debts ?? [];
  const earmarked = pots.reduce((s, p) => s + Math.max(0, p.saved), 0);

  // Empty-state verdict — honest, no payoff invented.
  if (list.length === 0) {
    const weather: MeloWeather = currentBalance.source === 'sample' ? 'fog' : 'sunny';
    return {
      mode: 'debt',
      safeZone: {
        amount: Math.max(0, Math.round(currentBalance.amount - earmarked - buffer)),
        priority: 'no debts declared yet',
        formula: 'add a debt to see payoff',
        confidence: currentBalance.source === 'sample' ? 'low' : 'estimating',
        date: null,
      },
      verdict: 'No debts spotted yet. Add one so I can hold the payoff.',
      spareLabel: 'safe zone',
      mood: 'curious',
      pose: 'none',
      weather,
      voice: VOICE,
    };
  }

  const s = summarise(list, 0);
  const nearMin = s.nextDue?.minPayment ?? 0;
  const daysToDue = s.daysToNextDue ?? Infinity;
  const exposed = daysToDue <= 7 && currentBalance.amount - earmarked < nearMin;
  const afterMin = Math.round(currentBalance.amount - earmarked - nearMin - buffer);

  let mood: MeloMood = 'calm';
  if (ritualCompletedRecently) mood = 'cheer';
  else if (exposed) mood = 'concern';
  else if (tightestSpare < 0) mood = 'curious';

  let pose: MeloPose = 'none';
  if (mood === 'cheer') pose = 'sealed';
  else if (!exposed && afterMin >= 0) pose = 'safe';

  let weather: MeloWeather = 'sunny';
  if (currentBalance.source === 'sample') weather = 'fog';
  else if (exposed) weather = 'storm';
  else if (afterMin < 0) weather = 'rainy';
  else if (afterMin < buffer * 0.5) weather = 'cloudy';
  if (typeof hour === 'number' && hour >= 22 && (weather === 'sunny' || weather === 'cloudy'))
    weather = 'night';

  const monthsLabel = isFinite(s.monthsAtMin) ? `${s.monthsAtMin} mo` : 'drowning at min';
  const verdict =
    weather === 'fog'
      ? 'Not enough to say yet — add a statement to sharpen this.'
      : exposed
        ? `A £${Math.round(nearMin)} payment lands in ${Math.max(0, Math.round(daysToDue))} d — small move now protects it.`
        : !isFinite(s.monthsAtMin)
          ? "Minimums won't shift the balance. A small extra a month changes everything."
          : afterMin < 0
            ? "Minimums held, everyday's tight."
            : `On this pace, clear in ${monthsLabel}. Steady wins.`;

  return {
    mode: 'debt',
    safeZone: {
      amount: Math.max(0, afterMin),
      priority: 'keep minimums moving',
      formula:
        nearMin > 0 ? `after £${Math.round(nearMin)} payment · ${monthsLabel} at min` : monthsLabel,
      confidence:
        currentBalance.source === 'sample'
          ? 'low'
          : currentBalance.confidence === 'rough'
            ? 'estimating'
            : 'high',
      date:
        s.nextDue && daysToDue !== Infinity
          ? new Date(Date.now() + daysToDue * 86400000).toISOString()
          : null,
    },
    verdict,
    spareLabel: 'after next payment',
    mood,
    pose,
    weather,
    voice: VOICE,
  };
}

export const debtStrategy: ModeStrategy = { mode: 'debt', derive };
