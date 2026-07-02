/**
 * Afford impact (drift-audit fix): the afford check must COMPUTE its forecast, not assert one.
 * "Thursday stays on plan" was copy without arithmetic behind it — this module recomputes the
 * danger date before and after the purchase via projectDangerDate, so any surface claim about
 * the forecast ("creates a storm cell", "moves your danger date 2 days earlier", "stays on
 * plan") is backed by the same engine that draws the forecast in the first place.
 * Verdict thresholds are checkAfford's own (reused, not copied), so afford copy and afford
 * impact can never drift apart.
 */

import { addDays, assertPence, daysBetween, type ISODate, type Pence } from './core.js';
import { projectDangerDate } from './dangerDate.js';
import { checkAfford } from './safeZone.js';

export interface AffordImpactInputs {
  readonly safeZonePence: Pence;
  readonly amountPence: Pence;
  readonly runRatePence: Pence;
  readonly todayISO: ISODate;
  readonly payday: ISODate;
}

export interface AffordImpact {
  readonly verdict: 'safe' | 'tight' | 'notNow';
  readonly leftAfterPence: Pence;
  readonly dangerBefore: ISODate | null;
  readonly dangerAfter: ISODate | null;
  readonly dangerCreated: boolean;
  readonly dangerMovedDays: number;
  readonly safeOnISO: ISODate | null;
}

/**
 * Earliest date on/before payday when the purchase would verdict 'safe', modelling the zone
 * as changing only by the run-rate each day (zone(t) = zone − runRate·t). With a non-negative
 * run-rate the zone never grows, so waiting before payday never helps and the honest answer
 * is payday itself — the next cycle. A negative run-rate (money flowing back in daily) is the
 * only case that yields an earlier date. Verdict per day comes from checkAfford — same
 * thresholds, no reimplementation.
 */
function earliestSafeDate(inputs: AffordImpactInputs): ISODate {
  const daysToPayday = Math.max(0, daysBetween(inputs.todayISO, inputs.payday));
  for (let t = 1; t < daysToPayday; t++) {
    const projectedZonePence = inputs.safeZonePence - inputs.runRatePence * t;
    if (checkAfford(projectedZonePence, inputs.amountPence).verdict === 'safe') {
      return addDays(inputs.todayISO, t);
    }
  }
  return inputs.payday;
}

export function assessAffordImpact(inputs: AffordImpactInputs): AffordImpact {
  assertPence(inputs.safeZonePence, 'safeZonePence');
  assertPence(inputs.runRatePence, 'runRatePence');
  // checkAfford asserts amountPence (integer, > 0) and owns the verdict thresholds.
  const afford = checkAfford(inputs.safeZonePence, inputs.amountPence);

  const before = projectDangerDate({
    safeZonePence: inputs.safeZonePence,
    runRatePence: inputs.runRatePence,
    today: inputs.todayISO,
    payday: inputs.payday,
  });
  const after = projectDangerDate({
    safeZonePence: inputs.safeZonePence - inputs.amountPence,
    runRatePence: inputs.runRatePence,
    today: inputs.todayISO,
    payday: inputs.payday,
  });

  const dangerBefore = before === null ? null : before.date;
  const dangerAfter = after === null ? null : after.date;
  const dangerCreated = before === null && after !== null;
  const dangerMovedDays =
    before !== null && after !== null ? daysBetween(after.date, before.date) : 0;

  const safeOnISO = afford.verdict === 'notNow' ? earliestSafeDate(inputs) : null;

  return {
    verdict: afford.verdict,
    leftAfterPence: afford.leftAfterPence,
    dangerBefore,
    dangerAfter,
    dangerCreated,
    dangerMovedDays,
    safeOnISO,
  };
}
