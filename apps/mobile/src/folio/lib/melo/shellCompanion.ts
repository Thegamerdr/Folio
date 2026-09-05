import type { ScreenId } from '@/folio/types';

export type ShellCompanionPlacement = Readonly<{
  top: number;
  bubbleLeft: number;
  birdLeft: number;
}>;

export type NormalizedCompanionPosition = Readonly<{ x: number; y: number }>;
export type CompanionLayerBounds = Readonly<{ width: number; height: number }>;

const FREE_SIZE = 64;
const FREE_INSET = 8;
const FREE_BOTTOM = 104;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Persisted 0..1 coordinates to device coordinates, with the tab bar and safe shell inset removed. */
export function denormalizeCompanionPosition(
  position: NormalizedCompanionPosition,
  bounds: CompanionLayerBounds,
): Readonly<{ x: number; y: number }> {
  const maxX = Math.max(FREE_INSET, bounds.width - FREE_SIZE - FREE_INSET);
  const maxY = Math.max(FREE_INSET, bounds.height - FREE_SIZE - FREE_BOTTOM);
  return {
    x: FREE_INSET + clamp(position.x, 0, 1) * (maxX - FREE_INSET),
    y: FREE_INSET + clamp(position.y, 0, 1) * (maxY - FREE_INSET),
  };
}

export function normalizeCompanionPosition(
  position: Readonly<{ x: number; y: number }>,
  bounds: CompanionLayerBounds,
): NormalizedCompanionPosition {
  const maxX = Math.max(FREE_INSET, bounds.width - FREE_SIZE - FREE_INSET);
  const maxY = Math.max(FREE_INSET, bounds.height - FREE_SIZE - FREE_BOTTOM);
  return {
    x: maxX === FREE_INSET ? 0 : clamp((position.x - FREE_INSET) / (maxX - FREE_INSET), 0, 1),
    y: maxY === FREE_INSET ? 0 : clamp((position.y - FREE_INSET) / (maxY - FREE_INSET), 0, 1),
  };
}

/**
 * Minimal screen-transition correction. The leading title block is the only shared authored text
 * exclusion across these shell screens; the bottom navigation is already removed from the usable
 * bounds. A drop remains continuous everywhere else and is never snapped to a left/right perch.
 */
export function correctCompanionForScreen(
  screen: ScreenId,
  position: Readonly<{ x: number; y: number }>,
  bounds: CompanionLayerBounds,
): Readonly<{ x: number; y: number }> {
  const maxX = Math.max(FREE_INSET, bounds.width - FREE_SIZE - FREE_INSET);
  const maxY = Math.max(FREE_INSET, bounds.height - FREE_SIZE - FREE_BOTTOM);
  let x = clamp(position.x, FREE_INSET, maxX);
  const y = clamp(position.y, FREE_INSET, maxY);
  const headerScreens: readonly ScreenId[] = [
    'plans',
    'whatif',
    'account',
    'privacy',
    'today-after',
    'timeline',
    'visualizer',
  ];
  // Left-aligned two-line titles occupy this authored header region. Move only the minimum distance
  // to its trailing edge; do not reset the user's vertical choice or spring back to a perch.
  if (
    headerScreens.includes(screen) &&
    x < 252 &&
    y < 174 &&
    x + FREE_SIZE > 16 &&
    y + FREE_SIZE > 48
  ) {
    x = clamp(252, FREE_INSET, maxX);
  }
  return { x, y };
}

type WorkspaceKind = 'personal' | 'business';

const PERSONAL_HEADER_PERCHES: Partial<
  Record<ScreenId, Readonly<{ top: number; bubbleLeft: number; birdLeft: number }>>
> = {
  plans: { top: 68, bubbleLeft: 44, birdLeft: 260 },
  whatif: { top: 68, bubbleLeft: 44, birdLeft: 260 },
  // Account owns a quiet inline character; no roaming bird or greeting over its title.
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
  // Header perches are authored on the trailing side because these screens use a large,
  // leading-aligned title block. Mirroring a persisted left preference puts Melo over that title.
  // Keep the preference in store for screens with two safe anchors, but use the only safe
  // authored header perch here. Connections deliberately has no roaming perch: its two-line title
  // and source cards leave no safe 64dp exclusion zone on the physical S9.
  return personalPerch === undefined ? null : placeOnSide(personalPerch, 'right');
}
