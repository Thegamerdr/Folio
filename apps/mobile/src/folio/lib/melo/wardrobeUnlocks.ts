/** Silent companion-touch unlocks from the live Lovable source. */
import type { CycleRecord } from '../../store';

function isSafeCycle(cycle: CycleRecord): boolean {
  return cycle.tightPoint > 0 && cycle.spare > 0;
}

export function evaluateWardrobe(
  cycles: readonly CycleRecord[],
  currentWardrobe: readonly string[],
): string[] {
  const current = currentWardrobe.find((item) => typeof item === 'string' && item.length > 0);
  if (current) return [current];
  return unlockedWardrobe(cycles).slice(0, 1);
}

/** Earned choices derive from confirmed cycles; `MeloState.wardrobe` stores only what is worn. */
export function unlockedWardrobe(cycles: readonly CycleRecord[]): string[] {
  const unlocked: string[] = [];
  if (cycles.length >= 1) unlocked.push('scarf');
  if (cycles.filter(isSafeCycle).length >= 3) unlocked.push('crown');
  return unlocked;
}
