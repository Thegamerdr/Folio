import { describe, expect, it } from 'vitest';

import {
  chooseCurrentFinancialTruth,
  canonicalAuthorityStates,
  createAccount,
  createAuditLogId,
  createBalanceObservation,
  createCalendarItemId,
  createCommitmentId,
  createDecisionRecordId,
  createDocumentId,
  createEntityVersion,
  createEventId,
  createExpectationId,
  createFinancialExpectation,
  createForecastId,
  createImportDraftId,
  createInstantString,
  createLocalDate,
  createLocalDateTime,
  createLocalTime,
  localDateFromInstant,
  createMeloMemoryId,
  createMeloProposalId,
  createMoney,
  createPlanId,
  createPlannerItemId,
  createProvenanceId,
  createScenarioId,
  createTimeZoneId,
  createTransaction,
  createTransactionId,
  createTransactionSplit,
  createTransferLink,
  createWorkspace,
  createSourceRecordId,
  createTimelineEntryId,
  createWorkspaceId,
  isTransferPairNetNeutral,
  nextEntityVersion,
  reconcileActualWithExpectation,
  type AuditLogEntry,
  type CalendarItem,
  type Commitment,
  type DecisionRecord,
  type DocumentRecord,
  type Event,
  type Forecast,
  type ImportDraft,
  type MeloMemory,
  type MeloProposalRecord,
  type Plan,
  type PlannerItem,
  type Provenance,
  type Scenario,
  type SourceRecord,
  type TimelineEntry,
} from '../src/index.js';

describe('local date and time value objects', () => {
  it('separates local dates, local times, time zones, and instants', () => {
    expect(createLocalDate('2028-02-29')).toBe('2028-02-29');
    expect(createLocalTime('09:30')).toBe('09:30:00');
    expect(createLocalDateTime('2026-06-20T09:30')).toBe('2026-06-20T09:30:00');
    expect(createTimeZoneId('Europe/London')).toBe('Europe/London');
    expect(createInstantString('2026-06-20T12:00:00Z')).toBe('2026-06-20T12:00:00.000Z');

    expect(() => createLocalDate('2026-02-29')).toThrow(/Invalid local date/);
    expect(() => createLocalTime('24:00')).toThrow(/Invalid local time/);
    expect(() => createTimeZoneId('Not/AZone')).toThrow(/Invalid time zone/);
    expect(() => createInstantString('2026-06-20T12:00:00')).toThrow(/UTC instant/);
  });

  it('converts instants to explicit workspace-local calendar dates', () => {
    const london = createTimeZoneId('Europe/London');
    const newYork = createTimeZoneId('America/New_York');

    expect(localDateFromInstant(new Date('2026-08-16T23:30:00Z'), london)).toBe('2026-08-17');
    expect(localDateFromInstant('2026-08-16T00:30:00Z', london)).toBe('2026-08-16');
    expect(localDateFromInstant('2026-12-31T23:30:00Z', london)).toBe('2026-12-31');
    expect(localDateFromInstant('2028-02-29T12:00:00Z', london)).toBe('2028-02-29');
    expect(localDateFromInstant('2026-08-17T02:30:00Z', newYork)).toBe('2026-08-16');
  });

  it('rejects invalid instants and unvalidated time zones', () => {
    const london = createTimeZoneId('Europe/London');
    expect(() => localDateFromInstant(new Date('invalid'), london)).toThrow(/Invalid instant/);
    expect(() => localDateFromInstant('not-an-instant', london)).toThrow(/Invalid instant/);
    expect(() =>
      localDateFromInstant('2026-08-16T12:00:00Z', 'Not/AZone' as typeof london),
    ).toThrow(/Invalid time zone/);
  });
});

describe('IDs, versions, and workspace aggregate', () => {
  it('creates opaque IDs and monotonic entity versions', () => {
    const version = createEntityVersion({ revision: 3, dataVersion: 'ledger:abc123' });

    expect(createWorkspaceId('workspace_personal_main')).toBe('workspace_personal_main');
    expect(createSourceRecordId('source_statement_row')).toBe('source_statement_row');
    expect(version).toEqual({ revision: 3, dataVersion: 'ledger:abc123' });
    expect(nextEntityVersion(version, 'ledger:def456')).toEqual({
      revision: 4,
      dataVersion: 'ledger:def456',
    });
    expect(() => createWorkspaceId('personal')).toThrow(/workspace_/);
  });

  it('creates a workspace with explicit jurisdiction, currency, and timezone', () => {
    const workspace = createWorkspace({
      id: 'workspace_personal_main',
      kind: 'personal',
      name: 'Personal',
      baseCurrency: 'gbp',
      jurisdiction: 'gb',
      timeZone: 'Europe/London',
    });

    expect(workspace).toMatchObject({
      id: 'workspace_personal_main',
      kind: 'personal',
      name: 'Personal',
      baseCurrency: 'GBP',
      jurisdiction: 'GB',
      timeZone: 'Europe/London',
    });
  });
});

describe('canonical authority states and ontology contracts', () => {
  it('exports the locked authority states without collapsed certainty shortcuts', () => {
    expect(canonicalAuthorityStates).toEqual([
      'confirmed',
      'user-confirmed',
      'provider-reported',
      'imported-claim',
      'inferred',
      'estimated',
      'hypothetical',
      'superseded',
      'reversed',
    ]);
    expect(canonicalAuthorityStates).not.toContain('reported');
    expect(canonicalAuthorityStates).not.toContain('expected');
  });

  it('models canonical objects without forcing transactions to become events', () => {
    const version = createEntityVersion();
    const workspaceId = createWorkspaceId('workspace_personal_main');
    const capturedAt = createInstantString('2026-06-22T09:00:00Z');
    const localDate = createLocalDate('2026-06-22');
    const sourceRecordId = createSourceRecordId('source_statement_row');
    const provenanceId = createProvenanceId('provenance_statement_row');
    const importDraftId = createImportDraftId('importdraft_statement_row');
    const transactionId = createTransactionId('transaction_rent_actual');
    const expectationId = createExpectationId('expectation_rent_june');
    const eventId = createEventId('event_rent_paid');
    const commitmentId = createCommitmentId('commitment_rent_june');
    const plannerItemId = createPlannerItemId('planner_review_rent');
    const planId = createPlanId('plan_recovery_june');
    const scenarioId = createScenarioId('scenario_june_preview');
    const forecastId = createForecastId('forecast_june_route');
    const decisionId = createDecisionRecordId('decision_confirm_rent');
    const documentId = createDocumentId('document_statement_june');
    const calendarItemId = createCalendarItemId('calendar_rent_due');
    const timelineEntryId = createTimelineEntryId('timeline_rent_paid');
    const memoryId = createMeloMemoryId('memory_import_correction');
    const proposalId = createMeloProposalId('proposal_label_rent');
    const auditId = createAuditLogId('audit_confirm_rent');
    const rentAmount = createMoney({ minorUnits: -73500, currency: 'GBP' });
    const sourceRecord = {
      id: sourceRecordId,
      workspaceId,
      kind: 'statement-row',
      authorityState: 'imported-claim',
      label: 'Statement row 4',
      capturedAt,
      sourceHash: 'sha256:statement-row-4',
      version,
    } satisfies SourceRecord;
    const provenance = {
      id: provenanceId,
      workspaceId,
      authorityState: 'imported-claim',
      sourceRecordIds: [sourceRecord.id],
      links: [{ relationship: 'evidences', fromId: sourceRecord.id, toId: transactionId }],
      createdAt: capturedAt,
      version,
    } satisfies Provenance;
    const importDraft = {
      id: importDraftId,
      workspaceId,
      sourceRecordId: sourceRecord.id,
      proposedTransactionId: transactionId,
      authorityState: 'imported-claim',
      reviewState: 'needs-review',
      userConfirmationState: 'requested',
      parserIssues: [{ code: 'ambiguous_date', message: 'Needs date review.', severity: 'review' }],
      provenanceId: provenance.id,
      version,
    } satisfies ImportDraft;
    const event = {
      id: eventId,
      workspaceId,
      kind: 'payment',
      title: 'Rent paid',
      localDate,
      authorityState: 'user-confirmed',
      version,
      transactionIds: [transactionId],
      expectationIds: [expectationId],
      sourceRecordIds: [sourceRecord.id],
      provenanceId: provenance.id,
    } satisfies Event;
    const commitment = {
      id: commitmentId,
      workspaceId,
      kind: 'bill',
      title: 'Rent',
      amount: rentAmount,
      dueDate: localDate,
      authorityState: 'user-confirmed',
      reviewState: 'user-confirmed',
      version,
      provenanceId: provenance.id,
    } satisfies Commitment;
    const plannerItem = {
      id: plannerItemId,
      workspaceId,
      kind: 'review',
      title: 'Review rent variance',
      dueDate: localDate,
      status: 'open',
      authorityState: 'inferred',
      version,
      linkedEventId: event.id,
      provenanceId: provenance.id,
    } satisfies PlannerItem;
    const plan = {
      id: planId,
      workspaceId,
      title: 'Recover June route',
      status: 'active',
      authorityState: 'user-confirmed',
      createdAt: capturedAt,
      version,
      commitmentIds: [commitment.id],
      scenarioIds: [scenarioId],
      provenanceId: provenance.id,
    } satisfies Plan;
    const scenario = {
      id: scenarioId,
      workspaceId,
      title: 'Move flexible spend',
      status: 'previewed',
      authorityState: 'hypothetical',
      createdAt: capturedAt,
      version,
      assumptionIds: [expectationId],
      affectedPlanIds: [plan.id],
      provenanceId: provenance.id,
    } satisfies Scenario;
    const forecast = {
      id: forecastId,
      workspaceId,
      asOf: localDate,
      authorityState: 'estimated',
      createdAt: capturedAt,
      sourceIds: [transactionId, expectationId, commitment.id, scenario.id],
      version,
      provenanceId: provenance.id,
    } satisfies Forecast;
    const decision = {
      id: decisionId,
      workspaceId,
      kind: 'confirm-import',
      decidedAt: capturedAt,
      actor: 'user',
      summary: 'User confirmed imported rent row.',
      affectedIds: [importDraft.id, transactionId],
      version,
      provenanceId: provenance.id,
    } satisfies DecisionRecord;
    const document = {
      id: documentId,
      workspaceId,
      kind: 'statement',
      filename: 'statement.csv',
      capturedAt,
      authorityState: 'imported-claim',
      sourceHash: 'sha256:statement',
      version,
      provenanceId: provenance.id,
    } satisfies DocumentRecord;
    const calendarItem = {
      id: calendarItemId,
      workspaceId,
      kind: 'commitment',
      title: 'Rent due',
      localDate,
      authorityState: 'user-confirmed',
      version,
      commitmentId: commitment.id,
      provenanceId: provenance.id,
    } satisfies CalendarItem;
    const timelineEntry = {
      id: timelineEntryId,
      workspaceId,
      kind: 'fact',
      title: 'Rent paid',
      localDate,
      authorityState: 'user-confirmed',
      subjectId: event.id,
      version,
      provenanceId: provenance.id,
    } satisfies TimelineEntry;
    const memory = {
      id: memoryId,
      workspaceId,
      authorityState: 'user-confirmed',
      reviewState: 'user-confirmed',
      value: 'Rent rows use housing label.',
      createdAt: capturedAt,
      version,
      provenanceId: provenance.id,
    } satisfies MeloMemory;
    const proposal = {
      id: proposalId,
      workspaceId,
      title: 'Label rent row',
      status: 'needs-review',
      authorityState: 'inferred',
      createdAt: capturedAt,
      proposedCommand: 'SuggestImportLabel',
      canWriteDirectly: false,
      version,
      provenanceId: provenance.id,
    } satisfies MeloProposalRecord;
    const audit = {
      id: auditId,
      workspaceId,
      actor: 'user',
      action: 'confirm-import',
      occurredAt: capturedAt,
      reversible: true,
      version,
      subjectId: decision.id,
      provenanceId: provenance.id,
    } satisfies AuditLogEntry;

    expect(event.transactionIds).toEqual([transactionId]);
    expect(forecast.sourceIds).toContain(scenario.id);
    expect(proposal.canWriteDirectly).toBe(false);
    expect(audit.reversible).toBe(true);
    expect([
      sourceRecord,
      provenance,
      importDraft,
      event,
      commitment,
      plannerItem,
      plan,
      scenario,
      forecast,
      decision,
      document,
      calendarItem,
      timelineEntry,
      memory,
      proposal,
      audit,
    ]).toHaveLength(16);
  });
});

describe('account, balance, transaction, split, and transfer invariants', () => {
  it('models account and balance states without deriving one from the other', () => {
    const account = createAccount({
      id: 'account_current_main',
      workspaceId: 'workspace_personal_main',
      name: 'Current',
      kind: 'bank',
      currency: 'GBP',
    });
    const balance = createBalanceObservation({
      id: 'balance_current_today',
      workspaceId: 'workspace_personal_main',
      accountId: 'account_current_main',
      observedOn: '2026-06-20',
      balance: { minorUnits: 100000, currency: 'GBP' },
      source: 'manual',
      reconciliationState: 'provisional',
    });

    expect(account.state).toBe('active');
    expect(balance.balance).toEqual(createMoney({ minorUnits: 100000, currency: 'GBP' }));
    expect(balance.reconciliationState).toBe('provisional');
  });

  it('requires transaction splits to sum exactly to the parent amount', () => {
    const splitA = createTransactionSplit({
      id: 'split_food_main',
      amount: { minorUnits: -3000, currency: 'GBP' },
      label: 'Food',
    });
    const splitB = createTransactionSplit({
      id: 'split_household_main',
      amount: { minorUnits: -2000, currency: 'GBP' },
      label: 'Household',
    });

    expect(
      createTransaction({
        id: 'transaction_grocery_posted',
        workspaceId: 'workspace_personal_main',
        accountId: 'account_current_main',
        status: 'posted',
        amount: { minorUnits: -5000, currency: 'GBP' },
        localDate: '2026-06-20',
        sourceKind: 'manual',
        certainty: 'confirmed',
        splits: [splitA, splitB],
      }).splits,
    ).toHaveLength(2);

    expect(() =>
      createTransaction({
        id: 'transaction_bad_split',
        workspaceId: 'workspace_personal_main',
        accountId: 'account_current_main',
        status: 'posted',
        amount: { minorUnits: -5000, currency: 'GBP' },
        localDate: '2026-06-20',
        sourceKind: 'manual',
        certainty: 'confirmed',
        splits: [splitA],
      }),
    ).toThrow(/sum exactly/);
  });

  it('links equal and opposite transfer movements as net neutral', () => {
    const debit = createTransaction({
      id: 'transaction_transfer_debit',
      workspaceId: 'workspace_personal_main',
      accountId: 'account_current_main',
      status: 'posted',
      amount: { minorUnits: -10000, currency: 'GBP' },
      localDate: '2026-06-21',
      sourceKind: 'manual',
      certainty: 'confirmed',
      transferLink: 'transfer_savings_move',
    });
    const credit = createTransaction({
      id: 'transaction_transfer_credit',
      workspaceId: 'workspace_personal_main',
      accountId: 'account_savings_main',
      status: 'posted',
      amount: { minorUnits: 10000, currency: 'GBP' },
      localDate: '2026-06-21',
      sourceKind: 'manual',
      certainty: 'confirmed',
      transferLink: 'transfer_savings_move',
    });

    expect(createTransferLink({ id: 'transfer_savings_move', debit, credit })).toMatchObject({
      amount: createMoney({ minorUnits: 10000, currency: 'GBP' }),
      debitTransactionId: 'transaction_transfer_debit',
      creditTransactionId: 'transaction_transfer_credit',
    });
    expect(isTransferPairNetNeutral(debit, credit)).toBe(true);
  });
});

describe('facts and expectations remain separate', () => {
  it('counts the actual transaction while retaining expectation variance', () => {
    const expectation = createFinancialExpectation({
      id: 'expectation_rent_june',
      workspaceId: 'workspace_personal_main',
      accountId: 'account_current_main',
      localDate: '2026-06-22',
      amount: { minorUnits: -73500, currency: 'GBP' },
      reference: 'RENT',
    });
    const actual = createTransaction({
      id: 'transaction_rent_actual',
      workspaceId: 'workspace_personal_main',
      accountId: 'account_current_main',
      status: 'posted',
      amount: { minorUnits: -73800, currency: 'GBP' },
      localDate: '2026-06-22',
      sourceKind: 'manual',
      certainty: 'confirmed',
      fulfils: 'expectation_rent_june',
      reference: 'RENT',
    });

    expect(
      chooseCurrentFinancialTruth({ transactions: [actual], expectations: [expectation] }),
    ).toEqual({
      transactionIds: ['transaction_rent_actual'],
      expectationIds: [],
    });
    expect(reconcileActualWithExpectation(actual, expectation)).toMatchObject({
      countedTransactionId: 'transaction_rent_actual',
      supersededExpectationId: 'expectation_rent_june',
      variance: createMoney({ minorUnits: -300, currency: 'GBP' }),
      questionType: 'recurring_amount_variance',
    });
  });
});
