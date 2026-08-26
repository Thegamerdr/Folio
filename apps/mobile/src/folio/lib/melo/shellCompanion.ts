import type { ScreenId } from '@/folio/types';

export type ShellCompanionPlacement = Readonly<{
  top: number;
  bubbleLeft: number;
  birdLeft: number;
}>;

type WorkspaceKind = 'personal' | 'business';

const PERSONAL_HEADER_PERCHES: Partial<
  Record<ScreenId, Readonly<{ top: number; bubbleLeft: number; birdLeft: number }>>
> = {
  plans: { top: 68, bubbleLeft: 44, birdLeft: 260 },
  whatif: { top: 68, bubbleLeft: 44, birdLeft: 260 },
  account: { top: 68, bubbleLeft: 44, birdLeft: 260 },
  connections: { top: 68, bubbleLeft: 44, birdLeft: 260 },
  privacy: { top: 68, bubbleLeft: 44, birdLeft: 260 },
  'today-after': { top: 68, bubbleLeft: 68, birdLeft: 284 },
  timeline: { top: 68, bubbleLeft: 44, birdLeft: 260 },
  visualizer: { top: 68, bubbleLeft: 44, birdLeft: 260 },
};

function placeOnSide(
  placement: Readonly<{ top: number; bubbleLeft: number; birdLeft: number }>,
  side: 'auto' | 'left' | 'right',
): ShellCompanionPlacement {
  if (side !== 'left') return placement;
  return {
    top: placement.top,
    bubbleLeft: 360 - placement.bubbleLeft - 220,
    birdLeft: 360 - placement.birdLeft - 64,
  };
}

/** S9 logical-DP placements for pinned semantic perches. Personal header perches are deliberately
 * workspace-scoped: screen ids such as Timeline are reused by Business, whose composition must not
 * inherit the personal roaming companion. Screens without an authored source perch return null. */
export function shellCompanionPlacement(
  screen: ScreenId,
  side: 'auto' | 'left' | 'right',
  workspaceKind: WorkspaceKind = 'personal',
): ShellCompanionPlacement | null {
  const existingPerch =
    screen === 'plan'
      ? { top: 485, bubbleLeft: 30, birdLeft: 260 }
      : screen === 'review'
        ? { top: 243, bubbleLeft: 30, birdLeft: 260 }
        : null;
  if (existingPerch !== null) return placeOnSide(existingPerch, side);
  if (workspaceKind === 'business') return null;
  const personalPerch = PERSONAL_HEADER_PERCHES[screen];
  return personalPerch === undefined ? null : placeOnSide(personalPerch, side);
}
