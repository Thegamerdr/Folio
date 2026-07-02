/**
 * Danger date (MELO_BLUEPRINT.md §2 P7): the projected day discretionary money hits £0
 * before payday at the observed run-rate. Bills are already reserved by the Safe Zone,
 * so this is purely spend-vs-spare. Confidence is honest: "around Thursday", never "14:32".
 */

import { addDays, assertPence, daysBetween, type ISODate, type Pence } from './core.js';

export interface DangerInputs {
  readonly safeZonePence: Pence;
  readonly runRatePence: Pence; // observed discretionary spend per day
  readonly today: ISODate;
  readonly payday: ISODate;
}

export interface DangerProjection {
  readonly date: ISODate;
  readonly daysAway: number;
  readonly confidence: 'high' | 'approx';
}

export function projectDangerDate(inputs: DangerInputs): DangerProjection | null {
  assertPence(inputs.runRatePence, 'runRatePence');
  const daysToPayday = Math.max(0, daysBetween(inputs.today, inputs.payday));
  if (daysToPayday === 0) return null; // payday today — this cycle is over
  if (inputs.safeZonePence <= 0) {
    return { date: inputs.today, daysAway: 0, confidence: 'high' };
  }
  if (inputs.runRatePence <= 0) return null; // not spending → nothing runs out
  const daysUntilZero = Math.floor(inputs.safeZonePence / inputs.runRatePence);
  if (daysUntilZero >= daysToPayday) return null; // money outlasts the cycle
  return {
    date: addDays(inputs.today, daysUntilZero),
    daysAway: daysUntilZero,
    confidence: daysUntilZero <= 2 ? 'high' : 'approx',
  };
}

/** Runway in days at the current run-rate; null = not spending (infinite runway). */
export function runwayDays(safeZonePence: Pence, runRatePence: Pence): number | null {
  if (runRatePence <= 0) return null;
  if (safeZonePence <= 0) return 0;
  return Math.floor(safeZonePence / runRatePence);
}
