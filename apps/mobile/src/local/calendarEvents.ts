/**
 * Calendar event derivation for the RN app — turns the REAL local ledger (recurring income, recurring
 * and planned commitments, subscriptions, import drafts, user-added events) into a sorted timeline of
 * events. Pure functions, no I/O, integer minor units throughout.
 *
 * @rn-engine  This is the engine ENGINES.md and the web's calendar-events.ts (@rn-engine note) call
 *             for. The web prototype seeded payday from `onboarding.payday`, bills from a hardcoded
 *             RECURRING_BILLS array (Octopus / Council Tax / BT / Rent), and pot top-ups on a fixed
 *             Friday cadence. NONE of that static seed is ported here: "Folio must not replace a
 *             promised engine with a manual form." Payday, bills and sub renewals are derived from the
 *             user's actual records using the SAME recurrence expansion the Route uses
 *             (expandRecurringTransactions over RECURRENCE_HORIZON_DAYS), so the Calendar and the Route
 *             agree to the day.
 *
 *             The ONLY static reference data kept is the UK personal-deadlines registry (Self
 *             Assessment, Payment on account). Those are real public HMRC dates, not invented user
 *             data, so they are legitimate reference data — marked source 'deadline'.
 */
import {
  RECURRENCE_HORIZON_DAYS,
  addIsoDays,
  expandRecurringTransactions,
  isoDayDistance,
  type LocalLedgerState,
  type LocalLedgerTransaction,
  type UserCalendarEvent,
} from './localLedger.js';
import type { Subscription } from '@folio/domain';

export type DerivedCalendarEventKind = 'in' | 'out' | 'review' | 'deadline' | 'manual';
export type DerivedCalendarEventSource =
  | 'payday'
  | 'bill'
  | 'sub'
  | 'deadline'
  | 'review'
  | 'manual'
  | 'pot';

export type DerivedCalendarEvent = Readonly<{
  id: string;
  // ISO date (YYYY-MM-DD).
  dateIso: string;
  kind: DerivedCalendarEventKind;
  // Where the event came from — drives the "Repeats monthly" hint and the one-tap Pause on sub rows.
  source: DerivedCalendarEventSource;
  title: string;
  note?: string;
  // Signed integer minor units (pence): positive = money in, negative = money out, absent =
  // informational. NEVER a float — the Calendar mirrors the ledger's integer money exactly.
  amountMinor?: number;
  // Recurrence cadence for the badge ("Repeats monthly/yearly").
  recurring?: 'monthly' | 'yearly';
  // For sub renewals — lets the Calendar offer a one-tap Pause + day-nudge.
  subName?: string;
  // true when the user added this event (vs derived from the ledger).
  manual?: boolean;
}>;

// The widest day-delta a sub override is allowed to express. Mirrors MAX_SUB_OVERRIDE_DAYS in
// localLedger; the override is already clamped on write, but the read path clamps again defensively
// so a hand-edited / corrupt blob can never relocate a renewal arbitrarily.
const MAX_SUB_OVERRIDE_DAYS_READ = 7;

// Does this transaction title read like income arriving (payday / salary / wages)? Same predicate the
// Route uses in nextPaydayLabel, so the Calendar's payday markers line up with the Route's.
const PAYDAY_TITLE = /pay|wage|salary/i;

// UK personal deadlines that do not depend on the user's data. These are real public HMRC dates, so
// they are reference data, not invented user records — kept and marked source 'deadline'.
const PERSONAL_DEADLINES: readonly Readonly<{ mmdd: string; title: string; note: string }>[] = [
  { mmdd: '01-31', title: 'Self Assessment due', note: 'HMRC online deadline' },
  { mmdd: '07-31', title: 'Payment on account', note: 'Second instalment' },
];

const MONTHLY_RECURRENCE: 'monthly' = 'monthly';

// Clamp a sub day-override read off the (possibly hand-edited) blob.
function clampOverrideRead(delta: number | undefined): number {
  if (delta === undefined || !Number.isFinite(delta)) return 0;
  const rounded = Math.round(delta);
  if (rounded > MAX_SUB_OVERRIDE_DAYS_READ) return MAX_SUB_OVERRIDE_DAYS_READ;
  if (rounded < -MAX_SUB_OVERRIDE_DAYS_READ) return -MAX_SUB_OVERRIDE_DAYS_READ;
  return rounded;
}

function nextRenewalDateIso(
  subscription: Subscription,
  asOfDateIso: string,
  overrideDays: number,
): string {
  // The renewal day is the stored days-away plus the user's nudge, never moved before today.
  const effectiveDays = Math.max(0, subscription.nextRenewalDaysAway + overrideDays);
  return addIsoDays(asOfDateIso, effectiveDays);
}

function paydayEventFromTransaction(transaction: LocalLedgerTransaction): DerivedCalendarEvent {
  return {
    id: `payday-${transaction.id}`,
    dateIso: transaction.date,
    kind: 'in',
    source: 'payday',
    title: transaction.title,
    note: 'Money in',
    amountMinor: transaction.amountMinor,
    ...(transaction.repeats === 'monthly' || transaction.repeats === 'weekly'
      ? { recurring: MONTHLY_RECURRENCE }
      : {}),
  };
}

function billEventFromTransaction(transaction: LocalLedgerTransaction): DerivedCalendarEvent {
  return {
    id: `bill-${transaction.id}`,
    dateIso: transaction.date,
    kind: 'out',
    source: 'bill',
    title: transaction.title,
    ...(transaction.original === undefined ? {} : { note: transaction.original }),
    amountMinor: transaction.amountMinor,
    ...(transaction.repeats === 'monthly' || transaction.repeats === 'weekly'
      ? { recurring: MONTHLY_RECURRENCE }
      : {}),
  };
}

function subEventFromSubscription(
  subscription: Subscription,
  asOfDateIso: string,
  overrideDays: number,
): DerivedCalendarEvent {
  const dateIso = nextRenewalDateIso(subscription, asOfDateIso, overrideDays);
  const note =
    overrideDays === 0
      ? 'Subscription renews'
      : `Subscription renews · nudged ${overrideDays > 0 ? '+' : ''}${overrideDays}d`;
  return {
    id: `sub-${String(subscription.id)}-${dateIso}`,
    dateIso,
    kind: 'out',
    source: 'sub',
    title: subscription.name,
    note,
    amountMinor: -Math.abs(subscription.cost.minorUnits),
    recurring: MONTHLY_RECURRENCE,
    subName: subscription.name,
  };
}

function manualEvent(event: UserCalendarEvent): DerivedCalendarEvent {
  return {
    id: event.id,
    dateIso: event.dateIso,
    kind: event.kind,
    source: 'manual',
    title: event.title,
    ...(event.note === undefined ? {} : { note: event.note }),
    ...(event.amountMinor === undefined ? {} : { amountMinor: event.amountMinor }),
    ...(event.recurring === undefined ? {} : { recurring: event.recurring }),
    manual: true,
  };
}

function deadlineEvents(
  asOfDateIso: string,
  windowEndIso: string,
): readonly DerivedCalendarEvent[] {
  const out: DerivedCalendarEvent[] = [];
  const startYear = Number(asOfDateIso.slice(0, 4));
  for (const deadline of PERSONAL_DEADLINES) {
    for (const year of [startYear, startYear + 1]) {
      const dateIso = `${year}-${deadline.mmdd}`;
      if (dateIso < asOfDateIso || dateIso > windowEndIso) continue;
      out.push({
        id: `deadline-${deadline.mmdd}-${year}`,
        dateIso,
        kind: 'deadline',
        source: 'deadline',
        title: deadline.title,
        note: deadline.note,
        recurring: 'yearly',
      });
    }
  }
  return out;
}

// Sort: by date, then money-in before money-out on the same day (so payday reads before the bills it
// covers), then by title for a stable order.
function compareDerived(left: DerivedCalendarEvent, right: DerivedCalendarEvent): number {
  if (left.dateIso !== right.dateIso) return left.dateIso < right.dateIso ? -1 : 1;
  const leftIn = left.kind === 'in' ? 0 : 1;
  const rightIn = right.kind === 'in' ? 0 : 1;
  if (leftIn !== rightIn) return leftIn - rightIn;
  return left.title.localeCompare(right.title);
}

/**
 * Derive the calendar timeline from REAL ledger data over a window (default = the Route horizon, so
 * the two surfaces cover the same span).
 *
 * Sourcing (no static seed):
 *  - PAYDAY (kind 'in', source 'payday'): every confirmed positive transaction on/after asOf whose
 *    title reads as income (pay/wage/salary), expanded so each recurring payday in the window appears.
 *  - BILLS  (kind 'out', source 'bill'): every confirmed negative transaction on/after asOf — both the
 *    recurring commitments (expanded) and one-off planned commitments — using the Route's expansion.
 *  - SUBS   (kind 'out', source 'sub'): each non-paused ledger subscription at its next renewal day +
 *    subOverrides[name] (clamped ±7), with subName exposed for Pause + the 'Repeats monthly' badge.
 *  - REVIEW (kind 'review', source 'review'): each pending import draft on its date.
 *  - MANUAL (any kind, source 'manual'): the user-added calendarEvents.
 *  - DEADLINES (kind 'deadline', source 'deadline'): the static UK personal-deadlines registry.
 */
export function deriveCalendarEvents(
  ledger: LocalLedgerState,
  asOfDateIso: string,
  windowDays: number = RECURRENCE_HORIZON_DAYS,
): readonly DerivedCalendarEvent[] {
  const windowEndIso = addIsoDays(asOfDateIso, Math.max(0, Math.round(windowDays)));
  const out: DerivedCalendarEvent[] = [];

  // Expand recurring income + commitments with the SAME engine the Route uses, then keep only what
  // lands inside [asOf, windowEnd]. This is what makes the Calendar derive from real records rather
  // than a static bill seed.
  const confirmed = ledger.transactions.filter((transaction) => transaction.status === 'confirmed');
  const expanded = expandRecurringTransactions(confirmed, asOfDateIso);
  for (const transaction of expanded) {
    if (transaction.date < asOfDateIso || transaction.date > windowEndIso) continue;
    if (transaction.amountMinor > 0) {
      // Income only surfaces as a calendar marker when it reads like payday; other positive lines
      // (refunds, transfers in) are not planner-worthy recurring income.
      if (PAYDAY_TITLE.test(transaction.title)) {
        out.push(paydayEventFromTransaction(transaction));
      }
    } else if (transaction.amountMinor < 0) {
      out.push(billEventFromTransaction(transaction));
    }
  }

  // Sub renewals from the real subscriptions list, with the per-sub nudge applied.
  for (const subscription of ledger.subscriptions) {
    if (subscription.paused) continue;
    const overrideDays = clampOverrideRead(ledger.subOverrides[subscription.name]);
    const event = subEventFromSubscription(subscription, asOfDateIso, overrideDays);
    if (event.dateIso < asOfDateIso || event.dateIso > windowEndIso) continue;
    out.push(event);
  }

  // Pending import drafts become review markers on their date.
  for (const draft of ledger.importDrafts) {
    if (draft.date < asOfDateIso || draft.date > windowEndIso) continue;
    out.push({
      id: `review-${draft.rowId}`,
      dateIso: draft.date,
      kind: 'review',
      source: 'review',
      title: draft.interpretation,
      note: 'Waiting for you to check',
    });
  }

  // User-added events. Allow a small look-back so an event the user logged for "yesterday" still
  // shows; cap the look-ahead at the window so a far-future note doesn't distort the picture.
  for (const event of ledger.calendarEvents) {
    if (isoDayDistance(asOfDateIso, event.dateIso) < -1) continue;
    if (event.dateIso > windowEndIso) continue;
    out.push(manualEvent(event));
  }

  // UK personal deadlines that fall inside the window.
  for (const event of deadlineEvents(asOfDateIso, windowEndIso)) {
    out.push(event);
  }

  return [...out].sort(compareDerived);
}

/** Group derived events by ISO day for a day-by-day render. */
export function groupCalendarEventsByDay(
  events: readonly DerivedCalendarEvent[],
): readonly Readonly<{ dateIso: string; events: readonly DerivedCalendarEvent[] }>[] {
  const map = new Map<string, DerivedCalendarEvent[]>();
  for (const event of events) {
    const list = map.get(event.dateIso) ?? [];
    list.push(event);
    map.set(event.dateIso, list);
  }
  return [...map.entries()].map(([dateIso, dayEvents]) => ({ dateIso, events: dayEvents }));
}

export type SparePerDay = Readonly<{ dateIso: string; spareMinor: number }>;

/**
 * Running "spare £ per day" across the window: start from an opening balance (the Route's available-
 * now figure), then apply each day's net signed amount in order. Returns one entry per day that has at
 * least one money-moving event, plus the tightest (lowest) point. Pure, integer minor units.
 *
 * The Calendar's spare sparkline can use this directly; if the surface needs the exact Route opening
 * balance it should pass route.availableNowMinor as openingBalanceMinor (left to Phase 2 wiring).
 */
export function computeSparePerDay(
  events: readonly DerivedCalendarEvent[],
  openingBalanceMinor: number,
): Readonly<{
  spareByDay: readonly SparePerDay[];
  tightestDateIso: string | null;
  tightestSpareMinor: number;
}> {
  const groups = groupCalendarEventsByDay(events)
    .slice()
    .sort((left, right) =>
      left.dateIso < right.dateIso ? -1 : left.dateIso > right.dateIso ? 1 : 0,
    );
  const spareByDay: SparePerDay[] = [];
  let running = openingBalanceMinor;
  let tightestDateIso: string | null = null;
  let tightestSpareMinor = openingBalanceMinor;
  let sawMovingDay = false;

  for (const group of groups) {
    let dayDelta = 0;
    for (const event of group.events) {
      if (typeof event.amountMinor === 'number') dayDelta += event.amountMinor;
    }
    if (dayDelta === 0 && !group.events.some((event) => typeof event.amountMinor === 'number')) {
      continue;
    }
    running += dayDelta;
    spareByDay.push({ dateIso: group.dateIso, spareMinor: running });
    if (!sawMovingDay || running < tightestSpareMinor) {
      tightestSpareMinor = running;
      tightestDateIso = group.dateIso;
      sawMovingDay = true;
    }
  }

  return { spareByDay, tightestDateIso, tightestSpareMinor };
}
