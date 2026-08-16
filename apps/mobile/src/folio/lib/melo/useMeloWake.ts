import { useEffect, useRef, useState } from 'react';

export type WakePhase = 'settled' | 'warming' | 'expanding' | 'revealing';

/** Fires only for Quiet Mode true → false; cold starts remain settled. */
export function useMeloWake(quietMode: boolean, reduceMotion: boolean): WakePhase {
  const [phase, setPhase] = useState<WakePhase>('settled');
  const previous = useRef(quietMode);

  useEffect(() => {
    const wasAsleep = previous.current;
    previous.current = quietMode;
    if (!(wasAsleep && !quietMode)) return undefined;
    if (reduceMotion) {
      setPhase('settled');
      return undefined;
    }
    setPhase('warming');
    const expandTimer = setTimeout(() => setPhase('expanding'), 200);
    const revealTimer = setTimeout(() => setPhase('revealing'), 400);
    const settleTimer = setTimeout(() => setPhase('settled'), 600);
    return () => {
      clearTimeout(expandTimer);
      clearTimeout(revealTimer);
      clearTimeout(settleTimer);
    };
  }, [quietMode, reduceMotion]);

  return phase;
}
