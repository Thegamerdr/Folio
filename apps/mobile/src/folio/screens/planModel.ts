import { computeSpareAndTightest, groupByDay, type DerivedEvent } from '../lib/calendarEvents';

/** The pinned Plan Hub's forward-looking row shape. */
export type PlanUpcoming = Readonly<{
  id: string;
  date: string;
  name: string;
  amount: number;
  note: string;
}>;

/**
 * Exact ScreenPlanHub event selection: every real negative `out` event in the
 * period from today through the next resolved payday, in engine order. The
 * Calendar remains the longer 35-day view; Plan's headline and rows share this
 * payday-bounded period.
 */
export function buildPlanUpcoming(
  events: readonly DerivedEvent[],
  periodEnd?: string | null,
): PlanUpcoming[] {
  return events
    .filter(
      (event) =>
        event.kind === 'out' &&
        typeof event.amount === 'number' &&
        event.amount < 0 &&
        (periodEnd === undefined || periodEnd === null || event.date <= periodEnd),
    )
    .map((event) => ({
      id: event.id,
      date: event.date,
      name: event.title,
      amount: Math.abs(event.amount ?? 0),
      note: event.note ?? (event.recurring === 'monthly' ? 'monthly' : ''),
    }));
}

/**
 * ScreenPlanHub's exact balance projection. The pinned Plan surface starts at
 * the displayed current balance and applies its own calendar events; it does
 * not use the broader route's protected-pot spendable balance.
 */
export function buildPlanTightPoint(
  events: readonly DerivedEvent[],
  currentBalance: number,
  periodEnd?: string | null,
): Readonly<{ date: string | null; amount: number }> {
  const bounded =
    periodEnd === undefined || periodEnd === null
      ? events
      : events.filter((event) => event.date <= periodEnd);
  const result = computeSpareAndTightest(groupByDay([...bounded]), currentBalance);
  return { date: result.tightestDate, amount: result.tightestSpare };
}

/** Pinned-source date label: "Tue 1". */
export function shortPlanDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${date.getDate()}`;
}
