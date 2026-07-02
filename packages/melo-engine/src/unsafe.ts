/**
 * Structural shortfall (MELO_BLUEPRINT.md — the honest "this cycle doesn't fit" flow).
 * This state is NOT overspending: the user's bills plus bare essentials exceed what they
 * have, so recovery copy ("here's the way back") would be subtly wrong and quietly cruel.
 * The engine says so plainly, offers at most three moves derived only from the user's real
 * numbers (never invented), and — when the shortfall repeats — signposts free debt help
 * (StepChange, Citizens Advice) as fact, not as a pitch. Deterministic, dependency-free:
 * money is integer pence, dates are ISO strings, no clock.
 */

import { assertPence, daysBetween, formatPounds, type ISODate, type Pence } from './core.js';

export interface UnsafeInputs {
  readonly todayISO: ISODate;
  readonly payday: ISODate;
  readonly incomePence: Pence;
  readonly balancePence: Pence;
  readonly shieldedBillsPence: Pence;
  readonly essentialsPerDayPence: Pence;
  readonly daysToPayday: number;
  readonly bills: readonly {
    readonly name: string;
    readonly amountPence: Pence;
    readonly dueDate: ISODate;
  }[];
  readonly structuralCycleCount: number;
}

export interface UnsafeOption {
  readonly id: 'shiftBill' | 'trimEssentials' | 'pauseSmallest';
  readonly title: string;
  readonly body: string;
}

export interface UnsafeState {
  readonly structural: boolean;
  readonly gapPence: Pence;
  readonly options: readonly UnsafeOption[];
  readonly signpost: boolean;
  readonly signpostLines: readonly string[];
}

const TRIM_PERCENT = 15; // the essentials trim we ever suggest — a stretch, not a starvation
const OPTION_GAP_QUARTER = 4; // an option must close at least a quarter of the gap to be worth naming
const SIGNPOST_CYCLE_THRESHOLD = 2; // one bad cycle is weather; two is structural — time to name free help

/**
 * Free, real, and not ours: the two lines only ever shown when the shortfall is structural
 * and repeating. Factual and warm — nothing here is being sold.
 */
const SIGNPOST_LINES: readonly string[] = [
  'When bills outrun income for more than one cycle, that is the maths, not your choices. StepChange gives free debt advice — 0800 138 1111, or stepchange.org.',
  'Citizens Advice is free too, for debts, bills, and what comes next. Neither of these sells anything — helping is the whole job.',
];

/**
 * The structural verdict and its honest moves. Structural means even bare essentials cannot
 * close the cycle: balance < shielded bills + essentials × days (no mid-cycle income in v1 —
 * `incomePence` is carried for the v2 mid-cycle model). The gap is exact pence; options are
 * ranked by how much of the gap each one actually closes.
 */
export function assessUnsafe(inputs: UnsafeInputs): UnsafeState {
  assertPence(inputs.incomePence, 'incomePence');
  assertPence(inputs.balancePence, 'balancePence');
  assertPence(inputs.shieldedBillsPence, 'shieldedBillsPence');
  assertPence(inputs.essentialsPerDayPence, 'essentialsPerDayPence');
  for (const bill of inputs.bills) assertPence(bill.amountPence, `bill ${bill.name} amountPence`);
  daysBetween(inputs.todayISO, inputs.payday); // fail fast on a malformed date

  const requiredPence =
    inputs.shieldedBillsPence + inputs.essentialsPerDayPence * inputs.daysToPayday;
  const structural = inputs.balancePence < requiredPence;
  const gapPence = structural ? requiredPence - inputs.balancePence : 0;

  if (!structural) {
    return { structural, gapPence, options: [], signpost: false, signpostLines: [] };
  }

  const signpost = inputs.structuralCycleCount >= SIGNPOST_CYCLE_THRESHOLD;
  return {
    structural,
    gapPence,
    options: rankedOptions(inputs, gapPence),
    signpost,
    signpostLines: signpost ? SIGNPOST_LINES : [],
  };
}

interface Candidate {
  readonly option: UnsafeOption;
  readonly impactPence: Pence;
  readonly tieRank: number;
}

/** Every applicable option, sorted by impact (pence of gap closed), largest first. */
function rankedOptions(inputs: UnsafeInputs, gapPence: Pence): readonly UnsafeOption[] {
  const candidates: Candidate[] = [];
  const shift = shiftBillOption(inputs, gapPence);
  if (shift) candidates.push(shift);
  const trim = trimEssentialsOption(inputs, gapPence);
  if (trim) candidates.push(trim);
  const pause = pauseSmallestOption(inputs, gapPence);
  if (pause) candidates.push(pause);

  return candidates
    .sort((a, b) => b.impactPence - a.impactPence || a.tieRank - b.tieRank)
    .slice(0, 3)
    .map((c) => c.option);
}

/** A bill counts for this cycle when it falls on or after today and strictly before payday. */
function isInCycle(inputs: UnsafeInputs, dueDate: ISODate): boolean {
  return daysBetween(inputs.todayISO, dueDate) >= 0 && daysBetween(dueDate, inputs.payday) > 0;
}

/**
 * Option 1 — move a bill past payday. Only offered when a real in-cycle bill exists whose
 * amount closes at least a quarter of the gap; the largest such bill is the one we name.
 */
function shiftBillOption(inputs: UnsafeInputs, gapPence: Pence): Candidate | null {
  const qualifying = inputs.bills
    .filter((b) => isInCycle(inputs, b.dueDate) && b.amountPence * OPTION_GAP_QUARTER >= gapPence)
    .sort((a, b) => b.amountPence - a.amountPence);
  const bill = qualifying[0];
  if (!bill) return null;
  return {
    impactPence: bill.amountPence,
    tieRank: 0,
    option: {
      id: 'shiftBill',
      title: 'Move one bill past payday',
      body: `${bill.name} (${formatPounds(bill.amountPence)}) is due before payday. Providers will usually move a due date if you ask — shifting it to after payday keeps that ${formatPounds(bill.amountPence)} in this cycle.`,
    },
  };
}

/**
 * Option 2 — trim essentials by 15% for the stretch to payday. Offered only when the trim
 * actually closes at least a quarter of the gap; both per-day figures are stated exactly.
 */
function trimEssentialsOption(inputs: UnsafeInputs, gapPence: Pence): Candidate | null {
  const trimPerDayPence = Math.floor((inputs.essentialsPerDayPence * TRIM_PERCENT) / 100);
  const totalTrimPence = trimPerDayPence * Math.max(inputs.daysToPayday, 0);
  if (totalTrimPence <= 0 || totalTrimPence * OPTION_GAP_QUARTER < gapPence) return null;
  const trimmedPerDayPence = inputs.essentialsPerDayPence - trimPerDayPence;
  return {
    impactPence: totalTrimPence,
    tieRank: 1,
    option: {
      id: 'trimEssentials',
      title: 'Trim the daily essentials',
      body: `Essentials are planned at ${formatPounds(inputs.essentialsPerDayPence)}/day. Trimming to ${formatPounds(trimmedPerDayPence)}/day until payday frees ${formatPounds(totalTrimPence)} toward the gap.`,
    },
  };
}

/**
 * Option 3 — pause the smallest in-cycle bill for one cycle. Offered only when that bill is
 * no larger than the gap itself (pausing more than the gap would be theatre, not help).
 */
function pauseSmallestOption(inputs: UnsafeInputs, gapPence: Pence): Candidate | null {
  const inCycle = inputs.bills
    .filter((b) => isInCycle(inputs, b.dueDate))
    .sort((a, b) => a.amountPence - b.amountPence);
  const bill = inCycle[0];
  if (!bill || bill.amountPence > gapPence) return null;
  return {
    impactPence: bill.amountPence,
    tieRank: 2,
    option: {
      id: 'pauseSmallest',
      title: 'Pause the smallest bill',
      body: `${bill.name} (${formatPounds(bill.amountPence)}) is the smallest bill this cycle. Pausing it for one cycle is a real option — providers would rather hear from you than not.`,
    },
  };
}
