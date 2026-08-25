import type { ScreenId } from '@/folio/types';

export type ShellCompanionPlacement = Readonly<{
  top: number;
  bubbleLeft: number;
  birdLeft: number;
}>;

/** Initial S9 logical-DP placements for the pinned semantic perches. Screens without a real
 * source perch return null rather than parking Melo in arbitrary leftover space. */
export function shellCompanionPlacement(
  screen: ScreenId,
  side: 'auto' | 'left' | 'right',
): ShellCompanionPlacement | null {
  const top = screen === 'plan' ? 485 : screen === 'review' ? 212 : null;
  if (top === null) return null;
  if (side === 'left') return { top, bubbleLeft: 110, birdLeft: 36 };
  return { top, bubbleLeft: 30, birdLeft: 260 };
}
