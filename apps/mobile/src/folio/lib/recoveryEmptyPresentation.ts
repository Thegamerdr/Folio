import type { CycleRecord } from '../store';
import { selectRecordedReviews } from './recordedReviews';

/** PASS52 copy is gated by native evidence. A recorded review is a snapshot;
 * its lowest point is not proof that a complete month elapsed. */
export function recoveryEmptyPresentation(
  complete: boolean,
  canReassure: boolean,
  message: string,
  cycles: readonly CycleRecord[],
) {
  const history = selectRecordedReviews(cycles).slice(0, 3);
  if (!complete)
    return {
      lead: 'Nothing to ',
      accent: 'recover',
      suffix: ' yet.',
      body: 'Recovery works from your recorded figures. Add what you have and it will show a real path here.',
      action: 'Add your money',
      setup: true,
      history: [] as CycleRecord[],
    };
  if (!canReassure)
    return {
      lead: 'Check your ',
      accent: 'recovery',
      suffix: ' picture.',
      body: message,
      action: 'See the plan',
      setup: false,
      history,
    };
  return {
    lead: 'Nothing to ',
    accent: 'recover',
    suffix: ' from.',
    body: history.length
      ? `The path reaches payday on today's figures. Your last ${history.length} recorded ${history.length === 1 ? 'review is' : 'reviews are'} below.`
      : "The path reaches payday on today's figures. There is no recorded cycle history to show yet.",
    action: 'See the plan',
    setup: false,
    history,
  };
}
