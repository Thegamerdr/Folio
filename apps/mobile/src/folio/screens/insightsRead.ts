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

/** Interpret durable recorded reviews as forecast snapshots, never as completed periods. */
export function buildInsightsRead({
  latest,
  prior,
  weeklySpent,
}: {
  latest: CycleRead | undefined;
  prior: CycleRead | undefined;
  weeklySpent?: number;
  quietDays?: number;
}): InsightsRead {
  if (!latest) {
    return {
      fact: 'No recorded forecast is available yet.',
      pattern: 'Not enough saved information yet.',
      interpretation: 'Your recorded reviews have not been changed.',
      action: 'Review the current plan in Today before relying on this earlier forecast.',
      canOpenToday: true,
    };
  }
  const date = latest.closedAt ? formatFinancialDate(latest.closedAt) : latest.label;
  const hasLatestForecast = Number.isFinite(latest.spare) && Number.isFinite(latest.tightPoint);
  const fact = hasLatestForecast
    ? `The ${date} review recorded projected payday cash of ${formatMoney(latest.spare)} and a forecast low of ${formatMoney(latest.tightPoint)}.`
    : 'Not enough saved information yet.';
  if (!prior) {
    return {
      fact,
      pattern: 'One recorded review is a starting point, not a pattern yet.',
      interpretation:
        'This is a saved forecast, not an observed bank balance or a completed payday-to-payday cycle.',
      action: 'Review the current plan in Today before relying on this earlier forecast.',
      canOpenToday: true,
    };
  }
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
    !Number.isFinite(latest.spare) || !Number.isFinite(prior.spare)
      ? 'Not enough saved information yet.'
      : latest.spare === prior.spare
        ? 'The saved payday cash forecast is unchanged.'
        : `The saved payday cash forecast changed by ${formatMoney(latest.spare - prior.spare)}.`;
  const spend = Number.isFinite(weeklySpent)
    ? ` Recorded money out in the past 7 days: ${formatMoney(weeklySpent!)}.`
    : '';
  return {
    fact,
    pattern: `${timing} ${change}${spend}`,
    interpretation:
      'A change between saved forecasts does not establish actual spending, savings or debt repayments. These reviews may cover the same period.',
    action: 'Open Today to check the current figures and any unpaid or unconfirmed items.',
    canOpenToday: true,
  };
}
