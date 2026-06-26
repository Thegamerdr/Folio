import { localDateTimeToUtc } from '@folio/calendar-engine';

import {
  formatMinorAmount,
  type LocalLedgerState,
  type LocalRoutePoint,
  type LocalRouteSummary,
} from './localLedger.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';

export type LocalCalendarTone = 'confirmed' | 'estimated' | 'attention';
export type LocalCalendarEventKind =
  | 'commitment'
  | 'income'
  | 'plan'
  | 'pressure'
  | 'recovery'
  | 'review'
  | 'route';

export type LocalCalendarEvent = Readonly<{
  actionLabel: string;
  date: string;
  day: string;
  title: string;
  detail: string;
  kind: LocalCalendarEventKind;
  sourceLabel: string;
  stateLabel: string;
  amount: string;
  tone: LocalCalendarTone;
}>;

export type LocalCalendarDaySummary = Readonly<{
  detail: string;
  label: string;
  tone: LocalCalendarTone;
  kind: LocalCalendarEventKind | 'quiet';
}>;

export type LocalCalendarModel = Readonly<{
  agenda: readonly LocalCalendarEvent[];
  calendarItemCount: number;
  plannerItemCount: number;
  materializedUtcInstants: readonly string[];
}>;

export function buildLocalCalendarModel(
  ledger: LocalLedgerState,
  route: LocalRouteSummary,
): LocalCalendarModel {
  const canonical = createCanonicalRepositoryForLocalLedgerState(ledger).snapshot().collections;

  const eventsById = new Map(canonical.events.map((event) => [String(event.id), event]));
  const commitmentsById = new Map(
    canonical.commitments.map((commitment) => [String(commitment.id), commitment]),
  );
  const plannerItemsById = new Map(canonical.plannerItems.map((item) => [String(item.id), item]));
  const plansById = new Map(canonical.plans.map((plan) => [String(plan.id), plan]));
  const planImpactsById = new Map(
    canonical.planImpacts.map((impact) => [String(impact.id), impact]),
  );
  const materializedUtcInstants: string[] = [];
  const routeRows = routeRowsForCalendar(route);
  const canonicalRows = canonical.calendarItems.map<LocalCalendarEvent>((item) => {
    const linkedEvent =
      item.eventId === undefined ? undefined : eventsById.get(String(item.eventId));
    const linkedCommitment =
      item.commitmentId === undefined ? undefined : commitmentsById.get(String(item.commitmentId));
    const linkedPlannerItem =
      item.plannerItemId === undefined
        ? undefined
        : plannerItemsById.get(String(item.plannerItemId));
    const linkedPlan = item.planId === undefined ? undefined : plansById.get(String(item.planId));
    const linkedPlanImpact =
      item.planImpactId === undefined ? undefined : planImpactsById.get(String(item.planImpactId));
    const localDateTime = `${item.localDate}T${item.localTime ?? '09:00:00'}`;
    materializedUtcInstants.push(
      localDateTimeToUtc({ local: localDateTime, timeZone: 'Europe/London' }),
    );
    const amountMinor =
      linkedEvent?.amount?.minorUnits ??
      linkedCommitment?.amount.minorUnits ??
      linkedPlanImpact?.protectedAmount.minorUnits ??
      linkedPlan?.targetAmount?.minorUnits;

    return {
      actionLabel:
        item.kind === 'task' || linkedPlanImpact?.needsReview === true
          ? 'Review linked item'
          : 'Reveal linked source',
      date: item.localDate,
      day: calendarDayLabel(item.localDate, ledger.asOfDate),
      title: item.title,
      detail:
        linkedPlannerItem !== undefined
          ? 'Review task'
          : linkedPlanImpact !== undefined
            ? 'Recovery follow-up'
            : linkedPlan !== undefined
              ? planCalendarDetail(item.title)
              : linkedCommitment !== undefined
                ? 'Protected commitment'
                : item.kind === 'money-event'
                  ? 'Money event'
                  : 'Calendar item',
      kind:
        linkedPlannerItem !== undefined
          ? 'review'
          : linkedPlanImpact !== undefined
            ? 'recovery'
            : linkedPlan !== undefined
              ? 'plan'
              : linkedCommitment !== undefined
                ? 'commitment'
                : item.kind === 'money-event' && (amountMinor ?? 0) > 0
                  ? 'income'
                  : 'route',
      sourceLabel:
        linkedPlannerItem !== undefined
          ? 'Planner item'
          : linkedPlanImpact !== undefined
            ? 'Plan impact'
            : linkedPlan !== undefined
              ? 'Plan'
              : linkedCommitment !== undefined
                ? 'Commitment'
                : 'Calendar item',
      stateLabel: `${item.authorityState.replace(/-/g, ' ')}${
        linkedPlanImpact?.needsReview === true ? ' - needs review' : ''
      }`,
      amount: amountMinor === undefined ? '' : formatMinorAmount(amountMinor),
      tone:
        item.authorityState === 'estimated' || item.authorityState === 'inferred'
          ? 'attention'
          : linkedPlanImpact?.needsReview === true
            ? 'attention'
            : item.kind === 'task'
              ? 'attention'
              : item.authorityState === 'user-confirmed' || item.authorityState === 'confirmed'
                ? 'confirmed'
                : 'estimated',
    };
  });

  return {
    agenda: [...dedupeCalendarEvents([...routeRows, ...canonicalRows])].sort(compareCalendarEvents),
    calendarItemCount: canonical.calendarItems.length,
    plannerItemCount: canonical.plannerItems.length,
    materializedUtcInstants,
  };
}

export function filterLocalCalendarEventsForDate(
  events: readonly LocalCalendarEvent[],
  date: string,
): readonly LocalCalendarEvent[] {
  return events.filter((event) => event.date === date);
}

export function summarizeLocalCalendarDay(
  events: readonly LocalCalendarEvent[],
): LocalCalendarDaySummary {
  if (events.length === 0) {
    return {
      detail: 'No linked item',
      kind: 'quiet',
      label: 'Quiet',
      tone: 'estimated',
    };
  }

  const firstAttention = events.find((event) => event.tone === 'attention');
  if (firstAttention !== undefined) {
    return {
      detail: firstAttention.title,
      kind: firstAttention.kind === 'route' ? 'pressure' : firstAttention.kind,
      label: firstAttention.kind === 'review' ? 'Review' : 'Pressure',
      tone: 'attention',
    };
  }

  const priority =
    events.find((event) => event.kind === 'income') ??
    events.find((event) => event.kind === 'commitment') ??
    events.find((event) => event.kind === 'plan') ??
    events.find((event) => event.kind === 'recovery') ??
    events[0];

  if (priority === undefined) {
    return {
      detail: 'No linked item',
      kind: 'quiet',
      label: 'Quiet',
      tone: 'estimated',
    };
  }

  return {
    detail: priority.title,
    kind: priority.kind,
    label: calendarKindLabel(priority.kind),
    tone: priority.tone,
  };
}

function routeRowsForCalendar(route: LocalRouteSummary): readonly LocalCalendarEvent[] {
  const routeTone = route.tightestBalanceMinor < 0 ? 'attention' : 'confirmed';
  return [
    {
      actionLabel: 'Reveal route source',
      date: route.points[0]?.date ?? 'local',
      day: route.points[0]?.label ?? 'Today',
      title: 'Current route',
      detail: `${formatMinorAmount(route.availableNowMinor)} breathing room`,
      kind: route.tightestBalanceMinor < 0 ? 'pressure' : 'route',
      sourceLabel: route.points[0]?.sourceLabel ?? 'Local route',
      stateLabel: route.points[0]?.reviewState ?? 'already real',
      amount: formatMinorAmount(route.availableNowMinor),
      tone: routeTone,
    },
    ...route.points.slice(1).map((point) => routePointCalendarEvent(point)),
  ];
}

function routePointCalendarEvent(point: LocalRoutePoint): LocalCalendarEvent {
  return {
    actionLabel: point.actionLabel,
    date: point.date,
    day: point.label,
    title: point.title,
    detail: point.explanation,
    kind: routePointCalendarKind(point),
    sourceLabel: point.sourceLabel,
    stateLabel: point.reviewState,
    amount: formatMinorAmount(point.balanceMinor),
    tone: point.tone,
  };
}

function routePointCalendarKind(point: LocalRoutePoint): LocalCalendarEventKind {
  if (point.pointKind === 'shortfall') return 'pressure';
  if (point.pointKind === 'commitment') return 'commitment';
  if (point.pointKind === 'plan') return 'plan';
  if (point.pointKind === 'expected' && point.deltaMinor > 0) return 'income';
  if (point.pointKind === 'preview') return 'pressure';
  return 'route';
}

function calendarKindLabel(kind: LocalCalendarEventKind): string {
  switch (kind) {
    case 'commitment':
      return 'Bill';
    case 'income':
      return 'Income';
    case 'plan':
      return 'Plan';
    case 'pressure':
      return 'Pressure';
    case 'recovery':
      return 'Recovery';
    case 'review':
      return 'Review';
    case 'route':
      return 'Route';
  }
}

function dedupeCalendarEvents(
  events: readonly LocalCalendarEvent[],
): readonly LocalCalendarEvent[] {
  return events.filter((event, index) => {
    if (
      event.sourceLabel !== 'Manual' &&
      event.sourceLabel !== 'Private example' &&
      event.sourceLabel !== 'Statement'
    ) {
      return true;
    }
    return !events.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        candidate.date === event.date &&
        candidate.title === event.title &&
        candidate.sourceLabel !== event.sourceLabel,
    );
  });
}

function planCalendarDetail(title: string): string {
  if (/\bplanned contribution\b/i.test(title)) return 'Planned contribution';
  if (/\breview\b/i.test(title)) return 'Plan review date';
  return 'Plan deadline';
}

function compareCalendarEvents(left: LocalCalendarEvent, right: LocalCalendarEvent): number {
  const date = left.date.localeCompare(right.date);
  if (date !== 0) return date;
  const tone = calendarToneWeight(left.tone) - calendarToneWeight(right.tone);
  if (tone !== 0) return tone;
  return left.title.localeCompare(right.title);
}

function calendarToneWeight(tone: LocalCalendarTone): number {
  if (tone === 'attention') return 0;
  if (tone === 'confirmed') return 1;
  return 2;
}

function calendarDayLabel(date: string, asOfDate: string): string {
  if (date <= asOfDate) return date === asOfDate ? 'Today' : 'Past';
  const distance = Math.round(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${asOfDate}T00:00:00.000Z`)) / 86_400_000,
  );
  if (distance === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}
