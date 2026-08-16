import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const MELO_MOTION = {
  routeDraw: { durationMs: 2200, easing: 'ease-out' },
  countUp: { durationMs: 700, easing: 'cubic-out' },
  pebbleBreathe: { durationMs: 4000, easing: 'ease-in-out' },
  pebbleBreatheFast: { durationMs: 2200, easing: 'ease-in-out' },
  pebbleBlink: { durationMs: 5000, easing: 'step' },
  sheetRise: { durationMs: 480, easing: 'cubic-bezier(.16,1,.3,1)' },
  scrimIn: { durationMs: 320, easing: 'ease-out' },
  verdictStamp: { durationMs: 600, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  slide: { durationMs: 360, easing: 'cubic-bezier(.16,1,.3,1)' },
  scaleIn: { durationMs: 320, easing: 'cubic-bezier(.16,1,.3,1)' },
  fadeIn: { durationMs: 220, easing: 'cubic-bezier(.16,1,.3,1)' },
  calloutIn: { durationMs: 600, delayMs: 1400, easing: 'ease-out' },
  pulseRing: { durationMs: 1800, easing: 'ease-out' },
  pointerNudge: { durationMs: 1600, easing: 'ease-in-out' },
  press: { durationMs: 120, scale: 0.97, easing: 'ease' },
} as const;

/** Reduced motion always resolves elements to their final state immediately. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduced(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
