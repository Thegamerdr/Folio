import type { CycleRecord } from '../store';

export type InsightsRead = Readonly<{
  fact: string;
  pattern: string;
  interpretation: string;
  action: string;
  canOpenToday: boolean;
}>;

type CycleRead = Pick<CycleRecord, 'label' | 'spare' | 'tightPoint'>;

function formatGBP(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}£${Math.abs(Math.round(amount)).toLocaleString('en-GB')}`;
}

/**
 * Turn lived cycle facts into one authored read. This intentionally refuses to infer a pattern from
 * one cycle and keeps the interpretation retrospective; it is a language layer over the existing
 * cycle engine, not a second financial authority.
 */
export function buildInsightsRead({
  latest,
  prior,
  weeklySpent,
  quietDays,
}: {
  latest: CycleRead | undefined;
  prior: CycleRead | undefined;
  weeklySpent: number;
  quietDays: number;
}): InsightsRead {
  if (!latest) {
    return {
      fact: 'There is no lived cycle to read yet.',
      pattern:
        'One real cycle will give Melo something to compare; imported history stays a reference.',
      interpretation: 'A stronger interpretation can wait for lived history.',
      action: 'Keep using Today; the first cycle will become the baseline.',
      canOpenToday: true,
    };
  }

  const fact = `${latest.label} closed with ${formatGBP(latest.spare)} left at payday.`;
  if (!prior) {
    return {
      fact,
      pattern: 'One lived cycle is a starting point, not a pattern yet.',
      interpretation:
        latest.tightPoint < 0
          ? 'The route dipped below zero once; there is not enough history to call that a trend.'
          : 'The route stayed above zero once; there is not enough history to call that a trend.',
      action: 'Let another cycle build before drawing a stronger conclusion.',
      canOpenToday: false,
    };
  }

  const spareDelta = latest.spare - prior.spare;
  const direction = spareDelta === 0 ? 'the same room' : spareDelta > 0 ? 'more room' : 'less room';
  const movement = spareDelta === 0 ? 'did not change' : `changed by ${formatGBP(spareDelta)}`;
  const weeklyContext = weeklySpent > 0 ? ` Recent spend was ${formatGBP(weeklySpent)}.` : '';
  return {
    fact,
    pattern: `Compared with ${prior.label}, payday room ${movement} — ${direction}.${weeklyContext}`,
    interpretation:
      spareDelta >= 0
        ? 'The last lived cycle gave the path a little more breathing room. That is an encouraging signal, not a promise about the next one.'
        : 'The last lived cycle left less room at payday. Treat that as a prompt to look at the low point, not as a verdict on your spending.',
    action:
      spareDelta < 0 || latest.tightPoint < 0
        ? `Open Today and choose the smallest move that changes the path${quietDays >= 3 ? ' while keeping the quiet days you already have' : ''}.`
        : 'Keep the next payday check-in small; compare the low point again after another lived cycle.',
    canOpenToday: spareDelta < 0 || latest.tightPoint < 0,
  };
}
