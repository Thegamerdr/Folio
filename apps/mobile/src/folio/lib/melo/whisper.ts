/** Weekly Sun/Mon Melo observation, ported from the live Lovable source. */
import type { CycleRecord, Sub } from '../../store';
import { computeGreenStreak } from '../streaks';

export type WhisperInputs = {
  now: Date;
  quietMode: boolean;
  subs: readonly Sub[];
  subPaused: Readonly<Record<string, boolean>>;
  tightestSpare: number;
  cycles: readonly CycleRecord[];
};

export type Whisper = {
  key: string;
  line: string;
} | null;

export function deriveWhisper(inputs: WhisperInputs): Whisper {
  if (inputs.quietMode) return null;
  const day = inputs.now.getDay();
  if (day !== 0 && day !== 1) return null;

  const streak = computeGreenStreak(inputs.cycles);
  if (streak >= 3) {
    return {
      key: `streak-${streak}`,
      line: 'Three cycles in the safe zone. Quiet, steady, yours.',
    };
  }

  const pausedCount = inputs.subs.filter((sub) => inputs.subPaused[sub.name]).length;
  if (pausedCount >= 2) {
    return {
      key: `paused-${pausedCount}`,
      line: `${pausedCount} things are resting this week. The path breathes easier.`,
    };
  }

  if (inputs.tightestSpare > 0 && inputs.tightestSpare < 40) {
    return {
      key: `thin-${Math.round(inputs.tightestSpare)}`,
      line: 'The path is thin near payday. Nothing broken — worth a look.',
    };
  }

  if (inputs.tightestSpare >= 200) {
    return {
      key: `room-${Math.round(inputs.tightestSpare)}`,
      line: 'Real headroom this cycle. A gentle window to top up a pot.',
    };
  }

  return null;
}
