/**
 * Money-path route engine — the curve behind Today.
 *
 * Builds the projected-balance path forward from today, one sample per calendar
 * day. By default the window is "today → payday inclusive"; a caller may pass
 * `windowDays` to sample further (the Calendar's fixed 35-day picture) so a dip
 * that lands AFTER payday — next month's start-of-month bills — is part of the
 * curve and the tight point, not clipped at payday. `daysToPayday` and `spare`
 * still describe payday itself regardless of how far the window runs. Per
 * ENGINES.md §6:
 *   - "Today — path shape (curve definition)"
 *   - "Today — band toggle (the band is a LENS, not a recompute)"
 *   - "Today — path scrub"
 *   - "Pots ↔ spendable money"
 *
 * For each sampled day, y is:
 *   balance
 *     + Σ(income up to and including that day)
 *     − Σ(bills, subs, logged spend, active holds up to and including that day)
 *     − Σ(pots.saved)            // earmarked cash lowers the whole path
 *     + Σ(open-borrows)          // borrowing from a pot lifts it back up
 *
 * The tight point is `min(y)` across the sampled days; ties resolve to the
 * earliest day. `spare` is the balance on payday (the last sampled day) — a
 * read-out of the curve, never a separate calculation. `spendable` per the
 * Pots decision is `balance − Σ pots.saved + Σ open-borrows`; pots and borrows
 * therefore shift every sampled day by the same flat offset, which is why the
 * band toggle can be a pure viewing lens with no recompute.
 *
 * HARD CONTRACT: this module is pure and deterministic. It accepts `now` and
 * `payday` as ISO date strings (YYYY-MM-DD) and never calls `Date.now()` or
 * reads the store singleton. Same input → byte-identical output. No
 * react-native imports, no UI.
 *
 * Types are intentionally local to keep the engine free of `@/folio/store`
 * runtime coupling; callers map store rows onto these shapes. (The store import
 * allowance in the brief is only for types, and none are needed here.)
 */

const DAY_MS = 86_400_000;

/** A signed money event landing on a calendar day. `amount` is the magnitude
 *  in the sign convention of its bucket: income is read as positive, while
 *  bills/subs/spend/holds are read as outflow magnitudes (a positive `amount`
 *  reduces the balance). Logged spend may carry a NEGATIVE amount to model an
 *  in-flow correction (e.g. a refund) without leaving the spend ledger. */
export type DatedAmount = {
  /** ISO date YYYY-MM-DD the money moves on. */
  date: string;
  /** £ magnitude in this bucket's convention (see the bucket's field doc). */
  amount: number;
};

/** A pot's earmarked balance. Only `saved` matters to the path: Σ saved is
 *  subtracted from every day so the curve never shows earmarked money as
 *  spendable (ENGINES.md §6 "Pots ↔ spendable money"). */
export type PotSaved = {
  saved: number;
};

export type RouteInput = {
  /** "Today" as an ISO date YYYY-MM-DD. Injected — never Date.now(). */
  now: string;
  /** Payday as an ISO date YYYY-MM-DD. Defines `daysToPayday` (today → payday).
   *  It no longer bounds the SAMPLED window — see `windowDays`. The path still
   *  runs from today, but samples out to `max(daysToPayday, windowDays)` so a
   *  dip that lands AFTER payday (e.g. month-start bills) is not clipped away. */
  payday: string;
  /** How many calendar days forward to SAMPLE the curve, today inclusive
   *  (today..today+windowDays). Defaults to the days-to-payday span when omitted,
   *  preserving the original "today → payday inclusive" shape. The Calendar's
   *  ladder derives its events over a fixed 35-day window; `routeFromStore` passes
   *  the same 35 here so the route's tight point and the Calendar ladder minimum
   *  are ONE number on ONE day. The sampled window is always at least the
   *  days-to-payday span, so payday itself is always sampled (spare stays a
   *  read-out of payday's balance). */
  windowDays?: number;
  /** The verifiable starting balance. `routeFromStore` passes
   *  `currentBalance.amount − Σ pots.saved` (earmarked pot cash folded in as the
   *  flat starting earmark, matching the Calendar's ladder anchor), so pots are
   *  modelled as DATED top-up dips in the buckets below, never as the internal
   *  flat `pots` plateau. */
  balance: number;
  /** Income / inflows. `amount` positive = money in. */
  income: DatedAmount[];
  /** Recurring bills. `amount` positive = outflow magnitude. */
  bills: DatedAmount[];
  /** Subscription renewals. `amount` positive = outflow magnitude. */
  subs: DatedAmount[];
  /** Logged spend. `amount` positive = outflow magnitude; negative = inflow
   *  correction (refund) so the path stays honest without a separate bucket. */
  spend: DatedAmount[];
  /** Active spend-holds / WhatIf holds. `amount` positive = outflow magnitude. */
  holds: DatedAmount[];
  /** Pots tied to cash — Σ saved lowers the whole path. */
  pots: PotSaved[];
  /** Σ open pot-borrows — lifts the whole path back up. */
  openBorrows: number;
};

export type RoutePoint = {
  /** ISO date YYYY-MM-DD this sample lands on. */
  date: string;
  /** Projected balance after that day's money has moved. */
  y: number;
};

export type RouteResult = {
  /** One point per calendar day, today inclusive, in date order. Spans today →
   *  payday by default, or today → today+windowDays when a window is given. */
  points: RoutePoint[];
  /** The lowest projected balance across the sampled window and the day it lands
   *  on (earliest day wins ties). The headline "will my money last?" number. */
  tightPoint: { date: string; amount: number };
  /** Balance on payday — the read-out of the curve at the days-to-payday sample,
   *  not the last sampled day (the window can extend past payday). */
  spare: number;
  /** Whole calendar days from today to payday (0 when payday is today). */
  daysToPayday: number;
};

/** Parse an ISO YYYY-MM-DD to a UTC-midnight epoch. Using UTC (not local)
 *  keeps day indexing deterministic across host timezones — the engine must
 *  return the same points on any machine. Throws on a malformed date so a bad
 *  caller fails fast rather than silently producing NaN days. */
function isoToUtcMs(iso: string): number {
  const parts = iso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (
    parts.length !== 3 ||
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d)
  ) {
    throw new Error(`moneyPath: invalid ISO date "${iso}"`);
  }
  return Date.UTC(y, m - 1, d);
}

/** Format a UTC-midnight epoch back to ISO YYYY-MM-DD. */
function utcMsToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole UTC days between two midnight epochs (b − a). */
function dayDiff(aMs: number, bMs: number): number {
  return Math.round((bMs - aMs) / DAY_MS);
}

/** Sum a bucket's amounts that land on a given UTC day index (0 = today),
 *  honouring the [0, lastIndex] window. Out-of-window dates are ignored so
 *  back-dated or future items never bend this cycle's curve. */
function bucketByDayIndex(
  items: DatedAmount[],
  todayMs: number,
  lastIndex: number,
): number[] {
  // One slot per sampled day; default 0 (noUncheckedIndexedAccess-safe reads
  // are still guarded below since TS widens fixed-fill arrays to T | undefined).
  const perDay: number[] = new Array<number>(lastIndex + 1).fill(0);
  for (const item of items) {
    const idx = dayDiff(todayMs, isoToUtcMs(item.date));
    if (idx < 0 || idx > lastIndex) continue;
    const current = perDay[idx] ?? 0;
    perDay[idx] = current + item.amount;
  }
  return perDay;
}

/**
 * Compute the money-path route from today through payday.
 *
 * Pure and deterministic — see the module header for the curve definition and
 * the no-`Date.now()` contract.
 */
export function computeRoute(input: RouteInput): RouteResult {
  const todayMs = isoToUtcMs(input.now);
  const paydayMs = isoToUtcMs(input.payday);

  // Payday before today is meaningless for a forward path; clamp to a
  // single-day window (today only) rather than producing negative samples.
  // `daysToPayday` stays the span to payday — that is what the headline
  // "X days to payday" reads and what `spare` is sampled at, regardless of how
  // far the curve is sampled.
  const rawSpan = dayDiff(todayMs, paydayMs);
  const daysToPayday = rawSpan > 0 ? rawSpan : 0;

  // The SAMPLED window. Defaults to the days-to-payday span (the original
  // "today → payday inclusive" shape, so the existing pure tests are unchanged).
  // When a caller passes `windowDays` (the Calendar's 35-day picture), the curve
  // samples at least that far — but never fewer days than it takes to reach
  // payday, so payday is always a sampled point and `spare` below stays valid.
  const requestedWindow =
    typeof input.windowDays === 'number' && input.windowDays > daysToPayday
      ? Math.trunc(input.windowDays)
      : daysToPayday;
  const lastIndex = requestedWindow;

  // Per-day net flows. Income is read positive; bills/subs/spend/holds are
  // outflow magnitudes (subtracted). Spend may carry a negative amount to
  // model an inflow correction, so we ADD spend after negating outflows —
  // i.e. a positive spend reduces the balance, a negative spend lifts it.
  const incomeByDay = bucketByDayIndex(input.income, todayMs, lastIndex);
  const billsByDay = bucketByDayIndex(input.bills, todayMs, lastIndex);
  const subsByDay = bucketByDayIndex(input.subs, todayMs, lastIndex);
  const spendByDay = bucketByDayIndex(input.spend, todayMs, lastIndex);
  const holdsByDay = bucketByDayIndex(input.holds, todayMs, lastIndex);

  // Flat offsets applied to every day: earmarked cash lowers the path, open
  // borrows lift it back up. This is what makes the band toggle a pure lens —
  // the offset is the same on every sampled day, so no per-band recompute.
  const potsTotal = input.pots.reduce((acc, p) => acc + p.saved, 0);
  const offset = input.openBorrows - potsTotal;

  const points: RoutePoint[] = [];
  let running = input.balance + offset;

  let tightAmount = Infinity;
  let tightDate = input.now;

  for (let i = 0; i <= lastIndex; i++) {
    const inflow = incomeByDay[i] ?? 0;
    const outflow = (billsByDay[i] ?? 0) + (subsByDay[i] ?? 0) + (spendByDay[i] ?? 0) + (holdsByDay[i] ?? 0);
    running += inflow - outflow;

    const date = utcMsToIso(todayMs + i * DAY_MS);
    points.push({ date, y: running });

    // Strict `<` keeps the EARLIEST day on a tie (we never overwrite an equal
    // earlier low) — ENGINES.md §6 "ties resolve to the earliest day".
    if (running < tightAmount) {
      tightAmount = running;
      tightDate = date;
    }
  }

  // `spare` is the balance ON PAYDAY — the read-out of the curve at the
  // days-to-payday sample, NOT the last sampled day (the window can now extend
  // past payday into the following month's bills, which must not masquerade as
  // payday's spare). Falls back to the starting balance when no point exists.
  const paydayPoint = points[daysToPayday];
  const spare = paydayPoint ? paydayPoint.y : input.balance + offset;

  return {
    points,
    tightPoint: { date: tightDate, amount: tightAmount },
    spare,
    daysToPayday,
  };
}
