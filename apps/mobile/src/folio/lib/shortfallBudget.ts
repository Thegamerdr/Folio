import type { RouteResult } from './moneyPath';
import type { DerivedEvent } from './calendarEvents';

const REAL_OUTGOING_SOURCES: readonly DerivedEvent['source'][] = [
  'bill',
  'sub',
  'manual',
  'history',
];

/** Recovery uses current cash after obligations, living costs and the protected buffer.
 * `spare` is forecast closing cash ON payday, including that future receipt, so it cannot fund
 * discretionary spending before payday. Keep the gap exact; only the approximate daily guide rounds down.
 */
export function deriveShortfallBudget(route: RouteResult | null) {
  const headroom = route?.safeToSpend ?? route?.tightPoint.amount ?? 0;
  const gap = Math.max(0, Math.round(-headroom * 100) / 100);
  const daysLeft = route ? route.daysToPayday : 0;
  return {
    gap,
    daysLeft,
    dailyCap: Math.max(0, Math.floor(headroom / Math.max(1, daysLeft))),
  };
}

/** Select the Shortfall explanation from the same pre-income date horizon as the protected gap.
 * The route date remains a fallback for callers without Calendar presentation data. */
export function selectShortfallCause(args: {
  routeDate: string;
  lowestBeforeIncomeDate?: string;
  events: readonly DerivedEvent[];
}): { date: string; event: DerivedEvent | null } {
  const date = args.lowestBeforeIncomeDate ?? args.routeDate;
  const event =
    args.events
      .filter(
        (candidate) =>
          candidate.date === date &&
          candidate.amount !== undefined &&
          candidate.amount < 0 &&
          REAL_OUTGOING_SOURCES.includes(candidate.source),
      )
      .sort((left, right) => Math.abs(right.amount ?? 0) - Math.abs(left.amount ?? 0))[0] ?? null;
  return { date, event };
}
