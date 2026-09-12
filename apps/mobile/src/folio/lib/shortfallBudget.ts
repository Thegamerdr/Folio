import type { RouteResult } from './moneyPath';
import type { DerivedEvent } from './calendarEvents';

const REAL_OUTGOING_SOURCES: readonly DerivedEvent['source'][] = [
  'bill',
  'sub',
  'manual',
  'history',
];

function isProtectedOutgoing(candidate: DerivedEvent): boolean {
  return (
    candidate.amount !== undefined &&
    candidate.amount < 0 &&
    REAL_OUTGOING_SOURCES.includes(candidate.source) &&
    candidate.note !== 'Daily share of your weekly essentials'
  );
}

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
  nextIncomeDate?: string | null;
  gap: number;
  events: readonly DerivedEvent[];
}): { date: string; event: DerivedEvent | null } {
  const date = args.lowestBeforeIncomeDate ?? args.routeDate;
  // A missing next-income date means there is no trustworthy protected horizon to explain. Keep
  // the displayed date as the caller's fallback, but never name an event from an unbounded chart.
  const event = args.nextIncomeDate
    ? (() => {
        const protectedEvents = args.events.filter(
          (candidate) => candidate.date < args.nextIncomeDate! && isProtectedOutgoing(candidate),
        );
        const decisiveEvents = protectedEvents.filter(
          (candidate) => Math.abs(candidate.amount ?? 0) >= args.gap,
        );
        const lowDateDecisiveEvents = decisiveEvents.filter((candidate) => candidate.date === date);
        // A row is explanatory only when removing its recorded outflow could close the current
        // protected gap. This preserves a single decisive payment when smaller rows also exist,
        // while refusing to name a small payment as the cause of a larger buffer gap or choosing
        // between several decisive payments.
        return decisiveEvents.length === 1 && lowDateDecisiveEvents.length === 1
          ? (lowDateDecisiveEvents[0] ?? null)
          : null;
      })()
    : null;
  return { date, event };
}

export function formatShortfallCauseLine(event: DerivedEvent | null): string {
  return event
    ? `A payment to ${event.title} lands in that stretch.`
    : 'No single payment creates this gap. It builds across this stretch.';
}
