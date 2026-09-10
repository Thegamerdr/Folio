import type { AppState } from '../store';
import { buildFinancialPlanFromState, toFinancialPlanInput } from './financialPlan';
import { formatFinancialDate } from './financialPresentation';
import {
  deriveCalendarEvents,
  deriveHistoricalDayEvents,
  groupByDay,
  type DerivedEvent,
} from './calendarEvents';

const DAY = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** Missing history and dates outside the forecast are unknown, never a zero balance. */
export function knownCalendarBalances(
  dates: readonly string[],
  balances: Readonly<Record<string, number | undefined>>,
): number[] {
  return dates.flatMap((date) => {
    const value = balances[date];
    return typeof value === 'number' && Number.isFinite(value) ? [value] : [];
  });
}

/** One read-only presentation for Calendar and Full day. Financial dates, unpaid amounts and
 * balances come from the same plan as Today. Calendar-only notes and recorded history are retained.
 * Always use date-only UTC for the legacy informational derivation: local midnight shifts dates
 * during British summer time. No displayed event is replayed into cash or the finance engine. */
export function buildCalendarPresentation(state: AppState, now: Date, windowDays = 365) {
  const input = toFinancialPlanInput(state, { now });
  const plan = buildFinancialPlanFromState(state, { now });
  const today = String(input.asOf);
  const end = shift(today, windowDays);
  const lowestBeforeIncome = plan.timeline
    .filter((point) => !plan.nextIncomeDate || point.date < plan.nextIncomeDate)
    .reduce((lowest, point) => (point.closingMinor < lowest.closingMinor ? point : lowest), {
      date: plan.asOf,
      closingMinor: plan.currentBalanceMinor,
    });
  const events: DerivedEvent[] = [];
  const add = (event: DerivedEvent) => {
    if (event.date <= end) events.push(event);
  };

  for (const event of input.income ?? []) {
    if (event.date !== today) continue;
    add({
      id: event.id,
      date: event.date,
      kind: 'in',
      source: 'payday',
      title: event.label ?? 'Income',
      note: 'Income dated today · already included in your entered balance',
    });
  }
  for (const item of plan.events) {
    const date = item.originalDate ?? item.date;
    const sub = state.subs.find((row) => item.id.startsWith(`subscription:${row.name}:`));
    const manual = state.calendarEvents.find((row) => item.id === `calendar:${row.id}`);
    const debt =
      item.source === 'debt-minimum'
        ? (input.debts ?? []).find((row) => item.id.startsWith(`debt-minimum:${row.id}:`))
        : undefined;
    const pot = item.id === 'pots:protected' || item.id.startsWith('derived:pot');
    // The adapter keeps the actual subscription occurrence in its stable ID. A temporary
    // forecast shift changes the displayed day, not when the bill is due with its provider.
    const obligationDate = sub ? item.id.slice(-10) : date;
    const forecastShifted = Boolean(sub && date !== obligationDate);
    const overdue = obligationDate < today;
    const forecastDatePassed = forecastShifted && date < today;
    const status = overdue
      ? 'Overdue'
      : forecastDatePassed
        ? 'Forecast date passed'
        : obligationDate === today
          ? 'Due today'
          : 'Due';
    const obligationNote = `${status} · ${
      overdue || forecastDatePassed
        ? 'still reserved until confirmed paid'
        : 'not yet confirmed paid'
    }${forecastShifted ? `. Bill due ${formatFinancialDate(obligationDate)}; provider date unchanged.` : ''}`;
    const kind = item.amountMinor < 0 ? ('out' as const) : ('in' as const);
    add({
      id: manual?.id ?? item.id,
      date,
      kind,
      source:
        item.source === 'income'
          ? 'payday'
          : sub
            ? 'sub'
            : manual
              ? 'manual'
              : debt || item.source === 'living'
                ? 'bill'
                : pot
                  ? 'pot'
                  : 'hold',
      title: debt ? `${debt.name} · minimum payment` : item.label,
      amount: item.amountMinor / 100,
      note:
        item.source === 'income'
          ? 'Expected income'
          : item.source === 'living'
            ? 'Daily share of your weekly essentials'
            : pot
              ? 'Money set aside · excluded from available balance'
              : obligationNote,
      ...(sub
        ? {
            subName: sub.name,
            ...(sub.renewalPeriodDays === undefined ? { recurring: 'monthly' as const } : {}),
          }
        : {}),
      ...(manual ? { manual: true, ...(manual.time ? { time: manual.time } : {}) } : {}),
    });
  }
  // Paid occurrences stay visible as dated records, with no new outflow.
  for (const sub of state.subs)
    for (const [date, resolution] of Object.entries(sub.obligationOccurrences ?? {})) {
      if (resolution.status !== 'paid') continue;
      const due = shift(date, state.subOverrides[sub.name] ?? 0);
      add({
        id: `paid:${sub.name}:${date}`,
        date: due,
        kind: 'review',
        source: 'bill',
        title: sub.name,
        note: 'Confirmed already paid · included in your cash balance',
      });
    }
  for (const event of state.calendarEvents) {
    if (
      event.kind === 'out' &&
      (event.obligationStatus === 'paid' || event.obligationStatus === 'settled')
    )
      add({
        id: `paid:${event.id}`,
        date: event.date,
        kind: 'review',
        source: 'manual',
        title: event.title,
        note: 'Confirmed already paid · included in your cash balance',
        manual: true,
      });
  }
  const informational = deriveCalendarEvents({
    subs: [],
    subPaused: {},
    onboarding: { ...state.onboarding, monthlyIncome: 0 },
    manualEvents: state.calendarEvents.filter(
      (event) => event.kind !== 'in' && event.kind !== 'out',
    ),
    now: new Date(`${today}T00:00:00Z`),
    windowDays,
    includeSampleBills: false,
  });
  events.push(...informational);
  const trialNotes = deriveCalendarEvents({
    subs: state.subs,
    subPaused: state.subPaused,
    onboarding: { ...state.onboarding, monthlyIncome: 0 },
    manualEvents: [],
    now: new Date(`${today}T00:00:00Z`),
    windowDays,
    includeSampleBills: false,
  }).filter((event) => event.kind === 'review');
  events.push(...trialNotes);
  const historical = deriveHistoricalDayEvents(state.transactions, today);
  const eventsByDay: Record<string, DerivedEvent[]> = {};
  for (const group of groupByDay(events)) eventsByDay[group.date] = group.events;
  for (const [date, records] of Object.entries(historical))
    eventsByDay[date] = [...(eventsByDay[date] ?? []), ...records];
  const spareByDay: Record<string, number> = {};
  let closing = plan.currentBalanceMinor;
  let index = 0;
  for (let day = 0; day <= windowDays; day += 1) {
    const date = shift(today, day);
    while (index < plan.timeline.length && plan.timeline[index]!.date <= date) {
      closing = plan.timeline[index]!.closingMinor;
      index += 1;
    }
    spareByDay[date] = closing / 100;
  }
  return {
    plan,
    lowestBeforeIncome,
    today,
    end,
    events: events.sort((a, b) => a.date.localeCompare(b.date)),
    groups: groupByDay(events),
    eventsByDay,
    spareByDay,
  };
}
