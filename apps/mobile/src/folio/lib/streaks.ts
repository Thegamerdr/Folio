import type { CycleRecord } from '../store';

/** Consecutive newest-first cycles whose actual low and close balance stayed non-negative. */
export function computeGreenStreak(cycles: readonly CycleRecord[]): number {
  const sorted = [...cycles].sort((left, right) => right.closedAt.localeCompare(left.closedAt));
  let count = 0;
  for (const cycle of sorted) {
    if (cycle.tightPoint < 0 || cycle.spare < 0) break;
    count += 1;
  }
  return count;
}
