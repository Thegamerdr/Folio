import type {
  Account as CanonicalAccount,
  BalanceObservation,
  CurrentBalance as CanonicalCurrentBalance,
  FinancialExpectation,
  FinancialTransaction,
  ReviewQueueItemState,
  TransactionSourceKind,
  WorkspaceId,
} from '@folio/domain';
import type { CanonicalRepositorySnapshot } from '@folio/storage';
import {
  normaliseBusinessOperationsState,
  type BusinessOperationsState,
} from '@folio/business-workspace';

import {
  DEFAULT_ACCOUNT_ID,
  accountIdOf,
  type Account,
  type AppState,
  type BalanceSource,
  type CurrentBalance,
  type CycleRecord,
  type Debt,
  type Pot,
  type PotLedgerEntry,
  type Sub,
  type Transaction,
} from '../store';
import { reanchorRenewals } from './renewalMath';

export type CanonicalAppStateMoneyProjection = Readonly<{
  currentBalance: CurrentBalance;
  accounts: Account[];
  transactions: Transaction[];
  pots: Pot[];
  potLedger: PotLedgerEntry[];
  subs: Sub[];
  cancelledSubs: NonNullable<AppState['cancelledSubs']>;
  subPaused: Record<string, boolean>;
  subOverrides: Record<string, number>;
  cycles: CycleRecord[];
  debts: Debt[];
  onboarding: AppState['onboarding'];
  nextYouNote: string;
  tightPointGoal: number | null;
  droppedTransactionCount: number;
  moneyMode: NonNullable<AppState['moneyMode']>;
  bufferAmount: number;
  modeExtras: NonNullable<AppState['modeExtras']>;
  household: NonNullable<AppState['household']>;
  spendHold: NonNullable<AppState['spendHold']> | null;
  whatIfHolds: NonNullable<AppState['whatIfHolds']>;
  business: NonNullable<AppState['business']>;
  calendarEvents: AppState['calendarEvents'];
  incomeSources: NonNullable<AppState['incomeSources']>;
  plans: NonNullable<AppState['plans']>;
  edits: NonNullable<AppState['edits']>;
  ignoredReviewSigs: NonNullable<AppState['ignoredReviewSigs']>;
  aiReads: NonNullable<AppState['aiReads']>;
  aiReadCache: NonNullable<AppState['aiReadCache']>;
  whatChangedSeenISO: NonNullable<AppState['whatChangedSeenISO']> | null;
  lens: NonNullable<AppState['lens']>;
  melo: NonNullable<AppState['melo']>;
  tinyWins: NonNullable<AppState['tinyWins']>;
  meloPrimerSeen: boolean;
  lastOpenedAt: NonNullable<AppState['lastOpenedAt']> | null;
  oneMoveHistory: NonNullable<AppState['oneMoveHistory']>;
  meloDismissLog: NonNullable<AppState['meloDismissLog']>;
  ignoredBankExternalIds: NonNullable<AppState['ignoredBankExternalIds']>;
  dismissedIncomeSignals: NonNullable<AppState['dismissedIncomeSignals']>;
  dismissedBillSignals: NonNullable<AppState['dismissedBillSignals']>;
  dismissedDriftSignals: NonNullable<AppState['dismissedDriftSignals']>;
  dismissedAnnualSignals: NonNullable<AppState['dismissedAnnualSignals']>;
  merchantCategories: NonNullable<AppState['merchantCategories']>;
  statementImports: NonNullable<AppState['statementImports']>;
  evidenceDocuments: NonNullable<AppState['evidenceDocuments']>;
  timelineEvents: NonNullable<AppState['timelineEvents']>;
  reviewQueue: NonNullable<AppState['reviewQueue']>;
  reviewQueueSpillover: NonNullable<AppState['reviewQueueSpillover']>;
}>;

const appCategories = new Set<Transaction['category']>([
  'food',
  'transport',
  'fun',
  'bills',
  'shopping',
  'income',
  'other',
]);

/**
 * Reconstruct the shipping AppState money slice from canonical repository records. This is kept
 * separate from the UI read path until projection parity and interrupted-write tests prove it can
 * replace the exact encrypted AppState generation without changing user-visible meaning.
 */
export function readCanonicalAppStateMoneyProjection(
  snapshot: CanonicalRepositorySnapshot,
  workspaceId: string,
  todayISO = new Date().toISOString().slice(0, 10),
): CanonicalAppStateMoneyProjection {
  if (String(snapshot.workspaceId) !== workspaceId) {
    throw new Error('Canonical AppState read is outside the requested workspace partition.');
  }

  const accounts = workspaceRows(snapshot.collections.accounts, workspaceId);
  const balances = workspaceRows(snapshot.collections.currentBalances, workspaceId);
  const observations = workspaceRows(snapshot.collections.balanceObservations, workspaceId);
  const balanceByAccount = uniqueBy(
    balances,
    (balance) => String(balance.accountId),
    'canonical current balance account',
  );
  const observationById = uniqueBy(
    observations,
    (observation) => String(observation.id),
    'canonical balance observation',
  );
  const accountById = uniqueBy(accounts, (account) => String(account.id), 'canonical account');

  const sourceAccounts = accounts.filter(
    (account) =>
      account.projectionRole === 'source' || account.projectionRole === 'synthesized-default',
  );
  const projectedAccounts = sourceAccounts.map((account) =>
    readSourceAccount(account, balanceByAccount, observationById),
  );

  const reconciliationAccount = singleOptional(
    accounts.filter((account) => account.projectionRole === 'reconciliation'),
    'canonical balance reconciliation account',
  );
  const aggregateMetadataAccount =
    reconciliationAccount ??
    singleRequired(
      accounts.filter((account) => account.projectionRole === 'synthesized-default'),
      'canonical aggregate balance metadata account',
    );
  const aggregateBalance = requiredMapValue(
    balanceByAccount,
    String(aggregateMetadataAccount.id),
    'canonical aggregate current balance',
  );
  const aggregateObservation = requiredMapValue(
    observationById,
    String(aggregateBalance.sourceObservationId),
    'canonical aggregate balance observation',
  );
  if (
    aggregateObservation.sourceVariant === undefined ||
    aggregateObservation.sourceConfidence === undefined
  ) {
    throw new Error('Canonical aggregate balance is missing exact source or confidence metadata.');
  }

  const availableAggregateMinor = accounts
    .filter(
      (account) =>
        (account.projectionRole === 'source' ||
          account.projectionRole === 'synthesized-default' ||
          account.projectionRole === 'reconciliation') &&
        account.kind !== 'credit' &&
        account.kind !== 'loan',
    )
    .reduce(
      (total, account) =>
        total +
        requiredMapValue(
          balanceByAccount,
          String(account.id),
          `canonical current balance for ${String(account.id)}`,
        ).balance.minorUnits,
      0,
    );

  const transactionRows = workspaceRows(snapshot.collections.transactions, workspaceId)
    .filter((transaction) => transaction.sourceTransactionId !== undefined)
    .map((transaction) => readPostedTransaction(transaction, accountById));
  const expectationRows = workspaceRows(snapshot.collections.expectations, workspaceId)
    .filter((expectation) => expectation.sourceTransactionId !== undefined)
    .map((expectation) => readExpectedTransaction(expectation, accountById));
  const orderedTransactions = [...transactionRows, ...expectationRows].sort(
    (left, right) => left.sourceOrdinal - right.sourceOrdinal,
  );
  uniqueBy(
    orderedTransactions,
    (row) => String(row.transaction.id),
    'canonical source transaction',
  );
  uniqueBy(
    orderedTransactions,
    (row) => String(row.sourceOrdinal),
    'canonical source transaction ordinal',
  );

  const pots = orderedSourceRows(snapshot.collections.pots, workspaceId, 'canonical pot').map(
    (pot) => ({
      id: requiredText(pot.sourcePotId, 'canonical source pot ID'),
      workspaceId: pot.workspaceId,
      name: pot.name,
      saved: minorToMajor(pot.saved.minorUnits),
      goal: minorToMajor(pot.goal.minorUnits),
      perWeek: minorToMajor(pot.perWeek.minorUnits),
      accent: pot.accent,
      ...(pot.cadence === undefined ? {} : { cadence: pot.cadence }),
      ...(pot.allowNegative === undefined ? {} : { allowNegative: pot.allowNegative }),
    }),
  );
  const potLedger = orderedSourceRows(
    snapshot.collections.potLedgerEntries,
    workspaceId,
    'canonical pot ledger entry',
  ).map((entry) => ({
    id: requiredText(entry.sourceEntryId, 'canonical source pot-ledger ID'),
    workspaceId: entry.workspaceId,
    potId: requiredText(entry.sourcePotId, 'canonical source pot ID'),
    at: requiredText(entry.sourceOccurredAt, 'canonical source pot-ledger time'),
    kind: entry.kind,
    amount: minorToMajor(entry.amount.minorUnits),
    source: entry.source,
  }));
  const canonicalSubscriptions = orderedSourceRows(
    snapshot.collections.subscriptions,
    workspaceId,
    'canonical subscription',
  );
  const subscriptions = canonicalSubscriptions
    .filter((subscription) => subscription.cancelledAt === undefined)
    .map((subscription) => ({
      name: requiredText(subscription.sourceName, 'canonical source subscription name'),
      workspaceId: subscription.workspaceId,
      cost: minorToMajor(subscription.cost.minorUnits),
      nextRenewalDaysAway: subscription.nextRenewalDaysAway,
      ...(subscription.nextRenewalISO === undefined
        ? {}
        : { nextRenewalISO: subscription.nextRenewalISO }),
      ...(subscription.renewalPeriodDays === undefined
        ? {}
        : { renewalPeriodDays: subscription.renewalPeriodDays }),
      lastUsedDaysAgo: subscription.lastUsedDaysAgo,
      usesPerMonth: subscription.usesPerMonth,
      ...(subscription.trialEndsInDays === undefined
        ? {}
        : { trialEndsInDays: subscription.trialEndsInDays }),
      ...(subscription.pausedUntil === undefined ? {} : { pausedUntil: subscription.pausedUntil }),
      ...(subscription.autoResume === undefined ? {} : { autoResume: subscription.autoResume }),
      ...(subscription.pauseReason === undefined ? {} : { pauseReason: subscription.pauseReason }),
      ...(subscription.pausedAt === undefined ? {} : { pausedAt: subscription.pausedAt }),
    }));
  const subs = reanchorRenewals(subscriptions, todayISO).items;
  const cancelledSubs = canonicalSubscriptions
    .filter((subscription) => subscription.cancelledAt !== undefined)
    .map((subscription) => ({
      name: requiredText(subscription.sourceName, 'canonical cancelled subscription name'),
      workspaceId: subscription.workspaceId,
      monthlyAmount: minorToMajor(subscription.cost.minorUnits),
      cancelledAt: subscription.cancelledAt!,
    }));
  const preferences = [
    ...uniqueBy(
      workspaceRows(snapshot.collections.subscriptionPreferences, workspaceId),
      (preference) => preference.sourceName,
      'canonical subscription preference',
    ).values(),
  ];
  const subPaused = Object.fromEntries(
    preferences.flatMap((preference) =>
      preference.paused === undefined ? [] : [[preference.sourceName, preference.paused] as const],
    ),
  );
  const unsweptOverrides = Object.fromEntries(
    preferences.flatMap((preference) =>
      preference.overrideDays === undefined
        ? []
        : [[preference.sourceName, preference.overrideDays] as const],
    ),
  );
  const subOverrides = sweepCanonicalSubscriptionOverrides(subs, unsweptOverrides);
  const cycles = orderedSourceRows(
    snapshot.collections.cycleRecords,
    workspaceId,
    'canonical cycle record',
  ).map((cycle) => ({
    workspaceId: cycle.workspaceId,
    closedAt: requiredText(cycle.sourceClosedAt, 'canonical source cycle close time'),
    label: cycle.label,
    spare: minorToMajor(cycle.spare.minorUnits),
    tightPoint: minorToMajor(cycle.tightPoint.minorUnits),
    setAside: minorToMajor(cycle.setAside.minorUnits),
    note: cycle.note ?? '',
    ...(cycle.reconstructed === true ? { reconstructed: true as const } : {}),
  }));
  const debts = orderedSourceRows(snapshot.collections.debts, workspaceId, 'canonical debt').map(
    (debt) => ({
      id: requiredText(debt.sourceDebtId, 'canonical source debt ID'),
      workspaceId: debt.workspaceId,
      name: debt.name,
      kind: debt.kind,
      balance: minorToMajor(debt.balance.minorUnits),
      apr: debt.apr,
      minPayment: minorToMajor(debt.minimumPayment.minorUnits),
      dueDom: debt.dueDayOfMonth,
      addedAt: requiredText(debt.sourceAddedAt, 'canonical source debt creation time'),
      ...(debt.linkedSourceAccountId === undefined
        ? {}
        : { linkedAccountId: debt.linkedSourceAccountId }),
    }),
  );
  const financialContext = singleRequired(
    workspaceRows(snapshot.collections.financialContexts, workspaceId),
    'canonical financial context',
  );
  const modeExtras = Object.fromEntries(
    Object.entries(financialContext.modeExtras).map(([mode, amount]) => [
      mode,
      minorToMajor(amount.minorUnits),
    ]),
  ) as NonNullable<AppState['modeExtras']>;
  const business = readBusinessOperations(financialContext.businessOperationsJson);
  const calendarItems = orderedSourceRows(
    snapshot.collections.calendarItems.filter((item) => item.sourceCalendarEventId !== undefined),
    workspaceId,
    'canonical source calendar event',
  );
  uniqueBy(
    calendarItems,
    (item) => requiredText(item.sourceCalendarEventId, 'canonical source calendar-event ID'),
    'canonical source calendar event',
  );
  const calendarEvents: AppState['calendarEvents'] = calendarItems.map((item) => ({
    id: requiredText(item.sourceCalendarEventId, 'canonical source calendar-event ID'),
    workspaceId: item.workspaceId,
    date: String(item.localDate),
    kind: appCalendarEventKind(item.sourceKind),
    title: item.title,
    ...(item.sourceTime === undefined ? {} : { time: item.sourceTime }),
    ...(item.sourceNote === undefined ? {} : { note: item.sourceNote }),
    ...(item.sourceAmount === undefined
      ? {}
      : { amount: minorToMajor(item.sourceAmount.minorUnits) }),
    ...(item.sourceReminderOffsetMinutes === undefined
      ? {}
      : { reminderOffsetMinutes: item.sourceReminderOffsetMinutes }),
  }));
  const incomeScheduleRows = orderedSourceRows(
    snapshot.collections.incomeSchedules,
    workspaceId,
    'canonical income schedule',
  );
  uniqueBy(
    incomeScheduleRows,
    (source) => source.sourceIncomeId,
    'canonical source income schedule',
  );
  const incomeSources: NonNullable<AppState['incomeSources']> = incomeScheduleRows.map(
    (source) => ({
      id: requiredText(source.sourceIncomeId, 'canonical source income ID'),
      workspaceId: source.workspaceId,
      label: source.label,
      cadence: source.cadence,
      amount: minorToMajor(source.amount.minorUnits),
      source: source.source,
      ...(source.dayOfMonth === undefined ? {} : { dayOfMonth: source.dayOfMonth }),
      ...(source.anchorDate === undefined ? {} : { anchorISO: String(source.anchorDate) }),
    }),
  );
  const planRows = orderedSourceRows(
    snapshot.collections.plans.filter((plan) => plan.sourcePlanId !== undefined),
    workspaceId,
    'canonical source plan',
  );
  uniqueBy(
    planRows,
    (plan) => requiredText(plan.sourcePlanId, 'canonical source plan ID'),
    'canonical source plan',
  );
  const plans: NonNullable<AppState['plans']> = planRows.map((plan) => {
    if (
      plan.targetAmount === undefined ||
      plan.targetDate === undefined ||
      plan.savedAmount === undefined ||
      plan.weeklyContribution === undefined
    ) {
      throw new Error(`Canonical source plan ${String(plan.id)} is incomplete.`);
    }
    return {
      id: requiredText(plan.sourcePlanId, 'canonical source plan ID'),
      workspaceId: plan.workspaceId,
      name: plan.title,
      target: minorToMajor(plan.targetAmount.minorUnits),
      saved: minorToMajor(plan.savedAmount.minorUnits),
      byDate: String(plan.targetDate),
      perWeek: minorToMajor(plan.weeklyContribution.minorUnits),
      addedAt: requiredText(plan.sourceAddedAt, 'canonical source plan creation time'),
    };
  });
  const transactionIntelligence = singleRequired(
    workspaceRows(snapshot.collections.transactionIntelligenceStates, workspaceId),
    'canonical transaction intelligence state',
  );
  const companionRuntime = singleRequired(
    workspaceRows(snapshot.collections.companionRuntimeStates, workspaceId),
    'canonical companion runtime state',
  );
  const edits: NonNullable<AppState['edits']> = transactionIntelligence.corrections.map(
    (correction) => ({
      txnId: correction.sourceTransactionId,
      field: correction.field,
      at: correction.at,
      by: correction.by,
      workspaceId: transactionIntelligence.workspaceId,
      before: correction.before,
      after: correction.after,
      ...(correction.id === undefined ? {} : { id: correction.id }),
    }),
  );
  const dismissedDriftSignals: NonNullable<AppState['dismissedDriftSignals']> =
    transactionIntelligence.dismissedDriftSignals.map((entry) => ({
      merchant: entry.merchant,
      at: entry.at,
      workspaceId: transactionIntelligence.workspaceId,
    }));
  const statementImports: NonNullable<AppState['statementImports']> =
    transactionIntelligence.statementImports.map((entry) => ({
      id: entry.id,
      workspaceId: transactionIntelligence.workspaceId,
      source: entry.source,
      rowCount: entry.rowCount,
      atISO: entry.atISO,
      ...(entry.accountId === undefined ? {} : { accountId: entry.accountId }),
      ...(entry.filename === undefined ? {} : { filename: entry.filename }),
      ...(entry.closingBalanceMinor === undefined
        ? {}
        : { closingBalanceMinor: entry.closingBalanceMinor }),
      ...(entry.sourceEvidenceId === undefined ? {} : { sourceEvidenceId: entry.sourceEvidenceId }),
    }));
  const evidenceDocuments: NonNullable<AppState['evidenceDocuments']> =
    transactionIntelligence.evidenceDocuments.map((document) => ({
      id: document.id,
      workspaceId: transactionIntelligence.workspaceId,
      filename: document.filename,
      mediaType: document.mediaType,
      byteSize: document.byteSize,
      addedAtISO: document.addedAtISO,
      sourceType: document.sourceType,
      extractionStatus: document.extractionStatus,
      storageState: document.storageState,
      ...(document.linkedTransactionIds === undefined
        ? {}
        : { linkedTransactionIds: [...document.linkedTransactionIds] }),
    }));
  const timelineEvents: NonNullable<AppState['timelineEvents']> =
    transactionIntelligence.timelineEvents.map((event) => ({
      id: event.id,
      workspaceId: transactionIntelligence.workspaceId,
      at: event.at,
      kind: event.kind,
      subject: event.subject,
      ...(event.note === undefined ? {} : { note: event.note }),
    }));
  const reviewQueue: NonNullable<AppState['reviewQueue']> = transactionIntelligence.reviewQueue.map(
    (item) => readExactReviewQueueItem(item, transactionIntelligence.workspaceId),
  );
  const reviewQueueSpillover: NonNullable<AppState['reviewQueueSpillover']> =
    transactionIntelligence.reviewQueueSpillover.map((item) =>
      readExactReviewQueueItem(item, transactionIntelligence.workspaceId),
    );
  const aiReadCache: NonNullable<AppState['aiReadCache']> = Object.fromEntries(
    Object.entries(companionRuntime.aiReadCache).map(([key, entry]) => [
      key,
      {
        candidates: entry.candidates.map((candidate) => ({
          id: candidate.id,
          source: candidate.source,
          kind: candidate.kind,
          merchant: candidate.merchant,
          amount: candidate.amount,
          confidence: candidate.confidence,
          ...(candidate.sourceEvidenceId === undefined
            ? {}
            : { sourceEvidenceId: candidate.sourceEvidenceId }),
          ...(candidate.date === undefined ? {} : { date: candidate.date }),
          ...(candidate.category === undefined ? {} : { category: candidate.category }),
          ...(candidate.note === undefined ? {} : { note: candidate.note }),
        })),
        closingBalance:
          entry.closingBalance === null
            ? null
            : {
                amount: entry.closingBalance.amount,
                asOfISO: entry.closingBalance.asOfISO,
                ...(entry.closingBalance.openingAmount === undefined
                  ? {}
                  : { openingAmount: entry.closingBalance.openingAmount }),
                ...(entry.closingBalance.statedTotalDebits === undefined
                  ? {}
                  : { statedTotalDebits: entry.closingBalance.statedTotalDebits }),
                ...(entry.closingBalance.statedTotalCredits === undefined
                  ? {}
                  : { statedTotalCredits: entry.closingBalance.statedTotalCredits }),
              },
        at: entry.at,
      },
    ]),
  );

  return {
    currentBalance: {
      amount: minorToMajor(availableAggregateMinor),
      source: aggregateObservation.sourceVariant as BalanceSource,
      confidence: aggregateObservation.sourceConfidence,
      setAt: String(aggregateObservation.observedAt ?? aggregateBalance.updatedAt),
    },
    accounts: projectedAccounts,
    transactions: orderedTransactions.map((row) => row.transaction),
    pots,
    potLedger,
    subs,
    cancelledSubs,
    subPaused,
    subOverrides,
    cycles,
    debts,
    onboarding: {
      done: financialContext.onboarding.done,
      name: financialContext.onboarding.name,
      payday: financialContext.onboarding.payday,
      monthlyIncome: minorToMajor(financialContext.onboarding.monthlyIncome.minorUnits),
    },
    nextYouNote: financialContext.nextYouNote,
    tightPointGoal:
      financialContext.tightPointGoal === null
        ? null
        : minorToMajor(financialContext.tightPointGoal.minorUnits),
    droppedTransactionCount: financialContext.droppedTransactionCount,
    moneyMode: financialContext.moneyMode,
    bufferAmount: minorToMajor(financialContext.bufferAmount.minorUnits),
    modeExtras,
    household: {
      partnerName: financialContext.household.partnerName,
      defaultShare: financialContext.household.defaultShare,
      subShareOverrides: { ...financialContext.household.subShareOverrides },
    },
    spendHold:
      financialContext.spendHold === undefined || financialContext.spendHold === null
        ? null
        : {
            start: String(financialContext.spendHold.start),
            end: String(financialContext.spendHold.end),
            dailyCap: minorToMajor(financialContext.spendHold.dailyCap.minorUnits),
            setAt: String(financialContext.spendHold.setAt),
            breachedDates: financialContext.spendHold.breachedDates.map(String),
          },
    whatIfHolds: (financialContext.whatIfHolds ?? []).map((hold) => ({
      id: hold.id,
      workspaceId: financialContext.workspaceId,
      amount: minorToMajor(hold.amount.minorUnits),
      recurrence: hold.recurrence,
      addedAt: String(hold.addedAt),
      ...(hold.label === undefined ? {} : { label: hold.label }),
    })),
    business,
    calendarEvents,
    incomeSources,
    plans,
    edits,
    ignoredReviewSigs: [...transactionIntelligence.ignoredReviewSignatures],
    aiReads: { ...companionRuntime.aiReads },
    aiReadCache,
    whatChangedSeenISO: companionRuntime.whatChangedSeenISO,
    lens: { ...companionRuntime.lens },
    melo: {
      quietMode: companionRuntime.melo.quietMode,
      wardrobe: [...companionRuntime.melo.wardrobe],
      ...(companionRuntime.melo.companionIntroSeen === undefined
        ? {}
        : { companionIntroSeen: companionRuntime.melo.companionIntroSeen }),
      ...(companionRuntime.melo.preferredPosition === undefined
        ? {}
        : { preferredPosition: companionRuntime.melo.preferredPosition }),
      tone: companionRuntime.melo.tone,
      ...(companionRuntime.melo.soundEnabled === undefined
        ? {}
        : { soundEnabled: companionRuntime.melo.soundEnabled }),
    },
    tinyWins: companionRuntime.tinyWins.map((win) => ({ ...win })),
    meloPrimerSeen: companionRuntime.meloPrimerSeen === true,
    lastOpenedAt: companionRuntime.lastOpenedAt ?? null,
    oneMoveHistory: (companionRuntime.oneMoveHistory ?? []).map((entry) => ({ ...entry })),
    meloDismissLog: (companionRuntime.meloDismissLog ?? []).map((entry) => ({ ...entry })),
    ignoredBankExternalIds: [...transactionIntelligence.ignoredBankExternalIds],
    dismissedIncomeSignals: [...transactionIntelligence.dismissedIncomeSignals],
    dismissedBillSignals: [...transactionIntelligence.dismissedBillSignals],
    dismissedDriftSignals,
    dismissedAnnualSignals: [...transactionIntelligence.dismissedAnnualSignals],
    merchantCategories: Object.fromEntries(
      Object.entries(transactionIntelligence.merchantCategories).map(([key, memory]) => [
        key,
        { ...memory },
      ]),
    ),
    statementImports,
    evidenceDocuments,
    timelineEvents,
    reviewQueue,
    reviewQueueSpillover,
  };
}

/** Reject a canonical mirror before commit if any shipping money field would read differently. */
export function assertCanonicalAppStateMoneyProjectionParity(
  state: AppState,
  snapshot: CanonicalRepositorySnapshot,
  workspaceId: string,
  todayISO = new Date().toISOString().slice(0, 10),
): CanonicalAppStateMoneyProjection {
  const actual = readCanonicalAppStateMoneyProjection(snapshot, workspaceId, todayISO);
  const expected = normalizedSourceMoneyProjection(state, todayISO);
  const mismatches = (
    [
      'currentBalance',
      'accounts',
      'transactions',
      'pots',
      'potLedger',
      'subs',
      'cancelledSubs',
      'subPaused',
      'subOverrides',
      'cycles',
      'debts',
      'onboarding',
      'nextYouNote',
      'tightPointGoal',
      'droppedTransactionCount',
      'moneyMode',
      'bufferAmount',
      'modeExtras',
      'household',
      'spendHold',
      'whatIfHolds',
      'business',
      'calendarEvents',
      'incomeSources',
      'plans',
      'edits',
      'ignoredReviewSigs',
      'aiReads',
      'aiReadCache',
      'whatChangedSeenISO',
      'lens',
      'melo',
      'tinyWins',
      'meloPrimerSeen',
      'lastOpenedAt',
      'oneMoveHistory',
      'meloDismissLog',
      'ignoredBankExternalIds',
      'dismissedIncomeSignals',
      'dismissedBillSignals',
      'dismissedDriftSignals',
      'dismissedAnnualSignals',
      'merchantCategories',
      'statementImports',
      'evidenceDocuments',
      'timelineEvents',
      'reviewQueue',
      'reviewQueueSpillover',
    ] as const
  ).filter((key) => stableJson(actual[key]) !== stableJson(expected[key]));
  if (mismatches.length > 0) {
    throw new Error(
      `Canonical AppState money projection parity failed for ${mismatches.join(', ')}.`,
    );
  }
  return actual;
}

type OrderedTransaction = Readonly<{
  sourceOrdinal: number;
  transaction: Transaction;
}>;

function readSourceAccount(
  account: CanonicalAccount,
  balances: ReadonlyMap<string, CanonicalCurrentBalance>,
  observations: ReadonlyMap<string, BalanceObservation>,
): Account {
  if (account.sourceAccountId === undefined) {
    throw new Error(`Canonical source account ${String(account.id)} has no source identity.`);
  }
  const balance = requiredMapValue(
    balances,
    String(account.id),
    `canonical current balance for ${String(account.id)}`,
  );
  const observation = requiredMapValue(
    observations,
    String(balance.sourceObservationId),
    `canonical balance observation for ${String(account.id)}`,
  );
  const balanceAsOfISO = String(observation.observedAt ?? balance.updatedAt);
  return {
    id: account.sourceAccountId,
    name: account.name,
    kind: appAccountKind(account.kind),
    isLiability: account.kind === 'credit' || account.kind === 'loan',
    balanceMinor: minorToMajor(balance.balance.minorUnits),
    balanceAsOfISO,
    addedAt: String(account.createdAt ?? balanceAsOfISO),
    currency: String(account.currency),
    workspaceId: account.workspaceId,
    ...(account.state === 'active' ? {} : { closed: true }),
  };
}

function readPostedTransaction(
  transaction: FinancialTransaction,
  accounts: ReadonlyMap<string, CanonicalAccount>,
): OrderedTransaction {
  const categoryIds = [
    ...new Set(
      transaction.splits.flatMap((split) =>
        split.categoryId === undefined ? [] : [split.categoryId],
      ),
    ),
  ];
  const category = appCategory(singleRequired(categoryIds, 'canonical transaction category'));
  return readTransactionFields({
    sourceTransactionId: requiredText(
      transaction.sourceTransactionId,
      'canonical source transaction ID',
    ),
    sourceOrdinal: requiredOrdinal(transaction.sourceOrdinal),
    accountId: sourceAccountId(transaction.accountId, accounts),
    merchant: transaction.reference ?? transaction.description,
    amountMinor: transaction.amount.minorUnits,
    bookedAt: transaction.bookedAt,
    category,
    sourceKind: transaction.sourceKind,
    sourceEvidenceId: transaction.sourceEvidenceId,
    externalId: transaction.externalId,
    connectionId: transaction.connectionId,
    workspaceId: transaction.workspaceId,
  });
}

function readExpectedTransaction(
  expectation: FinancialExpectation,
  accounts: ReadonlyMap<string, CanonicalAccount>,
): OrderedTransaction {
  if (expectation.accountId === undefined) {
    throw new Error('Canonical source expectation has no account.');
  }
  return readTransactionFields({
    sourceTransactionId: requiredText(
      expectation.sourceTransactionId,
      'canonical source expectation ID',
    ),
    sourceOrdinal: requiredOrdinal(expectation.sourceOrdinal),
    accountId: sourceAccountId(expectation.accountId, accounts),
    merchant: expectation.reference ?? expectation.description,
    amountMinor: expectation.amount.minorUnits,
    bookedAt: expectation.bookedAt,
    category: appCategory(requiredText(expectation.categoryId, 'canonical expectation category')),
    sourceKind: expectation.sourceKind,
    sourceEvidenceId: expectation.sourceEvidenceId,
    externalId: expectation.externalId,
    connectionId: expectation.connectionId,
    workspaceId: expectation.workspaceId,
  });
}

function readTransactionFields(
  input: Readonly<{
    sourceTransactionId: string;
    sourceOrdinal: number;
    accountId: string;
    merchant: string | undefined;
    amountMinor: number;
    bookedAt: string | undefined;
    category: Transaction['category'];
    sourceKind: TransactionSourceKind | undefined;
    sourceEvidenceId: string | undefined;
    externalId: string | undefined;
    connectionId: string | undefined;
    workspaceId: Transaction['workspaceId'];
  }>,
): OrderedTransaction {
  const merchant = input.merchant;
  if (merchant === undefined) throw new Error('Canonical source transaction has no merchant.');
  const bookedAt = requiredText(input.bookedAt, 'canonical source transaction timestamp');
  const source = appTransactionSource(input.sourceKind);
  return {
    sourceOrdinal: input.sourceOrdinal,
    transaction: {
      id: input.sourceTransactionId,
      when: bookedAt,
      merchant,
      amount: minorToMajor(input.amountMinor),
      category: input.category,
      source,
      accountId: input.accountId,
      ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId }),
      ...(input.sourceEvidenceId === undefined ? {} : { sourceEvidenceId: input.sourceEvidenceId }),
      ...(input.externalId === undefined ? {} : { externalId: input.externalId }),
      ...(input.connectionId === undefined ? {} : { bankConnectionId: input.connectionId }),
    },
  };
}

function sourceAccountId(
  canonicalAccountId: unknown,
  accounts: ReadonlyMap<string, CanonicalAccount>,
): string {
  const account = requiredMapValue(
    accounts,
    String(canonicalAccountId),
    `canonical transaction account ${String(canonicalAccountId)}`,
  );
  return requiredText(account.sourceAccountId, 'canonical transaction source account ID');
}

function appAccountKind(kind: CanonicalAccount['kind']): Account['kind'] {
  if (kind === 'credit' || kind === 'loan') return 'credit-card';
  return kind;
}

function appTransactionSource(source: TransactionSourceKind | undefined): Transaction['source'] {
  if (source === 'manual') return 'manual';
  if (source === 'melo') return 'melo';
  if (source === 'migration') return 'seed';
  if (source === 'open_banking') return 'bank';
  throw new Error(
    `Canonical source transaction kind ${String(source)} is not AppState-compatible.`,
  );
}

function appCategory(category: string): Transaction['category'] {
  if (!appCategories.has(category as Transaction['category'])) {
    throw new Error(
      `Canonical source transaction category ${category} is not AppState-compatible.`,
    );
  }
  return category as Transaction['category'];
}

function appCalendarEventKind(
  kind: 'in' | 'out' | 'review' | 'deadline' | undefined,
): AppState['calendarEvents'][number]['kind'] {
  if (kind === 'in' || kind === 'out' || kind === 'review' || kind === 'deadline') return kind;
  throw new Error('Canonical source calendar event kind is missing or unsupported.');
}

function workspaceRows<T extends Readonly<{ workspaceId: unknown }>>(
  rows: readonly T[],
  workspaceId: string,
): readonly T[] {
  return rows.filter((row) => String(row.workspaceId) === workspaceId);
}

function orderedSourceRows<T extends Readonly<{ workspaceId: unknown; sourceOrdinal?: number }>>(
  rows: readonly T[],
  workspaceId: string,
  label: string,
): readonly T[] {
  const selected = workspaceRows(rows, workspaceId).map((row) => ({
    row,
    sourceOrdinal: requiredOrdinal(row.sourceOrdinal),
  }));
  uniqueBy(selected, (entry) => String(entry.sourceOrdinal), `${label} ordinal`);
  return selected
    .sort((left, right) => left.sourceOrdinal - right.sourceOrdinal)
    .map((entry) => entry.row);
}

function sweepCanonicalSubscriptionOverrides(
  subscriptions: readonly Sub[],
  overrides: Readonly<Record<string, number>>,
): Record<string, number> {
  const byName = new Map(subscriptions.map((subscription) => [subscription.name, subscription]));
  return Object.fromEntries(
    Object.entries(overrides).filter(([name, delta]) => {
      const subscription = byName.get(name);
      return subscription !== undefined && subscription.nextRenewalDaysAway + delta >= 0;
    }),
  );
}

function uniqueBy<T>(
  rows: readonly T[],
  key: (row: T) => string,
  label: string,
): ReadonlyMap<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const value = key(row);
    if (result.has(value)) throw new Error(`${label} ${value} is duplicated.`);
    result.set(value, row);
  }
  return result;
}

function requiredMapValue<T>(map: ReadonlyMap<string, T>, key: string, label: string): T {
  const value = map.get(key);
  if (value === undefined) throw new Error(`${label} is missing.`);
  return value;
}

function singleRequired<T>(rows: readonly T[], label: string): T {
  if (rows.length !== 1) throw new Error(`${label} must contain exactly one record.`);
  return rows[0] as T;
}

function singleOptional<T>(rows: readonly T[], label: string): T | undefined {
  if (rows.length > 1) throw new Error(`${label} must contain at most one record.`);
  return rows[0];
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is missing.`);
  return value;
}

function requiredOrdinal(value: number | undefined): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Canonical source transaction ordinal is missing or invalid.');
  }
  return value;
}

function minorToMajor(value: number): number {
  if (!Number.isSafeInteger(value))
    throw new Error('Canonical money value is not safe integer minor units.');
  return value / 100;
}

function readExactReviewQueueItem(
  item: ReviewQueueItemState,
  workspaceId: WorkspaceId,
): NonNullable<AppState['reviewQueue']>[number] {
  return {
    id: item.id,
    workspaceId,
    source: item.source,
    merchant: item.merchant,
    amount: item.amount,
    addedAt: item.addedAt,
    ...(item.sourceEvidenceId === undefined ? {} : { sourceEvidenceId: item.sourceEvidenceId }),
    ...(item.date === undefined ? {} : { date: item.date }),
    ...(item.accountId === undefined ? {} : { accountId: item.accountId }),
    ...(item.externalId === undefined ? {} : { externalId: item.externalId }),
    ...(item.bankConnectionId === undefined ? {} : { bankConnectionId: item.bankConnectionId }),
    ...(item.hint === undefined ? {} : { hint: item.hint }),
    ...(item.category === undefined ? {} : { category: item.category }),
    ...(item.rememberedCategory === undefined
      ? {}
      : { rememberedCategory: item.rememberedCategory }),
  };
}

function normalizedSourceMoneyProjection(
  state: AppState,
  todayISO: string,
): CanonicalAppStateMoneyProjection {
  const sourceAccounts = state.accounts ?? [];
  const accounts: Account[] =
    sourceAccounts.length === 0
      ? [
          {
            id: DEFAULT_ACCOUNT_ID,
            name: 'Main',
            kind: 'bank',
            isLiability: false,
            balanceMinor: state.currentBalance.amount,
            balanceAsOfISO: state.currentBalance.setAt,
            addedAt: state.currentBalance.setAt,
            currency: 'GBP',
            workspaceId: state.dataWorkspaceId,
          },
        ]
      : sourceAccounts.map((account) => ({
          id: account.id,
          name: account.name,
          kind: account.kind,
          isLiability: account.isLiability,
          balanceMinor: account.balanceMinor,
          balanceAsOfISO: account.balanceAsOfISO,
          addedAt: account.addedAt,
          currency: account.currency ?? 'GBP',
          workspaceId: account.workspaceId ?? state.dataWorkspaceId,
          ...(account.closed === true ? { closed: true } : {}),
        }));
  const transactions: Transaction[] = state.transactions.map((transaction) => ({
    id: transaction.id,
    when: transaction.when,
    merchant: transaction.merchant,
    amount: transaction.amount,
    category: transaction.category,
    source: transaction.source,
    accountId: accountIdOf(transaction),
    workspaceId: transaction.workspaceId ?? state.dataWorkspaceId,
    ...(transaction.sourceEvidenceId === undefined
      ? {}
      : { sourceEvidenceId: transaction.sourceEvidenceId }),
    ...(transaction.externalId === undefined ? {} : { externalId: transaction.externalId }),
    ...(transaction.bankConnectionId === undefined
      ? {}
      : { bankConnectionId: transaction.bankConnectionId }),
  }));
  const pots: Pot[] = state.pots.map((pot) => ({
    id: pot.id,
    workspaceId: pot.workspaceId ?? state.dataWorkspaceId,
    name: pot.name,
    saved: pot.saved,
    goal: pot.goal,
    perWeek: pot.perWeek,
    accent: pot.accent,
    ...(pot.cadence === undefined ? {} : { cadence: pot.cadence }),
    ...(pot.allowNegative === undefined ? {} : { allowNegative: pot.allowNegative }),
  }));
  const potLedger: PotLedgerEntry[] = (state.potLedger ?? []).map((entry) => ({
    id: entry.id,
    workspaceId: entry.workspaceId ?? state.dataWorkspaceId,
    potId: entry.potId,
    at: entry.at,
    kind: entry.kind,
    amount: entry.amount,
    source: entry.source,
  }));
  const subs = reanchorRenewals(
    state.subs.map((subscription) => ({
      name: subscription.name,
      workspaceId: subscription.workspaceId ?? state.dataWorkspaceId,
      cost: subscription.cost,
      nextRenewalDaysAway: subscription.nextRenewalDaysAway,
      ...(subscription.nextRenewalISO === undefined
        ? {}
        : { nextRenewalISO: subscription.nextRenewalISO }),
      ...(subscription.renewalPeriodDays === undefined
        ? {}
        : { renewalPeriodDays: subscription.renewalPeriodDays }),
      lastUsedDaysAgo: subscription.lastUsedDaysAgo,
      usesPerMonth: subscription.usesPerMonth,
      ...(subscription.trialEndsInDays === undefined
        ? {}
        : { trialEndsInDays: subscription.trialEndsInDays }),
      ...(subscription.pausedUntil === undefined ? {} : { pausedUntil: subscription.pausedUntil }),
      ...(subscription.autoResume === undefined ? {} : { autoResume: subscription.autoResume }),
      ...(subscription.pauseReason === undefined ? {} : { pauseReason: subscription.pauseReason }),
      ...(subscription.pausedAt === undefined ? {} : { pausedAt: subscription.pausedAt }),
    })),
    todayISO,
  ).items;
  const subPaused = { ...state.subPaused };
  const subOverrides = sweepCanonicalSubscriptionOverrides(subs, state.subOverrides);
  const cycles: CycleRecord[] = state.cycles.map((cycle) => ({
    workspaceId: cycle.workspaceId ?? state.dataWorkspaceId,
    closedAt: cycle.closedAt,
    label: cycle.label,
    spare: cycle.spare,
    tightPoint: cycle.tightPoint,
    setAside: cycle.setAside,
    note: cycle.note,
    ...(cycle.reconstructed === true ? { reconstructed: true as const } : {}),
  }));
  const debts: Debt[] = (state.debts ?? []).map((debt) => ({
    id: debt.id,
    workspaceId: debt.workspaceId ?? state.dataWorkspaceId,
    name: debt.name,
    kind: debt.kind,
    balance: debt.balance,
    apr: debt.apr,
    minPayment: debt.minPayment,
    dueDom: debt.dueDom,
    addedAt: debt.addedAt,
    ...(debt.linkedAccountId === undefined ? {} : { linkedAccountId: debt.linkedAccountId }),
  }));
  return {
    currentBalance: {
      amount: state.currentBalance.amount,
      source: state.currentBalance.source,
      confidence: state.currentBalance.confidence,
      setAt: state.currentBalance.setAt,
    },
    accounts,
    transactions,
    pots,
    potLedger,
    subs,
    cancelledSubs: (state.cancelledSubs ?? []).map((subscription) => ({
      ...subscription,
      workspaceId: subscription.workspaceId ?? state.dataWorkspaceId,
    })),
    subPaused,
    subOverrides,
    cycles,
    debts,
    onboarding: {
      done: state.onboarding.done,
      name: state.onboarding.name,
      payday: state.onboarding.payday,
      monthlyIncome: state.onboarding.monthlyIncome,
    },
    nextYouNote: state.nextYouNote,
    tightPointGoal: state.tightPointGoal,
    droppedTransactionCount: state.droppedTransactionCount ?? 0,
    moneyMode: state.moneyMode ?? 'survival',
    bufferAmount: state.bufferAmount ?? 100,
    modeExtras: { ...(state.modeExtras ?? {}) },
    household: {
      partnerName: state.household?.partnerName ?? '',
      defaultShare: state.household?.defaultShare ?? 0.5,
      subShareOverrides: { ...(state.household?.subShareOverrides ?? {}) },
    },
    spendHold:
      state.spendHold === undefined || state.spendHold === null
        ? null
        : {
            ...state.spendHold,
            breachedDates: [...(state.spendHold.breachedDates ?? [])],
          },
    whatIfHolds: (state.whatIfHolds ?? []).map((hold) => ({
      ...hold,
      workspaceId: hold.workspaceId ?? state.dataWorkspaceId,
    })),
    business: normaliseBusinessOperationsState(state.business),
    calendarEvents: state.calendarEvents.map((event) => ({
      id: event.id,
      workspaceId: event.workspaceId ?? state.dataWorkspaceId,
      date: event.date,
      kind: event.kind,
      title: event.title,
      ...(event.time === undefined ? {} : { time: event.time }),
      ...(event.note === undefined ? {} : { note: event.note }),
      ...(event.amount === undefined ? {} : { amount: event.amount }),
      ...(event.reminderOffsetMinutes === undefined
        ? {}
        : { reminderOffsetMinutes: event.reminderOffsetMinutes }),
    })),
    incomeSources: (state.incomeSources ?? []).map((source) => ({
      id: source.id,
      workspaceId: source.workspaceId ?? state.dataWorkspaceId,
      label: source.label,
      cadence: source.cadence,
      amount: source.amount,
      source: source.source,
      ...(source.dayOfMonth === undefined ? {} : { dayOfMonth: source.dayOfMonth }),
      ...(source.anchorISO === undefined ? {} : { anchorISO: source.anchorISO }),
    })),
    plans: (state.plans ?? []).map((plan) => ({
      id: plan.id,
      workspaceId: plan.workspaceId ?? state.dataWorkspaceId,
      name: plan.name,
      target: plan.target,
      saved: plan.saved,
      byDate: plan.byDate,
      perWeek: plan.perWeek,
      addedAt: plan.addedAt,
    })),
    edits: (state.edits ?? []).map((edit) => ({
      txnId: edit.txnId,
      field: edit.field,
      at: edit.at,
      by: edit.by,
      workspaceId: edit.workspaceId ?? state.dataWorkspaceId,
      before: edit.before,
      after: edit.after,
      ...(edit.id === undefined ? {} : { id: edit.id }),
    })),
    ignoredReviewSigs: [...(state.ignoredReviewSigs ?? [])],
    aiReads: { ...(state.aiReads ?? { monthKey: '', used: 0 }) },
    aiReadCache: Object.fromEntries(
      Object.entries(state.aiReadCache ?? {}).map(([key, entry]) => [
        key,
        {
          candidates: entry.candidates.map((candidate) => ({ ...candidate })),
          closingBalance: entry.closingBalance === null ? null : { ...entry.closingBalance },
          at: entry.at,
        },
      ]),
    ),
    whatChangedSeenISO: state.whatChangedSeenISO ?? null,
    lens: {
      ...(state.lens ?? {
        plusUnlocked: false,
        proUnlocked: false,
        trialCycleId: null,
        trialEndedCycleId: null,
        trialEndAcknowledged: true,
      }),
    },
    melo: {
      quietMode: state.melo?.quietMode ?? false,
      wardrobe: [...(state.melo?.wardrobe ?? [])],
      ...(state.melo?.companionIntroSeen === undefined
        ? {}
        : { companionIntroSeen: state.melo.companionIntroSeen }),
      ...(state.melo?.preferredPosition === undefined
        ? {}
        : { preferredPosition: state.melo.preferredPosition }),
      tone: state.melo?.tone ?? 'calm',
      ...(state.melo?.soundEnabled === undefined ? {} : { soundEnabled: state.melo.soundEnabled }),
    },
    tinyWins: (state.tinyWins ?? []).map((win) => ({ ...win })),
    meloPrimerSeen: state.meloPrimerSeen === true,
    lastOpenedAt: state.lastOpenedAt ?? null,
    oneMoveHistory: (state.oneMoveHistory ?? []).map((entry) => ({ ...entry })),
    meloDismissLog: (state.meloDismissLog ?? []).map((entry) => ({ ...entry })),
    ignoredBankExternalIds: [...(state.ignoredBankExternalIds ?? [])],
    dismissedIncomeSignals: [...(state.dismissedIncomeSignals ?? [])],
    dismissedBillSignals: [...(state.dismissedBillSignals ?? [])],
    dismissedDriftSignals: (state.dismissedDriftSignals ?? []).map((entry) => ({
      merchant: entry.merchant,
      at: entry.at,
      workspaceId: entry.workspaceId ?? state.dataWorkspaceId,
    })),
    dismissedAnnualSignals: [...(state.dismissedAnnualSignals ?? [])],
    merchantCategories: Object.fromEntries(
      Object.entries(state.merchantCategories ?? {}).map(([key, memory]) => [key, { ...memory }]),
    ),
    statementImports: (state.statementImports ?? []).map((entry) => ({
      id: entry.id,
      workspaceId: entry.workspaceId ?? state.dataWorkspaceId,
      source: entry.source,
      rowCount: entry.rowCount,
      atISO: entry.atISO,
      ...(entry.accountId === undefined ? {} : { accountId: entry.accountId }),
      ...(entry.filename === undefined ? {} : { filename: entry.filename }),
      ...(entry.closingBalanceMinor === undefined
        ? {}
        : { closingBalanceMinor: entry.closingBalanceMinor }),
      ...(entry.sourceEvidenceId === undefined ? {} : { sourceEvidenceId: entry.sourceEvidenceId }),
    })),
    evidenceDocuments: (state.evidenceDocuments ?? []).map((document) => ({
      id: document.id,
      workspaceId: document.workspaceId ?? state.dataWorkspaceId,
      filename: document.filename,
      mediaType: document.mediaType,
      byteSize: document.byteSize,
      addedAtISO: document.addedAtISO,
      sourceType: document.sourceType,
      extractionStatus: document.extractionStatus,
      storageState: document.storageState,
      ...(document.linkedTransactionIds === undefined
        ? {}
        : { linkedTransactionIds: [...document.linkedTransactionIds] }),
    })),
    timelineEvents: (state.timelineEvents ?? []).map((event) => ({
      id: event.id,
      workspaceId: event.workspaceId ?? state.dataWorkspaceId,
      at: event.at,
      kind: event.kind,
      subject: event.subject,
      ...(event.note === undefined ? {} : { note: event.note }),
    })),
    reviewQueue: (state.reviewQueue ?? []).map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId ?? state.dataWorkspaceId,
      source: item.source,
      merchant: item.merchant,
      amount: item.amount,
      addedAt: item.addedAt,
      ...(item.sourceEvidenceId === undefined ? {} : { sourceEvidenceId: item.sourceEvidenceId }),
      ...(item.date === undefined ? {} : { date: item.date }),
      ...(item.accountId === undefined ? {} : { accountId: item.accountId }),
      ...(item.externalId === undefined ? {} : { externalId: item.externalId }),
      ...(item.bankConnectionId === undefined ? {} : { bankConnectionId: item.bankConnectionId }),
      ...(item.hint === undefined ? {} : { hint: item.hint }),
      ...(item.category === undefined ? {} : { category: item.category }),
      ...(item.rememberedCategory === undefined
        ? {}
        : { rememberedCategory: item.rememberedCategory }),
    })),
    reviewQueueSpillover: (state.reviewQueueSpillover ?? []).map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId ?? state.dataWorkspaceId,
      source: item.source,
      merchant: item.merchant,
      amount: item.amount,
      addedAt: item.addedAt,
      ...(item.sourceEvidenceId === undefined ? {} : { sourceEvidenceId: item.sourceEvidenceId }),
      ...(item.date === undefined ? {} : { date: item.date }),
      ...(item.accountId === undefined ? {} : { accountId: item.accountId }),
      ...(item.externalId === undefined ? {} : { externalId: item.externalId }),
      ...(item.bankConnectionId === undefined ? {} : { bankConnectionId: item.bankConnectionId }),
      ...(item.hint === undefined ? {} : { hint: item.hint }),
      ...(item.category === undefined ? {} : { category: item.category }),
      ...(item.rememberedCategory === undefined
        ? {}
        : { rememberedCategory: item.rememberedCategory }),
    })),
  };
}

function readBusinessOperations(value: string | undefined): BusinessOperationsState {
  if (value === undefined) return normaliseBusinessOperationsState(undefined);
  try {
    const parsed = JSON.parse(value) as Partial<BusinessOperationsState>;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Business operations payload is not an object.');
    }
    return normaliseBusinessOperationsState(parsed);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown parse failure';
    throw new Error(`Canonical Business operations payload is invalid: ${reason}`);
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
