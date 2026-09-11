/** Native geometry and timing from the ad90b4 reference, reconciled by Lovable PASS51. */
import type { Rect } from './scrollOwner';

export const PRESENCE_TIMING = {
  wait: 1200,
  peek: 240,
  move: 260,
  leave: 180,
  settle: 180,
  coveredLeave: 120,
  coveredCross: 80,
  stillAfterEngagement: 6000,
} as const;
export type PresencePhase =
  | 'hidden'
  | 'waiting'
  | 'entering'
  | 'peeking'
  | 'perched'
  | 'leaving'
  | 'moving';

function overlaps(a: Rect, b: Rect, margin = 8) {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
}

/** Test the actual cubic travel + quadratic lift, including its settling
 * overshoot. Adjacent samples enclose the swept body, with a 1px curvature guard. */
export function hasSafeMotionCorridor(from: Rect, to: Rect, exclusions: readonly Rect[]) {
  const { arc, overshoot } = motionBetween(from, to);
  let last = from;
  for (let step = 0; step <= 240; step++) {
    const p = step / 240;
    const travel = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
    const half = p < 0.5 ? p * 2 : (p - 0.5) * 2;
    const lift = p < 0.5 ? -arc * (1 - (1 - half) ** 2) : -arc + (arc + overshoot) * half ** 2;
    const box = {
      x: from.x + (to.x - from.x) * travel,
      y: from.y + (to.y - from.y) * travel + lift,
      width: Math.max(from.width, to.width),
      height: Math.max(from.height, to.height),
    };
    const swept = {
      x: Math.min(last.x, box.x),
      y: Math.min(last.y, box.y),
      width: Math.max(last.x + last.width, box.x + box.width) - Math.min(last.x, box.x),
      height: Math.max(last.y + last.height, box.y + box.height) - Math.min(last.y, box.y),
    };
    if (exclusions.some((other) => overlaps(swept, other, 9))) return false;
    last = box;
  }
  // The final 180ms settles from the overshoot to the anchor.
  return !exclusions.some((other) => overlaps({ ...to, height: to.height + overshoot }, other));
}
export function motionBetween(from: Rect, to: Rect) {
  const dx = to.x + to.width / 2 - from.x - from.width / 2;
  const dy = to.y + to.height / 2 - from.y - from.height / 2;
  const distance = Math.hypot(dx, dy);
  return {
    distance,
    duration: Math.max(320, Math.min(1100, 220 + distance * 1.2)),
    arc: Math.max(8, Math.min(80, distance * 0.18)),
    faceLeft: dx < 0,
    overshoot: distance > 240 ? 6 : 3,
  };
}
export function safePresenceRect(rect: Rect, shell: Rect, exclusions: readonly Rect[] = []) {
  if (![rect, shell, ...exclusions].every((box) => Object.values(box).every(Number.isFinite)))
    return false;
  if (rect.width < 48 || rect.height < 48) return false;
  if (
    rect.x < shell.x + 6 ||
    rect.y < shell.y + 6 ||
    rect.x + rect.width > shell.x + shell.width - 6 ||
    rect.y + rect.height > shell.y + shell.height - 6
  )
    return false;
  return exclusions.every(
    (other) =>
      rect.x + rect.width + 8 <= other.x ||
      other.x + other.width + 8 <= rect.x ||
      rect.y + rect.height + 8 <= other.y ||
      other.y + other.height + 8 <= rect.y,
  );
}

export function resolvePresenceTarget(slot: Rect, viewport: Rect, exclusions: readonly Rect[]) {
  return (
    [60, 48]
      .map((size) => ({
        x: slot.x + (slot.width - size) / 2,
        y: slot.y + (slot.height - (size * 208) / 192) / 2,
        width: size,
        height: (size * 208) / 192,
      }))
      .find(
        (candidate) =>
          slot.width >= candidate.width &&
          slot.height >= candidate.height &&
          safePresenceRect(candidate, viewport, exclusions),
      ) ?? null
  );
}

/** The alternate semantic edge is valid only after the context reflows beside it. */
export function resolvePresenceDrop(
  width: number,
  preferred: 'left' | 'right' | 'auto',
  dx: number,
  dy: number,
) {
  if (![width, dx, dy].every(Number.isFinite) || Math.abs(dy) > 48 || width < 152) return null;
  const current = preferred === 'left' ? 0 : width - 76;
  const endpoint = current + dx;
  const side = Math.abs(endpoint) < Math.abs(endpoint - (width - 76)) ? 'left' : 'right';
  if (Math.abs(endpoint - (side === 'left' ? 0 : width - 76)) > 48) return null;
  if ((side === 'left') === (preferred === 'left')) return null;
  return side;
}
