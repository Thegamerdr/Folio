import type { DerivedEvent } from '@/folio/lib/calendarEvents';

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
 * calendar engine's 35-day window, in engine order. The Plan Hub deliberately
 * does not truncate this model at payday; its first four rows are only a visual
 * excerpt, while the dominant total/count cover the complete derived window.
 */
export function buildPlanUpcoming(events: readonly DerivedEvent[]): PlanUpcoming[] {
  return events
    .filter((event) => event.kind === 'out' && typeof event.amount === 'number' && event.amount < 0)
    .map((event) => ({
      id: event.id,
      date: event.date,
      name: event.title,
      amount: Math.abs(event.amount ?? 0),
      note: event.note ?? (event.recurring === 'monthly' ? 'monthly' : ''),
    }));
}

/** Pinned-source date label: "Tue 1". */
export function shortPlanDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${date.getDate()}`;
}
