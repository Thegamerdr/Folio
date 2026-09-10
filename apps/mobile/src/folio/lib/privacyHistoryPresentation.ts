import type { CycleRecord } from '../store';
import { selectRecordedReviews } from './recordedReviews';

/** Privacy counts every saved record without claiming a forecast review completed a period. */
export function privacyHistoryPresentation(cycles: readonly CycleRecord[]) {
  const recordedReviews = selectRecordedReviews(cycles).length;
  const historySummaries = cycles.length - recordedReviews;
  const reviewSummary = `${recordedReviews} recorded review${recordedReviews === 1 ? '' : 's'}`;
  const summary = historySummaries
    ? `${reviewSummary} and ${historySummaries} history summar${historySummaries === 1 ? 'y' : 'ies'}`
    : reviewSummary;
  return { recordedReviews, historySummaries, summary };
}
