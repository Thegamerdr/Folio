import {
  buildMoneyTimelineProjection,
  buildPositionSummary,
  buildTimelineRows,
  rankBriefingCandidates,
  type BriefingCandidateInput,
  type MoneyTimelineProjection,
  type PositionAccountInput,
  type PositionCashflowInput,
  type PositionSummary,
  type TimelineEventInput,
} from '@folio/today-engine';
import {
  buildBadMonthBriefing,
  buildImportReviewBriefing,
  defaultMeloTonePreferences,
  renderDeterministicMeloBriefing,
} from '@folio/melo-policy';
import type { CanonicalRepositoryCollections, CanonicalRepositorySnapshot } from '@folio/storage';

import {
  canonicalEvidenceForRecord,
  type CanonicalSurfaceEvidence,
} from './canonicalExperienceEvidence.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import {
  buildLocalRouteSummary,
  formatMinorAmount,
  type LocalLedgerState,
  type LocalRouteSummary,
} from './localLedger.js';
import { gateMeloText } from './localMeloPolicyAdapter.js';

export type LocalTodayTone = 'confirmed' | 'estimated' | 'attention';

export type LocalTodayTimelineEvent = Readonly<{
  date?: string;
  day: string;
  title: string;
  detail: string;
  amount: string;
  tone: LocalTodayTone;
  kindLabel: string;
  evidence: CanonicalSurfaceEvidence;
}>;

export type LocalTodayBriefingItem = Readonly<{
  id: string;
  title: string;
  summary: string;
  urgency: 'urgent' | 'nonurgent';
  sourceIds: readonly string[];
  accessibilityText: string;
  category: 'confirmed' | 'commitment' | 'plan' | 'import' | 'scenario' | 'document' | 'task';
  evidence: CanonicalSurfaceEvidence;
}>;

export type LocalTodayWhatChanged = Readonly<{
  summary: string;
  items: readonly LocalTodayBriefingItem[];
}>;

export type LocalTodayRecoveryModel = Readonly<{
  active: boolean;
  title: string;
  summary: string;
  whatChanged: readonly string[];
  affects: readonly string[];
  remainsCovered: readonly string[];
  pathForward: readonly string[];
  scenarioPreviewRequired: true;
}>;

export type LocalTodayModel = Readonly<{
  headline: string;
  reviewCopy: string;
  sourceLabel: 'Private example' | 'Local route' | 'Local records';
  position: PositionSummary;
  projection: MoneyTimelineProjection;
  briefingItems: readonly LocalTodayBriefingItem[];
  whatChanged: LocalTodayWhatChanged;
  recovery: LocalTodayRecoveryModel;
  balanceEvidence: readonly CanonicalSurfaceEvidence[];
  meloBriefingText: string;
  timeline: readonly LocalTodayTimelineEvent[];
  accessibilitySummary: string;
}>;

export function buildLocalTodayModel(
  ledger: LocalLedgerState,
  route: LocalRouteSummary = buildLocalRouteSummary(ledger),
  options: Readonly<{ privateExampleMode?: boolean }> = {},
): LocalTodayModel {
  const untilDate = route.points.at(-1)?.date;
  return buildCanonicalTodayModel(createCanonicalRepositoryForLocalLedgerState(ledger).snapshot(), {
    asOfDate: ledger.asOfDate,
    sourceLabel: options.privateExampleMode === true ? 'Private example' : 'Local route',
    ...(untilDate === undefined ? {} : { untilDate }),
  });
}

export function buildCanonicalTodayModel(
  snapshot: CanonicalRepositorySnapshot,
  input: Readonly<{
    asOfDate: string;
    sourceLabel?: LocalTodayModel['sourceLabel'];
    untilDate?: string;
  }>,
): LocalTodayModel {
  const canonical = snapshot.collections;
  const cashflows = canonicalCashflows(canonical);
  const protectedFloorMinor = protectedFutureOutflowMinor(input.asOfDate, canonical);
  const balanceAuthority = canonicalPositionAccounts(input.asOfDate, canonical);
  const currency = balanceAuthority.currency;
  const position = buildPositionSummary({
    asOf: input.asOfDate,
    currency,
    protectedFloorMinor,
    accounts: balanceAuthority.accounts,
    cashflows,
    assumptions: [
      'Confirmed records, imported claims and future expectations are separated before Today is built.',
      ...balanceAuthority.assumptions,
    ],
  });
  const nextIncomeDate = canonical.expectations
    .filter((expectation) => expectation.amount.minorUnits > 0)
    .sort((left, right) => left.localDate.localeCompare(right.localDate))[0]?.localDate;
  const projection = buildMoneyTimelineProjection({
    asOf: input.asOfDate,
    until: input.untilDate ?? nextProjectionDate(input.asOfDate, canonical),
    currency,
    accounts: balanceAuthority.accounts,
    cashflows,
    protectedFloorMinor,
    assumptions: [
      'Hypothetical scenario previews are excluded until explicitly accepted.',
      ...balanceAuthority.assumptions,
    ],
    ...(nextIncomeDate === undefined ? {} : { nextIncomeDate }),
  });
  const timelineRows = buildTimelineRows({
    asOf: input.asOfDate,
    events: canonicalTodayEvents(input.asOfDate, canonical),
  });
  const rankedBriefing = rankBriefingCandidates({
    asOf: input.asOfDate,
    maxNonurgentItems: 3,
    candidates: briefingCandidates(input.asOfDate, projection, canonical),
  });
  const whatChanged = buildWhatChangedBriefing(input.asOfDate, canonical);
  const briefingItems = mergeBriefingItems(
    rankedBriefing.selected.map((item) => briefingItemFromRanked(item, canonical)),
    whatChanged.items,
  );
  const leadBriefing = briefingItems[0];
  const recovery = buildRecoveryModel(input.asOfDate, projection, canonical);
  const headline = todayHeadlineFromProjection(projection, nextIncomeDate);
  const activeImports = activeReviewImportDrafts(canonical);
  const reviewCopy =
    activeImports.length === 0
      ? 'Nothing is waiting for review right now.'
      : `You have ${activeImports.length} waiting for review. Your picture may change after review.`;
  const meloBriefingText = buildTodayMeloText({
    asOfDate: input.asOfDate,
    canonical,
    headline,
    leadBriefing,
    position,
    projection,
    recovery,
    balanceEvidence: balanceAuthority.evidence,
    whatChanged,
  });
  const timeline = timelineRows.map<LocalTodayTimelineEvent>((row) => {
    const evidence = evidenceForTimelineRow(row.id, canonical);
    return {
      date: row.localDate,
      day: timelineDayLabel(row.localDate, input.asOfDate),
      title: row.title,
      detail: `${row.detail ?? timelineFallbackDetail(row.eventState)}. ${evidence.summary}`,
      amount: row.amountMinor === undefined ? '' : formatMinorAmount(row.amountMinor),
      tone:
        row.eventState === 'actual'
          ? 'confirmed'
          : row.sourceKind === 'task' || row.sourceKind === 'reminder'
            ? 'attention'
            : 'estimated',
      kindLabel: todayKindLabel(row.sourceKind, row.eventState),
      evidence,
    };
  });

  return {
    headline,
    reviewCopy,
    sourceLabel: input.sourceLabel ?? 'Local records',
    position,
    projection,
    briefingItems,
    whatChanged,
    recovery,
    balanceEvidence: balanceAuthority.evidence,
    meloBriefingText,
    timeline,
    accessibilitySummary: `${headline} ${meloBriefingText} ${position.accessibilityText} ${projection.accessibilityText}`,
  };
}

function canonicalPositionAccounts(
  asOfDate: string,
  canonical: CanonicalRepositoryCollections,
): Readonly<{
  accounts: readonly PositionAccountInput[];
  assumptions: readonly string[];
  currency: 'GBP';
  evidence: readonly CanonicalSurfaceEvidence[];
}> {
  const accounts: PositionAccountInput[] = [];
  const assumptions: string[] = [];
  const evidence: CanonicalSurfaceEvidence[] = [];

  for (const account of canonical.accounts.filter((record) => record.state === 'active')) {
    const currentBalance = latestCurrentBalanceForAccount(asOfDate, canonical, String(account.id));
    const observation =
      currentBalance === undefined
        ? latestBalanceObservationForAccount(asOfDate, canonical, String(account.id))
        : canonical.balanceObservations.find(
            (candidate) => String(candidate.id) === String(currentBalance.sourceObservationId),
          );
    const balance = currentBalance?.balance ?? observation?.balance;
    if (balance === undefined) {
      assumptions.push(`${account.name} has no balance source yet.`);
      continue;
    }

    const balanceEvidence =
      currentBalance === undefined
        ? evidenceForBalanceObservation(canonical, observation)
        : evidenceForCurrentBalance(canonical, currentBalance, observation);
    const sourceId = balanceEvidence.provenanceId ?? balanceEvidence.sourceRecordId;
    evidence.push(balanceEvidence);
    accounts.push({
      id: String(account.id),
      label: account.name,
      balance,
      ...(sourceId === undefined ? {} : { sourceId }),
      assumption: `${account.name} balance comes from ${balanceSourceLabel(
        currentBalance?.sourceKind ?? observation?.sourceKind ?? 'calculated',
      )} balance data.`,
    });
  }

  if (accounts.length === 0) {
    assumptions.push('No active account balance is available for Today.');
  }

  return {
    accounts,
    assumptions,
    currency: 'GBP',
    evidence,
  };
}

function latestCurrentBalanceForAccount(
  asOfDate: string,
  canonical: CanonicalRepositoryCollections,
  accountId: string,
) {
  return canonical.currentBalances
    .filter((balance) => String(balance.accountId) === accountId && balance.asOf <= asOfDate)
    .sort(
      (left, right) =>
        right.asOf.localeCompare(left.asOf) || right.updatedAt.localeCompare(left.updatedAt),
    )[0];
}

function latestBalanceObservationForAccount(
  asOfDate: string,
  canonical: CanonicalRepositoryCollections,
  accountId: string,
) {
  return canonical.balanceObservations
    .filter(
      (observation) =>
        String(observation.accountId) === accountId && observation.observedOn <= asOfDate,
    )
    .sort(
      (left, right) =>
        right.observedOn.localeCompare(left.observedOn) ||
        String(right.observedAt ?? '').localeCompare(String(left.observedAt ?? '')),
    )[0];
}

function evidenceForCurrentBalance(
  canonical: CanonicalRepositoryCollections,
  balance: CanonicalRepositoryCollections['currentBalances'][number],
  observation: CanonicalRepositoryCollections['balanceObservations'][number] | undefined,
): CanonicalSurfaceEvidence {
  const provenanceId = balance.provenanceId ?? observation?.provenanceId;
  const sourceRecordId = observation?.sourceRecordId;
  return canonicalEvidenceForRecord(canonical, {
    recordKind: 'current balance',
    recordId: String(balance.id),
    why: 'A reviewed balance record anchors the Today position.',
    authorityState: balance.authorityState,
    reviewState: balance.reviewState,
    ...(sourceRecordId === undefined ? {} : { sourceRecordId: String(sourceRecordId) }),
    ...(provenanceId === undefined ? {} : { provenanceId: String(provenanceId) }),
    linkedRecords: [
      { kind: 'current balance', id: String(balance.id) },
      { kind: 'account', id: String(balance.accountId) },
      { kind: 'balance observation', id: String(balance.sourceObservationId) },
      ...(balance.calculatedFromTransactionIds ?? []).map((id) => ({
        kind: 'derived transaction',
        id: String(id),
      })),
    ],
  });
}

function evidenceForBalanceObservation(
  canonical: CanonicalRepositoryCollections,
  observation: CanonicalRepositoryCollections['balanceObservations'][number] | undefined,
): CanonicalSurfaceEvidence {
  if (observation === undefined) {
    return canonicalEvidenceForRecord(canonical, {
      recordKind: 'balance observation',
      recordId: 'missing_balance_observation',
      why: 'No balance source is attached to this account yet.',
      authorityState: 'inferred',
      reviewState: 'needs-review',
      actionPath: 'review',
    });
  }

  return canonicalEvidenceForRecord(canonical, {
    recordKind: 'balance observation',
    recordId: String(observation.id),
    why: 'A balance source anchors the Today position.',
    authorityState: observation.authorityState,
    reviewState: observation.reviewState,
    ...(observation.sourceRecordId === undefined
      ? {}
      : { sourceRecordId: String(observation.sourceRecordId) }),
    ...(observation.provenanceId === undefined
      ? {}
      : { provenanceId: String(observation.provenanceId) }),
    linkedRecords: [
      { kind: 'balance observation', id: String(observation.id) },
      { kind: 'account', id: String(observation.accountId) },
    ],
    actionPath: observation.reviewState === 'needs-review' ? 'review' : 'inspect',
  });
}

function balanceSourceLabel(sourceKind: string): string {
  switch (sourceKind) {
    case 'provider-reported':
      return 'provider-reported';
    case 'imported-statement':
      return 'imported statement';
    case 'calculated':
      return 'derived';
    case 'migration':
      return 'migrated';
    default:
      return 'user-entered';
  }
}

function canonicalCashflows(
  canonical: CanonicalRepositoryCollections,
): readonly PositionCashflowInput[] {
  const commitmentsById = new Map(
    canonical.commitments.map((commitment) => [String(commitment.id), commitment]),
  );
  const eventsByExpectationId = new Map(
    canonical.events.flatMap((event) =>
      event.expectationIds.map((expectationId) => [String(expectationId), event] as const),
    ),
  );
  const transactionCashflows = canonical.transactions.map((transaction) => ({
    id: String(transaction.id),
    label: transaction.description ?? transaction.reference ?? 'Transaction',
    date: transaction.localDate,
    amount: transaction.amount,
    state: 'actual' as const,
    protected: false,
    sourceId: String(transaction.provenanceId ?? transaction.id),
  }));
  const expectationCashflows = canonical.expectations.map((expectation) => {
    const commitment =
      expectation.commitmentId === undefined
        ? undefined
        : commitmentsById.get(String(expectation.commitmentId));
    const event = eventsByExpectationId.get(String(expectation.id));
    return {
      id: String(expectation.id),
      label: commitment?.title ?? event?.title ?? expectation.reference ?? 'Expected item',
      date: expectation.localDate,
      amount: expectation.amount,
      state: expectation.certainty === 'inferred' ? ('inferred' as const) : ('expected' as const),
      protected: expectation.commitmentId !== undefined,
      sourceId: String(expectation.provenanceId ?? expectation.id),
      assumption: 'Anything in the future stays an expectation until it becomes a fact.',
    };
  });

  return [...transactionCashflows, ...expectationCashflows];
}

function canonicalTodayEvents(
  asOfDate: string,
  canonical: CanonicalRepositoryCollections,
): readonly TimelineEventInput[] {
  const commitmentsById = new Map(
    canonical.commitments.map((commitment) => [String(commitment.id), commitment]),
  );
  const eventsByExpectationId = new Map(
    canonical.events.flatMap((event) =>
      event.expectationIds.map((expectationId) => [String(expectationId), event] as const),
    ),
  );
  const transactionEvents = canonical.transactions.map<TimelineEventInput>((transaction) => ({
    id: `transaction:${String(transaction.id)}`,
    title: transaction.description ?? transaction.reference ?? 'Transaction',
    localDate: transaction.localDate,
    sourceKind: 'transaction',
    state: 'actual',
    amount: transaction.amount,
    detail: transaction.reference ?? 'Confirmed financial record',
    sourceIds: [String(transaction.provenanceId ?? transaction.id)],
  }));
  const expectationEvents = canonical.expectations.map<TimelineEventInput>((expectation) => {
    const commitment =
      expectation.commitmentId === undefined
        ? undefined
        : commitmentsById.get(String(expectation.commitmentId));
    const event = eventsByExpectationId.get(String(expectation.id));

    return {
      id: `expectation:${String(expectation.id)}`,
      title: commitment?.title ?? event?.title ?? expectation.reference ?? 'Expected item',
      localDate: expectation.localDate,
      sourceKind: 'expectation',
      state: 'expected',
      amount: expectation.amount,
      detail:
        expectation.commitmentId === undefined
          ? 'Expected item; not a confirmed fact'
          : 'Protected expected payment',
      sourceIds: [String(expectation.provenanceId ?? expectation.id)],
    };
  });
  const activeImports = activeReviewImportDrafts(canonical);
  const reviewEvents = activeImports.map<TimelineEventInput>((draft) => ({
    id: `import:${String(draft.id)}`,
    title: plannerTitleForProvenance(canonical, String(draft.provenanceId), 'Imported payment'),
    localDate: plannerDateForProvenance(canonical, String(draft.provenanceId), asOfDate),
    sourceKind: 'task',
    state: 'expected',
    detail: 'Imported claim; review before it becomes a record',
    sourceIds: [String(draft.provenanceId)],
  }));
  const taskEvents = canonical.plannerItems
    .filter(
      (item) => !activeImports.some((draft) => String(draft.provenanceId) === item.provenanceId),
    )
    .map<TimelineEventInput>((item) => ({
      id: `planner:${String(item.id)}`,
      title: item.title,
      localDate: item.dueDate,
      sourceKind: 'task',
      state: 'expected',
      detail: item.status === 'open' ? 'Planner item still open' : `Planner item ${item.status}`,
      sourceIds: item.provenanceId === undefined ? [String(item.id)] : [String(item.provenanceId)],
    }));

  return [...transactionEvents, ...expectationEvents, ...reviewEvents, ...taskEvents];
}

function briefingCandidates(
  asOfDate: string,
  projection: MoneyTimelineProjection,
  canonical: CanonicalRepositoryCollections,
): readonly BriefingCandidateInput[] {
  const candidates: BriefingCandidateInput[] = [
    {
      id: 'today_position',
      kind: 'position',
      title: projection.riskDetected ? 'Route needs attention' : 'Known route stays above zero',
      summary: projection.riskDetected
        ? `${formatMinorAmount(projection.lowestMinor)} on ${projection.lowestLocalDate}.`
        : `${formatMinorAmount(projection.availableBeforeNextIncomeMinor ?? projection.closingMinor)} before the next income boundary.`,
      urgency: projection.riskDetected ? 'urgent' : 'nonurgent',
      importance: projection.riskDetected ? 95 : 70,
      evidenceWeight: 1,
      reasonCodes: projection.riskDetected ? ['position_risk'] : ['fresh_fact'],
      sourceIds: projection.countedIds,
    },
  ];

  const activeImports = activeReviewImportDrafts(canonical);
  if (activeImports.length > 0) {
    candidates.push({
      id: 'today_review_queue',
      kind: 'task',
      title: 'Import review',
      summary: `You have ${activeImports.length} row${
        activeImports.length === 1 ? '' : 's'
      } waiting for review. Your picture may change after review.`,
      urgency: 'urgent',
      importance: 88,
      evidenceWeight: 1,
      reasonCodes: ['review_needed'],
      sourceIds: activeImports.map((draft) => String(draft.id)),
    });
  }

  const nextCommitment = canonical.commitments
    .filter((commitment) => commitment.dueDate >= asOfDate)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
  if (nextCommitment !== undefined) {
    candidates.push({
      id: `today_commitment_${String(nextCommitment.id)}`,
      kind: 'calendar',
      title: nextCommitment.title,
      summary: `${formatMinorAmount(nextCommitment.amount.minorUnits)} due ${nextCommitment.dueDate}.`,
      dueDate: nextCommitment.dueDate,
      importance: 72,
      evidenceWeight: nextCommitment.authorityState === 'user-confirmed' ? 1 : 0.8,
      reasonCodes: ['calendar_focus'],
      sourceIds: [String(nextCommitment.provenanceId ?? nextCommitment.id)],
    });
  }

  return candidates;
}

function briefingItemFromRanked(
  item: ReturnType<typeof rankBriefingCandidates>['selected'][number],
  canonical: CanonicalRepositoryCollections,
): LocalTodayBriefingItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    urgency: item.urgency,
    sourceIds: item.sourceIds,
    accessibilityText: item.accessibilityText,
    category: item.kind === 'task' ? 'import' : item.kind === 'calendar' ? 'commitment' : 'plan',
    evidence: canonicalEvidenceForRecord(canonical, {
      recordKind: item.kind,
      recordId: item.id,
      why: item.summary,
      authorityState: item.evidenceWeight >= 1 ? 'user-confirmed' : 'estimated',
      linkedRecords: item.sourceIds.map((id) => ({ kind: 'source', id })),
      actionPath: item.kind === 'task' ? 'review' : 'inspect',
    }),
  };
}

function buildWhatChangedBriefing(
  asOfDate: string,
  canonical: CanonicalRepositoryCollections,
): LocalTodayWhatChanged {
  const confirmedRecords = canonical.transactions
    .filter((transaction) => transaction.localDate <= asOfDate)
    .slice(0, 3)
    .map<LocalTodayBriefingItem>((transaction) => ({
      id: `changed_transaction_${String(transaction.id)}`,
      title: transaction.description ?? transaction.reference ?? 'Confirmed record',
      summary: `${formatMinorAmount(transaction.amount.minorUnits)} is now a confirmed record.`,
      urgency: 'nonurgent',
      sourceIds: [String(transaction.provenanceId ?? transaction.id)],
      accessibilityText: 'Confirmed financial record changed the current position.',
      category: 'confirmed',
      evidence: canonicalEvidenceForRecord(canonical, {
        recordKind: 'transaction',
        recordId: String(transaction.id),
        why: 'A confirmed transaction is included in Today.',
        authorityState: transaction.authorityState,
        reviewState: transaction.reviewStatus,
        sourceRecordId: stringOrUndefined(transaction.sourceRecordId),
        provenanceId: stringOrUndefined(transaction.provenanceId),
        linkedRecords: [{ kind: 'transaction', id: String(transaction.id) }],
      }),
    }));
  const upcomingCommitments = canonical.commitments
    .filter((commitment) => commitment.dueDate >= asOfDate)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .slice(0, 2)
    .map<LocalTodayBriefingItem>((commitment) => ({
      id: `changed_commitment_${String(commitment.id)}`,
      title: commitment.title,
      summary: `${formatMinorAmount(commitment.amount.minorUnits)} is protected for ${commitment.dueDate}.`,
      urgency: 'nonurgent',
      sourceIds: [String(commitment.provenanceId ?? commitment.id)],
      accessibilityText: 'Upcoming commitment affects the route.',
      category: 'commitment',
      evidence: canonicalEvidenceForRecord(canonical, {
        recordKind: 'commitment',
        recordId: String(commitment.id),
        why: 'An upcoming commitment affects what remains covered.',
        authorityState: commitment.authorityState,
        reviewState: commitment.reviewState,
        sourceRecordId: stringOrUndefined(commitment.sourceRecordId),
        provenanceId: stringOrUndefined(commitment.provenanceId),
        linkedRecords: [{ kind: 'commitment', id: String(commitment.id) }],
      }),
    }));
  const unresolvedImports = activeReviewImportDrafts(canonical)
    .slice(0, 3)
    .map<LocalTodayBriefingItem>((draft) => ({
      id: `changed_import_${String(draft.id)}`,
      title: plannerTitleForProvenance(canonical, String(draft.provenanceId), 'Imported claim'),
      summary: 'Imported claim still needs review before becoming a record.',
      urgency: 'urgent',
      sourceIds: [String(draft.provenanceId)],
      accessibilityText: 'Imported claim needs user review.',
      category: 'import',
      evidence: canonicalEvidenceForRecord(canonical, {
        recordKind: 'import draft',
        recordId: String(draft.id),
        why: 'An imported claim is unresolved.',
        authorityState: draft.authorityState,
        reviewState: draft.reviewState,
        sourceRecordId: String(draft.sourceRecordId),
        provenanceId: String(draft.provenanceId),
        linkedRecords: [{ kind: 'import draft', id: String(draft.id) }],
        actionPath: 'review',
      }),
    }));
  const scenarioConsequences = canonical.scenarios
    .slice(0, 2)
    .map<LocalTodayBriefingItem>((scenario) => ({
      id: `changed_scenario_${String(scenario.id)}`,
      title: scenario.title,
      summary:
        scenario.status === 'previewed'
          ? 'Scenario preview is visible but not counted as reality.'
          : 'Scenario decision is recorded separately from financial facts.',
      urgency: scenario.status === 'previewed' ? 'urgent' : 'nonurgent',
      sourceIds: [String(scenario.provenanceId ?? scenario.id)],
      accessibilityText: 'Scenario consequence is separated from confirmed records.',
      category: 'scenario',
      evidence: canonicalEvidenceForRecord(canonical, {
        recordKind: 'scenario',
        recordId: String(scenario.id),
        why: 'A scenario changes the path to inspect without becoming a transaction.',
        authorityState: scenario.authorityState,
        reviewState: scenario.status,
        provenanceId: stringOrUndefined(scenario.provenanceId),
        linkedRecords: [{ kind: 'scenario', id: String(scenario.id) }],
        actionPath: 'scenario-preview',
      }),
    }));
  const documentTasks = [
    ...canonical.documents.slice(0, 1).map<LocalTodayBriefingItem>((document) => ({
      id: `changed_document_${String(document.id)}`,
      title: document.filename,
      summary: 'Document is attached as source material for review.',
      urgency: document.authorityState === 'imported-claim' ? 'urgent' : 'nonurgent',
      sourceIds: [String(document.provenanceId ?? document.id)],
      accessibilityText: 'Document attachment may need review.',
      category: 'document',
      evidence: canonicalEvidenceForRecord(canonical, {
        recordKind: 'document',
        recordId: String(document.id),
        why: 'A document is available as source material.',
        authorityState: document.authorityState,
        reviewState: document.kind,
        provenanceId: stringOrUndefined(document.provenanceId),
        linkedRecords: [{ kind: 'document', id: String(document.id) }],
        actionPath: document.authorityState === 'imported-claim' ? 'review' : 'inspect',
      }),
    })),
    ...canonical.plannerItems.slice(0, 1).map<LocalTodayBriefingItem>((item) => ({
      id: `changed_task_${String(item.id)}`,
      title: item.title,
      summary: `Planner item is ${item.status}.`,
      urgency: item.status === 'open' ? 'urgent' : 'nonurgent',
      sourceIds: [String(item.provenanceId ?? item.id)],
      accessibilityText: 'Planner item may need review.',
      category: 'task',
      evidence: canonicalEvidenceForRecord(canonical, {
        recordKind: 'planner item',
        recordId: String(item.id),
        why: 'A planner item is visible in Today.',
        authorityState: item.authorityState,
        reviewState: item.status,
        provenanceId: stringOrUndefined(item.provenanceId),
        linkedRecords: [{ kind: 'planner item', id: String(item.id) }],
        actionPath: item.status === 'open' ? 'review' : 'inspect',
      }),
    })),
  ];
  const planMovement = [
    ...canonical.plans.slice(0, 1).map<LocalTodayBriefingItem>((plan) => {
      const impact = canonical.planImpacts.find((record) => record.planId === plan.id);
      return {
        id: `changed_plan_${String(impact?.id ?? plan.id)}`,
        title: plan.title,
        summary:
          impact === undefined
            ? `Plan is ${plan.status} and linked to ${plan.commitmentIds.length} commitment${
                plan.commitmentIds.length === 1 ? '' : 's'
              }.`
            : `${impact.summary} ${impact.newProjectedOutcome}`,
        urgency: impact?.needsReview === true ? 'urgent' : 'nonurgent',
        sourceIds: [String(impact?.provenanceId ?? plan.provenanceId ?? plan.id)],
        accessibilityText:
          impact === undefined
            ? 'Plan movement is visible.'
            : 'Plan movement is derived from reviewed impact records.',
        category: 'plan' as const,
        evidence: canonicalEvidenceForRecord(canonical, {
          recordKind: impact === undefined ? 'plan' : 'plan impact',
          recordId: String(impact?.id ?? plan.id),
          why:
            impact === undefined
              ? 'A plan is affected by the current route.'
              : 'A plan impact explains movement from changed records.',
          authorityState: impact?.authorityState ?? plan.authorityState,
          reviewState: impact?.reviewState ?? plan.status,
          provenanceId: stringOrUndefined(impact?.provenanceId ?? plan.provenanceId),
          linkedRecords: [
            { kind: 'plan', id: String(plan.id) },
            ...(impact === undefined ? [] : [{ kind: 'plan impact', id: String(impact.id) }]),
          ],
          actionPath: impact?.needsReview === true ? 'review' : 'inspect',
        }),
      };
    }),
  ];
  const items = [
    ...unresolvedImports,
    ...confirmedRecords,
    ...upcomingCommitments,
    ...planMovement,
    ...scenarioConsequences,
    ...documentTasks,
  ];

  return {
    summary:
      items.length === 0
        ? 'No changes need attention right now.'
        : `${items.length} change${items.length === 1 ? '' : 's'} are visible.`,
    items,
  };
}

function buildRecoveryModel(
  asOfDate: string,
  projection: MoneyTimelineProjection,
  canonical: CanonicalRepositoryCollections,
): LocalTodayRecoveryModel {
  if (!projection.riskDetected && projection.lowestMinor >= 0) {
    return {
      active: false,
      title: 'Recovery path',
      summary: 'No recovery path is needed from the current canonical route.',
      whatChanged: [],
      affects: [],
      remainsCovered: canonical.commitments
        .filter((commitment) => commitment.dueDate >= asOfDate)
        .map((commitment) => commitment.title),
      pathForward: ['Keep the current route visible.'],
      scenarioPreviewRequired: true,
    };
  }

  const firstAffected = canonical.commitments
    .filter((commitment) => commitment.dueDate >= asOfDate)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
  const briefing = buildBadMonthBriefing({
    workspaceId: String(canonical.workspaces[0]?.id ?? 'workspace_personal_local'),
    eventLabel: firstAffected?.title ?? 'Known route',
    amountLabel: formatMinorAmount(projection.lowestMinor),
    availableChangeLabel: `Lowest visible point is ${formatMinorAmount(projection.lowestMinor)} on ${projection.lowestLocalDate}.`,
    affectedItems: canonical.plans.map((plan) => plan.title),
    stableItems: canonical.commitments
      .filter((commitment) => commitment.dueDate >= asOfDate && commitment.amount.minorUnits < 0)
      .map((commitment) => commitment.title),
    recoveryOptions: [
      'Review unresolved imported claims',
      'Preview a recovery scenario before saving changes',
      'Inspect protected commitments',
    ],
    supportLinks: [],
    tone: 'gentle',
  });

  return {
    active: true,
    title: briefing.title,
    summary: gateMeloText(
      briefing.summary,
      'Something changed. The updated route is visible and scenario previews stay separate from records.',
    ),
    whatChanged: briefing.facts,
    affects: briefing.affected,
    remainsCovered: briefing.stable,
    pathForward: briefing.recoveryOptions,
    scenarioPreviewRequired: true,
  };
}

function buildTodayMeloText(
  input: Readonly<{
    asOfDate: string;
    canonical: CanonicalRepositoryCollections;
    headline: string;
    leadBriefing: LocalTodayBriefingItem | undefined;
    position: PositionSummary;
    projection: MoneyTimelineProjection;
    recovery: LocalTodayRecoveryModel;
    balanceEvidence: readonly CanonicalSurfaceEvidence[];
    whatChanged: LocalTodayWhatChanged;
  }>,
): string {
  const rendered = renderDeterministicMeloBriefing({
    state: input.recovery.active
      ? 'bad_month'
      : activeReviewImportDrafts(input.canonical).length > 0
        ? 'attention'
        : input.whatChanged.items.length > 0
          ? 'changed'
          : 'on_track',
    positionLine: input.headline,
    assumptions: [
      'Today is rebuilt from local records and review items.',
      ...input.balanceEvidence.slice(0, 2).map((evidence) => evidence.summary),
      ...input.projection.assumptions.slice(0, 2),
    ],
    facts: input.whatChanged.items.slice(0, 3).map((item) => {
      const sourceId = item.evidence.provenanceId ?? item.evidence.sourceRecordId;
      return {
        id: item.id,
        label: item.category,
        value: item.summary,
        certainty: item.urgency === 'urgent' ? ('partial' as const) : ('confirmed' as const),
        ...(sourceId === undefined ? {} : { sourceId }),
      };
    }),
    tone: defaultMeloTonePreferences,
    dataAsOf: input.asOfDate,
    ...(input.leadBriefing?.title === undefined ? {} : { nextImportant: input.leadBriefing.title }),
    ...(input.whatChanged.items[0]?.summary === undefined
      ? {}
      : { changed: input.whatChanged.items[0].summary }),
  });
  const reviewClaimCount = input.canonical.importedClaims.filter(
    (claim) => claim.state === 'needs-review' && claim.nonFinancial !== true,
  ).length;
  const reviewIssueCount = input.canonical.importedClaims.reduce(
    (total, claim) =>
      claim.nonFinancial === true ? total : total + (claim.parserIssues?.length ?? 0),
    0,
  );
  const importBriefing =
    reviewClaimCount === 0 && input.canonical.documents.length === 0
      ? undefined
      : buildImportReviewBriefing({
          sourceLabel: 'Import review',
          importedClaimCount: reviewClaimCount,
          documentCount: input.canonical.documents.length,
          issueCount: reviewIssueCount,
          boundedQuestions: ['Is the date right?', 'Is the amount right?', 'Is this a duplicate?'],
        });
  const text =
    importBriefing === undefined ? rendered.text : `${rendered.text} ${importBriefing.summary}`;

  return gateMeloText(
    text,
    'Today is rebuilt from local records. Review items stay separate from confirmed facts.',
  );
}

function mergeBriefingItems(
  ranked: readonly LocalTodayBriefingItem[],
  changed: readonly LocalTodayBriefingItem[],
): readonly LocalTodayBriefingItem[] {
  const byId = new Map<string, LocalTodayBriefingItem>();
  for (const item of [...ranked, ...changed]) byId.set(item.id, item);
  return [...byId.values()];
}

function evidenceForTimelineRow(
  rowId: string,
  canonical: CanonicalRepositoryCollections,
): CanonicalSurfaceEvidence {
  const [kind, id] = rowId.split(':');
  if (kind === 'transaction') {
    const transaction = canonical.transactions.find((record) => String(record.id) === id);
    if (transaction !== undefined) {
      return canonicalEvidenceForRecord(canonical, {
        recordKind: 'transaction',
        recordId: String(transaction.id),
        why: 'A confirmed transaction contributes to Today.',
        authorityState: transaction.authorityState,
        reviewState: transaction.reviewStatus,
        sourceRecordId: stringOrUndefined(transaction.sourceRecordId),
        provenanceId: stringOrUndefined(transaction.provenanceId),
        linkedRecords: [{ kind: 'transaction', id: String(transaction.id) }],
      });
    }
  }
  if (kind === 'expectation') {
    const expectation = canonical.expectations.find((record) => String(record.id) === id);
    if (expectation !== undefined) {
      return canonicalEvidenceForRecord(canonical, {
        recordKind: 'expectation',
        recordId: String(expectation.id),
        why: 'A future expectation contributes to Today.',
        authorityState: expectation.authorityState,
        sourceRecordId: stringOrUndefined(expectation.sourceRecordId),
        provenanceId: stringOrUndefined(expectation.provenanceId),
        linkedRecords: [{ kind: 'expectation', id: String(expectation.id) }],
      });
    }
  }
  if (kind === 'import') {
    const draft = activeReviewImportDrafts(canonical).find((record) => String(record.id) === id);
    if (draft !== undefined) {
      return canonicalEvidenceForRecord(canonical, {
        recordKind: 'import draft',
        recordId: String(draft.id),
        why: 'An imported claim appears for review.',
        authorityState: draft.authorityState,
        reviewState: draft.reviewState,
        sourceRecordId: String(draft.sourceRecordId),
        provenanceId: String(draft.provenanceId),
        linkedRecords: [{ kind: 'import draft', id: String(draft.id) }],
        actionPath: 'review',
      });
    }
  }
  if (kind === 'planner') {
    const item = canonical.plannerItems.find((record) => String(record.id) === id);
    if (item !== undefined) {
      return canonicalEvidenceForRecord(canonical, {
        recordKind: 'planner item',
        recordId: String(item.id),
        why: 'A planner item appears in Today.',
        authorityState: item.authorityState,
        reviewState: item.status,
        provenanceId: stringOrUndefined(item.provenanceId),
        linkedRecords: [{ kind: 'planner item', id: String(item.id) }],
        actionPath: item.status === 'open' ? 'review' : 'inspect',
      });
    }
  }

  return canonicalEvidenceForRecord(canonical, {
    recordKind: 'timeline entry',
    recordId: rowId,
    why: 'This comes from your Today picture.',
    authorityState: 'estimated',
  });
}

function nextProjectionDate(asOfDate: string, canonical: CanonicalRepositoryCollections): string {
  return (
    [
      asOfDate,
      ...canonical.expectations.map((expectation) => expectation.localDate),
      ...canonical.commitments.map((commitment) => commitment.dueDate),
      ...canonical.calendarItems.map((item) => item.localDate),
    ].sort((left, right) => right.localeCompare(left))[0] ?? asOfDate
  );
}

function todayHeadlineFromProjection(
  projection: MoneyTimelineProjection,
  nextIncomeDate: string | undefined,
): string {
  if (projection.riskDetected) return 'This route needs attention.';
  if (nextIncomeDate === undefined) return 'The known route stays above zero.';
  return `You're covered through ${shortDateLabel(nextIncomeDate)}.`;
}

function protectedFutureOutflowMinor(
  asOfDate: string,
  canonical: CanonicalRepositoryCollections,
): number {
  return canonical.commitments
    .filter((commitment) => commitment.amount.minorUnits < 0 && commitment.dueDate > asOfDate)
    .reduce((total, commitment) => total + Math.abs(commitment.amount.minorUnits), 0);
}

function plannerDateForProvenance(
  canonical: CanonicalRepositoryCollections,
  provenanceId: string,
  fallback: string,
): string {
  return (
    canonical.plannerItems.find((item) => String(item.provenanceId) === provenanceId)?.dueDate ??
    fallback
  );
}

function plannerTitleForProvenance(
  canonical: CanonicalRepositoryCollections,
  provenanceId: string,
  fallback: string,
): string {
  return (
    canonical.plannerItems
      .find((item) => String(item.provenanceId) === provenanceId)
      ?.title.replace(/^Review\s+/iu, '') ?? fallback
  );
}

function activeReviewImportDrafts(
  canonical: CanonicalRepositoryCollections,
): CanonicalRepositoryCollections['importDrafts'] {
  return canonical.importDrafts.filter(
    (draft) => draft.reviewState !== 'dismissed' && draft.userConfirmationState !== 'rejected',
  );
}

function timelineFallbackDetail(eventState: 'actual' | 'expected'): string {
  return eventState === 'actual' ? 'Confirmed record' : 'Expected item';
}

function todayKindLabel(sourceKind: string, state: 'actual' | 'expected'): string {
  if (sourceKind === 'transaction') return 'Fact';
  if (sourceKind === 'task') return 'Review';
  if (sourceKind === 'expectation') return 'Expected';
  return state === 'actual' ? 'Confirmed' : 'Planned';
}

function timelineDayLabel(date: string, asOfDate: string): string {
  if (date <= asOfDate) return date === asOfDate ? 'Today' : 'Past';
  const distance = Math.round(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${asOfDate}T00:00:00.000Z`)) / 86_400_000,
  );
  if (distance === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}

function shortDateLabel(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function stringOrUndefined(value: unknown): string | undefined {
  return value === undefined ? undefined : String(value);
}
