// Shared count-up tween for the pressure-map surfaces (Quiet Paper Luxury).
//
// One hook, used by Pots, Subscriptions and Today, so the easeOutCubic count-up behaves
// identically everywhere — and, crucially, honours the user's reduced-motion preference on
// every surface (previously only Subscriptions did). When reduced motion is on, the figure
// jumps straight to its target with no animation; otherwise it settles up to the target with
// the same cubic ease-out the web's useCountUp uses.
//
// Curve/timing match the prior local copies exactly: a calm easeOutCubic (1 - (1-t)^3) over
// `durationMs`. The value starts at — and on the very first frame returns — the target, so
// there is no mount flourish; it animates only when the target changes (the existing Pots and
// Today behaviour). Pure requestAnimationFrame, cleaned up on unmount / dep change.

import { useEffect, useRef, useState } from 'react';

// Default tween length, in ms. Callers pass their own (Pots 700, Today 500, Subscriptions 600).
const DEFAULT_DURATION_MS = 600;

export function useCountUp(
  target: number,
  durationMs: number = DEFAULT_DURATION_MS,
  reduceMotion: boolean = false,
): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Reduced motion (or a zero/negative duration): no animation — snap to the target.
    if (reduceMotion || durationMs <= 0) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    let start: number | null = null;
    const tick = (frameTime: number) => {
      // requestAnimationFrame supplies a monotonic clock. Wall-clock time can jump when the device
      // corrects its time and is deliberately frozen by the deterministic parity harness.
      if (start === null) start = frameTime;
      const elapsed = frameTime - start;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic — a calm settle, never a linear crawl.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, reduceMotion]);

  return value;
}
