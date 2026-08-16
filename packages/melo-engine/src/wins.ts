/**
 * Tiny wins (MELO_BLUEPRINT.md §2 P10): wins are NOTICED, never claimed — zero-effort reward.
 * Detection is a pure diff of two snapshots; the store remembers what was already won so each
 * win fires exactly once. Celebration is understated by law: the line does the talking, no
 * exclamation marks, and checking-before-buying is praised over the purchase outcome (§16.1).
 */

import type { JourneyState, LadderState } from './states.js';

export type WinId =
  | 'first-safe-zone'
  | 'first-check'
  | 'five-checks-week'
  | 'first-ritual'
  | 'first-spend-logged'
  | 'storm-passed'
  | 'recovery-completed'
  | 'buffer-500';

export interface WinEvent {
  readonly id: WinId;
  readonly line: string;
}

export const WIN_LINES: Record<WinId, string> = {
  'first-safe-zone': 'You know your real number. Most people never do.',
  'first-check': 'You checked before buying. That’s the habit that changes everything.',
  'five-checks-week': 'Five checks this week. The habit is real now.',
  'first-ritual': 'First payday ritual done — the month is protected.',
  'first-spend-logged': 'First spend logged. The forecast just got sharper.',
  'storm-passed': 'You got to the other side. Storm’s over.',
  'recovery-completed': 'The way back, walked. Day by day.',
  'buffer-500': '£500 spare. The boring miracle.',
};

export interface WinSnapshot {
  readonly onboarded: boolean;
  readonly checksThisWeek: number;
  readonly ritualDone: boolean;
  readonly spendCount: number;
  readonly ladder: LadderState;
  readonly journey: JourneyState;
  readonly safeZonePence: number;
}

const STORMY: readonly LadderState[] = ['danger', 'overspent'];

export function detectWins(
  prev: WinSnapshot | null,
  next: WinSnapshot,
  alreadyWon: readonly string[],
): WinEvent[] {
  const events: WinEvent[] = [];
  const push = (id: WinId, when: boolean) => {
    if (when && !alreadyWon.includes(id)) events.push({ id, line: WIN_LINES[id] });
  };

  push('first-safe-zone', next.onboarded);
  push('first-check', next.checksThisWeek >= 1);
  push('five-checks-week', next.checksThisWeek >= 5);
  push('first-ritual', next.ritualDone);
  push('first-spend-logged', next.spendCount >= 1);
  push(
    'storm-passed',
    prev !== null && STORMY.includes(prev.ladder) && !STORMY.includes(next.ladder),
  );
  push(
    'recovery-completed',
    prev !== null && prev.journey === 'rebuilding' && next.journey === 'none',
  );
  push('buffer-500', next.safeZonePence >= 50_000);

  return events;
}
