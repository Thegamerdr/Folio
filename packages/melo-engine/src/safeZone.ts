/**
 * The Safe Zone formula (MELO_BLUEPRINT.md §2 P1):
 *   safeZone = balance − shielded bills − essentials to payday − committed savings − buffer
 * BNPL installments and debt payments are bills (§13 risk 11). The breakdown rows must sum
 * EXACTLY to the result — the "show the math" sheet (§5.2 screen 9) renders these rows verbatim
 * and an inspectable number is a forgivable number.
 */

import { assertPence, daysBetween, type ISODate, type Pence } from './core.js';

export type BillKind = 'bill' | 'bnpl' | 'debt';

export interface Bill {
  readonly id: string;
  readonly name: string;
  readonly amountPence: Pence;
  readonly dueDate: ISODate;
  readonly kind: BillKind;
  readonly paid?: boolean;
}

export interface SafeZoneInputs {
  readonly balancePence: Pence;
  readonly today: ISODate;
  readonly payday: ISODate;
  readonly bills: readonly Bill[];
  readonly essentialsPerDayPence: Pence;
  readonly savingsCommittedPence: Pence;
  readonly bufferPence: Pence;
}

export interface BreakdownRow {
  readonly key: 'balance' | 'bills' | 'essentials' | 'savings' | 'buffer';
  readonly amountPence: Pence; // signed; rows sum exactly to safeZonePence
}

export interface SafeZoneResult {
  readonly safeZonePence: Pence; // negative allowed — honesty over comfort (§4 Overspent)
  readonly perDayPence: Pence; // 0 when nothing spare or no days left
  readonly daysToPayday: number; // ≥ 0
  readonly shieldedBillsPence: Pence;
  readonly essentialsPence: Pence;
  readonly breakdown: readonly BreakdownRow[];
}

/**
 * Bills belonging to this cycle: unpaid, due on/after today and strictly before payday.
 * A bill due ON payday belongs to the next cycle — payday refills the pot first.
 */
export function billsInCycle(
  bills: readonly Bill[],
  today: ISODate,
  payday: ISODate,
): readonly Bill[] {
  return bills.filter(
    (b) => !b.paid && daysBetween(today, b.dueDate) >= 0 && daysBetween(b.dueDate, payday) > 0,
  );
}

export function computeSafeZone(inputs: SafeZoneInputs): SafeZoneResult {
  assertPence(inputs.balancePence, 'balancePence');
  assertPence(inputs.essentialsPerDayPence, 'essentialsPerDayPence');
  assertPence(inputs.savingsCommittedPence, 'savingsCommittedPence');
  assertPence(inputs.bufferPence, 'bufferPence');
  for (const b of inputs.bills) assertPence(b.amountPence, `bill ${b.id} amountPence`);

  const daysToPayday = Math.max(0, daysBetween(inputs.today, inputs.payday));
  const shielded = billsInCycle(inputs.bills, inputs.today, inputs.payday);
  const shieldedBillsPence = shielded.reduce((sum, b) => sum + b.amountPence, 0);
  const essentialsPence = inputs.essentialsPerDayPence * daysToPayday;

  const safeZonePence =
    inputs.balancePence -
    shieldedBillsPence -
    essentialsPence -
    inputs.savingsCommittedPence -
    inputs.bufferPence;

  const perDayPence =
    daysToPayday > 0 && safeZonePence > 0 ? Math.floor(safeZonePence / daysToPayday) : 0;

  const breakdown: readonly BreakdownRow[] = [
    { key: 'balance', amountPence: inputs.balancePence },
    { key: 'bills', amountPence: -shieldedBillsPence },
    { key: 'essentials', amountPence: -essentialsPence },
    { key: 'savings', amountPence: -inputs.savingsCommittedPence },
    { key: 'buffer', amountPence: -inputs.bufferPence },
  ];

  return {
    safeZonePence,
    perDayPence,
    daysToPayday,
    shieldedBillsPence,
    essentialsPence,
    breakdown,
  };
}

/** The afford-check verdict (§2 P8): Safe / Tight / Not now, always with what's left after. */
export type AffordVerdict = 'safe' | 'tight' | 'notNow';

export interface AffordResult {
  readonly verdict: AffordVerdict;
  readonly leftAfterPence: Pence;
  readonly shelfEligible: boolean; // Shelf offered on tight and notNow (§5.2 screen 13)
}

export function checkAfford(safeZonePence: Pence, amountPence: Pence): AffordResult {
  assertPence(amountPence, 'amountPence');
  if (amountPence <= 0) throw new Error(`amountPence must be positive, got ${amountPence}`);
  const leftAfterPence = safeZonePence - amountPence;
  const verdict: AffordVerdict =
    amountPence <= safeZonePence * 0.45
      ? 'safe'
      : amountPence <= safeZonePence
        ? 'tight'
        : 'notNow';
  return { verdict, leftAfterPence, shelfEligible: verdict !== 'safe' };
}
