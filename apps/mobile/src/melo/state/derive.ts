// Real-data derivation: MeloSetup (what the user told us) → engine inputs → view + copy context.
// The ENGINE stays clock-free and pure; this file is the surface layer that owns the device
// clock and date formatting. Payday weekend-shift handling is a known v1 gap (MELO_BLUEPRINT.md
// §13 risk 16) — dates land on the literal day-of-month for now.

import {
  computeSafeZone,
  daysBetween,
  formatPounds,
  projectDangerDate,
  runwayDays,
  type Bill,
  type CopyContext,
  type ISODate,
  type SafeZoneResult,
  type StateInputs,
} from '@folio/melo-engine';

import type { RunwayBill } from '../components/RunwayStrip';
import type { MeloJourney, MeloSetup } from './meloStore';

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

export interface LiveDerived {
  readonly today: ISODate;
  readonly payday: ISODate;
  readonly paydayLabel: string;
  readonly safeZone: SafeZoneResult;
  readonly inputs: StateInputs;
  readonly ctx: CopyContext;
  readonly runwayBills: readonly RunwayBill[];
  readonly dangerDayOffset: number | null;
}

export function deriveLive(
  setup: MeloSetup,
  journey: MeloJourney,
  now: Date = new Date(),
): LiveDerived {
  const today = todayISO(now);
  const payday = nextPaydayISO(setup.paydayDay, today);

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
    savingsCommittedPence: setup.savingsPence,
    bufferPence: setup.bufferPence,
  });

  // v1 run-rate: the essentials plan. Spend tracking sharpens this later — the honest
  // consequence is that danger appears through balance updates, not silent projection drift.
  const runRate = setup.essentialsPerDayPence;
  const danger = projectDangerDate({
    safeZonePence: safeZone.safeZonePence,
    runRatePence: runRate,
    today,
    payday,
  });

  const balanceAgeHours = Math.max(0, (now.getTime() - setup.balanceUpdatedAtMs) / 3_600_000);

  const dueSoon = engineBills.filter(
    (b) => daysBetween(today, b.dueDate) >= 0 && daysBetween(today, b.dueDate) < 7,
  );

  const greenDaysStreak =
    journey.record?.journey === 'recovery' && journey.recoveryStartISO
      ? Math.max(0, daysBetween(journey.recoveryStartISO, today))
      : 0;

  const inputs: StateInputs = {
    safeZonePence: safeZone.safeZonePence,
    perDayPence: safeZone.perDayPence,
    comfortablePerDayPence: 800,
    daysToPayday: safeZone.daysToPayday,
    runwayDays: runwayDays(safeZone.safeZonePence, runRate),
    dangerDaysAway: danger ? danger.daysAway : null,
    overdraft: setup.balancePence < 0,
    dataAgeHours: balanceAgeHours,
    paydayToday: today === payday,
    paydayTomorrow: daysBetween(today, payday) === 1,
    billsDueNext7: dueSoon.length,
    billsTotalCycle: engineBills.length,
    allBillsShielded: engineBills.length > 0,
    bufferIntact: safeZone.safeZonePence >= 0,
    cyclesEndedPositive: 0,
    savingsGrowing: setup.savingsPence > 0,
    daysSinceRecoveryEnd: null,
    greenDaysStreak,
    daysSinceOverdraftEvent: null,
    milestoneReached: false,
    returnedAfterAbsence: false,
  };

  const dangerLabel = danger ? weekdayWord(danger.date) : 'Thursday';
  const paydayLabel = dayLabel(payday);
  const dayOnPath = journey.recoveryStartISO
    ? Math.max(1, daysBetween(journey.recoveryStartISO, today) + 1)
    : 1;

  const ctx: CopyContext = {
    safeZone: formatPounds(safeZone.safeZonePence),
    perDay: formatPounds(safeZone.perDayPence),
    keepDryPerDay: formatPounds(safeZone.perDayPence),
    dangerDay: dangerLabel,
    paydayLabel,
    daysToPayday: safeZone.daysToPayday,
    dayOnPath,
    todaysMove: 'shift £8',
    staleLabel:
      dayLabel(todayISO(new Date(setup.balanceUpdatedAtMs))).split(' the ')[0] ?? 'a while ago',
  };

  const runwayBills: RunwayBill[] = dueSoonToRunway(engineBills, today);

  return {
    today,
    payday,
    paydayLabel,
    safeZone,
    inputs,
    ctx,
    runwayBills,
    dangerDayOffset: danger ? danger.daysAway : null,
  };
}

function dueSoonToRunway(bills: readonly Bill[], today: ISODate): RunwayBill[] {
  return bills
    .map((b) => ({ day: daysBetween(today, b.dueDate), label: b.name.toLowerCase().slice(0, 6) }))
    .filter((b) => b.day > 0)
    .sort((a, b) => a.day - b.day)
    .slice(0, 4);
}
