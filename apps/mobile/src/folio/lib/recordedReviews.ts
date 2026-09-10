import type { CycleRecord } from '../store';

/** A completed review is a recorded snapshot, not proof that a month has elapsed. */
export function selectRecordedReviews(cycles: readonly CycleRecord[]): CycleRecord[] {
  return cycles
    .filter((cycle) => !cycle.reconstructed)
    .slice()
    .sort((left, right) => right.closedAt.localeCompare(left.closedAt));
}
