export type Rect = { x: number; y: number; width: number; height: number };
export function visibleMeloFraction(slot: Rect, viewport: Rect): number {
  if (slot.width <= 0 || slot.height <= 0) return 0;
  const width = Math.max(
    0,
    Math.min(slot.x + slot.width, viewport.x + viewport.width) - Math.max(slot.x, viewport.x),
  );
  const height = Math.max(
    0,
    Math.min(slot.y + slot.height, viewport.y + viewport.height) - Math.max(slot.y, viewport.y),
  );
  return Math.min(1, (width * height) / (slot.width * slot.height));
}
export function shouldTuckMelo(wasTucked: boolean, visibleFraction: number): boolean {
  // Pass40 supersedes the old40/80 band: a partially clipped body must never remain.
  // Restoration is separately debounced until scrolling settles.
  return visibleFraction < (wasTucked ? 1 : 0.9999);
}
