/**
 * Cycle history (MELO_BLUEPRINT.md §4 positive states) — the memory that makes celebration
 * reachable. Winning needs momentum ("another green month"), milestones need to know what has
 * already been celebrated, and the welcome-back overlay needs to know you were away. All three
 * were hardwired false in the app because nothing persisted across pay cycles; this module is
 * that persistence contract, pure and clock-free: cycle records in, derived flags out.
 * Streak, not lifetime: `cyclesEndedPositive` counts CONSECUTIVE recent green cycles, because
 * the blueprint's Winning is momentum — three good months years ago is history, not weather.
 */

import { assertPence, daysBetween, formatPounds, type ISODate, type Pence } from './core.js';

export interface CycleRecord {
  readonly endedISO: ISODate;
  readonly endedPositive: boolean;
  readonly closingSafeZonePence: Pence;
}

export interface MilestoneState {
  readonly reachedIds: readonly string[];
}

export interface CycleInputs {
  readonly todayISO: ISODate;
  readonly history: readonly CycleRecord[];
  readonly lastOpenedISO: ISODate | null;
  readonly recoveryEndISO: ISODate | null;
  readonly bufferPence: Pence;
  readonly savingsPence: Pence;
  readonly reachedMilestoneIds: readonly string[];
}

export interface CycleDerived {
  readonly cyclesEndedPositive: number;
  readonly daysSinceRecoveryEnd: number | null;
  readonly returnedAfterAbsence: boolean;
  readonly newMilestoneIds: readonly string[];
  readonly milestoneLines: readonly string[];
}

/** History depth: two years of monthly cycles is more memory than Winning ever needs. */
const HISTORY_CAP = 24;

/** Ten days away is an absence worth a gentle welcome back — nine is just a busy week. */
const ABSENCE_THRESHOLD_DAYS = 10;

interface MilestoneRung {
  readonly id: string;
  readonly thresholdPence: Pence;
  readonly line: string;
}

/**
 * The milestone ladder (§4 overlays): fixed rungs at £100/£250/£500/£1000 for the buffer and
 * the same for savings, ascending. Each rung carries its own calm line — understated, amount
 * included, no hype — and fires exactly once (reached ids stay silent forever).
 */
const MILESTONE_LADDER: readonly MilestoneRung[] = [
  ...([10_000, 25_000, 50_000, 100_000] as const).map((thresholdPence) => ({
    id: `buffer-${thresholdPence / 100}`,
    thresholdPence,
    line: `Your buffer just passed ${formatPounds(thresholdPence)}. That's real ground under you.`,
  })),
  ...([10_000, 25_000, 50_000, 100_000] as const).map((thresholdPence) => ({
    id: `savings-${thresholdPence / 100}`,
    thresholdPence,
    line: `Savings just passed ${formatPounds(thresholdPence)}. Slow, steady, and working.`,
  })),
];

function sortByEndedAscending(history: readonly CycleRecord[]): readonly CycleRecord[] {
  return [...history].sort((a, b) => daysBetween(b.endedISO, a.endedISO));
}

function assertHistoryPence(history: readonly CycleRecord[]): void {
  for (const record of history) {
    assertPence(record.closingSafeZonePence, `cycle ${record.endedISO} closingSafeZonePence`);
  }
}

/**
 * Consecutive most-recent green cycles — the momentum count behind Winning.
 * A single negative cycle resets it to zero; older wins beyond the break don't count.
 */
function positiveStreak(history: readonly CycleRecord[]): number {
  const ordered = sortByEndedAscending(history);
  let streak = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (!ordered[i]!.endedPositive) break;
    streak += 1;
  }
  return streak;
}

export function deriveCycleState(inputs: CycleInputs): CycleDerived {
  assertPence(inputs.bufferPence, 'bufferPence');
  assertPence(inputs.savingsPence, 'savingsPence');
  assertHistoryPence(inputs.history);

  const reached = new Set(inputs.reachedMilestoneIds);
  const newRungs = MILESTONE_LADDER.filter((rung) => {
    if (reached.has(rung.id)) return false;
    const measured = rung.id.startsWith('buffer-') ? inputs.bufferPence : inputs.savingsPence;
    return measured >= rung.thresholdPence;
  });

  return {
    cyclesEndedPositive: positiveStreak(inputs.history),
    daysSinceRecoveryEnd:
      inputs.recoveryEndISO === null ? null : daysBetween(inputs.recoveryEndISO, inputs.todayISO),
    returnedAfterAbsence:
      inputs.lastOpenedISO !== null &&
      daysBetween(inputs.lastOpenedISO, inputs.todayISO) >= ABSENCE_THRESHOLD_DAYS,
    newMilestoneIds: newRungs.map((rung) => rung.id),
    milestoneLines: newRungs.map((rung) => rung.line),
  };
}

/**
 * Close a pay cycle into history: append the record, dedupe by endedISO (a re-closed day
 * replaces its earlier record — last write wins), and keep only the most recent HISTORY_CAP
 * records. Returns a new array; never mutates the input.
 */
export function closeCycle(
  history: readonly CycleRecord[],
  record: CycleRecord,
): readonly CycleRecord[] {
  assertHistoryPence(history);
  assertPence(record.closingSafeZonePence, `cycle ${record.endedISO} closingSafeZonePence`);

  const kept = history.filter((r) => r.endedISO !== record.endedISO);
  return sortByEndedAscending([...kept, record]).slice(-HISTORY_CAP);
}
