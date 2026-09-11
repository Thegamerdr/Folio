export type PerchSide = 'auto' | 'left' | 'right';
export const PERCH_SIZE = 88;

export function perchTargets(width: number) {
  return {
    left: 0,
    auto: Math.max(0, (width - PERCH_SIZE) / 2),
    right: Math.max(0, width - PERCH_SIZE),
  };
}

/** Only the explicitly reserved lane is a drop target. Money/content outside it
 * is never a valid fallback. Persist semantic preference, not device coordinates.
 */
export function resolvePerchDrop(
  width: number,
  x: number,
  y: number,
  origin: PerchSide,
): PerchSide {
  if (width < PERCH_SIZE || Math.abs(y) > 48) return origin;
  const targets = perchTargets(width);
  const nearest = (Object.keys(targets) as PerchSide[]).sort(
    (a, b) => Math.abs(targets[a] - x) - Math.abs(targets[b] - x),
  )[0]!;
  return Math.abs(targets[nearest] - x) <= 48 ? nearest : origin;
}
