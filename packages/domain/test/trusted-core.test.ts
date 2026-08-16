import { describe, expect, it } from 'vitest';

import {
  createCurrencyCode,
  createDecisionRecordId,
  createEntityVersion,
  createForecastId,
  createInstantString,
  createLocalDate,
  createMoney,
  createProvenanceId,
  createWorkspaceId,
  criticalJourneyIds,
  decisionLedgerStatuses,
  evaluateWorkspaceBoundary,
  materialFinancialChangeTypes,
  materialDecisionKinds,
  trustedCoreConfidenceLevels,
  trustedCoreFreshnessStates,
  trustedCoreMigrationPlan,
  trustedCoreResponsibilities,
  trustedCoreResponsibilityOwners,
  trustedCoreTruthClasses,
  trustedSafeRangeStatuses,
  trustedSafeRangeRelianceStates,
  type DecisionLedgerRecord,
  type TrustedCoreFactRef,
  type TrustedCoreProvenanceSnapshot,
  type TrustedSafeRangeResult,
} from '../src/index.js';

describe('Trusted Core truth vocabulary', () => {
  it('exports the canonical truth classes in product order', () => {
    expect(trustedCoreTruthClasses).toEqual([
      'verified',
      'user_confirmed',
      'observed',
      'inferred',
      'estimated',
      'predicted',
      'assumed',
      'missing',
      'stale',
      'contradicted',
      'sample_demo',
    ]);
    expect(trustedCoreConfidenceLevels).toEqual(['high', 'medium', 'low', 'blocked']);
    expect(trustedCoreFreshnessStates).toEqual(['fresh', 'ageing', 'stale', 'missing']);
    expect(trustedSafeRangeRelianceStates).toEqual([
      'safe_to_rely',
      'use_caution',
      'provisional',
      'blocked',
    ]);
    expect(trustedSafeRangeStatuses).toEqual([
      'ready',
      'caution',
      'shortfall',
      'insufficient_data',
      'stale',
      'contradicted',
      'sample_demo',
      'workspace_blocked',
    ]);
  });

  it('models fact provenance separately from a Safe Range answer', () => {
    const workspaceId = createWorkspaceId('workspace_personal_main');
    const capturedAt = createInstantString('2026-07-20T10:00:00Z');
    const expiresAt = createInstantString('2026-07-21T10:00:00Z');
    const provenanceId = createProvenanceId('provenance_trusted_core_fact');
    const fact = {
      factId: 'fact_current_balance',
      workspaceId,
      truthClass: 'user_confirmed',
      sourceType: 'manual_entry',
      sourceRef: 'balance-entry',
      capturedAt,
      confirmedAt: capturedAt,
      expiresAt,
      confidence: 'high',
      freshness: 'fresh',
      assumptions: [],
      derivedFrom: [],
      correctionOf: null,
      provenanceId,
    } satisfies TrustedCoreFactRef;
    const snapshot = {
      id: provenanceId,
      workspaceId,
      truthClass: fact.truthClass,
      confidence: fact.confidence,
      freshness: fact.freshness,
      sourceFactIds: [fact.factId],
      missingMaterialInfo: [],
      assumptions: [],
      contradictedFactIds: [],
      createdAt: capturedAt,
      expiresAt,
      auditLogIds: [],
    } satisfies TrustedCoreProvenanceSnapshot;

    expect(snapshot.sourceFactIds).toEqual(['fact_current_balance']);
    expect(snapshot.truthClass).toBe('user_confirmed');
  });
});

describe('Trusted Safe Range and Decision Ledger integration contracts', () => {
  it('defines the Phase C Safe Range result without calculating it in the domain package', () => {
    const workspaceId = createWorkspaceId('workspace_personal_main');
    const now = createInstantString('2026-07-20T10:00:00Z');
    const forecastVersionId = createForecastId('forecast_trusted_range_v1');
    const provenanceId = createProvenanceId('provenance_trusted_range_v1');
    const result = {
      workspaceId,
      currency: createCurrencyCode('GBP'),
      calculatedAt: now,
      horizonStartISO: createLocalDate('2026-07-20'),
      horizonEndISO: createLocalDate('2026-08-20'),
      status: 'caution',
      truthClass: 'user_confirmed',
      currentPosition: {
        amount: createMoney({ minorUnits: 125000, currency: 'GBP' }),
        truthClass: 'user_confirmed',
        label: 'Current bank balance',
        sourceFactIds: ['fact_current_balance'],
        observedAt: now,
      },
      committedFloor: {
        amount: createMoney({ minorUnits: 78000, currency: 'GBP' }),
        truthClass: 'predicted',
        label: 'Known committed floor',
        sourceFactIds: ['fact_rent_commitment'],
        observedAt: now,
      },
      expectedRange: {
        min: createMoney({ minorUnits: 24000, currency: 'GBP' }),
        max: createMoney({ minorUnits: 31000, currency: 'GBP' }),
        basis: 'explicit_uncertainty',
        uncertaintySources: [
          {
            id: 'uncertainty_variable_bill',
            label: 'Variable energy bill',
            amount: createMoney({ minorUnits: 7000, currency: 'GBP' }),
            direction: 'widens_down',
            sourceFactIds: ['fact_energy_commitment'],
          },
        ],
      },
      tightestPoint: {
        dateISO: createLocalDate('2026-08-01'),
        amount: createMoney({ minorUnits: 24000, currency: 'GBP' }),
        sourceFactIds: ['fact_rent_commitment'],
      },
      shortfall: null,
      confidenceReasons: [
        {
          id: 'confidence_balance_confirmed',
          label: 'Current balance was confirmed by the user.',
          impact: 'raises',
          sourceFactIds: ['fact_current_balance'],
        },
        {
          id: 'confidence_commitment_inferred',
          label: 'One recurring commitment is still inferred.',
          impact: 'lowers',
          sourceFactIds: ['fact_rent_commitment'],
        },
      ],
      freshnessDetail: {
        status: 'fresh',
        oldestMaterialSourceAt: now,
        affectedSourceIds: ['fact_current_balance', 'fact_rent_commitment'],
        summary: 'Material sources are fresh.',
      },
      missingInputs: [
        {
          id: 'missing_latest_subscription',
          label: 'Latest subscription renewal needs checking.',
          severity: 'caution',
          sourceFactIds: ['fact_subscription_review'],
        },
      ],
      contradictions: [],
      relianceDetail: {
        safeToRelyOn: false,
        label: 'Use caution until the latest renewal is checked.',
        blockedBy: ['missing_latest_subscription'],
      },
      whyChanged: [
        {
          id: 'changed_rent_before_payday',
          label: 'Rent lands before payday.',
          severity: 'info',
          sourceFactIds: ['fact_rent_commitment'],
        },
      ],
      nextAction: {
        id: 'review_subscription',
        label: 'Check the latest subscription renewal',
        route: 'review',
        reason: 'A pending renewal affects the range.',
        sourceFactIds: ['fact_subscription_review'],
      },
      currentKnownPosition: createMoney({ minorUnits: 125000, currency: 'GBP' }),
      knownCommittedFloor: createMoney({ minorUnits: 78000, currency: 'GBP' }),
      expectedSafeMin: createMoney({ minorUnits: 24000, currency: 'GBP' }),
      expectedSafeMax: createMoney({ minorUnits: 31000, currency: 'GBP' }),
      conservativeBoundary: createMoney({ minorUnits: 18000, currency: 'GBP' }),
      reliance: 'use_caution',
      confidence: 'medium',
      freshness: 'fresh',
      missingMaterialInfo: ['latest subscription renewal'],
      assumptions: ['usual weekly food spend'],
      mainCauses: [
        {
          label: 'Rent before payday',
          amount: createMoney({ minorUnits: -73500, currency: 'GBP' }),
          dateISO: createLocalDate('2026-08-01'),
          sourceFactIds: ['fact_rent_commitment'],
        },
      ],
      wouldChangeIf: ['income arrives late'],
      sourceBreakdown: [
        {
          factId: 'fact_current_balance',
          truthClass: 'user_confirmed',
          label: 'Current balance',
          capturedAt: now,
          freshness: 'fresh',
          confidence: 'high',
        },
      ],
      forecastVersionId,
      provenanceId,
      canUserRelyOnAnswer: false,
    } satisfies TrustedSafeRangeResult;

    expect(result.reliance).toBe('use_caution');
    expect(result.canUserRelyOnAnswer).toBe(false);
    expect(result.mainCauses[0]?.sourceFactIds).toEqual(['fact_rent_commitment']);
    expect(result.expectedRange.basis).toBe('explicit_uncertainty');
    expect(result.confidenceReasons.map((reason) => reason.id)).toContain(
      'confidence_balance_confirmed',
    );
  });

  it('defines the bounded Decision Ledger record without event-sourcing the whole app', () => {
    const workspaceId = createWorkspaceId('workspace_personal_main');
    const createdAt = createInstantString('2026-07-20T10:10:00Z');
    const forecastVersionId = createForecastId('forecast_decision_v1');
    const provenanceId = createProvenanceId('provenance_decision_v1');
    const decision = {
      id: createDecisionRecordId('decision_spend_question'),
      workspaceId,
      workspaceKind: 'personal',
      decisionType: 'purchase-affordability',
      materialDecisionKind: 'purchase-affordability',
      status: 'awaiting-outcome',
      createdAt,
      updatedAt: createdAt,
      presentedAt: createdAt,
      resolvedAt: null,
      expiresAt: null,
      question: {
        text: 'Can I spend £40 today?',
        source: 'user',
        priority: 'avoid_shortfall',
      },
      userQuestion: 'Can I spend £40 today?',
      userPriority: 'avoid_shortfall',
      contextRoute: 'today',
      materiality: {
        accepted: true,
        ruleIds: ['cash-effect-gte-10gbp'],
        reason: 'Accepted by cash-effect-gte-10gbp.',
        cashEffect: createMoney({ minorUnits: -4000, currency: 'GBP' }),
        bufferEffect: createMoney({ minorUnits: -4000, currency: 'GBP' }),
        daysShifted: null,
        affectsShortfall: false,
      },
      factSnapshots: [
        {
          factId: 'fact_current_balance',
          label: 'Current balance',
          workspaceId,
          truthClass: 'user_confirmed',
          sourceType: 'manual_entry',
          sourceRef: 'balance-entry',
          capturedAt: createdAt,
          confirmedAt: createdAt,
          expiresAt: null,
          confidence: 'high',
          freshness: 'fresh',
          amount: createMoney({ minorUnits: 125000, currency: 'GBP' }),
          assumptions: [],
          derivedFrom: [],
          correctionOf: null,
          provenanceId,
        },
      ],
      factRefs: ['fact_current_balance', 'fact_rent_commitment'],
      truthClasses: {
        fact_current_balance: 'user_confirmed',
        fact_rent_commitment: 'inferred',
      },
      unknowns: [],
      missingInformation: [],
      contradictions: [],
      assumptions: [
        {
          id: 'assumption_usual_food',
          label: 'usual weekly food spend',
          truthClass: 'assumed',
          confidence: 'medium',
          amount: null,
          sourceFactIds: [],
        },
      ],
      assumptionLabels: ['usual weekly food spend'],
      safeRange: null,
      forecast: {
        forecastVersionId,
        createdAt,
        horizonStartISO: createLocalDate('2026-07-20'),
        horizonEndISO: createLocalDate('2026-08-20'),
        predictedTightestPoint: createMoney({ minorUnits: 24000, currency: 'GBP' }),
        predictedEndPosition: createMoney({ minorUnits: 31000, currency: 'GBP' }),
        predictedSafeMin: createMoney({ minorUnits: 24000, currency: 'GBP' }),
        predictedSafeMax: createMoney({ minorUnits: 31000, currency: 'GBP' }),
        conservativeBoundary: createMoney({ minorUnits: 18000, currency: 'GBP' }),
        confidence: 'medium',
        sourceFactIds: ['fact_current_balance', 'fact_rent_commitment'],
      },
      scenarios: [],
      chosenScenarioId: null,
      forecastVersionId,
      meloExplanation: 'The range is cautious because one recurring amount is inferred.',
      proposedMoves: [
        {
          id: 'move_wait_until_tomorrow',
          label: 'Wait until tomorrow',
          decisionType: 'purchase-affordability',
          reversible: true,
          risk: 'low',
          expectedCashDelta: null,
          expectedBufferDelta: createMoney({ minorUnits: 4000, currency: 'GBP' }),
          affectedFactIds: [],
        },
      ],
      userChoice: {
        state: 'deferred',
        selectedScenarioId: null,
        selectedMoveIds: ['move_wait_until_tomorrow'],
        recordedAt: createdAt,
        actor: 'user',
        note: null,
      },
      consent: {
        required: false,
        granted: null,
        capturedAt: null,
        label: null,
        sourceControlId: null,
      },
      outcome: {
        checkedAt: null,
        state: 'unknown',
        actualCashDelta: null,
        actualBufferDelta: null,
        actualSourceFactIds: [],
        note: null,
        forecastError: null,
      },
      forecastEvaluations: [],
      corrections: [],
      userCorrectionRefs: [],
      learning: {
        permitted: false,
        disabledAt: createdAt,
        removedAt: null,
        memoryRefs: [],
      },
      learningPermitted: false,
      audit: [
        {
          at: createdAt,
          action: 'presented',
          actor: 'system',
          ref: 'today',
          commandId: 'decision-spend-question',
        },
      ],
      provenanceId,
    } satisfies DecisionLedgerRecord;

    expect(materialDecisionKinds).toEqual([
      'purchase-affordability',
      'recurring-commitment-change',
      'debt-payment',
      'pot-contribution',
      'pot-borrow',
      'spending-hold',
      'recovery-plan',
      'payday-plan',
      'income-assumption',
      'bill-date-change',
      'scenario-choice',
      'manual-financial-adjustment',
      'melo-confirmed-action',
    ]);
    expect(decisionLedgerStatuses).toContain(decision.status);
    expect(decision.decisionType).toBe(decision.materialDecisionKind);
    expect(decision.learningPermitted).toBe(false);
    expect(decision.audit).toHaveLength(1);
  });

  it('exports the Phase E critical journey and material-change vocabulary', () => {
    expect(criticalJourneyIds).toEqual([
      'first_trustworthy_answer',
      'material_financial_change',
      'financial_decision',
      'pressure_and_recovery',
      'payday_and_cycle_close',
      'correction_and_recalculation',
    ]);
    expect(materialFinancialChangeTypes).toEqual([
      'new_transaction',
      'balance_correction',
      'bill_amount_change',
      'bill_date_shift',
      'income_change',
      'subscription_detected',
      'debt_payment',
      'pot_move',
      'reviewed_statement',
      'provider_stale',
      'restored_backup',
      'user_correction',
      'forecast_recalculation',
    ]);
  });
});

describe('Trusted Core ownership and migration scaffolding', () => {
  it('declares exactly one canonical owner for every Phase B responsibility', () => {
    expect(Object.keys(trustedCoreResponsibilityOwners).sort()).toEqual(
      [...trustedCoreResponsibilities].sort(),
    );
    for (const responsibility of trustedCoreResponsibilities) {
      const owner = trustedCoreResponsibilityOwners[responsibility];
      expect(owner.canonicalOwner).toBeTruthy();
      expect(owner.userVisibleBehaviourChangesInPhaseB).toBe(false);
    }
    expect(trustedCoreResponsibilityOwners['truth-classification'].canonicalOwner).toBe(
      '@folio/domain',
    );
    expect(trustedCoreResponsibilityOwners['forecast-engine'].canonicalOwner).toBe(
      '@folio/finance-engine',
    );
    expect(trustedCoreResponsibilityOwners['persistence'].canonicalOwner).toBe('@folio/storage');
  });

  it('keeps migration scaffolding non-destructive for existing local state', () => {
    expect(trustedCoreMigrationPlan.map((item) => item.id)).toEqual([
      'truth-provenance-v1',
      'safe-range-result-v1',
      'decision-ledger-v1',
      'critical-journeys-v1',
    ]);
    expect(trustedCoreMigrationPlan.every((item) => item.destructive === false)).toBe(true);
    expect(trustedCoreMigrationPlan.every((item) => item.rollback.length > 0)).toBe(true);
  });

  it('keeps workspace-boundary checks explicit and deterministic', () => {
    const personal = createWorkspaceId('workspace_personal_main');
    const business = createWorkspaceId('workspace_business_acme');

    expect(
      evaluateWorkspaceBoundary({ activeWorkspaceId: personal, subjectWorkspaceId: personal }),
    ).toMatchObject({ allowed: true, reason: 'same_workspace' });
    expect(
      evaluateWorkspaceBoundary({ activeWorkspaceId: personal, subjectWorkspaceId: business }),
    ).toMatchObject({ allowed: false, reason: 'cross_workspace_blocked' });
  });

  it('does not require entity versions for the Trusted Core contract constants', () => {
    expect(createEntityVersion().revision).toBe(1);
    expect(trustedCoreResponsibilities).toContain('safe-range-result');
  });
});
