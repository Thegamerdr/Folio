import type {
  MeloDebtProjectionStrategy,
  MeloLocalCalculation,
  MeloLocalFinancialSnapshot,
  MeloLocalIntent,
} from '@folio/ai-contracts';
import { projectDebtPortfolio, projectDebtSchedule } from '@folio/finance-engine';

import { purgeSeedIfReal, type AppState } from '../store';
import { monthlyIncomeSeries, percentile } from './historyStats';
import { selectMonthlyIncome } from './income';
import { planProgress, summarisePlans } from './modes/planEngine';
import { buildRecoveryRoutePreview } from './recoveryPreview';
import { reviewMatch } from './reviewDedupe';
import { requireWorkspaceData, workspaceLocalDate } from './workspaceRoot';

const PENCE_PER_POUND = 100;
const MIN_IRREGULAR_HISTORY_MONTHS = 3;

export type MeloCalculationRequest = Readonly<{
  intent: MeloLocalIntent;
  prompt: string;
  detectedAmountMinor: number | null;
  selectedAccountId?: string | undefined;
}>;

function toMinor(pounds: number): number {
  return Math.round(pounds * PENCE_PER_POUND);
}

function formatDay(iso: string | null): string | null {
  if (iso === null) return null;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTimestampDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'at an unknown time';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nextMonthlyDueDate(state: AppState, now: Date, dueDom: number): string {
  const today = workspaceLocalDate(state, now);
  let year = Number(today.slice(0, 4));
  let monthIndex = Number(today.slice(5, 7)) - 1;
  for (let offset = 0; offset <= 1; offset += 1) {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const day = Math.min(Math.max(1, dueDom), daysInMonth);
    const candidate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (candidate >= today) return candidate;
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }
  return today;
}

function debtStrategy(
  prompt: string,
): Exclude<MeloDebtProjectionStrategy, 'contractual-minimums'> | null {
  if (/\b(?:highest[- ]rate|avalanche)\b/i.test(prompt)) return 'highest-rate-first';
  if (/\b(?:lowest[- ]balance|smallest[- ]balance|snowball)\b/i.test(prompt)) {
    return 'lowest-balance-first';
  }
  return null;
}

function buildDebtCalculation(
  state: AppState,
  snapshot: MeloLocalFinancialSnapshot,
  request: MeloCalculationRequest,
  now: Date,
): MeloLocalCalculation | null {
  const debts = (state.debts ?? []).filter((debt) => debt.balance > 0);
  if (debts.length === 0) return null;

  const engineDebts = debts.map((debt) => ({
    id: debt.id,
    principalMinor: toMinor(debt.balance),
    annualRateBps: Math.round(debt.apr * 100),
    minimumPaymentMinor: toMinor(debt.minPayment),
  }));
  const startDate = workspaceLocalDate(state, now);
  const minimums = projectDebtPortfolio({
    debts: engineDebts,
    strategy: 'contractual-minimums',
    startDate,
  });
  const selectedStrategy = debtStrategy(request.prompt);
  const amount = request.detectedAmountMinor ?? 0;
  const requestsExtra =
    amount > 0 &&
    (selectedStrategy !== null ||
      /\b(?:extra|overpay|overpayment|add|more)\b/i.test(request.prompt));

  if (requestsExtra && selectedStrategy === null) {
    return {
      kind: 'debt-strategy-required',
      extraMonthlyMinor: amount,
      safeZoneAfterExtraMinor: snapshot.availableNowMinor - amount,
    };
  }

  const projection =
    requestsExtra && selectedStrategy !== null
      ? projectDebtPortfolio({
          debts: engineDebts,
          strategy: selectedStrategy,
          startDate,
          extraMonthlyMinor: amount,
        })
      : minimums;
  const monthsSavedVsMinimums =
    projection.months !== null && minimums.months !== null
      ? Math.max(0, minimums.months - projection.months)
      : null;

  return {
    kind: 'debt-projection',
    strategy: projection.strategy,
    debtCount: projection.debtCount,
    extraMonthlyMinor: projection.extraMonthlyMinor,
    payoffMonths: projection.months,
    payoffDateLabel: formatDay(projection.payoffDate),
    totalInterestMinor: projection.totalInterestMinor,
    monthsSavedVsMinimums,
    interestSavedVsMinimumsMinor: Math.max(
      0,
      minimums.totalInterestMinor - projection.totalInterestMinor,
    ),
    safeZoneAfterExtraMinor: snapshot.availableNowMinor - projection.extraMonthlyMinor,
    stalled: projection.stalled,
  };
}

function buildBnplSchedule(state: AppState, now: Date): MeloLocalCalculation {
  const debts = (state.debts ?? []).filter((debt) => debt.kind === 'bnpl' && debt.balance > 0);
  const scheduledRows: { dueDate: string; paymentMinor: number }[] = [];
  let totalInterestMinor = 0;
  let stalledCount = 0;
  const payoffDates: string[] = [];
  for (const debt of debts) {
    try {
      const schedule = projectDebtSchedule({
        principalMinor: toMinor(debt.balance),
        annualRateBps: Math.round(debt.apr * 100),
        monthlyPaymentMinor: toMinor(debt.minPayment),
        startDate: nextMonthlyDueDate(state, now, debt.dueDom),
      });
      scheduledRows.push(
        ...schedule.rows.map((row) => ({
          dueDate: row.dueDate,
          paymentMinor: row.paymentMinor,
        })),
      );
      totalInterestMinor += schedule.totalInterestMinor;
      if (schedule.payoffDate) payoffDates.push(schedule.payoffDate);
      else stalledCount += 1;
    } catch {
      stalledCount += 1;
    }
  }
  scheduledRows.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const nextDate = scheduledRows[0]?.dueDate ?? null;
  const nextPaymentTotalMinor =
    nextDate === null
      ? 0
      : scheduledRows
          .filter((row) => row.dueDate === nextDate)
          .reduce((total, row) => total + row.paymentMinor, 0);
  const finalDate =
    stalledCount > 0 || payoffDates.length !== debts.length
      ? null
      : (payoffDates.sort().at(-1) ?? null);
  return {
    kind: 'bnpl-schedule',
    bnplCount: debts.length,
    scheduledPaymentCount: scheduledRows.length,
    nextPaymentDateLabel: formatDay(nextDate),
    nextPaymentTotalMinor,
    finalPaymentDateLabel: formatDay(finalDate),
    totalRemainingMinor: debts.reduce((total, debt) => total + toMinor(debt.balance), 0),
    totalInterestMinor,
    stalledCount,
  };
}

function wantsSourceExplanation(prompt: string): boolean {
  return /\b(?:source|sources|explain|why|where.*(?:come|from)|behind (?:that|those|the))\b/i.test(
    prompt,
  );
}

function buildSourceExplanation(
  state: AppState,
  snapshot: MeloLocalFinancialSnapshot,
  intent: MeloLocalIntent,
  selectedAccountId?: string,
): MeloLocalCalculation {
  const selectedAccount =
    intent === 'review_accounts' && selectedAccountId
      ? (state.accounts ?? []).find(
          (account) => account.id === selectedAccountId && !account.closed,
        )
      : undefined;
  const values: Extract<MeloLocalCalculation, { kind: 'source-explanation' }>['values'] =
    selectedAccount
      ? [{ label: 'selected account balance', amountMinor: toMinor(selectedAccount.balanceMinor) }]
      : intent === 'review_debts'
        ? [
            { label: 'debt balance', amountMinor: snapshot.totalDebtMinor ?? 0 },
            { label: 'monthly debt minimums', amountMinor: snapshot.monthlyDebtMinimumMinor ?? 0 },
          ]
        : intent === 'review_goals'
          ? [
              { label: 'goal saved', amountMinor: snapshot.goalSavedMinor ?? 0 },
              { label: 'goal target', amountMinor: snapshot.goalTargetMinor ?? 0 },
            ]
          : intent === 'summarise_month'
            ? [
                { label: 'monthly income', amountMinor: snapshot.monthlyIncomeMinor ?? 0 },
                { label: 'monthly outgoings', amountMinor: snapshot.monthlyOutgoingsMinor ?? 0 },
              ]
            : [
                { label: 'available now', amountMinor: snapshot.availableNowMinor },
                { label: 'tightest balance', amountMinor: snapshot.tightestBalanceMinor },
              ];
  const sourceKinds: Extract<MeloLocalCalculation, { kind: 'source-explanation' }>['sourceKinds'] =
    selectedAccount
      ? ['current balance setting']
      : intent === 'review_debts'
        ? ['recorded debt details']
        : intent === 'review_goals'
          ? ['recorded goal details']
          : intent === 'summarise_month'
            ? ['income sources and posted income', 'recurring rules and posted outgoings']
            : [
                'current balance setting',
                'forecast engine',
                ...(state.incomeSources?.length
                  ? (['income sources and posted income'] as const)
                  : []),
                ...(state.subs.length ? (['recurring rules and posted outgoings'] as const) : []),
                ...(state.debts?.length ? (['recorded debt details'] as const) : []),
                ...(state.pots.length || state.plans?.length
                  ? (['recorded goal details'] as const)
                  : []),
                ...(state.calendarEvents.length ? (['confirmed calendar events'] as const) : []),
              ];
  const confirmedRecordCount = selectedAccount
    ? 1
    : 1 +
      state.transactions.length +
      state.subs.length +
      (state.debts?.length ?? 0) +
      state.pots.length +
      (state.plans?.length ?? 0) +
      state.calendarEvents.length +
      (state.incomeSources?.length ?? 0);
  return {
    kind: 'source-explanation',
    values,
    sourceKinds,
    confirmedRecordCount,
    excludedReviewCount: snapshot.pendingReviewCount,
  };
}

function buildImportReviewSummary(
  state: AppState,
  snapshot: MeloLocalFinancialSnapshot,
  now: Date,
): MeloLocalCalculation {
  const unique = new Map(
    [...(state.reviewQueue ?? []), ...(state.reviewQueueSpillover ?? [])].map((item) => [
      item.id,
      item,
    ]),
  );
  let possibleDuplicateCount = 0;
  let changedAmountCount = 0;
  let relationshipCount = 0;
  let missingDateCount = 0;
  for (const item of unique.values()) {
    if (!item.date) {
      missingDateCount += 1;
      continue;
    }
    const proposal = reviewMatch(
      {
        id: item.id,
        amount: item.amount,
        dateIso: item.date.slice(0, 10),
        merchant: item.merchant,
      },
      state.transactions,
      now.toISOString(),
    );
    if (!proposal) continue;
    if (proposal.kind === 'propose-link' || proposal.kind === 'link-by-provider') {
      possibleDuplicateCount += 1;
    } else if (proposal.kind === 'propose-amount-changed') {
      changedAmountCount += 1;
    } else if (proposal.kind === 'propose-refund' || proposal.kind === 'propose-transfer') {
      relationshipCount += 1;
    }
  }
  const rememberedCategoryCount = [...unique.values()].filter(
    (item) => item.rememberedCategory === true,
  ).length;
  return {
    kind: 'import-review-summary',
    pendingCount: snapshot.pendingReviewCount,
    possibleDuplicateCount,
    changedAmountCount,
    relationshipCount,
    rememberedCategoryCount,
    missingDateCount,
  };
}

function buildGoalCalculation(
  state: AppState,
  snapshot: MeloLocalFinancialSnapshot,
  request: MeloCalculationRequest,
  now: Date,
): MeloLocalCalculation | null {
  const activePlans = (state.plans ?? []).filter((plan) => plan.target > plan.saved);
  const focus = summarisePlans(activePlans, now).focus;
  if (focus === null) return null;

  const contributionMinor =
    request.detectedAmountMinor !== null &&
    /\b(?:contribut|add|put|save|saving)\w*\b/i.test(request.prompt)
      ? request.detectedAmountMinor
      : 0;
  const contributionPounds = contributionMinor / PENCE_PER_POUND;
  const afterContribution =
    contributionMinor > 0
      ? planProgress(
          {
            ...focus.plan,
            saved: Math.min(focus.plan.target, focus.plan.saved + contributionPounds),
          },
          now,
        )
      : focus;

  return {
    kind: 'goal-projection',
    datedPlanCount: activePlans.length,
    remainingMinor: toMinor(focus.remaining),
    currentPerWeekMinor: toMinor(focus.plan.perWeek),
    requiredPerWeekMinor: Number.isFinite(focus.requiredPerWeek)
      ? toMinor(focus.requiredPerWeek)
      : null,
    weeksAvailable: focus.weeksAvailable,
    weeksAtPace: focus.weeksAtPace,
    onTrack: focus.onTrack,
    targetDateLabel: formatDay(focus.plan.byDate) ?? focus.plan.byDate,
    contributionMinor,
    remainingAfterContributionMinor: toMinor(afterContribution.remaining),
    requiredPerWeekAfterContributionMinor: Number.isFinite(afterContribution.requiredPerWeek)
      ? toMinor(afterContribution.requiredPerWeek)
      : null,
    onTrackAfterContribution: afterContribution.onTrack,
    safeZoneAfterContributionMinor: snapshot.availableNowMinor - contributionMinor,
  };
}

function buildIrregularIncomeCalculation(state: AppState, now: Date): MeloLocalCalculation {
  const series = monthlyIncomeSeries(state.transactions, workspaceLocalDate(state, now));
  const sufficientHistory = series.length >= MIN_IRREGULAR_HISTORY_MONTHS;
  return {
    kind: 'irregular-income-range',
    monthsObserved: series.length,
    sufficientHistory,
    lowMonthMinor: sufficientHistory ? toMinor(percentile(series, 20)) : null,
    baseMonthMinor: sufficientHistory ? toMinor(percentile(series, 50)) : null,
    highMonthMinor: sufficientHistory ? toMinor(percentile(series, 80)) : null,
  };
}

function buildAccountCalculation(
  state: AppState,
  request: MeloCalculationRequest,
): MeloLocalCalculation | null {
  if (!request.selectedAccountId) return null;
  const account = (state.accounts ?? []).find(
    (candidate) => candidate.id === request.selectedAccountId && !candidate.closed,
  );
  if (!account) return null;
  return {
    kind: 'account-position',
    accountKind: account.kind,
    balanceMinor: toMinor(account.balanceMinor),
    isLiability: account.isLiability,
    balanceAsOfLabel: formatTimestampDay(account.balanceAsOfISO),
  };
}

function buildRecoveryCalculation(state: AppState, now: Date): MeloLocalCalculation {
  const preview = buildRecoveryRoutePreview(state, now);
  const monthlyIncome = selectMonthlyIncome(state);
  const monthlyBills = state.subs
    .filter((subscription) => !state.subPaused[subscription.name])
    .reduce((total, subscription) => total + subscription.cost, 0);
  let hardCyclesInARow = 0;
  for (const cycle of state.cycles) {
    if (cycle.tightPoint >= 0) break;
    hardCyclesInARow += 1;
  }
  const option = (
    kind: Extract<MeloLocalCalculation, { kind: 'recovery-preview' }>['options'][number]['kind'],
    lift: number,
  ) => ({
    kind,
    liftMinor: toMinor(lift),
    afterMinor: toMinor(Math.max(-preview.shortfall + lift, -preview.shortfall)),
  });
  return {
    kind: 'recovery-preview',
    hasShortfall: preview.hasShortfall,
    shortfallMinor: toMinor(preview.shortfall),
    structuralPressure:
      (monthlyIncome > 0 && monthlyBills > monthlyIncome) || hardCyclesInARow >= 2,
    options: [
      ...(preview.flexibleBill ? [option('move-bill', preview.billLift)] : []),
      ...(preview.pausableSubscription
        ? [option('pause-recurring', preview.subscriptionLift)]
        : []),
      option('hold-discretionary', preview.holdLift),
    ],
  };
}

/**
 * Run a narrow deterministic calculation over local state, returning only typed aggregate output.
 * Names, IDs, rows and raw history never cross into the AI contract or transcript.
 */
export function buildMeloLocalCalculation(
  input: Readonly<{
    state: AppState;
    snapshot: MeloLocalFinancialSnapshot;
    request: MeloCalculationRequest;
    now?: Date;
    workspaceId?: string;
  }>,
): MeloLocalCalculation | null {
  if (input.snapshot.hasMoneyPicture === false) return null;
  const state = purgeSeedIfReal(
    requireWorkspaceData(input.state, input.workspaceId ?? input.state.activeWorkspaceId),
  );
  const now = input.now ?? new Date();
  switch (input.request.intent) {
    case 'explain_position':
      return buildSourceExplanation(state, input.snapshot, input.request.intent);
    case 'summarise_month':
      return wantsSourceExplanation(input.request.prompt)
        ? buildSourceExplanation(state, input.snapshot, input.request.intent)
        : null;
    case 'review_debts':
      if (/\b(?:bnpl|buy now|pay in [234]|instalment|installment)\b/i.test(input.request.prompt)) {
        return buildBnplSchedule(state, now);
      }
      if (wantsSourceExplanation(input.request.prompt)) {
        return buildSourceExplanation(state, input.snapshot, input.request.intent);
      }
      return buildDebtCalculation(state, input.snapshot, input.request, now);
    case 'review_goals':
      if (wantsSourceExplanation(input.request.prompt)) {
        return buildSourceExplanation(state, input.snapshot, input.request.intent);
      }
      return buildGoalCalculation(state, input.snapshot, input.request, now);
    case 'review_import':
      return buildImportReviewSummary(state, input.snapshot, now);
    case 'plan_recovery':
      return buildRecoveryCalculation(state, now);
    case 'review_irregular_income':
      return buildIrregularIncomeCalculation(state, now);
    case 'review_accounts':
      return wantsSourceExplanation(input.request.prompt)
        ? buildSourceExplanation(
            state,
            input.snapshot,
            input.request.intent,
            input.request.selectedAccountId,
          )
        : buildAccountCalculation(state, input.request);
    default:
      return null;
  }
}
