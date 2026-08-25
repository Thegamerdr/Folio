import {
  createCalendarItemId,
  createCompanionRuntimeStateId,
  createCycleRecordId,
  createDebtId,
  createEntityVersion,
  createFinancialContextId,
  createIncomeScheduleId,
  createInstantString,
  createLocalDate,
  createLocalTime,
  createMoney,
  createPlanId,
  createPotId,
  createPotLedgerEntryId,
  createProvenanceId,
  createSubscriptionId,
  createSubscriptionPreferenceId,
  createTransactionIntelligenceStateId,
} from '@folio/domain';
import type { CanonicalRepository, CanonicalRepositorySnapshot } from '@folio/storage';
import { normaliseBusinessOperationsState } from '@folio/business-workspace';

import {
  DEFAULT_ACCOUNT_ID,
  accountIdOf,
  type Account,
  type AppState,
  type ReviewItem,
  type TimelineEvent,
  type Transaction,
} from '../store';
import type { PersistedWorkspace } from './workspaceRoot';
import {
  createCanonicalMobileLedgerSnapshot,
  type CanonicalMobileAccountInput,
  type CanonicalMobileLedgerSnapshot,
} from '../../local/canonicalLedgerAdapter';
import { createCanonicalRepositoryForMobileSnapshot } from '../../local/canonicalLedgerRepository';
import { assertCanonicalAppStateMoneyProjectionParity } from './canonicalAppStateReadProjection';
import type {
  LocalHistoryEntry,
  LocalImportDraft,
  LocalLedgerState,
  LocalLedgerTransaction,
} from '../../local/localLedger';

export type CanonicalAppStateProjection = Readonly<{
  mobileSnapshot: CanonicalMobileLedgerSnapshot;
  repositorySnapshot: CanonicalRepositorySnapshot;
}>;

/**
 * Build the normalized, review-before-truth projection written beside one exact AppState
 * generation. AppState remains the read authority during the migration; this projection is a
 * verified bridge, not permission for UI code to bypass typed commands later.
 */
export function createCanonicalAppStateProjection(
  state: AppState,
  workspace: PersistedWorkspace,
  nowISO = new Date().toISOString(),
): CanonicalAppStateProjection {
  assertWorkspacePartition(state, workspace);
  const asOfDate = requireIsoInstant(nowISO, 'Canonical projection time').slice(0, 10);
  const transactions = state.transactions.map((transaction, sourceOrdinal) =>
    projectTransaction(transaction, workspace, sourceOrdinal),
  );
  const reviewItems = [...(state.reviewQueue ?? []), ...(state.reviewQueueSpillover ?? [])];
  const importDrafts = uniqueById(reviewItems).map((item) =>
    projectReviewItem(item, workspace, asOfDate),
  );
  const accountInputs = projectAccounts(state, workspace, [
    ...transactions.map((transaction) => transaction.accountId),
    ...reviewItems.map((item) => item.accountId ?? DEFAULT_ACCOUNT_ID),
  ]);
  const defaultAccountId = accountInputs.some((account) => account.id === DEFAULT_ACCOUNT_ID)
    ? DEFAULT_ACCOUNT_ID
    : accountInputs[0]?.id;
  if (defaultAccountId === undefined) {
    throw new Error('Canonical AppState projection requires an account.');
  }

  const localState: LocalLedgerState = {
    asOfDate,
    cashOnHandMinor: majorToMinor(state.currentBalance.amount, 'Current balance'),
    currency: 'GBP',
    tightPointGoalMinor:
      state.tightPointGoal === null ? null : majorToMinor(state.tightPointGoal, 'Tight-point goal'),
    transactions,
    importDrafts,
    rejectedImports: [],
    documentStages: [],
    importIssueCount: importDrafts.reduce((total, draft) => total + draft.parserIssues.length, 0),
    history: (state.timelineEvents ?? []).map((event) => projectTimelineEvent(event, workspace)),
    // Durable containers are projected directly into first-class canonical collections below.
    // The older local-ledger convenience shape cannot represent every shipping field losslessly.
    pots: [],
    subscriptions: [],
    cycles: [],
    subOverrides: {},
    calendarEvents: [],
  };
  const mobileSnapshot = createCanonicalMobileLedgerSnapshot(localState, workspace, {
    accounts: accountInputs,
    defaultAccountId,
  });
  const repository = createCanonicalRepositoryForMobileSnapshot(mobileSnapshot);
  projectDurableMoneyContainers(repository, state, workspace);
  const repositorySnapshot = repository.snapshot();
  assertCanonicalAppStateMoneyProjectionParity(
    state,
    repositorySnapshot,
    String(workspace.id),
    asOfDate,
  );
  return { mobileSnapshot, repositorySnapshot };
}

/** Parse the exact freshly serialized partition so the projection cannot accidentally include
 * transient in-memory fields that the committed generation excludes. */
export function createCanonicalAppStateProjectionFromPayload(
  payload: string,
  workspace: PersistedWorkspace,
  nowISO = new Date().toISOString(),
): CanonicalAppStateProjection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new Error('Canonical projection payload is not valid JSON.');
  }
  if (!isRecord(parsed)) throw new Error('Canonical projection payload is not an object.');
  return createCanonicalAppStateProjection(parsed as AppState, workspace, nowISO);
}

function projectDurableMoneyContainers(
  repository: CanonicalRepository,
  state: AppState,
  workspace: PersistedWorkspace,
): void {
  const currency = String(workspace.baseCurrency);
  const canonicalPotIds = new Map<string, ReturnType<typeof createPotId>>();

  for (const [sourceOrdinal, pot] of state.pots.entries()) {
    assertRowWorkspace(pot, workspace, 'Pot');
    const id = canonicalContainerId('pot', workspace, pot.id, sourceOrdinal, createPotId);
    if (!canonicalPotIds.has(pot.id)) canonicalPotIds.set(pot.id, id);
    repository.pots.put({
      id,
      workspaceId: workspace.id,
      sourcePotId: pot.id,
      sourceOrdinal,
      name: pot.name,
      goal: createMoney({ minorUnits: majorToMinor(pot.goal, `Pot ${pot.id} goal`), currency }),
      saved: createMoney({ minorUnits: majorToMinor(pot.saved, `Pot ${pot.id} saved`), currency }),
      perWeek: createMoney({
        minorUnits: majorToMinor(pot.perWeek, `Pot ${pot.id} weekly contribution`),
        currency,
      }),
      accent: pot.accent,
      ...(pot.cadence === undefined ? {} : { cadence: checkedPotCadence(pot.cadence, pot.id) }),
      ...(pot.allowNegative === undefined ? {} : { allowNegative: pot.allowNegative }),
      version: canonicalContainerVersion('pot', workspace, pot.id, sourceOrdinal),
    });
  }

  for (const [sourceOrdinal, entry] of (state.potLedger ?? []).entries()) {
    assertRowWorkspace(entry, workspace, 'Pot ledger entry');
    const potId =
      canonicalPotIds.get(entry.potId) ??
      canonicalContainerId('pot', workspace, entry.potId, 0, createPotId);
    repository.potLedgerEntries.put({
      id: canonicalContainerId(
        'potledger',
        workspace,
        entry.id,
        sourceOrdinal,
        createPotLedgerEntryId,
      ),
      workspaceId: workspace.id,
      potId,
      sourceEntryId: entry.id,
      sourcePotId: entry.potId,
      sourceOrdinal,
      sourceOccurredAt: entry.at,
      occurredAt: canonicalInstant(entry.at, `Pot ledger entry ${entry.id} time`),
      kind: entry.kind,
      amount: createMoney({
        minorUnits: majorToMinor(entry.amount, `Pot ledger entry ${entry.id} amount`),
        currency,
      }),
      source: entry.source,
      version: canonicalContainerVersion('potledger', workspace, entry.id, sourceOrdinal),
    });
  }

  for (const [sourceOrdinal, subscription] of state.subs.entries()) {
    assertRowWorkspace(subscription, workspace, 'Subscription');
    repository.subscriptions.put({
      id: canonicalContainerId(
        'subscription',
        workspace,
        subscription.name,
        sourceOrdinal,
        createSubscriptionId,
      ),
      workspaceId: workspace.id,
      sourceName: subscription.name,
      sourceOrdinal,
      name: subscription.name,
      cost: createMoney({
        minorUnits: majorToMinor(subscription.cost, `Subscription ${subscription.name} cost`),
        currency,
      }),
      cadence: canonicalSubscriptionCadence(subscription.renewalPeriodDays),
      nextRenewalDaysAway: requireSafeInteger(
        subscription.nextRenewalDaysAway,
        `Subscription ${subscription.name} renewal days`,
      ),
      ...(subscription.nextRenewalISO === undefined
        ? {}
        : {
            nextRenewalISO: requireLocalDate(
              subscription.nextRenewalISO,
              `Subscription ${subscription.name} renewal date`,
            ),
          }),
      ...(subscription.renewalPeriodDays === undefined
        ? {}
        : {
            renewalPeriodDays: requirePositiveInteger(
              subscription.renewalPeriodDays,
              `Subscription ${subscription.name} renewal period`,
            ),
          }),
      lastUsedDaysAgo: requireSafeInteger(
        subscription.lastUsedDaysAgo,
        `Subscription ${subscription.name} last-used days`,
      ),
      usesPerMonth: requireSafeInteger(
        subscription.usesPerMonth,
        `Subscription ${subscription.name} monthly uses`,
      ),
      ...(subscription.trialEndsInDays === undefined
        ? {}
        : {
            trialEndsInDays: requireSafeInteger(
              subscription.trialEndsInDays,
              `Subscription ${subscription.name} trial days`,
            ),
          }),
      paused: state.subPaused[subscription.name] === true,
      ...(subscription.pausedUntil === undefined
        ? {}
        : {
            pausedUntil: createLocalDate(
              requireLocalDate(
                subscription.pausedUntil,
                `Subscription ${subscription.name} resume date`,
              ),
            ),
          }),
      ...(subscription.autoResume === undefined ? {} : { autoResume: subscription.autoResume }),
      ...(subscription.pauseReason === undefined
        ? {}
        : {
            pauseReason: requireString(
              subscription.pauseReason,
              `Subscription ${subscription.name} pause reason`,
            ),
          }),
      ...(subscription.pausedAt === undefined
        ? {}
        : {
            pausedAt: createLocalDate(
              requireLocalDate(
                subscription.pausedAt,
                `Subscription ${subscription.name} pause date`,
              ),
            ),
          }),
      version: canonicalContainerVersion(
        'subscription',
        workspace,
        subscription.name,
        sourceOrdinal,
      ),
    });
  }

  for (const [archiveOrdinal, subscription] of (state.cancelledSubs ?? []).entries()) {
    assertRowWorkspace(subscription, workspace, 'Cancelled subscription');
    const sourceOrdinal = state.subs.length + archiveOrdinal;
    const sourceId = `cancelled:${subscription.name}`;
    repository.subscriptions.put({
      id: canonicalContainerId(
        'subscription',
        workspace,
        sourceId,
        sourceOrdinal,
        createSubscriptionId,
      ),
      workspaceId: workspace.id,
      sourceName: subscription.name,
      sourceOrdinal,
      name: subscription.name,
      cost: createMoney({
        minorUnits: majorToMinor(
          subscription.monthlyAmount,
          `Cancelled subscription ${subscription.name} cost`,
        ),
        currency,
      }),
      cadence: 'monthly',
      nextRenewalDaysAway: 0,
      lastUsedDaysAgo: 0,
      usesPerMonth: 0,
      paused: false,
      cancelledAt: createLocalDate(
        requireLocalDate(
          subscription.cancelledAt,
          `Cancelled subscription ${subscription.name} cancellation date`,
        ),
      ),
      version: canonicalContainerVersion('subscription', workspace, sourceId, sourceOrdinal),
    });
  }

  for (const sourceName of [
    ...new Set([...Object.keys(state.subPaused), ...Object.keys(state.subOverrides)]),
  ]) {
    const paused = state.subPaused[sourceName];
    const overrideDays = state.subOverrides[sourceName];
    repository.subscriptionPreferences.put({
      id: canonicalPreferenceId(workspace, sourceName),
      workspaceId: workspace.id,
      sourceName,
      ...(paused === undefined ? {} : { paused }),
      ...(overrideDays === undefined
        ? {}
        : {
            overrideDays: requireSafeInteger(
              overrideDays,
              `Subscription ${sourceName} override days`,
            ),
          }),
      version: canonicalContainerVersion('subpref', workspace, sourceName, 0),
    });
  }

  for (const [sourceOrdinal, cycle] of state.cycles.entries()) {
    assertRowWorkspace(cycle, workspace, 'Cycle record');
    repository.cycleRecords.put({
      id: canonicalContainerId(
        'cycle',
        workspace,
        `${cycle.closedAt}\u0000${cycle.label}`,
        sourceOrdinal,
        createCycleRecordId,
      ),
      workspaceId: workspace.id,
      sourceOrdinal,
      sourceClosedAt: cycle.closedAt,
      closedAt: canonicalInstant(cycle.closedAt, `Cycle ${cycle.label} close time`),
      label: cycle.label,
      spare: createMoney({
        minorUnits: majorToMinor(cycle.spare, `Cycle ${cycle.label} spare`),
        currency,
      }),
      tightPoint: createMoney({
        minorUnits: majorToMinor(cycle.tightPoint, `Cycle ${cycle.label} tight point`),
        currency,
      }),
      setAside: createMoney({
        minorUnits: majorToMinor(cycle.setAside, `Cycle ${cycle.label} set aside`),
        currency,
      }),
      note: cycle.note,
      ...(cycle.reconstructed === true ? { reconstructed: true as const } : {}),
      version: canonicalContainerVersion(
        'cycle',
        workspace,
        `${cycle.closedAt}\u0000${cycle.label}`,
        sourceOrdinal,
      ),
    });
  }

  for (const [sourceOrdinal, debt] of (state.debts ?? []).entries()) {
    assertRowWorkspace(debt, workspace, 'Debt');
    repository.debts.put({
      id: canonicalContainerId('debt', workspace, debt.id, sourceOrdinal, createDebtId),
      workspaceId: workspace.id,
      sourceDebtId: debt.id,
      sourceOrdinal,
      name: debt.name,
      kind: debt.kind,
      balance: createMoney({
        minorUnits: majorToMinor(debt.balance, `Debt ${debt.id} balance`),
        currency,
      }),
      apr: requireFiniteNumber(debt.apr, `Debt ${debt.id} APR`),
      minimumPayment: createMoney({
        minorUnits: majorToMinor(debt.minPayment, `Debt ${debt.id} minimum payment`),
        currency,
      }),
      dueDayOfMonth: requirePositiveInteger(debt.dueDom, `Debt ${debt.id} due day`),
      sourceAddedAt: debt.addedAt,
      addedAt: canonicalInstant(debt.addedAt, `Debt ${debt.id} creation time`),
      ...(debt.linkedAccountId === undefined
        ? {}
        : { linkedSourceAccountId: debt.linkedAccountId }),
      version: canonicalContainerVersion('debt', workspace, debt.id, sourceOrdinal),
    });
  }

  const moneyMode = checkedFinancialMode(state.moneyMode ?? 'survival');
  const modeExtras = Object.fromEntries(
    Object.entries(state.modeExtras ?? {}).map(([mode, amount]) => [
      checkedFinancialMode(mode),
      createMoney({
        minorUnits: majorToMinor(amount, `Money mode ${mode} amount`),
        currency,
      }),
    ]),
  );
  const household = state.household ?? {
    partnerName: '',
    defaultShare: 0.5,
    subShareOverrides: {},
  };
  const financialContextSourceId = 'active';
  repository.financialContexts.put({
    id: canonicalContainerId(
      'financialcontext',
      workspace,
      financialContextSourceId,
      0,
      createFinancialContextId,
    ),
    workspaceId: workspace.id,
    onboarding: {
      done: requireBoolean(state.onboarding.done, 'Onboarding completion'),
      name: requireString(state.onboarding.name, 'Onboarding name'),
      payday: requireSafeInteger(state.onboarding.payday, 'Onboarding payday'),
      monthlyIncome: createMoney({
        minorUnits: majorToMinor(state.onboarding.monthlyIncome, 'Onboarding monthly income'),
        currency,
      }),
    },
    nextYouNote: requireString(state.nextYouNote, 'Next-you note'),
    tightPointGoal:
      state.tightPointGoal === null
        ? null
        : createMoney({
            minorUnits: majorToMinor(state.tightPointGoal, 'Tight-point goal'),
            currency,
          }),
    droppedTransactionCount: requireNonNegativeSafeInteger(
      state.droppedTransactionCount ?? 0,
      'Dropped transaction count',
    ),
    moneyMode,
    bufferAmount: createMoney({
      minorUnits: majorToMinor(state.bufferAmount ?? 100, 'Safety buffer'),
      currency,
    }),
    modeExtras,
    household: {
      partnerName: requireString(household.partnerName, 'Household partner name'),
      defaultShare: requireFiniteNumber(household.defaultShare, 'Household default share'),
      subShareOverrides: Object.fromEntries(
        Object.entries(household.subShareOverrides).map(([name, share]) => [
          name,
          requireFiniteNumber(share, `Household share for ${name}`),
        ]),
      ),
    },
    spendHold:
      state.spendHold === undefined || state.spendHold === null
        ? null
        : {
            start: createLocalDate(requireLocalDate(state.spendHold.start, 'Spend hold start')),
            end: createLocalDate(requireLocalDate(state.spendHold.end, 'Spend hold end')),
            dailyCap: createMoney({
              minorUnits: majorToMinor(state.spendHold.dailyCap, 'Spend hold daily cap'),
              currency,
            }),
            setAt: canonicalInstant(state.spendHold.setAt, 'Spend hold creation time'),
            breachedDates: (state.spendHold.breachedDates ?? []).map((day) =>
              createLocalDate(requireLocalDate(day, 'Spend hold breached date')),
            ),
          },
    whatIfHolds: (state.whatIfHolds ?? []).map((hold, index) => {
      assertRowWorkspace(hold, workspace, 'What-if hold');
      return {
        id: requireString(hold.id, `What-if hold ${index} ID`),
        amount: createMoney({
          minorUnits: majorToMinor(hold.amount, `What-if hold ${hold.id} amount`),
          currency,
        }),
        recurrence: hold.recurrence,
        addedAt: canonicalInstant(hold.addedAt, `What-if hold ${hold.id} creation time`),
        ...(hold.label === undefined
          ? {}
          : { label: requireString(hold.label, `What-if hold ${hold.id} label`) }),
      };
    }),
    businessOperationsJson: JSON.stringify(normaliseBusinessOperationsState(state.business)),
    version: canonicalContainerVersion('financialcontext', workspace, financialContextSourceId, 0),
  });

  for (const [sourceOrdinal, event] of state.calendarEvents.entries()) {
    assertRowWorkspace(event, workspace, 'Calendar event');
    repository.calendarItems.put({
      id: canonicalContainerId(
        'calendar',
        workspace,
        event.id,
        sourceOrdinal,
        createCalendarItemId,
      ),
      workspaceId: workspace.id,
      kind: canonicalCalendarItemKind(event.kind),
      title: requireString(event.title, `Calendar event ${event.id} title`),
      localDate: createLocalDate(requireLocalDate(event.date, `Calendar event ${event.id} date`)),
      authorityState: 'user-confirmed',
      version: canonicalContainerVersion('calendar', workspace, event.id, sourceOrdinal),
      sourceCalendarEventId: event.id,
      sourceOrdinal,
      sourceKind: event.kind,
      ...(event.time === undefined
        ? {}
        : { localTime: createLocalTime(event.time), sourceTime: event.time }),
      ...(event.note === undefined ? {} : { sourceNote: event.note }),
      ...(event.amount === undefined
        ? {}
        : {
            sourceAmount: createMoney({
              minorUnits: majorToMinor(event.amount, `Calendar event ${event.id} amount`),
              currency,
            }),
          }),
      ...(event.reminderOffsetMinutes === undefined
        ? {}
        : {
            sourceReminderOffsetMinutes: requireNonNegativeSafeInteger(
              event.reminderOffsetMinutes,
              `Calendar event ${event.id} reminder offset`,
            ),
          }),
    });
  }

  for (const [sourceOrdinal, source] of (state.incomeSources ?? []).entries()) {
    assertRowWorkspace(source, workspace, 'Income source');
    const cadence = checkedIncomeCadence(source.cadence);
    repository.incomeSchedules.put({
      id: canonicalContainerId(
        'incomeschedule',
        workspace,
        source.id,
        sourceOrdinal,
        createIncomeScheduleId,
      ),
      workspaceId: workspace.id,
      sourceIncomeId: source.id,
      sourceOrdinal,
      label: requireString(source.label, `Income source ${source.id} label`),
      cadence,
      amount: createMoney({
        minorUnits: majorToMinor(source.amount, `Income source ${source.id} amount`),
        currency,
      }),
      source: source.source,
      version: canonicalContainerVersion('incomeschedule', workspace, source.id, sourceOrdinal),
      ...(source.dayOfMonth === undefined
        ? {}
        : {
            dayOfMonth: checkedDayOfMonth(source.dayOfMonth, `Income source ${source.id} day`),
          }),
      ...(source.anchorISO === undefined
        ? {}
        : {
            anchorDate: createLocalDate(
              requireLocalDate(source.anchorISO, `Income source ${source.id} anchor`),
            ),
          }),
    });
    assertIncomeCadenceFields(source.id, cadence, source.dayOfMonth, source.anchorISO);
  }

  for (const [sourceOrdinal, plan] of (state.plans ?? []).entries()) {
    assertRowWorkspace(plan, workspace, 'Plan');
    const planId = canonicalContainerId('plan', workspace, plan.id, sourceOrdinal, createPlanId);
    const provenanceId = canonicalContainerId(
      'provenance',
      workspace,
      `plan:${plan.id}`,
      sourceOrdinal,
      createProvenanceId,
    );
    const createdAt = canonicalInstant(plan.addedAt, `Plan ${plan.id} creation time`);
    repository.provenance.put({
      id: provenanceId,
      workspaceId: workspace.id,
      authorityState: 'user-confirmed',
      sourceRecordIds: [],
      links: [{ relationship: 'represents', fromId: String(provenanceId), toId: String(planId) }],
      createdAt,
      version: canonicalContainerVersion('provenance', workspace, `plan:${plan.id}`, sourceOrdinal),
    });
    repository.plans.put({
      id: planId,
      workspaceId: workspace.id,
      title: requireString(plan.name, `Plan ${plan.id} name`),
      status: plan.target > 0 && plan.saved >= plan.target ? 'completed' : 'active',
      authorityState: 'user-confirmed',
      createdAt,
      version: canonicalContainerVersion('plan', workspace, plan.id, sourceOrdinal),
      kind: 'save-for-goal',
      targetAmount: createMoney({
        minorUnits: majorToMinor(plan.target, `Plan ${plan.id} target`),
        currency,
      }),
      targetDate: createLocalDate(requireLocalDate(plan.byDate, `Plan ${plan.id} target date`)),
      commitmentIds: [],
      scenarioIds: [],
      sourcePlanId: plan.id,
      sourceOrdinal,
      sourceAddedAt: plan.addedAt,
      savedAmount: createMoney({
        minorUnits: majorToMinor(plan.saved, `Plan ${plan.id} saved`),
        currency,
      }),
      weeklyContribution: createMoney({
        minorUnits: majorToMinor(plan.perWeek, `Plan ${plan.id} weekly contribution`),
        currency,
      }),
      provenanceId,
    });
  }

  projectTransactionIntelligenceState(repository, state, workspace);
  projectCompanionRuntimeState(repository, state, workspace);
}

function projectTransactionIntelligenceState(
  repository: CanonicalRepository,
  state: AppState,
  workspace: PersistedWorkspace,
): void {
  const sourceId = 'active';
  repository.transactionIntelligenceStates.put({
    id: canonicalContainerId(
      'transactionintelligence',
      workspace,
      sourceId,
      0,
      createTransactionIntelligenceStateId,
    ),
    workspaceId: workspace.id,
    corrections: (state.edits ?? []).map((edit, index) => {
      assertRowWorkspace(edit, workspace, 'Transaction correction');
      return {
        sourceTransactionId: requireString(edit.txnId, `Transaction correction ${index} ID`),
        field: edit.field,
        at: requireIsoInstant(edit.at, `Transaction correction ${index} time`),
        by: edit.by,
        before:
          edit.before === undefined
            ? undefined
            : requireCorrectionValue(edit.before, `Transaction correction ${index} before`),
        after:
          edit.after === undefined
            ? undefined
            : requireCorrectionValue(edit.after, `Transaction correction ${index} after`),
        ...(edit.id === undefined
          ? {}
          : { id: requireString(edit.id, 'Transaction correction ID') }),
      };
    }),
    ignoredReviewSignatures: checkedStringList(
      state.ignoredReviewSigs ?? [],
      'Ignored review signature',
    ),
    ignoredBankExternalIds: checkedStringList(
      state.ignoredBankExternalIds ?? [],
      'Ignored bank external ID',
    ),
    dismissedIncomeSignals: checkedStringList(
      state.dismissedIncomeSignals ?? [],
      'Dismissed income signal',
    ),
    dismissedBillSignals: checkedStringList(
      state.dismissedBillSignals ?? [],
      'Dismissed bill signal',
    ),
    dismissedDriftSignals: (state.dismissedDriftSignals ?? []).map((entry, index) => {
      assertRowWorkspace(entry, workspace, 'Dismissed drift signal');
      return {
        merchant: requireString(entry.merchant, `Dismissed drift signal ${index} merchant`),
        at: requireIsoInstant(entry.at, `Dismissed drift signal ${index} time`),
      };
    }),
    dismissedAnnualSignals: checkedStringList(
      state.dismissedAnnualSignals ?? [],
      'Dismissed annual signal',
    ),
    merchantCategories: Object.fromEntries(
      Object.entries(state.merchantCategories ?? {}).map(([merchant, memory]) => [
        requireString(merchant, 'Merchant-category key'),
        {
          category: requireString(memory.category, `Merchant category ${merchant}`),
          correctedAt: requireIsoInstant(
            memory.correctedAt,
            `Merchant category ${merchant} correction time`,
          ),
          hits: requireNonNegativeSafeInteger(memory.hits, `Merchant category ${merchant} hits`),
          ...(memory.pendingCategory === undefined
            ? {}
            : {
                pendingCategory: requireString(
                  memory.pendingCategory,
                  `Merchant category ${merchant} pending value`,
                ),
              }),
          ...(memory.pendingCount === undefined
            ? {}
            : {
                pendingCount: requireNonNegativeSafeInteger(
                  memory.pendingCount,
                  `Merchant category ${merchant} pending count`,
                ),
              }),
        },
      ]),
    ),
    statementImports: (state.statementImports ?? []).map((entry, index) => {
      assertRowWorkspace(entry, workspace, 'Statement import');
      return {
        id: requireString(entry.id, `Statement import ${index} ID`),
        source: entry.source,
        rowCount: requireNonNegativeSafeInteger(
          entry.rowCount,
          `Statement import ${entry.id} row count`,
        ),
        atISO: requireIsoInstant(entry.atISO, `Statement import ${entry.id} time`),
        ...(entry.accountId === undefined ? {} : { accountId: entry.accountId }),
        ...(entry.filename === undefined ? {} : { filename: entry.filename }),
        ...(entry.closingBalanceMinor === undefined
          ? {}
          : {
              closingBalanceMinor: requireFiniteNumber(
                entry.closingBalanceMinor,
                `Statement import ${entry.id} closing balance`,
              ),
            }),
        ...(entry.sourceEvidenceId === undefined
          ? {}
          : { sourceEvidenceId: entry.sourceEvidenceId }),
      };
    }),
    evidenceDocuments: (state.evidenceDocuments ?? []).map((document, index) => {
      assertRowWorkspace(document, workspace, 'Evidence document');
      return {
        id: requireString(document.id, `Evidence document ${index} ID`),
        filename: requireString(document.filename, `Evidence document ${document.id} filename`),
        mediaType: requireString(document.mediaType, `Evidence document ${document.id} media type`),
        byteSize: requirePositiveInteger(
          document.byteSize,
          `Evidence document ${document.id} byte size`,
        ),
        addedAtISO: requireIsoInstant(
          document.addedAtISO,
          `Evidence document ${document.id} creation time`,
        ),
        sourceType: document.sourceType,
        extractionStatus: document.extractionStatus,
        storageState: document.storageState,
        ...(document.linkedTransactionIds === undefined
          ? {}
          : { linkedTransactionIds: [...document.linkedTransactionIds] }),
      };
    }),
    timelineEvents: (state.timelineEvents ?? []).map((event, index) => {
      assertRowWorkspace(event, workspace, 'Timeline event');
      return {
        id: requireString(event.id, `Timeline event ${index} ID`),
        at: requireIsoInstant(event.at, `Timeline event ${event.id} time`),
        kind: event.kind,
        subject: requireString(event.subject, `Timeline event ${event.id} subject`),
        ...(event.note === undefined ? {} : { note: event.note }),
      };
    }),
    reviewQueue: (state.reviewQueue ?? []).map((item, index) =>
      projectExactReviewQueueItem(item, index, workspace),
    ),
    reviewQueueSpillover: (state.reviewQueueSpillover ?? []).map((item, index) =>
      projectExactReviewQueueItem(item, index, workspace),
    ),
    version: canonicalContainerVersion('transactionintelligence', workspace, sourceId, 0),
  });
}

function projectExactReviewQueueItem(
  item: ReviewItem,
  index: number,
  workspace: PersistedWorkspace,
) {
  assertRowWorkspace(item, workspace, 'Review queue item');
  return {
    id: requireString(item.id, `Review queue item ${index} ID`),
    source: item.source,
    merchant: requireString(item.merchant, `Review queue item ${item.id} merchant`),
    amount: requireFiniteNumber(item.amount, `Review queue item ${item.id} amount`),
    addedAt: requireIsoInstant(item.addedAt, `Review queue item ${item.id} creation time`),
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

function projectCompanionRuntimeState(
  repository: CanonicalRepository,
  state: AppState,
  workspace: PersistedWorkspace,
): void {
  const sourceId = 'active';
  const lens = state.lens ?? {
    plusUnlocked: false,
    proUnlocked: false,
    trialCycleId: null,
    trialEndedCycleId: null,
    trialEndAcknowledged: true,
  };
  const melo = state.melo ?? { quietMode: false, wardrobe: [], tone: 'calm' as const };
  repository.companionRuntimeStates.put({
    id: canonicalContainerId(
      'companionruntime',
      workspace,
      sourceId,
      0,
      createCompanionRuntimeStateId,
    ),
    workspaceId: workspace.id,
    aiReads: {
      monthKey: requireString(state.aiReads?.monthKey ?? '', 'AI read month'),
      used: requireNonNegativeSafeInteger(state.aiReads?.used ?? 0, 'AI read count'),
    },
    aiReadCache: Object.fromEntries(
      Object.entries(state.aiReadCache ?? {}).map(([key, entry]) => [
        requireString(key, 'AI read cache key'),
        {
          candidates: entry.candidates.map((candidate, index) => ({
            id: requireString(candidate.id, `AI read candidate ${index} ID`),
            source: candidate.source,
            kind: candidate.kind,
            merchant: requireString(candidate.merchant, `AI read candidate ${index} merchant`),
            amount: requireFiniteNumber(candidate.amount, `AI read candidate ${index} amount`),
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
                  amount: requireFiniteNumber(
                    entry.closingBalance.amount,
                    `AI read cache ${key} closing balance`,
                  ),
                  asOfISO: requireIsoInstant(
                    entry.closingBalance.asOfISO,
                    `AI read cache ${key} balance time`,
                  ),
                  ...(entry.closingBalance.openingAmount === undefined
                    ? {}
                    : {
                        openingAmount: requireFiniteNumber(
                          entry.closingBalance.openingAmount,
                          `AI read cache ${key} opening balance`,
                        ),
                      }),
                  ...(entry.closingBalance.statedTotalDebits === undefined
                    ? {}
                    : {
                        statedTotalDebits: requireFiniteNumber(
                          entry.closingBalance.statedTotalDebits,
                          `AI read cache ${key} stated debits`,
                        ),
                      }),
                  ...(entry.closingBalance.statedTotalCredits === undefined
                    ? {}
                    : {
                        statedTotalCredits: requireFiniteNumber(
                          entry.closingBalance.statedTotalCredits,
                          `AI read cache ${key} stated credits`,
                        ),
                      }),
                },
          at: requireIsoInstant(entry.at, `AI read cache ${key} time`),
        },
      ]),
    ),
    whatChangedSeenISO:
      state.whatChangedSeenISO === undefined || state.whatChangedSeenISO === null
        ? null
        : requireIsoInstant(state.whatChangedSeenISO, 'What-changed baseline'),
    lens: {
      plusUnlocked: requireBoolean(lens.plusUnlocked, 'Full entitlement legacy Plus flag'),
      proUnlocked: requireBoolean(lens.proUnlocked, 'Full entitlement legacy Pro flag'),
      trialCycleId: lens.trialCycleId,
      trialEndedCycleId: lens.trialEndedCycleId,
      trialEndAcknowledged: requireBoolean(lens.trialEndAcknowledged, 'Lens trial acknowledgement'),
    },
    melo: {
      quietMode: requireBoolean(melo.quietMode, 'Melo quiet mode'),
      wardrobe: checkedStringList(melo.wardrobe, 'Melo wardrobe item'),
      ...(melo.companionIntroSeen === undefined
        ? {}
        : {
            companionIntroSeen: requireBoolean(
              melo.companionIntroSeen,
              'Melo companion introduction',
            ),
          }),
      ...(melo.preferredPosition === undefined
        ? {}
        : {
            preferredPosition: requireMeloPosition(melo.preferredPosition),
          }),
      tone: melo.tone ?? 'calm',
      ...(melo.soundEnabled === undefined
        ? {}
        : { soundEnabled: requireBoolean(melo.soundEnabled, 'Melo milestone sounds') }),
    },
    tinyWins: (state.tinyWins ?? []).map((win, index) => ({
      id: requireString(win.id, `Tiny win ${index} ID`),
      kind: win.kind,
      awardedAt: requireIsoInstant(win.awardedAt, `Tiny win ${win.id} time`),
      message: requireString(win.message, `Tiny win ${win.id} message`),
    })),
    meloPrimerSeen: state.meloPrimerSeen === true,
    lastOpenedAt:
      state.lastOpenedAt === undefined || state.lastOpenedAt === null
        ? null
        : canonicalInstant(state.lastOpenedAt, 'Last-opened time'),
    oneMoveHistory: (state.oneMoveHistory ?? []).map((entry, index) => ({
      key: requireString(entry.key, `One-move history ${index} key`),
      shownAt: createLocalDate(
        requireLocalDate(entry.shownAt, `One-move history ${index} shown date`),
      ),
      ...(entry.tappedAt === undefined
        ? {}
        : {
            tappedAt: canonicalInstant(entry.tappedAt, `One-move history ${index} tapped time`),
          }),
    })),
    meloDismissLog: (state.meloDismissLog ?? []).map((entry, index) => ({
      kind: requireString(entry.kind, `Melo dismissal ${index} kind`),
      reason: entry.reason,
      at: canonicalInstant(entry.at, `Melo dismissal ${index} time`),
      ...(entry.amount === undefined
        ? {}
        : { amount: requireFiniteNumber(entry.amount, `Melo dismissal ${index} amount`) }),
      ...(entry.potId === undefined
        ? {}
        : { potId: requireString(entry.potId, `Melo dismissal ${index} pot ID`) }),
    })),
    version: canonicalContainerVersion('companionruntime', workspace, sourceId, 0),
  });
}

function projectAccounts(
  state: AppState,
  workspace: PersistedWorkspace,
  referencedAccountIds: readonly (string | undefined)[],
): readonly CanonicalMobileAccountInput[] {
  const sourceAccounts = state.accounts ?? [];
  for (const account of sourceAccounts) assertRowWorkspace(account, workspace, 'Account');

  const projected = new Map<string, CanonicalMobileAccountInput>();
  if (sourceAccounts.length === 0) {
    projected.set(
      DEFAULT_ACCOUNT_ID,
      projectAccount(
        {
          id: DEFAULT_ACCOUNT_ID,
          name: 'Main',
          kind: 'bank',
          isLiability: false,
          balanceMinor: state.currentBalance.amount,
          balanceAsOfISO: state.currentBalance.setAt,
          addedAt: state.currentBalance.setAt,
        },
        state,
        'synthesized-default',
      ),
    );
  } else {
    for (const account of sourceAccounts) projected.set(account.id, projectAccount(account, state));
  }

  reconcileVisibleCurrentBalance(projected, state, workspace);

  for (const referencedAccountId of referencedAccountIds) {
    if (referencedAccountId === undefined || projected.has(referencedAccountId)) continue;
    projected.set(referencedAccountId, {
      id: referencedAccountId,
      name:
        referencedAccountId === DEFAULT_ACCOUNT_ID ? 'Main (legacy rows)' : 'Unresolved account',
      kind: 'bank',
      currency: String(workspace.baseCurrency),
      balanceMinor: 0,
      balanceAsOfISO: state.currentBalance.setAt,
      addedAt: state.currentBalance.setAt,
      balanceSourceKind: canonicalBalanceSourceKind(state.currentBalance.source),
      balanceConfidence: state.currentBalance.confidence,
      balanceSourceVariant: state.currentBalance.source,
      projectionRole: 'unresolved-reference',
      authorityState: 'estimated',
      includeInAvailablePosition: true,
    });
  }
  return [...projected.values()];
}

function reconcileVisibleCurrentBalance(
  accounts: Map<string, CanonicalMobileAccountInput>,
  state: AppState,
  workspace: PersistedWorkspace,
): void {
  const visibleBalanceMinor = majorToMinor(state.currentBalance.amount, 'Current balance');
  const availableAccounts = [...accounts.values()].filter(
    (account) => account.includeInAvailablePosition !== false,
  );
  const projectedBalanceMinor = availableAccounts.reduce(
    (total, account) => total + account.balanceMinor,
    0,
  );
  const differenceMinor = visibleBalanceMinor - projectedBalanceMinor;
  const synthesizedOnly =
    availableAccounts.length === 1 &&
    availableAccounts[0]?.projectionRole === 'synthesized-default';
  if (synthesizedOnly) return;

  // AppState has a legacy aggregate scalar used by the visible Today experience. Preserve the
  // named account claims unchanged and keep an explicit reconciliation row even when its amount is
  // zero: the row also retains the aggregate claim's exact timestamp, source and confidence.
  accounts.set('acct-balance-reconciliation', {
    id: 'acct-balance-reconciliation',
    name: 'Unallocated balance reconciliation',
    kind: 'cash',
    currency: String(workspace.baseCurrency),
    balanceMinor: differenceMinor,
    balanceAsOfISO: state.currentBalance.setAt,
    addedAt: state.currentBalance.setAt,
    balanceSourceKind: canonicalBalanceSourceKind(state.currentBalance.source),
    balanceConfidence: state.currentBalance.confidence,
    balanceSourceVariant: state.currentBalance.source,
    projectionRole: 'reconciliation',
    authorityState: 'estimated',
    includeInAvailablePosition: true,
  });
}

function projectAccount(
  account: Account,
  state: AppState,
  projectionRole: NonNullable<CanonicalMobileAccountInput['projectionRole']> = 'source',
): CanonicalMobileAccountInput {
  return {
    id: account.id,
    name: account.name,
    kind: canonicalAccountKind(account),
    currency: account.currency ?? 'GBP',
    state: account.closed === true ? 'closed' : 'active',
    balanceMinor: majorToMinor(account.balanceMinor, `Account ${account.id} balance`),
    balanceAsOfISO: requireIsoInstant(account.balanceAsOfISO, `Account ${account.id} balance time`),
    addedAt: requireIsoInstant(account.addedAt, `Account ${account.id} creation time`),
    balanceSourceKind: canonicalBalanceSourceKind(state.currentBalance.source),
    balanceConfidence: state.currentBalance.confidence,
    balanceSourceVariant: state.currentBalance.source,
    projectionRole,
    authorityState: state.currentBalance.source === 'sample' ? 'estimated' : 'user-confirmed',
    includeInAvailablePosition: !account.isLiability,
  };
}

function canonicalAccountKind(account: Account): CanonicalMobileAccountInput['kind'] {
  if (account.kind === 'credit-card') return 'credit';
  return account.kind;
}

function canonicalBalanceSourceKind(
  source: AppState['currentBalance']['source'],
): NonNullable<CanonicalMobileAccountInput['balanceSourceKind']> {
  if (source === 'statement' || source === 'pdf-derived' || source === 'ocr-derived') {
    return 'imported-statement';
  }
  if (source === 'sample') return 'calculated';
  return 'user-entered';
}

function projectTransaction(
  transaction: Transaction,
  workspace: PersistedWorkspace,
  sourceOrdinal: number,
): LocalLedgerTransaction {
  assertRowWorkspace(transaction, workspace, 'Transaction');
  return {
    id: transaction.id,
    accountId: accountIdOf(transaction),
    title: transaction.merchant.trim() || 'Untitled transaction',
    amountMinor: majorToMinor(transaction.amount, `Transaction ${transaction.id} amount`),
    date: requireIsoInstant(transaction.when, `Transaction ${transaction.id} time`).slice(0, 10),
    bookedAt: requireIsoInstant(transaction.when, `Transaction ${transaction.id} time`),
    categoryId: transaction.category,
    source:
      transaction.source === 'bank'
        ? 'open_banking'
        : transaction.source === 'melo'
          ? 'melo'
          : transaction.source === 'seed'
            ? 'seed'
            : 'manual',
    status: 'confirmed',
    protected: false,
    original: transaction.merchant,
    sourceTransactionId: transaction.id,
    sourceOrdinal,
    ...(transaction.sourceEvidenceId === undefined
      ? {}
      : { sourceEvidenceId: transaction.sourceEvidenceId }),
    ...(transaction.externalId === undefined ? {} : { externalId: transaction.externalId }),
    ...(transaction.bankConnectionId === undefined
      ? {}
      : { connectionId: transaction.bankConnectionId }),
    ...(transaction.sourceEvidenceId === undefined && transaction.externalId === undefined
      ? {}
      : {
          provenanceHash:
            transaction.sourceEvidenceId ?? `open-banking:${transaction.externalId ?? ''}`,
        }),
    ...(transaction.sourceEvidenceId === undefined
      ? {}
      : { sourceDocumentId: transaction.sourceEvidenceId }),
  };
}

function projectReviewItem(
  item: ReviewItem,
  workspace: PersistedWorkspace,
  fallbackDate: string,
): LocalImportDraft {
  assertRowWorkspace(item, workspace, 'Review item');
  const date =
    item.date === undefined
      ? fallbackDate
      : requireLocalDate(item.date, `Review item ${item.id} date`);
  const hasDate = item.date !== undefined;
  const original = `${date} / ${item.merchant} / ${item.amount.toFixed(2)}`;
  const parserIssues = hasDate ? [] : ['Date needs user confirmation'];
  return {
    rowId: item.id,
    transactionId: `review_${item.id}`,
    original,
    interpretation: item.merchant.trim() || 'Untitled review item',
    amountMinor: majorToMinor(item.amount, `Review item ${item.id} amount`),
    date,
    authorityState: item.source === 'manual' ? 'estimated' : 'imported-claim',
    reviewState: 'needs-review',
    userConfirmationState: 'requested',
    parserIssues,
    status: 'Needs review',
    provenanceHash:
      item.sourceEvidenceId ??
      item.externalId ??
      `app-review:${item.id}:${item.source}:${item.merchant}:${item.amount}`,
    searchText: `${original} ${item.source}`.toLowerCase(),
    reasons: ['Awaiting explicit user confirmation.'],
  };
}

function projectTimelineEvent(
  event: TimelineEvent,
  workspace: PersistedWorkspace,
): LocalHistoryEntry {
  assertRowWorkspace(event, workspace, 'Timeline event');
  return {
    id: event.id,
    label: event.note === undefined ? event.subject : `${event.subject}: ${event.note}`,
    createdAt: requireIsoInstant(event.at, `Timeline event ${event.id} time`),
    kind:
      event.kind === 'sub-paused'
        ? 'subscription_paused'
        : event.kind === 'sub-resumed'
          ? 'subscription_resumed'
          : 'import_dismissed',
  };
}

function assertWorkspacePartition(state: AppState, workspace: PersistedWorkspace): void {
  if (
    String(state.activeWorkspaceId) !== String(workspace.id) ||
    String(state.dataWorkspaceId) !== String(workspace.id)
  ) {
    throw new Error('Canonical AppState projection is outside the active workspace partition.');
  }
  const owned = state.workspaces.find((candidate) => String(candidate.id) === String(workspace.id));
  if (owned === undefined || owned.encryptedSubkeyId !== workspace.encryptedSubkeyId) {
    throw new Error('Canonical AppState projection is not bound to the workspace key identity.');
  }
  requireIsoInstant(state.currentBalance.setAt, 'Current balance time');
}

function assertRowWorkspace(
  row: Readonly<{ workspaceId?: unknown }>,
  workspace: PersistedWorkspace,
  label: string,
): void {
  if (row.workspaceId !== undefined && String(row.workspaceId) !== String(workspace.id)) {
    throw new Error(`${label} is outside the canonical AppState workspace.`);
  }
}

function uniqueById<T extends Readonly<{ id: string }>>(values: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  });
}

function majorToMinor(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  const minor = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor)) throw new Error(`${label} is outside the supported range.`);
  return minor;
}

function requireIsoInstant(value: string, label: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is not a valid ISO instant.`);
  }
  return value;
}

function requireLocalDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} is not a valid local date.`);
  }
  return value;
}

function canonicalInstant(value: string, label: string): ReturnType<typeof createInstantString> {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is not a valid instant or local date.`);
  }
  return createInstantString(new Date(value).toISOString());
}

function requireFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function requireString(value: string, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  return value;
}

function checkedStringList(values: readonly string[], label: string): readonly string[] {
  return values.map((value, index) => requireString(value, `${label} ${index}`));
}

function requireCorrectionValue(value: string | number, label: string): string | number {
  return typeof value === 'number'
    ? requireFiniteNumber(value, label)
    : requireString(value, label);
}

function requireBoolean(value: boolean, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}

function requireMeloPosition(value: string): 'auto' | 'left' | 'right' {
  if (value === 'auto' || value === 'left' || value === 'right') return value;
  throw new Error(`Melo preferred position must be auto, left, or right.`);
}

function requireSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer.`);
  return value;
}

function requirePositiveInteger(value: number, label: string): number {
  const checked = requireSafeInteger(value, label);
  if (checked < 1) throw new Error(`${label} must be positive.`);
  return checked;
}

function requireNonNegativeSafeInteger(value: number, label: string): number {
  const checked = requireSafeInteger(value, label);
  if (checked < 0) throw new Error(`${label} cannot be negative.`);
  return checked;
}

function checkedFinancialMode(value: string): NonNullable<AppState['moneyMode']> {
  if (
    value === 'survival' ||
    value === 'stability' ||
    value === 'growth' ||
    value === 'debt' ||
    value === 'irregular' ||
    value === 'household' ||
    value === 'planning' ||
    value === 'optimizer' ||
    value === 'reset' ||
    value === 'lowVis'
  ) {
    return value;
  }
  throw new Error(`Financial mode ${value} is unsupported.`);
}

function canonicalCalendarItemKind(
  kind: AppState['calendarEvents'][number]['kind'],
): 'money-event' | 'task' | 'commitment' {
  if (kind === 'in' || kind === 'out') return 'money-event';
  if (kind === 'review') return 'task';
  return 'commitment';
}

function checkedIncomeCadence(
  cadence: string,
): 'monthly' | 'weekly' | 'fortnightly' | 'four-weekly' | 'last-working-day' {
  if (
    cadence === 'monthly' ||
    cadence === 'weekly' ||
    cadence === 'fortnightly' ||
    cadence === 'four-weekly' ||
    cadence === 'last-working-day'
  ) {
    return cadence;
  }
  throw new Error(`Income cadence ${cadence} is unsupported.`);
}

function checkedDayOfMonth(value: number, label: string): number {
  const day = requirePositiveInteger(value, label);
  if (day > 31) throw new Error(`${label} is outside 1-31.`);
  return day;
}

function assertIncomeCadenceFields(
  id: string,
  cadence: ReturnType<typeof checkedIncomeCadence>,
  dayOfMonth: number | undefined,
  anchorISO: string | undefined,
): void {
  if (cadence === 'monthly' && dayOfMonth === undefined) {
    throw new Error(`Income source ${id} requires a day of month.`);
  }
  if (
    (cadence === 'weekly' || cadence === 'fortnightly' || cadence === 'four-weekly') &&
    anchorISO === undefined
  ) {
    throw new Error(`Income source ${id} requires an anchor date.`);
  }
}

function checkedPotCadence(
  cadence: NonNullable<AppState['pots'][number]['cadence']>,
  sourcePotId: string,
): NonNullable<AppState['pots'][number]['cadence']> {
  if (cadence.kind === 'after-payday') return { kind: 'after-payday' };
  if (cadence.kind === 'weekly') {
    const weekday = requireSafeInteger(cadence.weekday, `Pot ${sourcePotId} weekday`);
    if (weekday < 0 || weekday > 6) throw new Error(`Pot ${sourcePotId} weekday is outside 0-6.`);
    return { kind: 'weekly', weekday };
  }
  if (cadence.kind === 'monthly') {
    const dayOfMonth = requirePositiveInteger(cadence.dayOfMonth, `Pot ${sourcePotId} monthly day`);
    if (dayOfMonth > 31) throw new Error(`Pot ${sourcePotId} monthly day is outside 1-31.`);
    return { kind: 'monthly', dayOfMonth };
  }
  if (cadence.kind === 'custom') {
    return {
      kind: 'custom',
      nextDate: requireLocalDate(cadence.nextDate, `Pot ${sourcePotId} custom date`),
    };
  }
  throw new Error(`Pot ${sourcePotId} cadence is unsupported.`);
}

function canonicalSubscriptionCadence(
  renewalPeriodDays: number | undefined,
): 'weekly' | 'fortnightly' | 'monthly' | 'yearly' | 'custom-days' {
  if (renewalPeriodDays === undefined) return 'monthly';
  if (renewalPeriodDays === 7) return 'weekly';
  if (renewalPeriodDays === 14) return 'fortnightly';
  if (renewalPeriodDays === 365) return 'yearly';
  return 'custom-days';
}

function canonicalContainerId<TId>(
  kind: string,
  workspace: PersistedWorkspace,
  sourceIdentity: string,
  sourceOrdinal: number,
  factory: (value: string) => TId,
): TId {
  const identity = `${String(workspace.id)}\u0000${sourceIdentity}\u0000${sourceOrdinal}`;
  return factory(`${kind}_appstate_${sourceOrdinal}_${stableSourceHash(identity)}`);
}

function canonicalPreferenceId(
  workspace: PersistedWorkspace,
  sourceName: string,
): ReturnType<typeof createSubscriptionPreferenceId> {
  return createSubscriptionPreferenceId(
    `subpref_appstate_${stableSourceHash(`${String(workspace.id)}\u0000${sourceName}`)}`,
  );
}

function canonicalContainerVersion(
  kind: string,
  workspace: PersistedWorkspace,
  sourceIdentity: string,
  sourceOrdinal: number,
): ReturnType<typeof createEntityVersion> {
  return createEntityVersion({
    dataVersion: `appstate:${kind}:${stableSourceHash(
      `${String(workspace.id)}\u0000${sourceIdentity}\u0000${sourceOrdinal}`,
    )}`,
  });
}

function stableSourceHash(value: string): string {
  const hash = (input: string): string => {
    let result = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      result ^= input.charCodeAt(index);
      result = Math.imul(result, 0x01000193) >>> 0;
    }
    return result.toString(16).padStart(8, '0');
  };
  return `${hash(value)}${hash(`${value}\u0000melo`)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
