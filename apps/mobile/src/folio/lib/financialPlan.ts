/**
 * AppState -> finance-engine bridge.
 *
 * This is deliberately the only live-store adapter for the canonical cash plan. It translates the
 * existing Folio fields into dated engine inputs and leaves all arithmetic to @folio/finance-engine.
 * Manual setup therefore works without Open Banking, while imported/provider rows can continue to
 * enter through the same state later.
 */
import {
  calculateFinancialPlan,
  expandObligationOccurrences,
  remainingObligationMinor,
  type DebtStrategy,
  type FinancialCashflow,
  type FinancialCommitment,
  type FinancialLivingCost,
  type FinancialPlanInput,
  type FinancialPlanResult,
} from '@folio/finance-engine';

import type { AppState } from '../store';
import { deriveCalendarEvents } from './calendarEvents';
import { projectIncomeEvents } from './income';
import { reanchorRenewals } from './renewalMath';

const DAY_MS = 86_400_000;
const DEFAULT_HORIZON_DAYS = 365;
export type ExtraDebtPaymentCadence = 'once' | 'weekly' | 'monthly';

export type FinancialPlanAdapterOptions = Readonly<{
  now?: Date;
  /** Optional explicit essentials entered by the manual setup flow. */
  livingCosts?: readonly FinancialLivingCost[];
  strategy?: DebtStrategy;
  selectedDebtId?: string;
  /** Explicit extra amount for the debt projection; omitted means no extra scenario. */
  recurringExtraDebtPaymentMinor?: number;
  /** How the explicit extra amount is applied in the debt projection. */
  extraDebtPaymentCadence?: ExtraDebtPaymentCadence;
  horizonDays?: number;
}>;

function isoDayLocal(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function poundsToMinor(amount: number): number {
  return Math.round(amount * 100);
}

function bankBalanceOf(state: AppState): number {
  const accounts = state.accounts ?? [];
  if (accounts.length === 0) return state.currentBalance.amount;
  return accounts
    .filter((account) => !account.isLiability && !account.closed)
    .reduce((sum, account) => sum + account.balanceMinor, 0);
}

function nextMonthlyDay(today: string, dayOfMonth: number): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const candidateFor = (candidateYear: number, candidateMonth: number): string => {
    const days = new Date(Date.UTC(candidateYear, candidateMonth, 0)).getUTCDate();
    return `${String(candidateYear).padStart(4, '0')}-${String(candidateMonth).padStart(2, '0')}-${String(Math.min(Math.max(1, dayOfMonth), days)).padStart(2, '0')}`;
  };
  const thisMonth = candidateFor(year, month);
  if (thisMonth >= today) return thisMonth;
  return candidateFor(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
}

function incomeEvents(state: AppState, today: string, horizonDays: number): FinancialCashflow[] {
  const events: FinancialCashflow[] = [];
  const sources = state.incomeSources ?? [];
  if (sources.length > 0) {
    events.push(
      ...projectIncomeEvents(sources, today, horizonDays).map((event) => ({
        id: `income:${event.sourceId}:${event.date}`,
        date: event.date,
        amountMinor: poundsToMinor(event.amount),
        label: event.label,
        kind: 'income' as const,
      })),
    );
  } else if (state.onboarding.monthlyIncome > 0 && state.onboarding.payday > 0) {
    // A monthly amount without a known payday is not a reliable dated receipt. Keep the horizon
    // explicitly unknown instead of inventing the historical day-25 fallback.
    const payday = nextMonthlyDay(today, state.onboarding.payday);
    let cursor = payday;
    for (
      let index = 0;
      index < Math.ceil(horizonDays / 28) + 1 && cursor <= addDays(today, horizonDays);
      index += 1
    ) {
      events.push({
        id: `onboarding-income:${cursor}`,
        date: cursor,
        amountMinor: poundsToMinor(state.onboarding.monthlyIncome),
        label: 'Income',
        kind: 'income',
      });
      const year = Number(cursor.slice(0, 4));
      const month = Number(cursor.slice(5, 7));
      cursor = nextMonthlyDay(
        `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`,
        state.onboarding.payday,
      );
    }
  }
  // A manually dated calendar receipt is a reliable fact for this projection, even when the
  // user has no recurring income source. It shares the same engine input as inferred income.
  const end = addDays(today, horizonDays);
  for (const event of state.calendarEvents ?? []) {
    if (event.kind !== 'in' || event.amount === undefined || event.amount <= 0 || event.date > end)
      continue;
    events.push({
      id: `calendar-income:${event.id}`,
      date: event.date,
      amountMinor: poundsToMinor(event.amount),
      label: event.title,
      kind: 'income',
    });
  }
  events.sort(
    (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );
  return events;
}

function addCalendarMonths(anchor: string, months: number): string {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)) - 1 + months;
  const day = Number(anchor.slice(8, 10));
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function commitmentEvents(
  state: AppState,
  today: string,
  horizonDays: number,
): FinancialCommitment[] {
  const end = addDays(today, horizonDays);
  const commitments: FinancialCommitment[] = [];
  for (const event of state.calendarEvents) {
    if (event.kind !== 'out' || event.amount === undefined) continue;
    const amountMinor = remainingObligationMinor(poundsToMinor(Math.abs(event.amount)), {
      ...(event.obligationStatus === undefined ? {} : { status: event.obligationStatus }),
      ...(event.obligationPaidMinor === undefined ? {} : { paidMinor: event.obligationPaidMinor }),
    });
    if (amountMinor > 0)
      commitments.push({
        id: `calendar:${event.id}`,
        date: event.date,
        amountMinor,
        label: event.title,
        movable: false,
      });
  }
  const anchoredSubs = reanchorRenewals(state.subs, today).items;
  for (const subscription of anchoredSubs) {
    const anchor = subscription.obligationAnchorISO ?? subscription.nextRenewalISO ?? today;
    const dateOffset = state.subOverrides[subscription.name] ?? 0;
    // Legacy persisted subscriptions can contain zero/invalid cadence values. Treat those as
    // calendar-monthly (the canonical undefined cadence) and keep a finite occurrence bound so a
    // malformed value can never turn the forecast loop into `Infinity`.
    const rawPeriod = subscription.renewalPeriodDays;
    const period =
      typeof rawPeriod === 'number' && Number.isSafeInteger(rawPeriod) && rawPeriod > 0
        ? rawPeriod
        : undefined;
    for (const occurrence of expandObligationOccurrences({
      anchor,
      through: addDays(end, -dateOffset),
      amountMinor: poundsToMinor(subscription.cost),
      ...(period === undefined ? {} : { periodDays: period }),
      ...(subscription.obligationOccurrences === undefined
        ? {}
        : { resolutions: subscription.obligationOccurrences }),
    })) {
      const date = addDays(occurrence.date, dateOffset);
      const { amountMinor } = occurrence;
      // A prospective pause skips future charges. It cannot settle a bill already overdue at
      // the time of the pause. Legacy paused rows have no earlier tracked pause date.
      if (
        state.subPaused[subscription.name] &&
        subscription.pausedUntil !== undefined &&
        date > (subscription.pausedAt ?? today) &&
        date < subscription.pausedUntil
      )
        continue;
      commitments.push({
        id: `subscription:${subscription.name}:${occurrence.date}`,
        date,
        amountMinor,
        label: subscription.name,
        category: 'subscription',
        movable: true,
      });
    }
  }
  // Keep Recovery and What-if commitments on the same canonical calendar derivation used by the
  // route. Passing no subs/manual events here avoids re-adding the explicit rows handled above,
  // while preserving pot top-ups (including after-payday anchors) and daily spend/scenario holds.
  const derived = deriveCalendarEvents({
    subs: [],
    subPaused: {},
    onboarding: state.onboarding,
    manualEvents: [],
    pots: state.pots ?? [],
    incomeSources: state.incomeSources ?? [],
    spendHold: state.spendHold ?? null,
    // What-if recurrence is expanded below so monthly means calendar-monthly (day anchored),
    // rather than the calendar screen's legacy 30-day visual cadence.
    whatIfHolds: [],
    windowDays: horizonDays,
    now: new Date(`${today}T00:00:00Z`),
    includeSampleBills: false,
  });
  for (const event of derived) {
    if (event.kind !== 'out' || event.amount === undefined || event.amount >= 0) continue;
    commitments.push({
      id: `derived:${event.id}`,
      date: event.date,
      amountMinor: poundsToMinor(-event.amount),
      label: event.title,
      category: event.source,
      movable: event.source === 'hold',
    });
  }
  for (const hold of state.whatIfHolds ?? []) {
    if (!(hold.amount > 0)) continue;
    for (let occurrence = 0; occurrence < (hold.recurrence === 'once' ? 1 : 13); occurrence += 1) {
      const date =
        hold.recurrence === 'monthly'
          ? addCalendarMonths(today, occurrence)
          : addDays(today, occurrence * 7);
      if (date > end) break;
      commitments.push({
        id: `what-if:${hold.id}:${date}`,
        date,
        amountMinor: poundsToMinor(hold.amount),
        label: hold.label ?? `Hold · £${hold.amount}`,
        category: 'hold',
        movable: true,
      });
    }
  }
  const protectedPotMinor = Math.round(
    state.pots.reduce((sum, pot) => sum + Math.max(0, pot.saved), 0) * 100,
  );
  if (protectedPotMinor > 0) {
    commitments.push({
      id: 'pots:protected',
      date: today,
      amountMinor: protectedPotMinor,
      label: 'Money already set aside',
      priority: 'other',
      movable: true,
    });
  }
  return commitments;
}

function dailyEssentials(
  state: AppState,
  today: string,
  horizonDays: number,
): FinancialLivingCost[] {
  const weekly = state.modeExtras?.reset ?? 0;
  if (weekly <= 0) return [];
  const weeklyMinor = poundsToMinor(weekly);
  return Array.from({ length: horizonDays }, (_, index) => {
    const date = addDays(today, index);
    const amountMinor =
      Math.floor(((index + 1) * weeklyMinor) / 7) - Math.floor((index * weeklyMinor) / 7);
    return { id: `essentials:${date}`, date, amountMinor, label: 'Essential living' };
  });
}

export function toFinancialPlanInput(
  state: AppState,
  options: FinancialPlanAdapterOptions = {},
): FinancialPlanInput {
  const today = isoDayLocal(options.now ?? new Date());
  const horizonDays = options.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const income = incomeEvents(state, today, horizonDays);
  const incomeCandidates = [
    ...income.filter((event) => event.date > today).map((event) => event.date),
  ]
    .filter((date): date is string => date != null)
    .sort();
  const next = incomeCandidates[0];
  const debts = (state.debts ?? []).map((debt) => ({
    id: debt.id,
    name: debt.name,
    balanceMinor: poundsToMinor(debt.balance),
    // Existing Debt.apr is numeric and 0 is a confirmed interest-free value. Future adapters can
    // pass null when the source has no APR; the engine never turns null into 0%.
    aprBps: debt.aprKnown === false ? null : Math.round(debt.apr * 100),
    ...(debt.arrears === undefined ? {} : { arrears: debt.arrears }),
    ...(debt.promoUntil === undefined ? {} : { promoUntil: debt.promoUntil }),
    minimumPaymentMinor: poundsToMinor(debt.minPayment),
    dueDate: nextMonthlyDay(today, debt.dueDom),
    dueDayOfMonth: debt.dueDom,
    // Legacy debts did not store a due occurrence. Conservatively track this month's due date;
    // hydration persists that migration anchor so crossing a month cannot erase it next time.
    minimumOccurrences: expandObligationOccurrences({
      anchor: debt.minimumDueDate ?? nextMonthlyDay(`${today.slice(0, 8)}01`, debt.dueDom),
      through: addDays(today, horizonDays),
      amountMinor: poundsToMinor(debt.minPayment),
      dayOfMonth: debt.dueDom,
      ...(debt.minimumOccurrences === undefined ? {} : { resolutions: debt.minimumOccurrences }),
    }),
  }));
  return {
    asOf: today,
    accounts: { main: poundsToMinor(bankBalanceOf(state)) },
    // Current balance already includes posted transaction effects. Replaying history here would
    // double count every spend/refund; future changes are represented by explicit commitments or
    // by a caller-provided scenario.
    income,
    commitments: commitmentEvents(state, today, horizonDays),
    livingCosts: options.livingCosts ?? dailyEssentials(state, today, horizonDays),
    debts,
    bufferMinor: poundsToMinor(Math.max(0, state.bufferAmount ?? 100)),
    ...(next === undefined ? {} : { nextIncomeDate: next }),
    horizonEndDate: addDays(today, horizonDays),
    ...(options.strategy === undefined ? {} : { strategy: options.strategy }),
    ...(options.selectedDebtId === undefined ? {} : { selectedDebtId: options.selectedDebtId }),
    ...(options.recurringExtraDebtPaymentMinor === undefined
      ? {}
      : {
          extraDebtPaymentMinor: options.recurringExtraDebtPaymentMinor,
          ...(options.extraDebtPaymentCadence === undefined
            ? {}
            : { extraDebtPaymentCadence: options.extraDebtPaymentCadence }),
        }),
  };
}

export function buildFinancialPlanFromState(
  state: AppState,
  options: FinancialPlanAdapterOptions = {},
): FinancialPlanResult {
  return calculateFinancialPlan(toFinancialPlanInput(state, options));
}
