/**
 * What changed (MELO_BLUEPRINT.md — honest diff): the short list of things that genuinely
 * moved between two snapshots. No fabrication and no noise — a wobble under the threshold
 * is not "news", and a quiet day returns []. Every line is derived straight from the inputs
 * via formatPounds; nothing is invented, nothing is rounded in the wrong direction.
 */

import { assertPence, formatPounds, type Pence } from './core.js';
import { lintCopy } from './copy.js';

export interface WhatChangedItem {
  readonly id: string;
  readonly line: string;
}

export interface WhatChangedSnapshot {
  readonly balancePence: Pence;
  readonly dangerDaysAway: number | null;
  readonly safeZonePence: Pence;
}

export interface WhatChangedContext {
  readonly runRatePence: Pence | null;
  readonly billLandedName: string | null;
}

const BALANCE_MOVE_THRESHOLD_PENCE = 25_00; // £25 — below this, it is noise, not news

function assertSnapshot(snap: WhatChangedSnapshot, label: string): void {
  assertPence(snap.balancePence, `${label}.balancePence`);
  assertPence(snap.safeZonePence, `${label}.safeZonePence`);
}

/** Balance moved by more than £25, either direction. */
function diffBalance(prev: WhatChangedSnapshot, next: WhatChangedSnapshot): WhatChangedItem | null {
  const movedPence = next.balancePence - prev.balancePence;
  if (Math.abs(movedPence) <= BALANCE_MOVE_THRESHOLD_PENCE) return null;
  const line =
    movedPence > 0
      ? `Balance is up ${formatPounds(movedPence)}, now ${formatPounds(next.balancePence)}.`
      : `Balance is down ${formatPounds(-movedPence)}, now ${formatPounds(next.balancePence)}.`;
  return { id: 'balanceMoved', line };
}

/** A danger date appeared, cleared, or moved — both earlier and later are worth saying. */
function diffDangerDate(
  prev: WhatChangedSnapshot,
  next: WhatChangedSnapshot,
): WhatChangedItem | null {
  const prevDays = prev.dangerDaysAway;
  const nextDays = next.dangerDaysAway;
  if (prevDays === nextDays) return null;

  if (prevDays === null && nextDays !== null) {
    const dayWord = nextDays === 1 ? 'day' : 'days';
    return { id: 'dangerAppeared', line: `A tight day now shows up, ${nextDays} ${dayWord} away.` };
  }
  if (prevDays !== null && nextDays === null) {
    return { id: 'dangerCleared', line: 'The tight day cleared off the map.' };
  }
  // Both non-null and different — moved earlier or later.
  if (prevDays !== null && nextDays !== null) {
    if (nextDays < prevDays) {
      return {
        id: 'dangerMovedEarlier',
        line: `The tight day moved closer, now ${nextDays} days away.`,
      };
    }
    return {
      id: 'dangerMovedLater',
      line: `The tight day moved further out, now ${nextDays} days away.`,
    };
  }
  return null;
}

/** Safe zone crossed zero, either direction. */
function diffSafeZoneCrossing(
  prev: WhatChangedSnapshot,
  next: WhatChangedSnapshot,
): WhatChangedItem | null {
  const prevBelow = prev.safeZonePence < 0;
  const nextBelow = next.safeZonePence < 0;
  if (prevBelow === nextBelow) return null;
  const line = nextBelow
    ? 'The safe zone dropped below zero.'
    : `The safe zone is back above zero, at ${formatPounds(next.safeZonePence)}.`;
  return { id: 'safeZoneCrossedZero', line };
}

/** A bill landed — named, once, from the caller-supplied context. */
function diffBillLanded(ctx: WhatChangedContext): WhatChangedItem | null {
  if (ctx.billLandedName === null) return null;
  return { id: 'billLanded', line: `${ctx.billLandedName} landed.` };
}

/**
 * The honest diff between two snapshots. Returns [] when nothing real moved — most checks,
 * nothing did. Order is balance, danger date, safe-zone crossing, bill landed.
 */
export function diffChanges(
  prev: WhatChangedSnapshot | null,
  next: WhatChangedSnapshot,
  ctx: WhatChangedContext,
): WhatChangedItem[] {
  assertSnapshot(next, 'next');
  if (ctx.runRatePence !== null) assertPence(ctx.runRatePence, 'ctx.runRatePence');
  if (prev === null) return [];
  assertSnapshot(prev, 'prev');

  const items = [
    diffBalance(prev, next),
    diffDangerDate(prev, next),
    diffSafeZoneCrossing(prev, next),
    diffBillLanded(ctx),
  ].filter((item): item is WhatChangedItem => item !== null);

  for (const item of items) {
    const violations = lintCopy(item.line);
    if (violations.length > 0) {
      throw new Error(`whatChanged line "${item.line}" failed lintCopy: ${violations.join(', ')}`);
    }
  }

  return items;
}
