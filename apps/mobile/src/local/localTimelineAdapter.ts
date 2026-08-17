import { defaultMeloTonePreferences, renderDeterministicMeloBriefing } from '@folio/melo-policy';
import type { CanonicalRepositoryCollections, CanonicalRepositorySnapshot } from '@folio/storage';

import {
  canonicalEvidenceForRecord,
  type CanonicalSurfaceEvidence,
  type CanonicalSurfaceLinkedRecord,
} from './canonicalExperienceEvidence.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { formatMinorAmount, type LocalLedgerState } from './localLedger.js';
import { gateMeloText } from './localMeloPolicyAdapter.js';

export type LocalTimelineTone = 'confirmed' | 'estimated' | 'attention';

export type LocalTimelineEntryKind =
  | 'confirmed-record'
  | 'pending-record'
  | 'reversed-record'
  | 'void-record'
  | 'refund'
  | 'transfer'
  | 'imported-claim'
  | 'meaning-event'
  | 'expectation'
  | 'commitment'
  | 'planner-item'
  | 'plan-change'
  | 'scenario-preview'
  | 'decision-record'
  | 'document-attachment'
  | 'melo-proposal'
  | 'audit-change'
  | 'balance-event';

export type LocalTimelineEvent = Readonly<{
  date?: string;
  day: string;
  title: string;
  detail: string;
  amount: string;
  tone: LocalTimelineTone;
  kind: LocalTimelineEntryKind;
  kindLabel: string;
  evidence: CanonicalSurfaceEvidence;
}>;

export type LocalTimelineModel = Readonly<{
  events: readonly LocalTimelineEvent[];
  factCount: number;
  expectationCount: number;
  reviewCount: number;
  sourceLabel: 'Private example' | 'Local route' | 'Local records';
  meloBriefingText: string;
  accessibilitySummary: string;
}>;

export function buildLocalTimelineModel(
  ledger: LocalLedgerState,
  options: Readonly<{ privateExampleMode?: boolean }> = {},
): LocalTimelineModel {
  return buildCanonicalTimelineModel(
    createCanonicalRepositoryForLocalLedgerState(ledger).snapshot(),
    {
      asOfDate: ledger.asOfDate,
      sourceLabel: options.privateExampleMode === true ? 'Private example' : 'Local route',
    },
  );
}

export function buildCanonicalTimelineModel(
  snapshot: CanonicalRepositorySnapshot,
  options: Readonly<{
    asOfDate: string;
    sourceLabel?: LocalTimelineModel['sourceLabel'];
  }>,
): LocalTimelineModel {
  const canonical = snapshot.collections;
  const events = [
    ...canonical.balanceObservations.map((observation) =>
      timelineEvent({
        amountMinor: observation.balance.minorUnits,
        canonical,
        date: observation.observedOn,
        detail: balanceObservationDetail(observation),
        evidence: {
          actionPath:
            observation.reviewState === 'needs-review' ||
            observation.reconciliationState === 'unreconciled'
              ? 'review'
              : 'inspect',
          authorityState: observation.authorityState,
          linkedRecords: [
            { kind: 'balance observation', id: String(observation.id) },
            { kind: 'account', id: String(observation.accountId) },
          ],
          provenanceId: stringOrUndefined(observation.provenanceId),
          recordId: String(observation.id),
          recordKind: 'balance observation',
          reviewState: observation.reviewState,
          sourceRecordId: stringOrUndefined(observation.sourceRecordId),
          why: 'This balance record anchors or updates the current position and keeps its review state visible.',
        },
        kind: 'balance-event',
        kindLabel: 'Balance',
        title: balanceObservationTitle(observation),
        tone: balanceTone(observation.authorityState, observation.reviewState),
      }),
    ),
    ...canonical.currentBalances.map((balance) =>
      timelineEvent({
        amountMinor: balance.balance.minorUnits,
        canonical,
        date: balance.asOf,
        detail:
          balance.sourceKind === 'calculated'
            ? balance.reviewState === 'needs-review'
              ? 'Needs a source before this can be treated as a real balance'
              : 'Calculated from reviewed local records'
            : 'Current balance selected from recorded balance evidence',
        evidence: {
          actionPath: balance.reviewState === 'needs-review' ? 'review' : 'inspect',
          authorityState: balance.authorityState,
          linkedRecords: [
            { kind: 'current balance', id: String(balance.id) },
            { kind: 'account', id: String(balance.accountId) },
            { kind: 'balance observation', id: String(balance.sourceObservationId) },
            ...(balance.calculatedFromTransactionIds ?? []).map((id) => ({
              kind: 'derived transaction',
              id: String(id),
            })),
          ],
          provenanceId: stringOrUndefined(balance.provenanceId),
          recordId: String(balance.id),
          recordKind: 'current balance',
          reviewState: balance.reviewState,
          why: 'This balance record explains what Today is using and whether it needs review.',
        },
        kind: 'balance-event',
        kindLabel: 'Balance',
        title: balance.reviewState === 'needs-review' ? 'Balance needs source' : 'Balance updated',
        tone: balanceTone(balance.authorityState, balance.reviewState),
      }),
    ),
    ...canonical.balanceAdjustments.map((adjustment) =>
      timelineEvent({
        amountMinor: adjustment.amount.minorUnits,
        canonical,
        date: adjustment.localDate,
        detail:
          adjustment.kind === 'correction'
            ? 'Balance corrected by user decision'
            : adjustment.kind === 'reconciliation'
              ? 'Account reconciled against a balance observation'
              : 'Balance adjustment recorded separately from transactions',
        evidence: {
          actionPath: adjustment.reviewState === 'needs-review' ? 'review' : 'undo',
          authorityState: adjustment.authorityState,
          linkedRecords: [
            { kind: 'balance adjustment', id: String(adjustment.id) },
            { kind: 'account', id: String(adjustment.accountId) },
            ...(adjustment.sourceObservationId === undefined
              ? []
              : [
                  {
                    kind: 'source balance observation',
                    id: String(adjustment.sourceObservationId),
                  },
                ]),
            ...(adjustment.resultingObservationId === undefined
              ? []
              : [
                  {
                    kind: 'resulting balance observation',
                    id: String(adjustment.resultingObservationId),
                  },
                ]),
            ...(adjustment.decisionId === undefined
              ? []
              : [{ kind: 'decision', id: String(adjustment.decisionId) }]),
          ],
          provenanceId: stringOrUndefined(adjustment.provenanceId),
          recordId: String(adjustment.id),
          recordKind: 'balance adjustment',
          reviewState: adjustment.reviewState,
          sourceRecordId: stringOrUndefined(adjustment.sourceRecordId),
          why: 'A balance correction or reconciliation changed the balance authority trail.',
        },
        kind: 'balance-event',
        kindLabel: 'Balance',
        title: adjustment.kind === 'correction' ? 'Balance corrected' : 'Account reconciled',
        tone: balanceTone(adjustment.authorityState, adjustment.reviewState),
      }),
    ),
    ...canonical.transactions.map((transaction) => {
      const kind: LocalTimelineEntryKind =
        transaction.status === 'pending'
          ? 'pending-record'
          : transaction.status === 'reversed'
            ? 'reversed-record'
            : transaction.status === 'void'
              ? 'void-record'
              : transaction.movementKind === 'refund'
                ? 'refund'
                : transaction.movementKind === 'transfer'
                  ? 'transfer'
                  : 'confirmed-record';
      const kindLabel =
        kind === 'pending-record'
          ? 'Pending'
          : kind === 'reversed-record'
            ? 'Reversed'
            : kind === 'void-record'
              ? 'Voided'
              : kind === 'refund'
                ? 'Refund'
                : kind === 'transfer'
                  ? 'Transfer'
                  : 'Fact';
      const detail =
        kind === 'pending-record'
          ? 'Pending provider record; retained but not counted as settled money'
          : kind === 'reversed-record'
            ? 'Reversed record retained in the audit trail and not counted as settled money'
            : kind === 'void-record'
              ? 'Voided or superseded record retained in the audit trail and not counted'
              : kind === 'refund'
                ? transaction.refundOf === undefined
                  ? 'Refund recorded; original transaction is not linked'
                  : 'Refund linked to its original transaction'
                : kind === 'transfer'
                  ? 'Own-account transfer; not treated as income or spending'
                  : (transaction.reference ?? 'Confirmed financial record');
      return timelineEvent({
        amountMinor: transaction.amount.minorUnits,
        canonical,
        date: transaction.localDate,
        detail,
        evidence: {
          actionPath: kind === 'pending-record' ? 'review' : 'inspect',
          authorityState: transaction.authorityState,
          linkedRecords: [
            { kind: 'transaction', id: String(transaction.id) },
            ...(transaction.eventId === undefined
              ? []
              : [{ kind: 'event', id: String(transaction.eventId) }]),
          ],
          provenanceId: stringOrUndefined(transaction.provenanceId),
          recordId: String(transaction.id),
          recordKind: kindLabel.toLowerCase(),
          reviewState: transaction.reviewStatus,
          sourceRecordId: stringOrUndefined(transaction.sourceRecordId),
          why:
            kind === 'pending-record'
              ? 'A provider record exists but has not settled.'
              : 'The transaction and its lifecycle state remain in local records.',
        },
        kind,
        kindLabel,
        title: transaction.description ?? transaction.reference ?? 'Transaction',
        tone: kind === 'pending-record' ? 'estimated' : 'confirmed',
      });
    }),
    ...activeReviewImportDrafts(canonical).map((draft) =>
      timelineEvent({
        amountMinor: undefined,
        canonical,
        date: plannerDateForProvenance(canonical, String(draft.provenanceId), options.asOfDate),
        detail: 'Imported claim; review before it can become a confirmed fact',
        evidence: {
          actionPath: 'review',
          authorityState: draft.authorityState,
          linkedRecords: [
            { kind: 'import draft', id: String(draft.id) },
            { kind: 'proposed transaction', id: String(draft.proposedTransactionId) },
          ],
          provenanceId: String(draft.provenanceId),
          recordId: String(draft.id),
          recordKind: 'imported claim',
          reviewState: draft.reviewState,
          sourceRecordId: String(draft.sourceRecordId),
          why: 'An imported payment is waiting for you to confirm it.',
        },
        kind: 'imported-claim',
        kindLabel: 'Import',
        title: plannerTitleForProvenance(canonical, String(draft.provenanceId), 'Imported payment'),
        tone: 'attention',
      }),
    ),
    ...canonical.events.map((event) =>
      timelineEvent({
        amountMinor: event.amount?.minorUnits,
        canonical,
        date: event.localDate,
        detail:
          event.transactionIds.length > 0
            ? 'Recorded money movement with a linked transaction'
            : event.expectationIds.length > 0
              ? 'Planned money movement; not a confirmed transaction yet'
              : 'Money event with linked meaning',
        evidence: {
          actionPath: 'inspect',
          authorityState: event.authorityState,
          linkedRecords: [
            { kind: 'event', id: String(event.id) },
            ...event.transactionIds.map((id) => ({ kind: 'transaction', id: String(id) })),
            ...event.expectationIds.map((id) => ({ kind: 'expectation', id: String(id) })),
          ],
          provenanceId: stringOrUndefined(event.provenanceId),
          recordId: String(event.id),
          recordKind: 'event',
          why: 'This event explains what the money movement means and which records it links to.',
        },
        kind: 'meaning-event',
        kindLabel: 'Meaning',
        title: event.title,
        tone: event.authorityState === 'user-confirmed' ? 'confirmed' : 'estimated',
      }),
    ),
    ...canonical.expectations.map((expectation) =>
      timelineEvent({
        amountMinor: expectation.amount.minorUnits,
        canonical,
        date: expectation.localDate,
        detail: expectation.fulfilled
          ? 'Expectation fulfilled'
          : 'Expected item; not a confirmed fact yet',
        evidence: {
          actionPath: 'inspect',
          authorityState: expectation.authorityState,
          linkedRecords: [
            { kind: 'expectation', id: String(expectation.id) },
            ...(expectation.commitmentId === undefined
              ? []
              : [{ kind: 'commitment', id: String(expectation.commitmentId) }]),
          ],
          provenanceId: stringOrUndefined(expectation.provenanceId),
          recordId: String(expectation.id),
          recordKind: 'expectation',
          sourceRecordId: stringOrUndefined(expectation.sourceRecordId),
          why: 'A future expectation is present in local records.',
        },
        kind: 'expectation',
        kindLabel: 'Expected',
        title: titleForExpectation(canonical, String(expectation.id)),
        tone: 'estimated',
      }),
    ),
    ...canonical.commitments.map((commitment) =>
      timelineEvent({
        amountMinor: commitment.amount.minorUnits,
        canonical,
        date: commitment.dueDate,
        detail: 'Commitment or obligation protected in the route',
        evidence: {
          actionPath: commitment.reviewState === 'needs-review' ? 'review' : 'inspect',
          authorityState: commitment.authorityState,
          linkedRecords: [{ kind: 'commitment', id: String(commitment.id) }],
          provenanceId: stringOrUndefined(commitment.provenanceId),
          recordId: String(commitment.id),
          recordKind: 'commitment',
          reviewState: commitment.reviewState,
          sourceRecordId: stringOrUndefined(commitment.sourceRecordId),
          why: 'A commitment marks an obligation the route protects.',
        },
        kind: 'commitment',
        kindLabel: 'Obligation',
        title: commitment.title,
        tone: commitment.reviewState === 'needs-review' ? 'attention' : 'estimated',
      }),
    ),
    ...canonical.plannerItems.map((item) =>
      timelineEvent({
        amountMinor: undefined,
        canonical,
        date: item.dueDate,
        detail: item.status === 'open' ? 'Planner item still open' : `Planner item ${item.status}`,
        evidence: {
          actionPath: item.status === 'open' ? 'review' : 'inspect',
          authorityState: item.authorityState,
          linkedRecords: [{ kind: 'planner item', id: String(item.id) }],
          provenanceId: stringOrUndefined(item.provenanceId),
          recordId: String(item.id),
          recordKind: 'planner item',
          reviewState: item.status,
          why: 'A planner item is due on this date.',
        },
        kind: 'planner-item',
        kindLabel: 'Task',
        title: item.title,
        tone: item.status === 'open' ? 'attention' : 'confirmed',
      }),
    ),
    ...canonical.plans.map((plan) =>
      timelineEvent({
        amountMinor: plan.targetAmount?.minorUnits,
        canonical,
        date: plan.targetDate ?? plan.createdAt.slice(0, 10),
        detail: `Plan ${plan.status}; reality updates the plan without punishment`,
        evidence: {
          actionPath: 'inspect',
          authorityState: plan.authorityState,
          linkedRecords: [
            { kind: 'plan', id: String(plan.id) },
            ...plan.commitmentIds.map((id) => ({ kind: 'commitment', id: String(id) })),
            ...plan.scenarioIds.map((id) => ({ kind: 'scenario', id: String(id) })),
          ],
          provenanceId: stringOrUndefined(plan.provenanceId),
          recordId: String(plan.id),
          recordKind: 'plan',
          reviewState: plan.status,
          why: 'A plan has a milestone or tracked change.',
        },
        kind: 'plan-change',
        kindLabel: 'Plan',
        title: plan.title,
        tone: plan.status === 'active' ? 'estimated' : 'attention',
      }),
    ),
    ...canonical.planImpacts.map((impact) => {
      const plan = canonical.plans.find((record) => record.id === impact.planId);
      return timelineEvent({
        amountMinor: impact.protectedAmount.minorUnits,
        canonical,
        date: impact.asOf,
        detail: `${impact.summary} ${impact.newProjectedOutcome}`,
        evidence: {
          actionPath: impact.needsReview ? 'review' : 'inspect',
          authorityState: impact.authorityState,
          linkedRecords: [
            { kind: 'plan impact', id: String(impact.id) },
            { kind: 'plan', id: String(impact.planId) },
            ...impact.changedRecordIds.map((id) => ({ kind: 'changed record', id })),
            ...impact.scenarioIds.map((id) => ({ kind: 'scenario', id: String(id) })),
          ],
          provenanceId: stringOrUndefined(impact.provenanceId),
          recordId: String(impact.id),
          recordKind: 'plan impact',
          reviewState: impact.reviewState,
          why: 'A plan impact explains how reality moved a plan.',
        },
        kind: 'plan-change',
        kindLabel: 'Plan',
        title: impact.needsReview
          ? `${plan?.title ?? 'Plan'} needs review`
          : `${plan?.title ?? 'Plan'} checked`,
        tone: impact.needsReview ? 'attention' : 'estimated',
      });
    }),
    ...canonical.scenarios.map((scenario) =>
      timelineEvent({
        amountMinor: undefined,
        canonical,
        date: scenario.createdAt.slice(0, 10),
        detail:
          scenario.status === 'accepted'
            ? 'Scenario decision recorded; no transaction is created by the preview'
            : 'Scenario preview only; not reality until accepted',
        evidence: {
          actionPath: scenario.status === 'previewed' ? 'scenario-preview' : 'inspect',
          authorityState: scenario.authorityState,
          linkedRecords: [
            { kind: 'scenario', id: String(scenario.id) },
            ...scenario.affectedPlanIds.map((id) => ({ kind: 'plan', id: String(id) })),
          ],
          provenanceId: stringOrUndefined(scenario.provenanceId),
          recordId: String(scenario.id),
          recordKind: 'scenario',
          reviewState: scenario.status,
          why: 'A hypothetical scenario records a preview or recovery consequence.',
        },
        kind: 'scenario-preview',
        kindLabel: 'Scenario',
        title: scenario.title,
        tone: 'estimated',
      }),
    ),
    ...canonical.decisions.map((decision) =>
      timelineEvent({
        amountMinor: undefined,
        canonical,
        date: decision.decidedAt.slice(0, 10),
        detail: decision.summary,
        evidence: {
          actionPath: 'undo',
          authorityState: 'user-confirmed',
          linkedRecords: [
            { kind: 'decision', id: String(decision.id) },
            ...decision.affectedIds.map((id) => ({ kind: 'affected record', id })),
          ],
          provenanceId: stringOrUndefined(decision.provenanceId),
          recordId: String(decision.id),
          recordKind: 'decision',
          reviewState: decision.kind,
          why: 'Something you decided changed or confirmed the meaning.',
        },
        kind: 'decision-record',
        kindLabel: 'Decision',
        title: decision.kind.replaceAll('-', ' '),
        tone: 'confirmed',
      }),
    ),
    ...canonical.documents.map((document) =>
      timelineEvent({
        amountMinor: undefined,
        canonical,
        date: document.capturedAt.slice(0, 10),
        detail: `${document.kind} attached for review`,
        evidence: {
          actionPath: document.authorityState === 'imported-claim' ? 'review' : 'inspect',
          authorityState: document.authorityState,
          linkedRecords: [{ kind: 'document', id: String(document.id) }],
          provenanceId: stringOrUndefined(document.provenanceId),
          recordId: String(document.id),
          recordKind: 'document',
          reviewState: document.kind,
          why: 'A document attachment is available as source material.',
        },
        kind: 'document-attachment',
        kindLabel: 'Document',
        title: document.filename,
        tone: document.authorityState === 'imported-claim' ? 'attention' : 'confirmed',
      }),
    ),
    ...canonical.meloProposals.map((proposal) =>
      timelineEvent({
        amountMinor: undefined,
        canonical,
        date: proposal.createdAt.slice(0, 10),
        detail: 'Melo proposal is review-only and cannot write directly',
        evidence: {
          actionPath: 'review',
          authorityState: proposal.authorityState,
          linkedRecords: [{ kind: 'Melo proposal', id: String(proposal.id) }],
          provenanceId: stringOrUndefined(proposal.provenanceId),
          recordId: String(proposal.id),
          recordKind: 'Melo proposal',
          reviewState: proposal.status,
          why: 'Melo suggested an interpretation for user review.',
        },
        kind: 'melo-proposal',
        kindLabel: 'Melo',
        title: proposal.title,
        tone: 'attention',
      }),
    ),
    ...canonical.auditLog.map((entry) =>
      timelineEvent({
        amountMinor: undefined,
        canonical,
        date: entry.occurredAt.slice(0, 10),
        detail: `${entry.actor} recorded ${entry.action.replaceAll('_', ' ')}`,
        evidence: {
          actionPath: entry.reversible ? 'undo' : 'inspect',
          authorityState: 'user-confirmed',
          linkedRecords: [
            { kind: 'audit entry', id: String(entry.id) },
            ...(entry.subjectId === undefined ? [] : [{ kind: 'subject', id: entry.subjectId }]),
          ],
          provenanceId: stringOrUndefined(entry.provenanceId),
          recordId: String(entry.id),
          recordKind: 'audit event',
          reviewState: entry.reversible ? 'reversible' : 'not reversible',
          why: 'An audit entry records a change to local data.',
        },
        kind: 'audit-change',
        kindLabel: 'Audit',
        title: entry.action.replaceAll('_', ' '),
        tone: entry.actor === 'melo' ? 'attention' : 'confirmed',
      }),
    ),
  ].sort(compareTimelineEvents);

  const factCount = events.filter((event) =>
    ['confirmed-record', 'reversed-record', 'void-record', 'refund', 'transfer'].includes(
      event.kind,
    ),
  ).length;
  const expectationCount = events.filter((event) => event.kind === 'expectation').length;
  const reviewCount = events.filter(
    (event) =>
      [
        'pending-record',
        'imported-claim',
        'planner-item',
        'melo-proposal',
        'document-attachment',
      ].includes(event.kind) ||
      (event.kind === 'balance-event' && event.tone === 'attention'),
  ).length;
  const firstReview = events.find((event) => event.tone === 'attention');
  const renderedMelo = renderDeterministicMeloBriefing({
    state: reviewCount > 0 ? 'attention' : events.length > 0 ? 'changed' : 'quiet',
    positionLine: `${events.length} timeline entr${events.length === 1 ? 'y is' : 'ies are'} available.`,
    assumptions: ['Your timeline is rebuilt from local records and what is waiting to check.'],
    facts: events.slice(0, 3).map((event) => {
      const sourceId = event.evidence.provenanceId ?? event.evidence.sourceRecordId;
      return {
        id: `${event.kind}:${event.title}`,
        label: event.kindLabel,
        value: event.title,
        certainty: event.tone === 'confirmed' ? ('confirmed' as const) : ('partial' as const),
        ...(sourceId === undefined ? {} : { sourceId }),
      };
    }),
    tone: defaultMeloTonePreferences,
    dataAsOf: options.asOfDate,
    ...(firstReview?.title === undefined ? {} : { nextImportant: firstReview.title }),
    ...(events[0]?.title === undefined ? {} : { changed: events[0].title }),
  });
  const meloBriefingText = gateMeloText(
    renderedMelo.text,
    'Your timeline is built from local records. What is waiting to check stays separate from facts.',
  );

  return {
    events,
    factCount,
    expectationCount,
    reviewCount,
    sourceLabel: options.sourceLabel ?? 'Local records',
    meloBriefingText,
    accessibilitySummary: `Timeline has ${factCount} confirmed financial record${
      factCount === 1 ? '' : 's'
    }, ${expectationCount} expectation${expectationCount === 1 ? '' : 's'}, and ${reviewCount} review item${
      reviewCount === 1 ? '' : 's'
    }. ${meloBriefingText}`,
  };
}

function balanceObservationTitle(
  observation: CanonicalRepositoryCollections['balanceObservations'][number],
): string {
  if (observation.observationKind === 'provider-balance') return 'Provider balance imported';
  if (observation.observationKind === 'imported-statement-balance') {
    return observation.reconciliationState === 'unreconciled'
      ? 'Discrepancy detected'
      : 'Statement balance imported';
  }
  if (observation.sourceKind === 'calculated' && observation.reviewState === 'needs-review') {
    return 'Balance needs source';
  }
  if (observation.observationKind === 'opening-balance') return 'Opening balance set';
  if (observation.observationKind === 'balance-correction') return 'Balance corrected';
  if (observation.observationKind === 'reconciled-balance') return 'Account reconciled';
  return 'Balance updated';
}

function balanceObservationDetail(
  observation: CanonicalRepositoryCollections['balanceObservations'][number],
): string {
  if (observation.sourceKind === 'provider-reported') {
    return 'Provider-reported balance; reported fact, not final truth until reconciled';
  }
  if (observation.sourceKind === 'imported-statement') {
    return observation.reconciliationState === 'unreconciled'
      ? 'Imported statement balance does not reconcile yet'
      : 'Imported statement balance; review state remains visible';
  }
  if (observation.sourceKind === 'calculated') {
    return observation.reviewState === 'needs-review'
      ? 'Needs a source before this can be treated as a real balance'
      : 'Calculated from reviewed local records';
  }
  if (observation.observationKind === 'opening-balance') {
    return 'User-entered opening balance used as the current position anchor';
  }
  return 'Balance observation recorded with authority and review state';
}

function balanceTone(authorityState: string, reviewState: string): LocalTimelineTone {
  if (reviewState === 'needs-review') return 'attention';
  if (authorityState === 'provider-reported' || authorityState === 'imported-claim') {
    return 'estimated';
  }
  if (authorityState === 'inferred' || authorityState === 'estimated') return 'estimated';
  return 'confirmed';
}

function activeReviewImportDrafts(
  canonical: CanonicalRepositoryCollections,
): CanonicalRepositoryCollections['importDrafts'] {
  return canonical.importDrafts.filter(
    (draft) => draft.reviewState !== 'dismissed' && draft.userConfirmationState !== 'rejected',
  );
}

function timelineEvent(
  input: Readonly<{
    amountMinor: number | undefined;
    canonical: CanonicalRepositoryCollections;
    date: string;
    detail: string;
    evidence: Parameters<typeof canonicalEvidenceForRecord>[1];
    kind: LocalTimelineEntryKind;
    kindLabel: string;
    title: string;
    tone: LocalTimelineTone;
  }>,
): LocalTimelineEvent {
  const evidence = canonicalEvidenceForRecord(input.canonical, input.evidence);
  return {
    date: input.date,
    day: timelineDayLabel(input.date, input.canonical.forecastSnapshots[0]?.asOf ?? input.date),
    title: input.title,
    detail: `${input.detail}. ${evidence.summary}`,
    amount: input.amountMinor === undefined ? '' : formatMinorAmount(input.amountMinor),
    tone: input.tone,
    kind: input.kind,
    kindLabel: input.kindLabel,
    evidence,
  };
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

function titleForExpectation(
  canonical: CanonicalRepositoryCollections,
  expectationId: string,
): string {
  const expectation = canonical.expectations.find((row) => String(row.id) === expectationId);
  const commitment =
    expectation?.commitmentId === undefined
      ? undefined
      : canonical.commitments.find((row) => row.id === expectation.commitmentId);
  const event = canonical.events.find((row) =>
    row.expectationIds.some((id) => String(id) === expectationId),
  );
  return commitment?.title ?? event?.title ?? expectation?.reference ?? 'Expected item';
}

function compareTimelineEvents(left: LocalTimelineEvent, right: LocalTimelineEvent): number {
  const dateComparison = (left.date ?? '').localeCompare(right.date ?? '');
  if (dateComparison !== 0) return dateComparison;
  const kindComparison = timelineKindWeight(left.kind) - timelineKindWeight(right.kind);
  if (kindComparison !== 0) return kindComparison;
  return left.title.localeCompare(right.title);
}

function timelineKindWeight(kind: LocalTimelineEntryKind): number {
  if (
    kind === 'confirmed-record' ||
    kind === 'reversed-record' ||
    kind === 'void-record' ||
    kind === 'refund' ||
    kind === 'transfer'
  )
    return 0;
  if (kind === 'meaning-event') return 1;
  if (kind === 'audit-change') return 2;
  if (kind === 'decision-record') return 3;
  if (kind === 'imported-claim' || kind === 'pending-record') return 4;
  if (kind === 'document-attachment') return 5;
  if (kind === 'melo-proposal') return 6;
  if (kind === 'planner-item') return 7;
  if (kind === 'expectation') return 8;
  if (kind === 'commitment') return 9;
  if (kind === 'plan-change') return 10;
  return 11;
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

function stringOrUndefined(value: unknown): string | undefined {
  return value === undefined ? undefined : String(value);
}
