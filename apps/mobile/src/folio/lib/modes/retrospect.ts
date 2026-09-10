import type { CycleRecord } from '../../store';
import { formatMoney } from '../financialPresentation';
import { selectRecordedReviews } from '../recordedReviews';
import { MODE_LABEL, type MoneyMode } from './types';

export type Kpi = { label: string; value: string; tone?: 'ink' | 'positive' | 'accent' };
export type Retrospect = {
  eyebrow: string;
  title: { lead: string; accent: string; tail: string };
  primary: Kpi;
  secondary: Kpi;
  trendCaption: string;
  meloNote: string;
  shareTitle: string;
};

/** Review records contain forecast snapshots and recorded pot contributions. Their financial
 * meaning does not change with the selected lens, and repeated reviews are not elapsed months. */
export function getRetrospect(
  mode: MoneyMode,
  cycles: CycleRecord[],
  _potsTotal: number,
): Retrospect {
  const reviews = selectRecordedReviews(cycles);
  const latest = reviews[0];
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.tightPoint, 0) / reviews.length
    : null;
  return {
    eyebrow: `${reviews.length} recorded ${reviews.length === 1 ? 'review' : 'reviews'} · ${MODE_LABEL[mode]}`,
    title: { lead: 'Your ', accent: 'recorded', tail: ' reviews.' },
    primary: {
      label: 'Latest payday cash forecast',
      value: latest ? formatMoney(latest.spare) : 'Not recorded',
      tone: 'ink',
    },
    secondary: {
      label: 'Average forecast low',
      value: average === null ? 'Not recorded' : formatMoney(average),
      tone: 'ink',
    },
    trendCaption: `Forecast snapshots · ${Math.min(6, reviews.length)} ${reviews.length === 1 ? 'review' : 'reviews'}`,
    meloNote:
      reviews.length < 2
        ? reviews.length === 1
          ? 'Your first review is recorded. One snapshot is not a trend.'
          : 'Imported estimates remain reference history. Record a review to save your current forecast.'
        : 'Each review saves the forecast as it looked then. It does not record a bank payment or prove a month has passed.',
    shareTitle: 'My recorded review',
  };
}

/** A forecast delta, never an inferred payment or saving. */
export function formatDelta(delta: number): string {
  return `${delta >= 0 ? '+' : '−'}${formatMoney(Math.abs(delta))}`;
}
