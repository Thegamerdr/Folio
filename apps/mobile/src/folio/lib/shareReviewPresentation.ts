import type { CycleRecord } from '../store';
import { formatFinancialDate, formatMoney } from './financialPresentation';
import { selectRecordedReviews } from './recordedReviews';

/** A share card keeps a recorded forecast separate from current forecast settings. */
export function buildShareReviewPresentation(
  cycles: readonly CycleRecord[],
  currentForecastPauseCount: number,
  brand = 'Melo',
) {
  const latest = selectRecordedReviews(cycles)[0];
  if (!latest) return null;

  const recordedDate = formatFinancialDate(latest.closedAt);
  const amount = formatMoney(latest.spare);
  const amountLabel = 'Recorded payday cash forecast';
  const forecastScope =
    'These figures are a saved forecast. Check Today for the current plan before spending.';
  const count = Number.isFinite(currentForecastPauseCount)
    ? Math.max(0, Math.floor(currentForecastPauseCount))
    : 0;
  const currentPauses =
    count > 0
      ? `${count} current forecast ${count === 1 ? 'pause' : 'pauses'}. Provider payments are unchanged.`
      : 'No current forecast pauses. Provider payments are unchanged.';
  return {
    recordedDate,
    amount,
    amountLabel,
    forecastScope,
    currentPauses,
    shareText: `${brand} · forecast review recorded ${recordedDate}. ${amountLabel}: ${amount}. ${forecastScope} ${currentPauses}`,
  };
}

export type ShareReviewPresentation = NonNullable<ReturnType<typeof buildShareReviewPresentation>>;
