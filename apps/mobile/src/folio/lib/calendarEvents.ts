/**
 * Calendar event derivation — faithful 1:1 RN port of the web design's
 * `src/lib/calendar-events.ts`. Turns the existing money model (subs, payday,
 * pots, manual events) into a sorted timeline. Pure functions, no I/O.
 *
 * Parity-first: this mirrors the web prototype in behaviour so the Calendar
 * screen renders the same shape of derived events the web design did. The
 * static seeds below remain deliberate web stand-ins, each tagged @rn-engine
 * where the real RN engine will eventually take over. Two derivations now wire
 * the real pure engines: payday/bill day-of-month resolution goes through
 * `resolvePayday` (Feb-31 clamp + weekend-previous) and pot top-ups follow each
 * pot's own `cadence` via `resolveNextTopUp` (defaulting to after-payday). The
 * windowing/sorting/recurrence/sub-nudge behaviour is otherwise unchanged.
 *
 * Types come from the data spine: `@/folio/store` (alias `@/*` -> `src/*`),
 * imported relatively as `../store` so the pure-logic test runner resolves it.
 */
import type { Sub, Onboarding, CalendarEvent, Pot } from '../store';
import { resolvePayday } from './payday';
import { resolveNextTopUp } from './potCadence';

export type DerivedEventKind = 'in' | 'out' | 'review' | 'deadline' | 'manual';
export type DerivedEventSource =
  | 'payday'
  | 'bill'
  | 'sub'
  | 'deadline'
  | 'review'
  | 'manual'
  | 'pot';

export type DerivedEvent = {
  id: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  kind: DerivedEventKind;
  /** Where the event came from — drives "Repeats monthly" hint + pause action. */
  source: DerivedEventSource;
  title: string;
  note?: string;
  /** signed pounds; positive = in, negative = out, undefined = informational */
  amount?: number;
  /** Recurrence cadence for the badge ("Repeats monthly" etc.). */
  recurring?: 'monthly' | 'yearly';
  /** For sub renewals — lets the Calendar offer a one-tap Pause. */
  subName?: string;
  /** true if user added this (vs derived) */
  manual?: boolean;
};

const DAY = 86_400_000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number): Date {
  return new Date(base.getTime() + n * DAY);
}

/** "YYYY-MM" of an ISO "YYYY-MM-DD" date — the year-month `resolvePayday` takes. */
function yearMonthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** The "YYYY-MM" one calendar month after the given "YYYY-MM". */
function nextYearMonth(yearMonth: string): string {
  const [y = 0, m = 0] = yearMonth.split('-').map((n) => parseInt(n, 10));
  const month = m === 12 ? 1 : m + 1;
  const year = m === 12 ? y + 1 : y;
  return `${year}-${month < 10 ? `0${month}` : month}`;
}

/**
 * Next occurrence of a day-of-month rule (payday or bill) on/after `fromIso`,
 * as an ISO "YYYY-MM-DD". Resolves the rule for `fromIso`'s month via the real
 * payday engine (Feb-31 clamp + weekend-previous shift); if that resolved date
 * is strictly before `fromIso`, rolls to the next month and resolves again.
 * ISO dates sort lexically, so the compare is a plain string compare — the same
 * "strictly before now rolls forward" semantics the prototype's `<` Date math
 * had, now with the clamp/shift corrections applied.
 */
function nextDayOfMonth(fromIso: string, dayOfMonth: number): string {
  const thisMonth = resolvePayday({ dayOfMonth, weekendRule: 'previous' }, yearMonthOf(fromIso));
  if (thisMonth >= fromIso) return thisMonth;
  return resolvePayday({ dayOfMonth, weekendRule: 'previous' }, nextYearMonth(fromIso));
}

// @rn-engine bills — RN swaps for the real engines (faithful web stand-in)
/** Static personal recurring bills — anchored to day-of-month.
 *  Stands in for the RN Bills engine; values match the synthetic figures
 *  used elsewhere in the prototype so the Route and Calendar agree. */
const RECURRING_BILLS: { name: string; dayOfMonth: number; amount: number; note?: string }[] = [
  { name: 'Octopus Energy', dayOfMonth: 1, amount: 118.4, note: 'Variable — could land lower' },
  { name: 'Council Tax', dayOfMonth: 1, amount: 162, note: 'Monthly direct debit' },
  { name: 'BT Broadband', dayOfMonth: 3, amount: 38 },
  { name: 'Rent', dayOfMonth: 12, amount: 540, note: 'Monthly' },
];

// @rn-engine deadlines — RN swaps for the real engines (faithful web stand-in)
/** UK personal deadlines that don't depend on user data. */
const PERSONAL_DEADLINES: { mmdd: string; title: string; note: string }[] = [
  { mmdd: '01-31', title: 'Self Assessment due', note: 'HMRC online deadline' },
  { mmdd: '07-31', title: 'Payment on account', note: 'Second instalment' },
];

/** Build the next `windowDays` of timeline events. */
export function deriveCalendarEvents({
  subs,
  subPaused,
  subOverrides = {},
  onboarding,
  manualEvents,
  pots = [],
  windowDays = 35,
  now = new Date(),
}: {
  subs: Sub[];
  subPaused: Record<string, boolean>;
  /** Day-delta nudge per sub. Added to `nextRenewalDaysAway` so a flex
   *  bill can be slid around the tight day without losing recurrence. */
  subOverrides?: Record<string, number>;
  onboarding: Onboarding;
  manualEvents: CalendarEvent[];
  /** Pot top-ups surface as "Out" events (each on its own cadence) so the
   *  Calendar explains dips that have a pot cause, not just bills + subs. */
  pots?: Pot[];
  windowDays?: number;
  now?: Date;
}): DerivedEvent[] {
  const out: DerivedEvent[] = [];
  const windowEnd = addDays(now, windowDays);
  // ISO bounds for the engine-resolved derivations. ISO "YYYY-MM-DD" sorts
  // lexically, so window membership is a plain string compare — matching the
  // final `out.sort` and the engines, which work in the same ISO/UTC space.
  const nowIso = isoDay(now);
  const windowEndIso = isoDay(windowEnd);

  // The next concrete payday (engine-resolved: Feb-31 clamp + weekend-previous).
  // Reused below as the `after-payday` anchor for pot top-ups.
  const firstPaydayIso = nextDayOfMonth(nowIso, onboarding.payday || 25);

  // Payday — next occurrence(s) within window.
  let payIso = firstPaydayIso;
  while (payIso <= windowEndIso) {
    out.push({
      id: `payday-${payIso}`,
      date: payIso,
      kind: 'in',
      source: 'payday',
      title: 'Payday',
      note: 'Salary in',
      amount: onboarding.monthlyIncome || 0,
      recurring: 'monthly',
    });
    // Advance to the same day-of-month next month, re-resolved through the
    // engine so each month gets its own clamp/weekend shift.
    payIso = nextDayOfMonth(nextYearMonth(yearMonthOf(payIso)) + '-01', onboarding.payday || 25);
  }

  // Recurring bills — next occurrence per bill.
  for (const bill of RECURRING_BILLS) {
    const whenIso = nextDayOfMonth(nowIso, bill.dayOfMonth);
    if (whenIso <= windowEndIso) {
      out.push({
        id: `bill-${bill.name}-${whenIso}`,
        date: whenIso,
        kind: 'out',
        source: 'bill',
        title: bill.name,
        // exactOptionalPropertyTypes: only set `note` when present (never explicit
        // undefined). RN-port idiom — identical output to the web `note: bill.note`.
        ...(bill.note !== undefined ? { note: bill.note } : {}),
        amount: -bill.amount,
        recurring: 'monthly',
      });
    }
  }

  // Sub renewals — from existing store data. Skip paused. Apply any
  // user-set "what if I move this?" override.
  for (const s of subs) {
    if (subPaused[s.name]) continue;
    const delta = subOverrides[s.name] ?? 0;
    const effectiveDays = s.nextRenewalDaysAway + delta;
    if (effectiveDays < 0 || effectiveDays > windowDays) continue;
    const when = addDays(now, effectiveDays);
    const isTrialFirstCharge = typeof s.trialEndsInDays === 'number' && s.trialEndsInDays >= 0;
    const nudgeNote =
      delta !== 0
        ? `${isTrialFirstCharge ? 'Trial converts' : 'Subscription renews'} · nudged ${delta > 0 ? '+' : ''}${delta}d`
        : isTrialFirstCharge
          ? 'Trial converts — first charge'
          : 'Subscription renews';
    out.push({
      id: `sub-${s.name}-${isoDay(when)}`,
      date: isoDay(when),
      kind: 'out',
      source: 'sub',
      title: s.name,
      note: nudgeNote,
      amount: -s.cost,
      recurring: 'monthly',
      subName: s.name,
    });
  }

  // Trial-end nudges — surface a "Decide about X" review 2 days before the
  // trial flips into a paying charge. Highest-regret category, so we surface
  // it loudly and early. Skip if the sub is already paused.
  for (const s of subs) {
    if (subPaused[s.name]) continue;
    if (typeof s.trialEndsInDays !== 'number') continue;
    const nudge = Math.max(0, s.trialEndsInDays - 2);
    if (nudge > windowDays) continue;
    const day = addDays(now, nudge);
    out.push({
      id: `trial-review-${s.name}-${isoDay(day)}`,
      date: isoDay(day),
      kind: 'review',
      source: 'review',
      title: `Decide about ${s.name}`,
      note: `Free trial ends in ${Math.max(1, s.trialEndsInDays - nudge)}d — cancel now to avoid the charge`,
      subName: s.name,
    });
  }

  // Pot top-ups — each pot follows its own `cadence` (ENGINES §6) via the real
  // pot-cadence engine. Unmigrated pots (no cadence) default to `after-payday`,
  // anchored to the engine-resolved payday above — money goes to pots after it
  // arrives. The engine returns `ask-user` when an after-payday pot has no known
  // payday; that pot is skipped (Folio can't honestly place a date yet). A
  // resolved top-up only surfaces if it lands inside the window — so a single
  // dated dip has a named cause ("Holiday pot · £35"), replacing the old Friday
  // weekly fill.
  for (const pot of pots) {
    if (!(pot.perWeek > 0)) continue;
    const resolution = resolveNextTopUp(pot.cadence ?? { kind: 'after-payday' }, {
      now: nowIso,
      nextPayday: firstPaydayIso,
    });
    if (resolution.kind !== 'date') continue;
    const whenIso = resolution.date;
    if (whenIso < nowIso || whenIso > windowEndIso) continue;
    out.push({
      id: `pot-${pot.id}-${whenIso}`,
      date: whenIso,
      kind: 'out',
      source: 'pot',
      title: `${pot.name} pot`,
      note: 'Top-up',
      amount: -pot.perWeek,
      recurring: 'monthly',
    });
  }

  // A small review nudge mid-window (stands in for derived review tasks).
  const reviewDay = addDays(now, 14);
  out.push({
    id: `review-klarna-${isoDay(reviewDay)}`,
    date: isoDay(reviewDay),
    kind: 'review',
    source: 'review',
    title: 'Check Klarna · 2 of 3',
    note: 'Confirm the next instalment lands cleanly',
  });

  // Personal deadlines within window.
  for (const d of PERSONAL_DEADLINES) {
    // noUncheckedIndexedAccess: the two split halves are always present for the
    // static "MM-DD" seeds; fall back to 0 so the types stay sound. Same output.
    const [mm = 0, dd = 0] = d.mmdd.split('-').map((n) => parseInt(n, 10));
    for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
      const when = new Date(year, mm - 1, dd);
      if (when.getTime() >= now.getTime() && when.getTime() <= windowEnd.getTime()) {
        out.push({
          id: `deadline-${d.mmdd}-${year}`,
          date: isoDay(when),
          kind: 'deadline',
          source: 'deadline',
          title: d.title,
          note: d.note,
          recurring: 'yearly',
        });
      }
    }
  }

  // Manual events.
  for (const e of manualEvents) {
    const when = new Date(e.date + 'T00:00:00');
    if (when.getTime() < now.getTime() - DAY) continue;
    if (when.getTime() > windowEnd.getTime() + 60 * DAY) continue;
    out.push({
      id: e.id,
      date: e.date,
      kind: e.kind,
      source: 'manual',
      title: e.title,
      // exactOptionalPropertyTypes: mirror the store's conditional-spread idiom
      // so optional fields are omitted, not set to explicit undefined. Same output.
      ...(e.note !== undefined ? { note: e.note } : {}),
      ...(e.amount !== undefined ? { amount: e.amount } : {}),
      manual: true,
    });
  }

  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === 'in' ? -1 : 1));
  return out;
}

/** Group derived events by ISO day for the timeline render. */
export function groupByDay(events: DerivedEvent[]): { date: string; events: DerivedEvent[] }[] {
  const map = new Map<string, DerivedEvent[]>();
  for (const e of events) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  return [...map.entries()].map(([date, events]) => ({ date, events }));
}

/** Running spare after each day (synthetic — anchored to a starting balance).
 *  Identifies the tightest day in the window. */
export function computeSpareAndTightest(
  groups: { date: string; events: DerivedEvent[] }[],
  startingSpare: number,
): { spareByDay: Record<string, number>; tightestDate: string | null; tightestSpare: number } {
  const spareByDay: Record<string, number> = {};
  let running = startingSpare;
  let tightestDate: string | null = null;
  let tightestSpare = Infinity;
  for (const g of groups) {
    for (const e of g.events) {
      if (typeof e.amount === 'number') running += e.amount;
    }
    spareByDay[g.date] = running;
    if (running < tightestSpare) {
      tightestSpare = running;
      tightestDate = g.date;
    }
  }
  return {
    spareByDay,
    tightestDate,
    tightestSpare: isFinite(tightestSpare) ? tightestSpare : startingSpare,
  };
}

/** Format an ISO day as "TUE · 8 JUL". */
export function formatDayHeader(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const wd = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const day = d.getDate();
  const mo = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  return `${wd} · ${day} ${mo}`;
}

/** Format as "Tuesday 8" for inline prose. */
export function formatDayProse(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${d.getDate()}`;
}

/** Preview: would nudging this sub by `deltaDays` lift the tight-day spare?
 *  Returns the £ delta (positive = lift, negative = makes it worse, 0 = no
 *  change). Used by the Calendar to show "would lift tight day by £X"
 *  before the user commits the move. Pure — no state mutation. */
export function previewSubNudge(args: {
  subName: string;
  deltaDays: number;
  subs: Sub[];
  subPaused: Record<string, boolean>;
  subOverrides: Record<string, number>;
  onboarding: Onboarding;
  manualEvents: CalendarEvent[];
  pots?: Pot[];
  startingSpare: number;
  now?: Date;
}): number {
  // exactOptionalPropertyTypes: only forward optional `pots`/`now` when defined,
  // so an absent value is omitted rather than passed as explicit undefined.
  // RN-port idiom — behaviour is identical to the web's direct pass-through.
  const optional = {
    ...(args.pots !== undefined ? { pots: args.pots } : {}),
    ...(args.now !== undefined ? { now: args.now } : {}),
  };
  const base = computeSpareAndTightest(
    groupByDay(
      deriveCalendarEvents({
        subs: args.subs,
        subPaused: args.subPaused,
        subOverrides: args.subOverrides,
        onboarding: args.onboarding,
        manualEvents: args.manualEvents,
        ...optional,
      }),
    ),
    args.startingSpare,
  );
  const next = computeSpareAndTightest(
    groupByDay(
      deriveCalendarEvents({
        subs: args.subs,
        subPaused: args.subPaused,
        subOverrides: {
          ...args.subOverrides,
          [args.subName]: (args.subOverrides[args.subName] ?? 0) + args.deltaDays,
        },
        onboarding: args.onboarding,
        manualEvents: args.manualEvents,
        ...optional,
      }),
    ),
    args.startingSpare,
  );
  return Math.round(next.tightestSpare - base.tightestSpare);
}
