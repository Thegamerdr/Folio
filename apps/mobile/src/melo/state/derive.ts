// Real-data derivation: MeloSetup (what the user told us) → engine inputs → view + copy context.
// The ENGINE stays clock-free and pure; this file is the surface layer that owns the device
// clock and date formatting. Payday weekend-shift handling is a known v1 gap (MELO_BLUEPRINT.md
// §13 risk 16) — dates land on the literal day-of-month for now.

import {
  addDays,
  assessUnsafe,
  computeSafeZone,
  daysBetween,
  deriveCycleState,
  formatPounds,
  observedRunRatePence,
  projectDangerDate,
  recoveryMovePence,
  runwayDays,
  shiftWeekendToFriday,
  type Bill,
  type CopyContext,
  type ISODate,
  type SafeZoneResult,
  type StateInputs,
  type UnsafeState,
} from '@folio/melo-engine';

import type { RunwayBill } from '../components/RunwayStrip';
import type { MeloSetup, MeloState } from './meloStore';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoFor(year: number, monthIndex: number, day: number): ISODate {
  const normalized = new Date(year, monthIndex, day);
  return todayISO(normalized);
}

/** Next occurrence of a day-of-month (1..28), strictly AFTER today if today IS that day —
 *  on payday itself the cycle has rolled, so the next payday is next month's. */
export function nextPaydayISO(paydayDay: number, today: ISODate): ISODate {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  if (d < paydayDay) return isoFor(y, m - 1, paydayDay);
  return isoFor(y, m, paydayDay); // next month (monthIndex m = m-1 + 1)
}

/** Next occurrence of a bill's day-of-month on/after today. */
export function nextDueISO(dueDay: number, today: ISODate): ISODate {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  if (d <= dueDay) return isoFor(y, m - 1, dueDay);
  return isoFor(y, m, dueDay);
}

/** "Fri the 12th" — the label style the copy system speaks in. */
export function dayLabel(date: ISODate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()] ?? '';
  return `${weekday} the ${ordinal(d)}`;
}

/** "Thursday"-style single word for danger days. */
export function weekdayWord(date: ISODate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return long[new Date(y, m - 1, d).getDay()] ?? 'soon';
}

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

/** One bill's place in the current cycle, for the Bills Shield surface (§2 P9). */
export interface ShieldBillView {
  readonly name: string;
  readonly amountPence: number;
  readonly dueDate: ISODate;
  readonly dueLabel: string;
  readonly status: 'landed' | 'dueToday' | 'shielded';
}

export interface ShieldView {
  readonly bills: readonly ShieldBillView[];
  /** Still-to-land bills this cycle (what the shield is currently holding). */
  readonly shieldedPence: number;
  /** How much of that the balance actually covers. */
  readonly coveredPence: number;
  readonly covered: boolean;
}

export interface LiveDerived {
  readonly today: ISODate;
  readonly payday: ISODate;
  readonly paydayLabel: string;
  readonly safeZone: SafeZoneResult;
  readonly inputs: StateInputs;
  readonly ctx: CopyContext;
  readonly runwayBills: readonly RunwayBill[];
  readonly dangerDayOffset: number | null;
  /** The recovery "one move today", derived from the actual overshoot (never hardcoded). */
  readonly recoveryMove: number;
  /** Whether the forecast runs on observed spending or the essentials plan. */
  readonly runRateSource: 'observed' | 'planned';
  /** The observed run-rate itself; null until the log has enough distinct days. */
  readonly observedRunRatePence: number | null;
  /** True only when the balance actually covers the shielded bills — "bills are safe" is
   *  never asserted unchecked (§13 risk 3). */
  readonly billsCovered: boolean;
  readonly shield: ShieldView;
  /** Current cycle's start (the payday occurrence on/before today) — rollover anchor. */
  readonly cycleStart: ISODate;
  /** Fresh milestone celebrations (ids + linted lines) — surface fires once, then records. */
  readonly newMilestoneIds: readonly string[];
  readonly milestoneLines: readonly string[];
  /** Savings actually committed THIS cycle (0 when the ritual beat declined it). */
  readonly savingsThisCyclePence: number;
  /** Structural-shortfall assessment (audit: the engine existed but nothing called it —
   *  the honest "this cycle doesn't fit" flow and free debt signposting were dead code). */
  readonly unsafe: UnsafeState;
}

/** Weekend paydays pay the Friday before (UK convention). If the shift lands the payday in the
 *  past (it's Saturday and payday was "tomorrow, Sunday" → paid yesterday), the cycle has
 *  already rolled — use next month's occurrence, shifted the same way. */
function nextShiftedPayday(paydayDay: number, today: ISODate): ISODate {
  const candidate = shiftWeekendToFriday(nextPaydayISO(paydayDay, today));
  if (daysBetween(today, candidate) >= 0) return candidate;
  const following = nextPaydayISO(paydayDay, addDays(nextPaydayISO(paydayDay, today), 1));
  return shiftWeekendToFriday(following);
}

/** Last working day of the month containing `anchor` (weekend month-ends pay the Friday). */
function lastWorkingDayISO(year: number, monthIndex: number): ISODate {
  const lastDay = new Date(year, monthIndex + 1, 0); // day 0 of next month = last of this
  return shiftWeekendToFriday(todayISO(lastDay));
}

/** Payday resolution honoring the last-working-day pattern (§13 risk 16). */
function resolvePaydays(setup: MeloSetup, today: ISODate): { next: ISODate; cycleStart: ISODate } {
  if (!setup.paydayLastWorkingDay) {
    return {
      next: nextShiftedPayday(setup.paydayDay, today),
      cycleStart: prevOccurrenceISO(setup.paydayDay, today),
    };
  }
  const [y, m] = today.split('-').map(Number) as [number, number];
  const thisLWD = lastWorkingDayISO(y, m - 1);
  if (daysBetween(today, thisLWD) > 0) {
    // This month's payday is still ahead → the cycle started on LAST month's LWD.
    return { next: thisLWD, cycleStart: lastWorkingDayISO(y, m - 2) };
  }
  // On or past this month's LWD → the cycle rolled; next payday is next month's.
  return { next: lastWorkingDayISO(y, m), cycleStart: thisLWD };
}

export function deriveLive(state: MeloState, now: Date = new Date()): LiveDerived {
  const { setup, journey, spendLog, manualPaydayISO } = state;
  const today = todayISO(now);
  const { next: payday, cycleStart } = resolvePaydays(setup, today);

  // The engine's positive half, fed for real (drift audit: these were hardwired false/0,
  // making Winning/Milestone/welcome-back unreachable for every user forever).
  const cycleDerived = deriveCycleState({
    todayISO: today,
    history: state.cycleHistory,
    lastOpenedISO: state.lastOpenedISO,
    recoveryEndISO: state.recoveryEndISO,
    bufferPence: Math.max(0, setup.bufferPence),
    savingsPence: Math.max(0, setup.savingsPence),
    reachedMilestoneIds: state.reachedMilestoneIds,
  });

  // The ritual's savings beat is a real decision now: declining excludes savings from
  // THIS cycle's Safe Zone (it used to subtract regardless — theater, per the audit).
  const savingsThisCycle = state.savingsSkippedCycleISO === payday ? 0 : setup.savingsPence;

  const latestOverdraft = state.overdraftEventISOs[state.overdraftEventISOs.length - 1];

  const engineBills: Bill[] = setup.bills.map((b) => ({
    id: b.id,
    name: b.name,
    amountPence: b.amountPence,
    dueDate: nextDueISO(b.dueDay, today),
    kind: b.kind,
  }));

  const safeZone = computeSafeZone({
    balancePence: setup.balancePence,
    today,
    payday,
    bills: engineBills,
    essentialsPerDayPence: setup.essentialsPerDayPence,
    savingsCommittedPence: savingsThisCycle,
    bufferPence: setup.bufferPence,
  });

  // Run-rate: observed spending when the user logs it (the forecast that MOVES), the essentials
  // plan until then — and the UI says which one is speaking.
  const observed = observedRunRatePence(spendLog, today);
  const runRate = observed ?? setup.essentialsPerDayPence;
  const runRateSource: 'observed' | 'planned' = observed !== null ? 'observed' : 'planned';
  const danger = projectDangerDate({
    safeZonePence: safeZone.safeZonePence,
    runRatePence: runRate,
    today,
    payday,
  });

  const balanceAgeHours = Math.max(0, (now.getTime() - setup.balanceUpdatedAtMs) / 3_600_000);

  // Only THIS cycle's bills count toward bill-week/danger heuristics — next-cycle bills landing
  // just after payday must not manufacture a false storm in the days before it.
  const dueSoon = engineBills.filter(
    (b) =>
      daysBetween(today, b.dueDate) >= 0 &&
      daysBetween(today, b.dueDate) < 7 &&
      daysBetween(b.dueDate, payday) > 0,
  );

  // Green days are EARNED, not elapsed: the streak only counts while the zone is back above
  // the line — no rainbow while still overdrawn (audit: calendar-graduation was a lie).
  const greenDaysStreak =
    journey.record?.journey === 'recovery' &&
    journey.recoveryStartISO &&
    safeZone.safeZonePence >= 0
      ? Math.max(0, daysBetween(journey.recoveryStartISO, today))
      : 0;

  const billsCovered = setup.balancePence >= safeZone.shieldedBillsPence;

  const inputs: StateInputs = {
    safeZonePence: safeZone.safeZonePence,
    perDayPence: safeZone.perDayPence,
    comfortablePerDayPence: Math.max(100, setup.comfortablePerDayPence),
    daysToPayday: safeZone.daysToPayday,
    runwayDays: runwayDays(safeZone.safeZonePence, runRate),
    dangerDaysAway: danger ? danger.daysAway : null,
    overdraft: setup.balancePence < 0,
    dataAgeHours: balanceAgeHours,
    // Payday is detected from the RAW day-of-month (nextPaydayISO rolls the cycle on payday
    // itself, so `today === nextPayday` alone can never be true on a weekday payday — the
    // audit's critical finding) — plus the shifted-Friday case where today IS the payout day.
    paydayToday:
      (!setup.paydayLastWorkingDay && Number(today.split('-')[2]) === setup.paydayDay) ||
      today === payday ||
      today === cycleStart ||
      manualPaydayISO === today,
    paydayTomorrow: daysBetween(today, payday) === 1,
    billsDueNext7: dueSoon.length,
    billsTotalCycle: engineBills.length,
    // "Protected" is VERIFIED protection (audit: one bill + £1 of zone used to read as
    // 'Bills covered, buffer intact' — fabricated reassurance).
    allBillsShielded: engineBills.length > 0 && billsCovered,
    bufferIntact: safeZone.safeZonePence >= 0 && billsCovered,
    cyclesEndedPositive: cycleDerived.cyclesEndedPositive,
    savingsGrowing: savingsThisCycle > 0,
    daysSinceRecoveryEnd: cycleDerived.daysSinceRecoveryEnd,
    greenDaysStreak,
    daysSinceOverdraftEvent: latestOverdraft ? daysBetween(latestOverdraft, today) : null,
    milestoneReached: cycleDerived.newMilestoneIds.length > 0,
    returnedAfterAbsence: cycleDerived.returnedAfterAbsence,
  };

  // No danger date → no fabricated "Thursday": copy falls back to a neutral horizon.
  const dangerLabel = danger ? weekdayWord(danger.date) : 'the week';
  const paydayLabel = dayLabel(payday);
  const dayOnPath = journey.recoveryStartISO
    ? Math.max(1, daysBetween(journey.recoveryStartISO, today) + 1)
    : 1;

  const movePence = recoveryMovePence(safeZone.safeZonePence, safeZone.daysToPayday);

  const ctx: CopyContext = {
    safeZone: formatPounds(safeZone.safeZonePence),
    perDay: formatPounds(safeZone.perDayPence),
    keepDryPerDay: formatPounds(safeZone.perDayPence),
    dangerDay: dangerLabel,
    paydayLabel,
    daysToPayday: safeZone.daysToPayday,
    dayOnPath,
    todaysMove: `shift ${formatPounds(movePence)}`,
    staleLabel:
      dayLabel(todayISO(new Date(setup.balanceUpdatedAtMs))).split(' the ')[0] ?? 'a while ago',
  };

  const runwayBills: RunwayBill[] = dueSoonToRunway(engineBills, today);
  const shield = buildShieldView(setup, today, payday, safeZone.shieldedBillsPence, cycleStart);

  return {
    today,
    payday,
    paydayLabel,
    safeZone,
    inputs,
    ctx,
    runwayBills,
    dangerDayOffset: danger ? danger.daysAway : null,
    recoveryMove: movePence,
    runRateSource,
    observedRunRatePence: observed,
    billsCovered,
    shield,
    cycleStart,
    newMilestoneIds: cycleDerived.newMilestoneIds,
    milestoneLines: cycleDerived.milestoneLines,
    savingsThisCyclePence: savingsThisCycle,
    unsafe: assessUnsafe({
      todayISO: today,
      payday,
      incomePence: Math.max(0, setup.incomePence),
      balancePence: setup.balancePence,
      shieldedBillsPence: safeZone.shieldedBillsPence,
      essentialsPerDayPence: setup.essentialsPerDayPence,
      daysToPayday: safeZone.daysToPayday,
      bills: engineBills.map((b) => ({
        name: b.name,
        amountPence: b.amountPence,
        dueDate: b.dueDate,
      })),
      // Prior structural cycles ≈ the trailing run of negative closes in the history.
      structuralCycleCount: trailingNegativeCycles(state.cycleHistory),
    }),
  };
}

function trailingNegativeCycles(
  history: readonly { readonly closingSafeZonePence: number }[],
): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.closingSafeZonePence < 0) n++;
    else break;
  }
  return n;
}

/** Most recent occurrence of a day-of-month (1..28) ON or BEFORE today. */
function prevOccurrenceISO(day: number, today: ISODate): ISODate {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  if (d >= day) return isoFor(y, m - 1, day); // this month
  return isoFor(y, m - 2, day); // last month (Date normalizes month underflow)
}

/** The Bills Shield: where every bill stands in the current payday cycle. A monthly bill either
 *  already LANDED this cycle (its day passed since the last payday), is DUE TODAY, or is still
 *  ahead and SHIELDED. Coverage compares the balance to what is still to land. */
function buildShieldView(
  setup: MeloSetup,
  today: ISODate,
  payday: ISODate,
  shieldedPence: number,
  cycleStart: ISODate,
): ShieldView {
  const bills: ShieldBillView[] = setup.bills.map((b) => {
    const prevDue = prevOccurrenceISO(b.dueDay, today);
    if (prevDue === today) {
      return {
        name: b.name,
        amountPence: b.amountPence,
        dueDate: today,
        dueLabel: 'due today',
        status: 'dueToday' as const,
      };
    }
    // Landed = its most recent occurrence fell inside the current cycle (after the last payday).
    if (daysBetween(cycleStart, prevDue) >= 0) {
      return {
        name: b.name,
        amountPence: b.amountPence,
        dueDate: prevDue,
        dueLabel: `landed ${dayLabel(prevDue)}`,
        status: 'landed' as const,
      };
    }
    const nextDue = nextDueISO(b.dueDay, today);
    return {
      name: b.name,
      amountPence: b.amountPence,
      dueDate: nextDue,
      dueLabel: dayLabel(nextDue),
      status: 'shielded' as const,
    };
  });

  // Upcoming first (soonest at the top), landed after (most recent first).
  const order = { dueToday: 0, shielded: 1, landed: 2 } as const;
  const sorted = [...bills].sort((a, b) =>
    order[a.status] !== order[b.status]
      ? order[a.status] - order[b.status]
      : a.status === 'landed'
        ? daysBetween(a.dueDate, b.dueDate)
        : daysBetween(b.dueDate, a.dueDate),
  );

  const coveredPence = Math.max(0, Math.min(setup.balancePence, shieldedPence));
  return {
    bills: sorted,
    shieldedPence,
    coveredPence,
    covered: setup.balancePence >= shieldedPence,
  };
}

function dueSoonToRunway(bills: readonly Bill[], today: ISODate): RunwayBill[] {
  return bills
    .map((b) => ({ day: daysBetween(today, b.dueDate), label: b.name.toLowerCase().slice(0, 6) }))
    .filter((b) => b.day > 0)
    .sort((a, b) => a.day - b.day)
    .slice(0, 4);
}
