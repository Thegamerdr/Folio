import { describe, expect, it } from 'vitest';
import {
  createForecastId,
  createInstantString,
  createLocalDate,
  createMoney,
  createProvenanceId,
  createScenarioId,
  createWorkspaceId,
  type DecisionLedgerEntry,
  type DecisionLedgerSafeRangeSnapshot,
} from '@folio/domain';

import {
  addCorrection,
  attachSafeRange,
  cancelDecision,
  createDecisionDraft,
  decisionLedgerGroups,
  deleteDecision,
  disableDecisionLearning,
  evaluateDecisionMateriality,
  evaluateForecast,
  expireDecision,
  exportDecisionLedger,
  markAwaitingOutcome,
  markPresented,
  receiptSummary,
  recordChoice,
  recordConsent,
  removeDecisionLearning,
  resolveOutcome,
} from './decisionLedger';

const personal = createWorkspaceId('workspace_personal_main');
const business = createWorkspaceId('workspace_business_acme');
const now = '2026-07-20T10:00:00.000Z';

function safeRange(): DecisionLedgerSafeRangeSnapshot {
  return {
    forecastVersionId: createForecastId('forecast_safe_range_snapshot'),
    provenanceId: createProvenanceId('provenance_safe_range_snapshot'),
    calculatedAt: createInstantString(now),
    horizonStartISO: createLocalDate('2026-07-20'),
    horizonEndISO: createLocalDate('2026-08-20'),
    status: 'caution',
    reliance: 'use_caution',
    freshness: 'fresh',
    currentKnownPosition: createMoney({ minorUnits: 120_000, currency: 'GBP' }),
    knownCommittedFloor: createMoney({ minorUnits: 70_000, currency: 'GBP' }),
    expectedSafeMin: createMoney({ minorUnits: 20_000, currency: 'GBP' }),
    expectedSafeMax: createMoney({ minorUnits: 30_000, currency: 'GBP' }),
    conservativeBoundary: createMoney({ minorUnits: 15_000, currency: 'GBP' }),
    tightestPointDateISO: createLocalDate('2026-08-01'),
    tightestPointAmount: createMoney({ minorUnits: 20_000, currency: 'GBP' }),
    shortfall: null,
    missingMaterialInfo: ['latest subscription renewal'],
    assumptions: ['usual weekly food spend'],
    sourceFactIds: ['fact_current_balance'],
    canUserRelyOnAnswer: false,
  };
}

function draft(overrides: Partial<Parameters<typeof createDecisionDraft>[1]> = {}) {
  const result = createDecisionDraft([], {
    idempotencyKey: 'spend_lunch_decision',
    workspaceId: personal,
    workspaceKind: 'personal',
    decisionType: 'purchase-affordability',
    contextRoute: 'whatif',
    question: 'Can I spend £40 today?',
    amountMinor: -4_000,
    bufferDeltaMinor: -4_000,
    now,
    safeRange: safeRange(),
    ...overrides,
  });
  expect(result.accepted).toBe(true);
  expect(result.entry).not.toBeNull();
  return { entries: result.entries, entry: result.entry! };
}

describe('Decision Ledger materiality', () => {
  it('accepts cash effects at or above £10', () => {
    expect(
      evaluateDecisionMateriality({
        decisionType: 'purchase-affordability',
        amountMinor: -1_000,
      }).accepted,
    ).toBe(true);
  });

  it('rejects non-material events below deterministic thresholds', () => {
    expect(
      createDecisionDraft([], {
        idempotencyKey: 'tap_non_material',
        workspaceId: personal,
        workspaceKind: 'personal',
        decisionType: 'purchase-affordability',
        contextRoute: 'today',
        question: 'Tiny tap',
        amountMinor: -99,
        now,
      }),
    ).toMatchObject({ accepted: false, entry: null });
  });

  it('does not treat confirmation alone as material', () => {
    expect(
      createDecisionDraft([], {
        idempotencyKey: 'tiny_confirmed_tool',
        workspaceId: personal,
        workspaceKind: 'personal',
        decisionType: 'melo-confirmed-action',
        contextRoute: 'melo',
        question: 'Confirmed tiny correction',
        amountMinor: 99,
        confirmedAction: true,
        now,
      }),
    ).toMatchObject({ accepted: false, entry: null });
  });

  it('treats payday plans as material accountability moments', () => {
    expect(
      evaluateDecisionMateriality({ decisionType: 'payday-plan', amountMinor: 0 }).ruleIds,
    ).toContain('cycle-close-accountability');
  });

  it('keeps Business Decision Ledger out of Phase D by default', () => {
    expect(
      createDecisionDraft([], {
        idempotencyKey: 'business_runway_choice',
        workspaceId: business,
        workspaceKind: 'business',
        decisionType: 'scenario-choice',
        contextRoute: 'business-runway',
        question: 'Choose runway plan',
        amountMinor: 50_000,
        now,
      }),
    ).toMatchObject({
      accepted: false,
      reason: 'Business Decision Ledger is out of Phase D scope.',
    });
  });

  it('can be explicitly enabled for future Business migrations without changing Personal rules', () => {
    const result = createDecisionDraft([], {
      idempotencyKey: 'business_future_enabled',
      workspaceId: business,
      workspaceKind: 'business',
      enableBusinessWorkspace: true,
      decisionType: 'scenario-choice',
      contextRoute: 'business-runway',
      question: 'Choose runway plan',
      amountMinor: 50_000,
      now,
    });
    expect(result.entry?.workspaceId).toBe(business);
  });
});

describe('Decision Ledger lifecycle', () => {
  it('creates a draft with Safe Range and forecast snapshots, not full AppState', () => {
    const { entry } = draft();
    expect(entry.safeRange?.forecastVersionId).toBe(
      createForecastId('forecast_safe_range_snapshot'),
    );
    expect(entry.forecast?.predictedTightestPoint?.minorUnits).toBe(20_000);
    expect(JSON.stringify(entry)).not.toContain('transactions');
    expect(JSON.stringify(entry)).not.toContain('readerCandidates');
  });

  it('does not duplicate entries for repeated callbacks with the same idempotency key', () => {
    const first = draft();
    const second = createDecisionDraft(first.entries, {
      idempotencyKey: 'spend_lunch_decision',
      workspaceId: personal,
      workspaceKind: 'personal',
      decisionType: 'purchase-affordability',
      contextRoute: 'whatif',
      question: 'Can I spend £40 today?',
      amountMinor: -4_000,
      now,
    });
    expect(second.entries).toHaveLength(1);
    expect(second.entry?.id).toBe(first.entry.id);
  });

  it('marks a decision presented', () => {
    const { entry, entries } = draft();
    const result = markPresented(entries, entry.id, now, 'present-command');
    expect(result.entry?.status).toBe('presented');
    expect(result.entry?.presentedAt).toBe(createInstantString(now));
  });

  it('records accepted choices', () => {
    const { entry, entries } = draft();
    const result = recordChoice(entries, {
      entryId: entry.id,
      state: 'accepted',
      selectedMoveIds: ['move_hold'],
      now,
      commandId: 'choice-command',
    });
    expect(result.entry?.userChoice).toMatchObject({
      state: 'accepted',
      selectedMoveIds: ['move_hold'],
    });
  });

  it('records rejected and deferred choices without resolving outcomes', () => {
    const { entry, entries } = draft();
    const rejected = recordChoice(entries, { entryId: entry.id, state: 'rejected', now });
    const deferred = recordChoice(entries, { entryId: entry.id, state: 'deferred', now });
    expect(rejected.entry?.outcome.state).toBe('unknown');
    expect(deferred.entry?.userChoice.state).toBe('deferred');
  });

  it('records consent as a separate audit step', () => {
    const { entry, entries } = draft();
    const result = recordConsent(entries, {
      entryId: entry.id,
      required: true,
      granted: true,
      label: 'Use this to improve future reminders',
      sourceControlId: 'decision-learning',
      now,
    });
    expect(result.entry?.consent).toMatchObject({ required: true, granted: true });
    expect(result.entry?.audit.map((event) => event.action)).toContain('consent_recorded');
  });

  it('marks entries awaiting outcome', () => {
    const { entry, entries } = draft();
    expect(markAwaitingOutcome(entries, entry.id, now).entry?.status).toBe('awaiting-outcome');
  });

  it('resolves as-expected outcomes once', () => {
    const { entry, entries } = draft();
    const result = resolveOutcome(entries, {
      entryId: entry.id,
      state: 'as-expected',
      actualCashDeltaMinor: -3_500,
      forecastErrorMinor: 500,
      now,
    });
    expect(result.entry?.status).toBe('resolved');
    expect(result.entry?.outcome.forecastError?.minorUnits).toBe(500);
    expect(
      resolveOutcome(result.entries, {
        entryId: entry.id,
        state: 'worse-than-expected',
        now: '2026-07-21T10:00:00.000Z',
      }).accepted,
    ).toBe(false);
  });

  it('supports required outcome states without inventing success from silence', () => {
    const states: Array<DecisionLedgerEntry['outcome']['state']> = [
      'better-than-expected',
      'worse-than-expected',
      'partially-observed',
      'not-observed',
      'invalidated-by-new-information',
      'user-reversed',
      'expired',
    ];
    for (const state of states) {
      const created = draft({ idempotencyKey: `outcome_${state}` });
      expect(
        resolveOutcome(created.entries, { entryId: created.entry.id, state, now }).entry?.outcome
          .state,
      ).toBe(state);
    }
  });

  it('cancels and expires drafts without inventing an actual outcome', () => {
    const cancelled = draft({ idempotencyKey: 'cancel_me' });
    const expired = draft({ idempotencyKey: 'expire_me' });
    expect(cancelDecision(cancelled.entries, cancelled.entry.id, now).entry?.status).toBe(
      'cancelled',
    );
    expect(cancelDecision(cancelled.entries, cancelled.entry.id, now).entry?.outcome.state).toBe(
      'user-reversed',
    );
    expect(expireDecision(expired.entries, expired.entry.id, now).entry?.outcome.state).toBe(
      'expired',
    );
  });
});

describe('Forecast accountability', () => {
  it('classifies actuals inside the predicted range', () => {
    const { entry, entries } = draft();
    const result = evaluateForecast(entries, {
      entryId: entry.id,
      actualTightestPointMinor: 25_000,
      now,
    });
    expect(result.entry?.forecastEvaluations[0]?.classification).toBe('inside_range');
  });

  it('classifies conservative outcomes above the conservative boundary', () => {
    const { entry, entries } = draft();
    const result = evaluateForecast(entries, {
      entryId: entry.id,
      actualTightestPointMinor: 16_000,
      now,
    });
    expect(result.entry?.forecastEvaluations[0]?.classification).toBe('conservative');
  });

  it('classifies outside-range misses below the conservative boundary', () => {
    const { entry, entries } = draft();
    const result = evaluateForecast(entries, {
      entryId: entry.id,
      actualTightestPointMinor: 12_000,
      now,
    });
    expect(result.entry?.forecastEvaluations[0]?.classification).toBe('outside_range');
  });

  it('keeps the evaluation unknown when actuals cannot be checked', () => {
    const { entry, entries } = draft();
    const result = evaluateForecast(entries, { entryId: entry.id, now });
    expect(result.entry?.forecastEvaluations[0]).toMatchObject({
      classification: 'unknown',
    });
    expect(result.entry?.forecastEvaluations[0]).not.toHaveProperty('confidence');
  });
});

describe('Corrections, privacy and workspace isolation', () => {
  it('adds corrections without rewriting the original question', () => {
    const { entry, entries } = draft();
    const result = addCorrection(entries, {
      entryId: entry.id,
      field: 'actualCashDelta',
      before: -4000,
      after: -3500,
      reason: 'Receipt settled for less.',
      recalculatesForecast: true,
      now,
    });
    expect(result.entry?.question.text).toBe('Can I spend £40 today?');
    expect(result.entry?.corrections[0]).toMatchObject({ recalculatesForecast: true });
  });

  it('disables learning without deleting the receipt', () => {
    const created = draft({ idempotencyKey: 'learning_on', learningPermitted: true });
    const result = disableDecisionLearning(created.entries, created.entry.id, now);
    expect(result.entry?.learning.permitted).toBe(false);
    expect(result.entry?.learning.disabledAt).toBe(createInstantString(now));
  });

  it('removes learning references but keeps the accountable receipt', () => {
    const created = draft({ idempotencyKey: 'remove_learning', learningPermitted: true });
    const result = removeDecisionLearning(created.entries, created.entry.id, now);
    expect(result.entry?.learning.memoryRefs).toEqual([]);
    expect(result.entry?.status).toBe('draft');
  });

  it('deletes a receipt from durable exportable entries', () => {
    const { entry, entries } = draft();
    const deleted = deleteDecision(entries, entry.id, now);
    expect(deleted.entries).toEqual([]);
    expect(deleted.entry?.status).toBe('deleted');
  });

  it('exports only the requested workspace and excludes deleted entries', () => {
    const personalEntry = draft({ idempotencyKey: 'personal_export' }).entry;
    const businessEntry = draft({
      idempotencyKey: 'business_export',
      workspaceId: business,
      workspaceKind: 'business',
      enableBusinessWorkspace: true,
    }).entry;
    expect(exportDecisionLedger([personalEntry, businessEntry], personal)).toEqual([personalEntry]);
    expect(
      exportDecisionLedger([personalEntry, { ...businessEntry, status: 'deleted' }], business),
    ).toEqual([]);
  });

  it('groups Decision History into the three required buckets', () => {
    const awaitingDraft = draft({ idempotencyKey: 'awaiting' });
    const awaiting = markAwaitingOutcome(awaitingDraft.entries, awaitingDraft.entry.id, now);
    const resolvedDraft = draft({ idempotencyKey: 'resolved' });
    const resolved = resolveOutcome(resolvedDraft.entries, {
      entryId: resolvedDraft.entry.id,
      state: 'as-expected',
      now,
    }).entry!;
    const cancelledDraft = draft({ idempotencyKey: 'cancelled' });
    const cancelled = cancelDecision(cancelledDraft.entries, cancelledDraft.entry.id, now);
    const groups = decisionLedgerGroups([
      awaiting.entry!,
      resolved,
      ...(cancelled.entry ? [cancelled.entry] : []),
    ]);
    expect(groups.awaitingOutcome).toHaveLength(1);
    expect(groups.recentlyResolved).toHaveLength(1);
    expect(groups.draftOrCancelled).toHaveLength(1);
  });

  it('renders a receipt without AI output', () => {
    const { entry } = draft();
    expect(receiptSummary(entry)).toEqual(
      expect.arrayContaining(['Can I spend £40 today?', 'Decision: purchase-affordability']),
    );
  });

  it('keeps Safe Range snapshot arrays immutable from caller mutation', () => {
    const snapshot = safeRange();
    const created = draft({ idempotencyKey: 'immutable_snapshot', safeRange: snapshot });
    (snapshot.missingMaterialInfo as string[]).push('mutated after recording');
    expect(created.entry.safeRange?.missingMaterialInfo).toEqual(['latest subscription renewal']);
  });

  it('keeps scenario snapshots immutable from caller mutation', () => {
    const scenario = {
      id: createScenarioId('scenario_lunch_wait'),
      label: 'Wait until tomorrow',
      forecastVersionId: createForecastId('forecast_scenario_wait'),
      summary: 'No spend today.',
      assumptionFactIds: ['fact_food_spend'],
      expectedCashDelta: createMoney({ minorUnits: 4_000, currency: 'GBP' }),
      expectedBufferDelta: createMoney({ minorUnits: 4_000, currency: 'GBP' }),
      risk: 'low' as const,
    };
    const created = draft({
      idempotencyKey: 'immutable_scenario',
      scenarios: [scenario],
    });

    scenario.label = 'Mutated after recording';
    scenario.assumptionFactIds.push('mutated_fact');
    (scenario.expectedCashDelta as { minorUnits: number }).minorUnits = 999_999;

    expect(created.entry.scenarios[0]).toMatchObject({
      label: 'Wait until tomorrow',
      assumptionFactIds: ['fact_food_spend'],
    });
    expect(created.entry.scenarios[0]?.expectedCashDelta?.minorUnits).toBe(4_000);
  });

  it('retains contradicted and stale facts instead of rewriting decision history', () => {
    const created = draft({
      idempotencyKey: 'truth_snapshot_retention',
      factSnapshots: [
        {
          factId: 'fact_balance_conflict',
          label: 'Balance from old statement',
          workspaceId: personal,
          truthClass: 'contradicted',
          sourceType: 'statement_import',
          sourceRef: 'statement-old',
          capturedAt: createInstantString('2026-07-01T00:00:00.000Z'),
          confirmedAt: null,
          expiresAt: createInstantString('2026-07-10T00:00:00.000Z'),
          freshness: 'stale',
          amount: createMoney({ minorUnits: 80_000, currency: 'GBP' }),
          assumptions: ['statement may be superseded'],
          derivedFrom: ['statement_row_1'],
          correctionOf: null,
        },
      ],
      contradictions: [
        {
          id: 'contradiction_balance',
          label: 'Statement balance conflicts with confirmed bank balance',
          impact: 'widens_range',
          sourceFactIds: ['fact_balance_conflict'],
        },
      ],
    });

    expect(created.entry.factSnapshots[0]).toMatchObject({
      truthClass: 'contradicted',
      freshness: 'stale',
      assumptions: ['statement may be superseded'],
    });
    expect(created.entry.contradictions[0]?.sourceFactIds).toEqual(['fact_balance_conflict']);
  });

  it('rejects malformed forecast snapshots at the command boundary', () => {
    const result = createDecisionDraft([], {
      idempotencyKey: 'bad_forecast',
      workspaceId: personal,
      workspaceKind: 'personal',
      decisionType: 'purchase-affordability',
      contextRoute: 'whatif',
      question: 'Can I spend £40 today?',
      amountMinor: -4_000,
      forecast: {
        forecastVersionId: createForecastId('forecast_bad_dates'),
        createdAt: createInstantString(now),
        horizonStartISO: createLocalDate('2026-08-20'),
        horizonEndISO: createLocalDate('2026-07-20'),
        predictedTightestPoint: null,
        predictedEndPosition: null,
        predictedSafeMin: null,
        predictedSafeMax: null,
        conservativeBoundary: null,
        sourceFactIds: [],
      },
      now,
    });
    expect(result).toMatchObject({
      accepted: false,
      entry: null,
      reason: 'Rejected: malformed forecast snapshot.',
    });
  });
});
