// Renewal math — pure helper shared by BillCaughtSheet and SubCaughtSheet's confirm paths.
//
// BUG THIS FIXES (money-safety): both sheets used to hardcode `nextRenewalDaysAway: 30` on
// confirm, ignoring the detector's own `cadence` + `lastDate` facts. Bills Shield
// (lib/modes/safeZone.ts `shieldedBills`) only reserves a bill within the days-to-payday
// window, so a weekly bill charged 2 days ago got a fabricated 30-day renewal and silently
// escaped the Shield for its actual (much sooner) due date — a real overspend risk.
//
// `nextRenewalDaysAwayFrom` computes the honest day-count from the SAME facts the detector
// already caught (cadence + last-charged date) instead of a constant. Weekly/fortnightly step
// by their fixed period; monthly anchors to the "next same day-of-month" (calendar-correct, not
// a flat +30) so a bill charged on the 31st still renews on a real day-of-month. If one or more
// full periods have already elapsed since `lastDateIso` (e.g. the ledger is stale), the result
// steps forward by whole periods until it lands on/after `todayIso`, never returning negative.

import type { Cadence } from './subSignals';

const DAY_MS = 86_400_000;

/** Nominal period length in days for the weekly/fortnightly cadences (fixed-step). */
const FIXED_STEP_DAYS: Partial<Record<Cadence, number>> = {
  weekly: 7,
  fortnightly: 14,
};

type Ymd = { year: number; month: number; day: number }; // month is 1-12

function parseIsoDate(iso: string): Ymd {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y ?? 1970, month: m ?? 1, day: d ?? 1 };
}

function utcMillis({ year, month, day }: Ymd): number {
  return Date.UTC(year, month - 1, day);
}

function daysBetween(aIso: string, bIso: string): number {
  return Math.round((utcMillis(parseIsoDate(bIso)) - utcMillis(parseIsoDate(aIso))) / DAY_MS);
}

/** Days-in-month aware "same day next month" anchor. When the anchor day doesn't exist in the
 *  target month (e.g. 31st into February), clamps to that month's last day — the calendar-correct
 *  behaviour banks use for monthly renewals. */
function addCalendarMonths(ymd: Ymd, months: number): Ymd {
  const totalMonthIndex = ymd.month - 1 + months;
  const year = ymd.year + Math.floor(totalMonthIndex / 12);
  const month = ((totalMonthIndex % 12) + 12) % 12; // 0-11
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(ymd.day, lastDayOfMonth);
  return { year, month: month + 1, day };
}

function isoOfYmd(ymd: Ymd): string {
  const mm = String(ymd.month).padStart(2, '0');
  const dd = String(ymd.day).padStart(2, '0');
  return `${ymd.year}-${mm}-${dd}`;
}

/**
 * The honest "days from today until the next renewal", derived from the detected cadence and the
 * last-charged date — never a hardcoded constant. Floored at 0 (today/overdue reads as due now,
 * matching the rest of the codebase's `nextRenewalDaysAway <= 0` = "due" convention). If multiple
 * cadence periods have already elapsed since `lastDateIso`, steps forward by whole periods so the
 * result always lands on/after `todayIso`.
 *
 * @param cadence the detector's confirmed recurrence (weekly/fortnightly/monthly; quarterly/yearly
 *                fixed-step at their nominal length as a safe fallback — out of SHEET_CADENCES today)
 * @param lastDateIso ISO `YYYY-MM-DD` of the last confirmed charge (`RecurringSignal.lastSeen`)
 * @param todayIso ISO `YYYY-MM-DD` for "now"
 */
export function nextRenewalDaysAwayFrom(
  cadence: Cadence,
  lastDateIso: string,
  todayIso: string,
): number {
  const fixedStep = FIXED_STEP_DAYS[cadence];

  if (fixedStep !== undefined) {
    // The first occurrence AFTER lastDateIso is always one period out — step once
    // unconditionally, then keep stepping while still behind (or exactly on) today, so a charge
    // dated today correctly reports a full period away rather than "due today".
    let nextIso = addIsoDays(lastDateIso, fixedStep);
    let guard = 0;
    while (daysBetween(nextIso, todayIso) > 0 && guard < 10_000) {
      nextIso = addIsoDays(nextIso, fixedStep);
      guard += 1;
    }
    return Math.max(0, daysBetween(todayIso, nextIso));
  }

  // Monthly (and quarterly/yearly fallback) — anchor to "next same day-of-month", stepping whole
  // cadence-multiples of months forward until on/after today. Quarterly = 3 months, yearly = 12.
  // Mirrors the fixed-step branch: the first anchor after lastDateIso is always one period out.
  const monthsPerPeriod = cadence === 'monthly' ? 1 : cadence === 'quarterly' ? 3 : 12;
  let anchor = addCalendarMonths(parseIsoDate(lastDateIso), monthsPerPeriod);
  let guard = 0;
  while (daysBetween(isoOfYmd(anchor), todayIso) > 0 && guard < 1_000) {
    anchor = addCalendarMonths(anchor, monthsPerPeriod);
    guard += 1;
  }
  return Math.max(0, daysBetween(todayIso, isoOfYmd(anchor)));
}

function addIsoDays(iso: string, days: number): string {
  const ms = utcMillis(parseIsoDate(iso)) + days * DAY_MS;
  const d = new Date(ms);
  return isoOfYmd({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}

/**
 * Days from `todayIso` until the NEXT occurrence of a day-of-month — for seeding a freshly
 * declared monthly bill's `nextRenewalDaysAway` from the user's "on the 12th" answer.
 *
 * BUG THIS FIXES (found in the 2026-07-10 Phase-0 device smoke): AddEntryScreen seeded
 * `nextRenewalDaysAway` with the day-of-month LITERAL — "12th" became "due in 12 days"
 * (a phantom date that also happened to sit exactly on the route's tight point), so the bill
 * landed on the wrong calendar day everywhere downstream (route, calendar, Bills Shield).
 *
 * Semantics: today's occurrence counts as due today (0) — matching the codebase-wide
 * `nextRenewalDaysAway <= 0` = "due" convention. A day that doesn't exist in the current month
 * (31st in February, the "Last day" option's 31) clamps to that month's last day, same
 * calendar-correct rule `addCalendarMonths` uses.
 */
export function daysUntilDayOfMonth(dayOfMonth: number, todayIso: string): number {
  const today = parseIsoDate(todayIso);
  const wanted = Math.max(1, Math.min(31, Math.round(dayOfMonth)));
  const lastDayThisMonth = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
  const clampedThisMonth = Math.min(wanted, lastDayThisMonth);
  if (clampedThisMonth >= today.day) {
    return clampedThisMonth - today.day;
  }
  const next = addCalendarMonths({ year: today.year, month: today.month, day: wanted }, 1);
  return daysBetween(todayIso, isoOfYmd(next));
}

// ---------------------------------------------------------------------------
// Date-anchored renewals — the Phase-2 fix for relative-day rot
// ---------------------------------------------------------------------------
//
// THE ROT (MELO_ALIGNMENT_AUDIT.md, confirmed on-device 2026-07-10): `Sub.nextRenewalDaysAway`
// is a persisted RELATIVE day count. It is written once ("due in 12 days") and then read for
// weeks — after 7 days away from the app it is wrong by 7 days, and everything downstream
// (route, calendar, Bills Shield, mode strategies, Melo's voice) inherits the lie.
//
// THE FIX SHAPE: ~30 files read `nextRenewalDaysAway` directly, so the field STAYS the universal
// read — but it becomes DERIVED. Each sub now also carries a persisted DATE anchor
// (`nextRenewalISO`, plus an optional fixed `renewalPeriodDays`), and `reanchorRenewals` below is
// run at every store hydration and app-foreground: it rolls a past anchor forward by its period
// (fixed days, or calendar-monthly keeping the original day-of-month — Jan 31 stays "the 31st,
// clamped", never drifting to the 28th forever after one February) and recomputes the day count
// from the anchor. A sub that predates the anchor field gets one synthesized from its current
// day count — freezing whatever rot already happened, but stopping all future rot.

/** The anchored slice of `Sub` this module needs — structural, so store.ts can import this
 *  module without a type cycle. */
export type AnchoredRenewal = {
  nextRenewalDaysAway: number;
  /** ISO `YYYY-MM-DD` the next renewal actually falls on. The durable truth the day count is
   *  derived from. Optional for shape back-compat — `reanchorRenewals` synthesizes it. */
  nextRenewalISO?: string;
  /** Fixed renewal period in days (7 weekly, 14 fortnightly, 365 yearly). Undefined = calendar
   *  monthly (same day-of-month, clamped to short months). */
  renewalPeriodDays?: number;
};

/** The anchor date for a renewal declared as "N days away from today". */
export function anchorIsoFor(daysAway: number, todayIso: string): string {
  return addIsoDays(todayIso, Math.max(0, Math.round(daysAway)));
}

/** A detector cadence's fixed roll period — `undefined` means calendar-monthly (the anchor rolls
 *  to the same day-of-month). Quarterly rides a 91-day fixed step: close enough for a roll that
 *  only happens when the app slept past the due date, without teaching the roller a third mode. */
export function renewalPeriodDaysFor(cadence: Cadence): number | undefined {
  if (cadence === 'weekly') return 7;
  if (cadence === 'fortnightly') return 14;
  if (cadence === 'quarterly') return 91;
  if (cadence === 'yearly') return 365;
  return undefined;
}

/** Roll a (possibly past) anchor forward by its period until it lands on/after `todayIso`.
 *  An anchor due TODAY is not rolled — `<= 0` still reads as "due" everywhere. */
function rollAnchorForward(
  anchorIso: string,
  periodDays: number | undefined,
  todayIso: string,
): string {
  if (daysBetween(anchorIso, todayIso) <= 0) return anchorIso; // today or future — keep.
  if (periodDays !== undefined && periodDays > 0) {
    let next = anchorIso;
    let guard = 0;
    while (daysBetween(next, todayIso) > 0 && guard < 10_000) {
      next = addIsoDays(next, periodDays);
      guard += 1;
    }
    return next;
  }
  // Calendar monthly — step whole months FROM THE ORIGINAL anchor so the day-of-month never
  // drifts after a clamped short month (Jan 31 → Feb 28 → Mar 31, not Mar 28).
  const origin = parseIsoDate(anchorIso);
  for (let months = 1; months <= 1_000; months += 1) {
    const candidate = addCalendarMonths(origin, months);
    if (daysBetween(isoOfYmd(candidate), todayIso) <= 0) return isoOfYmd(candidate);
  }
  return anchorIso; // unreachable in practice (guard bound) — never loop forever.
}

/**
 * Re-derive every renewal's day count from its date anchor, synthesizing anchors for legacy
 * entries. Pure; returns the SAME array instance when nothing changed so store hydration can
 * skip a redundant write. Runs at load() + app foreground (store.ts `reanchorSubRenewals`).
 */
export function reanchorRenewals<T extends AnchoredRenewal>(
  items: readonly T[],
  todayIso: string,
): { items: T[]; changed: boolean } {
  let changed = false;
  const next = items.map((item) => {
    if (item.nextRenewalISO === undefined) {
      // Legacy entry — synthesize the anchor from today's relative count (freezes any rot that
      // already happened; stops all future rot). The day count itself is left untouched.
      changed = true;
      return { ...item, nextRenewalISO: anchorIsoFor(item.nextRenewalDaysAway, todayIso) };
    }
    const rolled = rollAnchorForward(item.nextRenewalISO, item.renewalPeriodDays, todayIso);
    const daysAway = Math.max(0, daysBetween(todayIso, rolled));
    if (rolled === item.nextRenewalISO && daysAway === item.nextRenewalDaysAway) return item;
    changed = true;
    return { ...item, nextRenewalISO: rolled, nextRenewalDaysAway: daysAway };
  });
  return changed ? { items: next, changed } : { items: items as T[], changed };
}
