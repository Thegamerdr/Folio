import type { CycleRecord } from '../store';

/** Consecutive recorded reviews with non-negative forecast low/payday balances.
 * These figures do not confirm paid bills, available money or a safely completed month.
 * Reconstructed transaction history is not a review the user completed.
 */
export function computeGreenStreak(cycles: readonly CycleRecord[]): number {
  const sorted = cycles
    .filter((cycle) => cycle.reconstructed !== true)
    .sort((left, right) => right.closedAt.localeCompare(left.closedAt));
  let count = 0;
  for (const cycle of sorted) {
    if (
      !Number.isFinite(cycle.tightPoint) ||
      !Number.isFinite(cycle.spare) ||
      cycle.tightPoint < 0 ||
      cycle.spare < 0
    )
      break;
    count += 1;
  }
  return count;
}
