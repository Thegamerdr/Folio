// Today rich-home derivation — maps the canonical local ledger + route into the small
// presentation shapes the new TodayScreen (surfaces/pressureMap/todayPath.tsx) consumes.
//
// The Today rebuild is presentation-only: it never touches the engine, so the container must
// hand it already-shaped data. Rather than scatter that mapping across app/index.tsx, this module
// derives every Today data prop in one pure place (no React, no store, no mutation). All money stays
// in MINOR units; the screen formats at the edge via the kit's formatMinorAmount.
//
// Faithful to the web ScreenToday data model:
//   • the hero spare = the tightest visible balance (>=0 magnitude);
//   • the spend strip + recent list come from the user's real spends (negative transactions);
//   • the path summary (coming in / going out / lowest) is summed from the route points;
//   • the week tiles compare this week vs last week of spend, and surface the next charge or the
//     tight point.

import type { LocalLedgerState, LocalLedgerTransaction, LocalRouteSummary } from './localLedger';
import type { LocalSubscriptionsModel } from './localSubscriptionsAdapter';
import type {
  TodayGoalSignal,
  TodayPathSummary,
  TodayTransaction,
} from '../surfaces/pressureMap/todayTypes';
import type { TodayNextCharge, TodayTightPoint } from '../surfaces/pressureMap/todayWeekTiles';

const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Category derivation — the spend strip + log sheet colour by a small key set. The ledger
// transaction carries no category, so we derive one from the title (never fabricated data — a
// best-effort keyword bucket, defaulting to 'other'). One of food|transport|fun|bills|shopping|other.
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: readonly { category: string; terms: readonly string[] }[] = [
  {
    category: 'food',
    terms: [
      'tesco',
      'sainsbury',
      'asda',
      'aldi',
      'lidl',
      'coffee',
      'cafe',
      'lunch',
      'food',
      'eat',
      'restaurant',
      'takeaway',
      'deliveroo',
      'uber eats',
      'mcdonald',
      'greggs',
      'pizza',
      'grocery',
    ],
  },
  {
    category: 'transport',
    terms: [
      'bus',
      'train',
      'tube',
      'uber',
      'taxi',
      'fuel',
      'petrol',
      'parking',
      'rail',
      'tfl',
      'travel',
    ],
  },
  {
    category: 'fun',
    terms: [
      'cinema',
      'pub',
      'bar',
      'game',
      'spotify',
      'netflix',
      'cinema',
      'concert',
      'fun',
      'night out',
    ],
  },
  {
    category: 'bills',
    terms: [
      'rent',
      'mortgage',
      'council',
      'water',
      'gas',
      'electric',
      'energy',
      'bill',
      'insurance',
      'phone',
      'broadband',
      'tv licence',
    ],
  },
  {
    category: 'shopping',
    terms: ['amazon', 'shop', 'clothes', 'argos', 'boots', 'next', 'h&m', 'zara', 'store'],
  },
];

export function deriveCategory(title: string): string {
  const lower = title.toLowerCase();
  for (const { category, terms } of CATEGORY_KEYWORDS) {
    if (terms.some((term) => lower.includes(term))) return category;
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// Transaction mapping — LocalLedgerTransaction → the presentation TodayTransaction. The sign is
// preserved (spends are negative). The category is derived (see above).
// ---------------------------------------------------------------------------

export function toTodayTransaction(transaction: LocalLedgerTransaction): TodayTransaction {
  return {
    id: transaction.id,
    merchant: transaction.title,
    category: deriveCategory(transaction.title),
    amountMinor: transaction.amountMinor,
    date: transaction.date,
  };
}

// ---------------------------------------------------------------------------
// Windowed spends — this week's spends (last 7 days inclusive) and the recent list (newest-first).
// Only real spends (negative amounts) are surfaced. "This week" is for the spend strip; "recent" is
// the list under it.
// ---------------------------------------------------------------------------

// A real spend is a negative-amount transaction. (Date windowing is applied per-caller.)
function isSpend(transaction: LocalLedgerTransaction): boolean {
  return transaction.amountMinor < 0;
}

function isoDaysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / MS_PER_DAY);
}

/** This week's spends: real spends dated within the last 7 days up to and including asOfDate. */
export function deriveWeekSpends(
  ledger: LocalLedgerState,
  asOfDate: string,
): readonly TodayTransaction[] {
  return ledger.transactions
    .filter(isSpend)
    .filter((transaction) => transaction.date <= asOfDate)
    .filter((transaction) => {
      const age = isoDaysBetween(transaction.date, asOfDate);
      return age >= 0 && age < 7;
    })
    .map(toTodayTransaction);
}

/** Recent spends, newest-first, real spends only (the screen renders the first 5). */
export function deriveRecentSpends(
  ledger: LocalLedgerState,
  asOfDate: string,
): readonly TodayTransaction[] {
  return ledger.transactions
    .filter(isSpend)
    .filter((transaction) => transaction.date <= asOfDate)
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date))
    .map(toTodayTransaction);
}

/** Sum of real spend magnitude within [windowStartInclusive, windowEndInclusive]. */
function sumSpendInWindow(ledger: LocalLedgerState, startIso: string, endIso: string): number {
  return ledger.transactions
    .filter(isSpend)
    .filter((transaction) => transaction.date >= startIso && transaction.date <= endIso)
    .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
}

function addIsoDays(iso: string, days: number): string {
  const base = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(base)) return iso;
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** This-week total spend (minor) — last 7 days up to asOfDate. */
export function deriveThisWeekMinor(ledger: LocalLedgerState, asOfDate: string): number {
  return sumSpendInWindow(ledger, addIsoDays(asOfDate, -6), asOfDate);
}

/** Prior-week total spend (minor) — the 7 days before this week. 0 → screen shows "no prior week". */
export function deriveLastWeekMinor(ledger: LocalLedgerState, asOfDate: string): number {
  return sumSpendInWindow(ledger, addIsoDays(asOfDate, -13), addIsoDays(asOfDate, -7));
}

// ---------------------------------------------------------------------------
// Path summary — coming in / going out / lowest, summed from the route points. Each point carries a
// signed deltaMinor; positives are money in, negatives money out. The lowest is the tightest balance.
// ---------------------------------------------------------------------------

export function derivePathSummary(route: LocalRouteSummary): TodayPathSummary {
  let comingInMinor = 0;
  let goingOutMinor = 0;
  for (const point of route.points) {
    if (point.deltaMinor > 0) comingInMinor += point.deltaMinor;
    else goingOutMinor += Math.abs(point.deltaMinor);
  }
  return {
    comingInMinor,
    goingOutMinor,
    lowestMinor: route.tightestBalanceMinor,
  };
}

// ---------------------------------------------------------------------------
// Goal signal — the user's tight-point goal (the "Melo-set floor") projected onto the route. The
// goal is a scalar on the ledger state (minor units, or null when unset). breachesGoal is true only
// when a goal is set AND the route's tightest balance falls below it — the honest "this drops below
// your floor" signal the What-if and Today surfaces read. No goal → never a breach.
// ---------------------------------------------------------------------------

export function deriveGoalSignal(
  ledger: LocalLedgerState,
  route: LocalRouteSummary,
): TodayGoalSignal {
  const tightPointGoalMinor = ledger.tightPointGoalMinor;
  const breachesGoal =
    tightPointGoalMinor !== null && route.tightestBalanceMinor < tightPointGoalMinor;
  return { tightPointGoalMinor, breachesGoal };
}

// ---------------------------------------------------------------------------
// Days to payday — the next future income point on the route. The route's nextPaydayLabel is human
// text, so we recompute the whole-day distance from the points (the first future positive delta).
// ---------------------------------------------------------------------------

export function deriveDaysToPayday(route: LocalRouteSummary, asOfDate: string): number {
  const nextIncome = route.points
    .filter((point) => point.deltaMinor > 0 && point.date >= asOfDate)
    .sort((left, right) => left.date.localeCompare(right.date))[0];
  if (nextIncome === undefined) return 0;
  return Math.max(0, isoDaysBetween(asOfDate, nextIncome.date));
}

// ---------------------------------------------------------------------------
// Range label — the path caption, e.g. "27 Jun → 25 Jul". From the first to the last route point.
// ---------------------------------------------------------------------------

function shortDate(iso: string): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function deriveRangeLabel(route: LocalRouteSummary, asOfDate: string): string {
  const first = route.points[0]?.date ?? asOfDate;
  const last = route.points[route.points.length - 1]?.date ?? addIsoDays(asOfDate, 28);
  return `${shortDate(first)} → ${shortDate(last)}`;
}

// ---------------------------------------------------------------------------
// Date label — the italic-serif Today date, e.g. "Saturday, 27 June".
// ---------------------------------------------------------------------------

export function deriveDateLabel(asOfDate: string): string {
  const ms = Date.parse(`${asOfDate}T00:00:00Z`);
  if (Number.isNaN(ms)) return asOfDate;
  return new Date(ms).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// Tight point tile — the day label + spare at the tightest point of the route.
// ---------------------------------------------------------------------------

export function deriveTightPoint(route: LocalRouteSummary): TodayTightPoint {
  return {
    dayLabel: route.tightestDay,
    spareMinor: route.tightestBalanceMinor,
  };
}

// ---------------------------------------------------------------------------
// Next charge tile — the soonest active subscription renewal. Undefined → the screen falls back to
// the tight point on the right tile. Built from the subscriptions model the container already has.
// ---------------------------------------------------------------------------

export function deriveNextCharge(
  subscriptions: LocalSubscriptionsModel,
): TodayNextCharge | undefined {
  const upcoming = subscriptions.rows
    .filter((row) => !row.paused)
    .slice()
    .sort((left, right) => left.nextRenewalDaysAway - right.nextRenewalDaysAway)[0];
  if (upcoming === undefined) return undefined;
  return {
    name: upcoming.name,
    costMinor: upcoming.costMinor,
    daysAway: upcoming.nextRenewalDaysAway,
  };
}
