import type { CycleRecord } from '../store';
import { formatFinancialDate, formatMoney } from '../lib/financialPresentation';

export type InsightsRead = Readonly<{
  fact: string;
  pattern: string;
  interpretation: string;
  action: string;
  canOpenToday: boolean;
}>;
type CycleRead = Pick<CycleRecord, 'label' | 'spare' | 'tightPoint'> &
  Partial<Pick<CycleRecord, 'closedAt'>>;

/** Interpret saved forecasts as snapshots, retaining their recorded dates and exact money. */
export function buildInsightsRead({
  latest,
  prior,
  weeklySpent,
}: {
  latest: CycleRead | undefined;
  prior: CycleRead | undefined;
  weeklySpent: number;
  quietDays: number;
}): InsightsRead {
  if (!latest)
    return {
      fact: 'No forecast review has been recorded yet.',
      pattern: 'Imported estimates remain reference history, separate from your recorded reviews.',
      interpretation: 'There is no review comparison to make yet.',
      action: 'Open Today to review the current plan.',
      canOpenToday: true,
    };
  const date = latest.closedAt ? formatFinancialDate(latest.closedAt) : latest.label;
  const fact = `The ${date} review recorded projected payday cash of ${formatMoney(latest.spare)} and a forecast low of ${formatMoney(latest.tightPoint)}.`;
  if (!prior)
    return {
      fact,
      pattern: 'One recorded review is a starting point, not a pattern yet.',
      interpretation:
        'These figures describe a saved forecast, not an observed bank balance over a completed month.',
      action: 'Review the current plan in Today before relying on these earlier figures.',
      canOpenToday: true,
    };
  const delta = latest.spare - prior.spare;
  const sameDay = Boolean(
    latest.closedAt &&
    prior.closedAt &&
    latest.closedAt.slice(0, 10) === prior.closedAt.slice(0, 10),
  );
  const priorDate = prior.closedAt ? formatFinancialDate(prior.closedAt) : prior.label;
  const timing = sameDay
    ? `Both reviews were recorded on ${date}.`
    : `The previous review was recorded on ${priorDate}.`;
  const change =
    delta === 0
      ? 'The saved payday cash forecast is unchanged.'
      : `The saved payday cash forecast changed by ${formatMoney(delta)}.`;
  return {
    fact,
    pattern: `${timing} ${change} Recorded money out in the past 7 days: ${formatMoney(weeklySpent)}.`,
    interpretation:
      'A change between saved forecasts does not establish actual spending, savings or debt repayments. These reviews may cover the same period.',
    action: 'Open Today to check the current figures and any unpaid or unconfirmed items.',
    canOpenToday: true,
  };
}
