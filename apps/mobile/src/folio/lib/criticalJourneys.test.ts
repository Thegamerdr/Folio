import { beforeEach, describe, expect, it } from 'vitest';

import { createInstantString, createWorkspaceId, type DecisionLedgerEntry } from '@folio/domain';

import {
  DEFAULT_ACCOUNT_ID,
  addCycle,
  getDecisionLedgerEntries,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  recordCorrectionImpact,
  recordCriticalJourneyContinuity,
  recordMaterialDecision,
  recordMaterialFinancialChange,
  recordProvisionalAnswer,
  resetToEmpty,
  setPartial,
  setSpendHold,
  type Account,
  type AppState,
  type CalendarEvent,
  type CurrentBalance,
  type Pot,
  type Sub,
} from '../store';
import {
  PHASE_E_PERSONAL_JOURNEYS,
  RECOVERY_PROTECTION_ORDER,
  buildDecisionScenarioComparison,
  buildProvisionalFirstAnswer,
  deriveCorrectionImpact,
  deriveMaterialFinancialChange,
  evaluatePaydayForecastAccountability,
  supportedRecoveryMoves,
} from './criticalJourneys';
import { safeRangeSnapshotFromResult } from './decisionLedger';
import { buildTrustedSafeRangeFromAppState } from './trustedSafeRange';
import {
  PERSONAL_WORKSPACE_ID,
  createBusinessWorkspace,
  createPersonalWorkspaceRoot,
} from './workspaceRoot';

const NOW = '2026-07-20T10:00:00.000Z';

beforeEach(() => {
  resetToEmpty({ onboardingDone: true });
});

function account(balance: number): Account {
  return {
    id: DEFAULT_ACCOUNT_ID,
    workspaceId: PERSONAL_WORKSPACE_ID,
    name: 'Main',
    kind: 'bank',
    isLiability: false,
    balanceMinor: balance,
    balanceAsOfISO: NOW,
    addedAt: NOW,
  };
}

function balance(amount: number): CurrentBalance {
  return { amount, source: 'user-entered', confidence: 'corrected', setAt: NOW };
}

function bill(id: string, amount: number, date = '2026-07-24'): CalendarEvent {
  return {
    id,
    workspaceId: PERSONAL_WORKSPACE_ID,
    date,
    kind: amount >= 0 ? 'in' : 'out',
    title: id,
    amount,
  };
}

function optionalSub(name: string, cost: number): Sub {
  return {
    name,
    workspaceId: PERSONAL_WORKSPACE_ID,
    cost,
    nextRenewalDaysAway: 4,
    nextRenewalISO: '2026-07-24',
    lastUsedDaysAgo: 45,
    usesPerMonth: 0,
  };
}

function pot(id: string, saved: number): Pot {
  return {
    id,
    workspaceId: PERSONAL_WORKSPACE_ID,
    name: id,
    saved,
    goal: 500,
    perWeek: 20,
    accent: false,
  };
}

function stateWith(patch: Partial<AppState> = {}): AppState {
  const base = getState();
  return {
    ...base,
    schemaVersion: 18,
    onboarding: { done: true, name: 'Taylor', payday: 25, monthlyIncome: 2200 },
    currentBalance: balance(1000),
    accounts: [account(1000)],
    calendarEvents: [bill('rent', -300)],
    transactions: [],
    subs: [],
    pots: [],
    potLedger: [],
    debts: [],
    incomeSources: [],
    reviewQueue: [],
    reviewQueueSpillover: [],
    readerCandidates: [],
    spendHold: null,
    whatIfHolds: [],
    decisionLedger: [],
    provisionalAnswers: [],
    materialChanges: [],
    correctionImpacts: [],
    criticalJourneyContinuity: [],
    ...patch,
  };
}

function snapshot(state: AppState) {
  return safeRangeSnapshotFromResult(buildTrustedSafeRangeFromAppState(state, { now: NOW }));
}

function materialDecision(safeRange = snapshot(stateWith())): DecisionLedgerEntry {
  const entry = recordMaterialDecision({
    idempotencyKey: 'phase-e-test-decision',
    contextRoute: 'whatif',
    question: 'Can I spend £50?',
    decisionType: 'purchase-affordability',
    amountMinor: -5_000,
    bufferDeltaMinor: -5_000,
    confirmedAction: true,
    safeRange,
    forecast: null,
    assumptions: ['user entered a purchase amount'],
    factSnapshots: [],
    scenarios: [],
  });
  if (entry === null) throw new Error('expected material decision');
  return entry;
}

describe('Phase E critical journey contract', () => {
  it('declares exactly the six Personal journeys in product order', () => {
    expect(PHASE_E_PERSONAL_JOURNEYS.map((journey) => journey.id)).toEqual([
      'first_trustworthy_answer',
      'material_financial_change',
      'financial_decision',
      'pressure_and_recovery',
      'payday_and_cycle_close',
      'correction_and_recalculation',
    ]);
    expect(
      PHASE_E_PERSONAL_JOURNEYS.every((journey) => journey.engines.includes('Trusted Safe Range')),
    ).toBe(true);
  });

  it('builds a provisional first answer without creating a Decision Ledger receipt on view', () => {
    const provisional = buildProvisionalFirstAnswer(getState(), {
      workspaceId: PERSONAL_WORKSPACE_ID,
      question: 'Will I make it to payday?',
      balanceMinor: 75_000,
      paydayDay: 25,
      now: NOW,
    });

    expect(provisional.question).toBe('Will I make it to payday?');
    expect(provisional.enteredFacts.map((fact) => fact.label)).toContain('Current balance');
    expect(provisional.missingMaterialInfo).toContain('income amount');
    expect(provisional.nextBestInput).toBe('income amount');
    expect(getState().decisionLedger).toEqual([]);

    recordProvisionalAnswer(provisional);
    const blob = getPersistBlob();
    hydrateFromBlob(blob);

    expect(getState().provisionalAnswers?.[0]?.id).toBe(provisional.id);
    expect(getState().decisionLedger).toEqual([]);
  });

  it('persists causal material-change context and preserves it after relaunch', () => {
    const before = snapshot(stateWith({ calendarEvents: [bill('rent', -300)] }));
    const after = snapshot(stateWith({ calendarEvents: [bill('rent', -425)] }));
    const change = deriveMaterialFinancialChange({
      workspaceId: PERSONAL_WORKSPACE_ID,
      type: 'bill_amount_change',
      sourceIds: ['fact_calendar_user_event_rent'],
      truth: 'user_confirmed',
      occurredAt: NOW,
      detectedAt: NOW,
      before,
      after,
    });

    expect(change).not.toBeNull();
    recordMaterialFinancialChange(change!);
    const blob = getPersistBlob();
    hydrateFromBlob(blob);

    expect(getState().materialChanges?.[0]).toMatchObject({
      id: change!.id,
      explanationCode: 'material.bill_amount_change.worsened.user_confirmed',
      userActionRequired: expect.any(Boolean),
    });
  });

  it('compares baseline, proposed and modified decision options and writes one idempotent receipt', () => {
    const baseline = snapshot(stateWith());
    const comparison = buildDecisionScenarioComparison({
      baseline,
      proposed: {
        id: 'proposed-purchase',
        label: 'Buy today',
        decisionType: 'purchase-affordability',
        immediateCashEffectMinor: -5_000,
        expectedBufferEffectMinor: -5_000,
        reversible: false,
        risk: 'medium',
      },
      modified: {
        id: 'modified-purchase',
        label: 'Wait one week',
        immediateCashEffectMinor: 0,
        expectedBufferEffectMinor: 0,
        reversible: true,
        risk: 'low',
      },
    });

    expect(comparison).toHaveLength(3);
    expect(comparison[0]!.label).toBe('Do nothing');
    expect(comparison[1]!.essentialCommitmentRisk).toBe('higher');

    const entry = recordMaterialDecision({
      idempotencyKey: 'phase-e-scenario-choice',
      contextRoute: 'whatif',
      question: 'Can I buy this today?',
      decisionType: 'purchase-affordability',
      amountMinor: -5_000,
      bufferDeltaMinor: -5_000,
      confirmedAction: true,
      safeRange: baseline,
      forecast: null,
      scenarios: comparison.map((row) => row.scenario),
      selectedScenarioId: comparison[1]!.scenario.id,
      assumptions: ['purchase amount entered by user'],
    });
    const duplicate = recordMaterialDecision({
      idempotencyKey: 'phase-e-scenario-choice',
      contextRoute: 'whatif',
      question: 'Can I buy this today?',
      decisionType: 'purchase-affordability',
      amountMinor: -5_000,
      bufferDeltaMinor: -5_000,
      confirmedAction: true,
      safeRange: baseline,
      forecast: null,
      scenarios: comparison.map((row) => row.scenario),
      selectedScenarioId: comparison[1]!.scenario.id,
    });

    expect(entry?.id).toBe(duplicate?.id);
    expect(getDecisionLedgerEntries()).toHaveLength(1);
    expect(getDecisionLedgerEntries()[0]).toMatchObject({
      status: 'chosen',
      consent: { required: true, granted: true },
      chosenScenarioId: comparison[1]!.scenario.id,
    });
  });

  it('limits recovery to state-supported moves and records confirmed recovery as material', () => {
    const pressureState = stateWith({
      currentBalance: balance(80),
      accounts: [account(80)],
      calendarEvents: [bill('rent', -300)],
      subs: [optionalSub('Streaming', 18)],
      pots: [pot('buffer', 90)],
    });
    const pressure = snapshot(pressureState);
    const moves = supportedRecoveryMoves(pressureState, pressure);

    expect(RECOVERY_PROTECTION_ORDER[0]).toBe('housing');
    expect(moves.map((move) => move.id)).toContain('bounded_spending_hold');
    expect(moves.some((move) => move.label.toLowerCase().includes('government'))).toBe(false);

    setSpendHold(20, 7, new Date(NOW));
    expect(getState().spendHold).toMatchObject({ dailyCap: 20 });
    expect(getDecisionLedgerEntries()[0]).toMatchObject({
      decisionType: 'spending-hold',
      status: 'awaiting-outcome',
    });
  });

  it('evaluates payday forecast accountability without creating a global accuracy score', () => {
    const prior = snapshot(stateWith());
    const evaluation = evaluatePaydayForecastAccountability(
      prior,
      prior.expectedSafeMax?.minorUnits ?? null,
    );

    expect(evaluation.classification).toBe('inside_range');
    expect(evaluation.confidenceAtTheTime).toBe(prior.confidence);
    expect(evaluation).not.toHaveProperty('score');

    addCycle({
      closedAt: '2026-07-25',
      label: 'July',
      spare: 30,
      tightPoint: 10,
      setAside: 20,
      note: 'Confirmed cycle close',
    });
    expect(getDecisionLedgerEntries()[0]).toMatchObject({
      decisionType: 'payday-plan',
      status: 'resolved',
    });
  });

  it('preserves correction originals, recalculates before/after and marks affected receipts', () => {
    const before = snapshot(stateWith({ calendarEvents: [bill('rent', -425)] }));
    setPartial({ decisionLedger: [] });
    const entry = materialDecision(before);
    const after = snapshot(stateWith({ calendarEvents: [bill('rent', -300)] }));
    const correction = deriveCorrectionImpact({
      workspaceId: PERSONAL_WORKSPACE_ID,
      subject: { kind: 'bill', id: 'rent' },
      field: 'amount',
      original: -425,
      corrected: -300,
      sourceIds: before.sourceFactIds,
      before,
      after,
      decisions: [entry],
      correctedAt: NOW,
      correctedBy: 'user',
    });

    recordCorrectionImpact(correction);

    expect(getState().correctionImpacts?.[0]).toMatchObject({
      id: correction.id,
      original: -425,
      corrected: -300,
      affectedDecisionIds: [entry.id],
    });
    expect(getDecisionLedgerEntries()[0]).toMatchObject({
      status: 'corrected',
      corrections: [expect.objectContaining({ before: -425, after: -300 })],
    });
  });

  it('blocks Business workspaces from Personal Safe Range journeys', () => {
    const personalRoot = createPersonalWorkspaceRoot();
    const businessId = createWorkspaceId('workspace_business_phase_e');
    const business = createBusinessWorkspace({
      id: businessId,
      name: 'Studio Ltd',
      encryptedSubkeyId: 'workspace-subkey-business-phase-e-business-v1',
    });
    const businessState = stateWith({
      workspaces: [...personalRoot.workspaces, business],
      activeWorkspaceId: businessId,
      dataWorkspaceId: businessId,
    });
    const result = buildTrustedSafeRangeFromAppState(businessState, { now: NOW });

    expect(result.status).toBe('workspace_blocked');
    expect(result.missingMaterialInfo).toContain(
      'Trusted Safe Range only reads the active Personal workspace.',
    );
  });

  it('persists restart continuity records without touching financial history', () => {
    recordCriticalJourneyContinuity({
      id: 'journey-continuity-test',
      workspaceId: PERSONAL_WORKSPACE_ID,
      journeyId: 'financial_decision',
      status: 'previewed',
      startedAt: createInstantString(NOW),
      updatedAt: createInstantString(NOW),
      currentRoute: 'whatif',
      pendingAction: 'confirm scenario',
      blockerCodes: [],
      decisionLedgerEntryIds: [],
      materialChangeIds: [],
      correctionImpactIds: [],
    });

    const blob = getPersistBlob();
    hydrateFromBlob(blob);

    expect(getState().criticalJourneyContinuity?.[0]).toMatchObject({
      journeyId: 'financial_decision',
      currentRoute: 'whatif',
    });
    expect(getState().transactions).toEqual([]);
  });
});
