/**
 * Build the financial context used by Melo's deterministic on-device responder.
 *
 * This is deliberately not a provider prompt or an analytics payload. It contains only
 * derived totals needed for local answers; it excludes names, merchants, transaction rows,
 * account identifiers, pot names and subscription names. Keeping this type identical to the
 * local AI contract prevents a future caller from reviving the old rich-snapshot cast.
 */
import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';
import {
  businessDeadlines,
  calculateBusinessRunway,
  calculateSelfAssessmentSummary,
  calculateVatBoxes,
  corporationTaxMinor,
  hasBusinessOperationsData,
  invoiceAgingBucket,
  normaliseBusinessOperationsState,
  outstandingInvoiceMinor,
  totalOutstandingInvoicesMinor,
} from '@folio/business-workspace';

import { purgeSeedIfReal, type AppState } from '../store';
import { deriveCalendarEvents } from './calendarEvents';
import { selectMonthlyIncome } from './income';
import { routeFromStore } from './storeRoute';
import { buildTimelineRows } from './timelineEvents';
import { summarizeWhatChanged } from './whatChanged';
import { buildWidgetSnapshot } from './widgetSnapshot';
import { requireWorkspaceData } from './workspaceRoot';
import { buildBusinessCashPosition } from './businessCashPosition';
import { isAccountInLaunchMoneyPicture } from './accountPolicy';

const PENCE_PER_POUND = 100;

export type MeloSnapshot = MeloLocalFinancialSnapshot;

/** @deprecated Use `selectMonthlyIncome` directly in new code. */
export const liveMonthlyIncome = selectMonthlyIncome;

function toPence(pounds: number): number {
  return Math.round(pounds * PENCE_PER_POUND);
}

function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'the projected low day';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

function protectedItemLabels(state: AppState): readonly string[] {
  const labels: string[] = [];
  if (state.subs.some((subscription) => !state.subPaused[subscription.name])) {
    labels.push('active bills and subscriptions');
  }
  if (state.pots.some((pot) => pot.saved > 0 || pot.perWeek > 0)) {
    labels.push('protected pots');
  }
  return labels.length > 0 ? labels : ['confirmed commitments'];
}

function hasRealMoneyPicture(state: AppState): boolean {
  return (
    state.currentBalance.source !== 'sample' ||
    state.transactions.some((transaction) => transaction.source !== 'seed')
  );
}

/** Pure and deterministic when `now` is supplied. No network, storage or store-singleton reads. */
export function buildMeloSnapshot(
  state: AppState,
  _pressure: unknown,
  now: Date | string = new Date(),
  workspaceId = state.activeWorkspaceId,
): MeloSnapshot {
  const nowDate = now instanceof Date ? now : new Date(now);
  const localState = purgeSeedIfReal(requireWorkspaceData(state, workspaceId));
  const workspace = localState.workspaces.find((candidate) => candidate.id === workspaceId)!;
  const isBusiness = workspace.kind === 'business';
  const route = routeFromStore(localState, nowDate);
  const widget = buildWidgetSnapshot(localState, nowDate);
  const hasMoneyPicture = hasRealMoneyPicture(localState);
  const activeSubscriptions = localState.subs.filter(
    (subscription) => !localState.subPaused[subscription.name],
  );
  const activeDebts = (localState.debts ?? []).filter((debt) => debt.balance > 0);
  const activePots = localState.pots.filter((pot) => pot.goal > 0);
  const activePlans = (localState.plans ?? []).filter((plan) => plan.target > 0);
  const activeAccounts = (localState.accounts ?? []).filter(isAccountInLaunchMoneyPicture);
  const calendar = deriveCalendarEvents({
    subs: localState.subs,
    subPaused: localState.subPaused,
    subOverrides: localState.subOverrides,
    onboarding: localState.onboarding,
    manualEvents: localState.calendarEvents,
    pots: localState.pots,
    incomeSources: localState.incomeSources ?? [],
    spendHold: localState.spendHold ?? null,
    whatIfHolds: localState.whatIfHolds ?? [],
    includeSampleBills: false,
    now: nowDate,
  });
  const changes = summarizeWhatChanged({
    rows: buildTimelineRows({
      transactions: localState.transactions,
      edits: localState.edits ?? [],
      events: localState.timelineEvents ?? [],
    }),
    imports: localState.statementImports ?? [],
    materialChanges: localState.materialChanges ?? [],
    seenISO: localState.whatChangedSeenISO ?? null,
  });
  const businessPosition = isBusiness
    ? buildBusinessCashPosition({
        accounts: activeAccounts,
        transactions: localState.transactions,
        upcomingEvents: calendar,
        now: nowDate,
      })
    : null;
  const businessOperations = isBusiness
    ? normaliseBusinessOperationsState(localState.business)
    : null;
  const businessAccounts = activeAccounts.map((account) => ({
    balanceMinor: toPence(account.balanceMinor),
    isLiability: account.isLiability,
    ...(account.closed === undefined ? {} : { closed: account.closed }),
  }));
  const operationsRunway =
    businessOperations && hasBusinessOperationsData(businessOperations)
      ? calculateBusinessRunway(businessOperations, businessAccounts, nowDate)
      : null;
  const openVatReturn = businessOperations?.vatReturns
    .filter((item) => item.filedExternallyOn === undefined)
    .sort((left, right) => left.dueOn.localeCompare(right.dueOn))[0];
  const currentVatDueMinor = openVatReturn
    ? Math.max(0, calculateVatBoxes(openVatReturn).box5Minor)
    : 0;
  const overdueInvoices =
    businessOperations?.invoices.filter(
      (invoice) =>
        outstandingInvoiceMinor(invoice) > 0 && invoiceAgingBucket(invoice, nowDate) !== 'current',
    ) ?? [];
  const taxEstimateMinor =
    businessOperations?.entity?.kind === 'ltd'
      ? corporationTaxMinor(businessOperations.ytdProfitMinor)
      : businessOperations?.entity?.kind === 'sole-trader'
        ? calculateSelfAssessmentSummary(businessOperations, businessOperations.entity)
            .amountDueMinor
        : 0;
  const openBusinessDeadlines = businessOperations
    ? businessDeadlines(businessOperations, { now: nowDate, withinDays: 365 })
    : [];
  const nextBusinessIncome = isBusiness
    ? calendar.find((event) => typeof event.amount === 'number' && event.amount > 0)
    : undefined;
  const resolvedMoneyPicture = isBusiness
    ? activeAccounts.length > 0 ||
      localState.transactions.length > 0 ||
      calendar.length > 0 ||
      localState.readerCandidates.length > 0 ||
      (localState.reviewQueue?.length ?? 0) > 0 ||
      (businessOperations !== null && hasBusinessOperationsData(businessOperations))
    : hasMoneyPicture;
  const businessCashMinor =
    operationsRunway?.cashMinor ?? toPence(businessPosition?.cashBalance ?? 0);
  const businessUpcomingIncomeMinor =
    operationsRunway?.incoming30Minor ?? toPence(businessPosition?.upcomingIncome ?? 0);
  const businessCommitmentsMinor =
    operationsRunway?.outgoing30Minor ?? toPence(businessPosition?.upcomingCommitments ?? 0);
  const businessProjectedMinor =
    businessCashMinor + businessUpcomingIncomeMinor - businessCommitmentsMinor;

  return {
    currency: 'GBP',
    workspaceKind: workspace.kind,
    availableNowMinor: isBusiness
      ? businessProjectedMinor
      : hasMoneyPicture
        ? widget.safeZonePence
        : 0,
    tightestDay: isBusiness
      ? businessPosition?.nextCommitmentDate
        ? formatDay(businessPosition.nextCommitmentDate)
        : 'not set up yet'
      : hasMoneyPicture
        ? formatDay(route.tightPoint.date)
        : 'not set up yet',
    tightestBalanceMinor: isBusiness
      ? businessProjectedMinor
      : hasMoneyPicture
        ? toPence(route.tightPoint.amount)
        : 0,
    protectedItems: isBusiness
      ? ['confirmed dated commitments']
      : hasMoneyPicture
        ? protectedItemLabels(localState)
        : ['confirmed commitments'],
    pendingReviewCount:
      localState.readerCandidates.length +
      (localState.reviewQueue?.length ?? 0) +
      (localState.reviewQueueSpillover?.length ?? 0),
    nextPaydayLabel: isBusiness
      ? nextBusinessIncome?.date
        ? formatDay(nextBusinessIncome.date)
        : 'not set up yet'
      : hasMoneyPicture && widget.paydayISO
        ? formatDay(widget.paydayISO)
        : 'not set up yet',
    hasMoneyPicture: resolvedMoneyPicture,
    subscriptionCount: resolvedMoneyPicture ? activeSubscriptions.length : 0,
    activeSubscriptionMonthlyMinor: toPence(
      resolvedMoneyPicture
        ? activeSubscriptions.reduce((total, subscription) => total + subscription.cost, 0)
        : 0,
    ),
    monthlyIncomeMinor: isBusiness
      ? (operationsRunway?.incoming30Minor ?? toPence(businessPosition?.confirmedIncome30Days ?? 0))
      : hasMoneyPicture
        ? toPence(selectMonthlyIncome(localState))
        : 0,
    monthlyOutgoingsMinor: isBusiness
      ? (operationsRunway?.outgoing30Minor ??
        toPence(businessPosition?.confirmedExpense30Days ?? 0))
      : hasMoneyPicture
        ? toPence(route.outgoingTotal ?? 0)
        : 0,
    activeRecurringCount: resolvedMoneyPicture ? activeSubscriptions.length : 0,
    debtCount: resolvedMoneyPicture ? activeDebts.length : 0,
    totalDebtMinor: toPence(
      resolvedMoneyPicture ? activeDebts.reduce((total, debt) => total + debt.balance, 0) : 0,
    ),
    monthlyDebtMinimumMinor: toPence(
      resolvedMoneyPicture ? activeDebts.reduce((total, debt) => total + debt.minPayment, 0) : 0,
    ),
    goalCount: resolvedMoneyPicture ? activePots.length + activePlans.length : 0,
    goalSavedMinor: toPence(
      resolvedMoneyPicture
        ? activePots.reduce((total, pot) => total + pot.saved, 0) +
            activePlans.reduce((total, plan) => total + plan.saved, 0)
        : 0,
    ),
    goalTargetMinor: toPence(
      resolvedMoneyPicture
        ? activePots.reduce((total, pot) => total + pot.goal, 0) +
            activePlans.reduce((total, plan) => total + plan.target, 0)
        : 0,
    ),
    upcomingCalendarCount: resolvedMoneyPicture ? calendar.length : 0,
    nextCalendarDate:
      resolvedMoneyPicture && calendar[0]?.date ? formatDay(calendar[0].date) : undefined,
    unseenChangeCount: resolvedMoneyPicture ? (changes?.count ?? 0) : 0,
    incomeSourceCount: resolvedMoneyPicture ? (localState.incomeSources?.length ?? 0) : 0,
    irregularIncomeMode: resolvedMoneyPicture && localState.moneyMode === 'irregular',
    accountCount: resolvedMoneyPicture ? activeAccounts.length : 0,
    liabilityAccountCount: resolvedMoneyPicture
      ? activeAccounts.filter((account) => account.isLiability).length
      : 0,
    ...(businessPosition
      ? {
          businessCashBalanceMinor: businessCashMinor,
          businessLiabilityBalanceMinor: toPence(businessPosition.liabilityBalance),
          businessNetPositionMinor: businessCashMinor - toPence(businessPosition.liabilityBalance),
          businessProjectedCashMinor: businessProjectedMinor,
          businessUpcomingIncomeMinor,
          businessUpcomingCommitmentsMinor: businessCommitmentsMinor,
          businessConfirmedIncome30DaysMinor: toPence(businessPosition.confirmedIncome30Days),
          businessConfirmedExpense30DaysMinor: toPence(businessPosition.confirmedExpense30Days),
          businessRunwayDays: operationsRunway?.daysLeft ?? businessPosition.runwayDays,
          businessRunwayHistoryDays: businessPosition.runwayHistoryDays,
          ...(businessPosition.nextCommitmentDate
            ? { businessNextCommitmentDate: formatDay(businessPosition.nextCommitmentDate) }
            : {}),
        }
      : {}),
    ...(businessOperations
      ? {
          businessEntityKind: businessOperations.entity?.kind,
          businessClientCount: businessOperations.clients.length,
          businessOutstandingInvoicesMinor: totalOutstandingInvoicesMinor(businessOperations),
          businessOverdueInvoicesMinor: overdueInvoices.reduce(
            (sum, invoice) => sum + outstandingInvoiceMinor(invoice),
            0,
          ),
          businessOverdueInvoiceCount: overdueInvoices.length,
          businessVatRegistered: businessOperations.entity?.vat.registered === true,
          businessVatDueMinor: currentVatDueMinor,
          businessVatPotMinor: businessOperations.vatPotMinor,
          businessTaxEstimateMinor: taxEstimateMinor,
          businessTaxPotMinor: businessOperations.ctPotMinor,
          businessObligations30Minor: operationsRunway?.outgoing30Minor ?? 0,
          businessEmployeeCount: businessOperations.employees.length,
          businessOpenFilingCount: openBusinessDeadlines.filter(
            (deadline) => deadline.kind !== 'invoice' && deadline.kind !== 'obligation',
          ).length,
        }
      : {}),
  };
}
