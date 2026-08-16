import {
  createCurrencyCode,
  createInstantString,
  createMoney,
  createScenarioId,
  type CorrectionImpactRecord,
  type CriticalJourneyId,
  type DecisionLedgerEntry,
  type DecisionLedgerScenario,
  type MaterialDecisionKind,
  type MaterialFinancialChange,
  type MaterialFinancialChangeType,
  type Money,
  type ProvisionalAnswerInputFact,
  type ProvisionalAnswerRecord,
  type TrustedCoreSourceType,
  type TrustedCoreTruthClass,
  type TrustedSafeRangeSnapshot,
  type WorkspaceId,
} from '@folio/domain';

import {
  DEFAULT_ACCOUNT_ID,
  type AppState,
  type CalendarEvent,
  type CurrentBalance,
  type Pot,
  type Sub,
} from '../store';
import { forecastSnapshotFromSafeRange, safeRangeSnapshotFromResult } from './decisionLedger';
import { buildTrustedSafeRangeFromAppState } from './trustedSafeRange';

const GBP = createCurrencyCode('GBP');
const MATERIAL_RANGE_DELTA_MINOR = 100;

export type CriticalJourneyMapItem = Readonly<{
  id: CriticalJourneyId;
  label: string;
  currentEntryPoints: readonly string[];
  targetEntryPoints: readonly string[];
  storeReads: readonly (keyof AppState)[];
  storeWrites: readonly (keyof AppState)[];
  engines: readonly string[];
  ledgerRule: 'none' | 'on_material_confirmation' | 'required';
  exitState: string;
}>;

export const PHASE_E_PERSONAL_JOURNEYS: readonly CriticalJourneyMapItem[] = [
  {
    id: 'first_trustworthy_answer',
    label: 'First trustworthy answer',
    currentEntryPoints: ['Start', 'Onboarding', 'Today empty state'],
    targetEntryPoints: ['urgent question', 'manual balance', 'continue setup'],
    storeReads: ['currentBalance', 'onboarding', 'subs', 'calendarEvents', 'incomeSources'],
    storeWrites: ['provisionalAnswers', 'criticalJourneyContinuity'],
    engines: ['Trusted Safe Range'],
    ledgerRule: 'on_material_confirmation',
    exitState: 'provisional answer saved or discarded; setup continuation optional',
  },
  {
    id: 'material_financial_change',
    label: 'Material financial change',
    currentEntryPoints: ['WhatChangedRow', 'Timeline', 'Review', 'Statement import'],
    targetEntryPoints: ['new fact', 'reviewed fact', 'provider stale', 'backup restore'],
    storeReads: ['transactions', 'subs', 'currentBalance', 'reviewQueue', 'decisionLedger'],
    storeWrites: ['materialChanges', 'whatChangedSeenISO', 'criticalJourneyContinuity'],
    engines: ['Trusted Safe Range', 'What Changed'],
    ledgerRule: 'on_material_confirmation',
    exitState: 'causal before/after explanation persists after relaunch',
  },
  {
    id: 'financial_decision',
    label: 'Financial decision',
    currentEntryPoints: ['WhatIf', 'Recovery', 'Pots', 'Subs', 'Payday Ritual'],
    targetEntryPoints: ['scenario compare', 'confirm', 'decision receipt'],
    storeReads: ['decisionLedger', 'currentBalance', 'subs', 'pots', 'whatIfHolds'],
    storeWrites: ['decisionLedger', 'criticalJourneyContinuity'],
    engines: ['Trusted Safe Range', 'Decision Ledger'],
    ledgerRule: 'required',
    exitState: 'immutable receipt with selected scenario, consent and outcome state',
  },
  {
    id: 'pressure_and_recovery',
    label: 'Pressure and recovery',
    currentEntryPoints: ['Today pressure card', 'Recovery', 'Shortfall'],
    targetEntryPoints: ['pressure detected', 'safe moves', 'single confirmation'],
    storeReads: ['currentBalance', 'calendarEvents', 'subs', 'pots', 'spendHold'],
    storeWrites: ['spendHold', 'subOverrides', 'subPaused', 'potLedger', 'decisionLedger'],
    engines: ['Trusted Safe Range', 'Recovery', 'Decision Ledger'],
    ledgerRule: 'required',
    exitState: 'recovery receipt plus follow-up state',
  },
  {
    id: 'payday_and_cycle_close',
    label: 'Payday and cycle close',
    currentEntryPoints: ['Payday Ritual', 'Review', 'Today income arrived'],
    targetEntryPoints: ['income observed', 'forecast accountability', 'confirm cycle'],
    storeReads: ['cycles', 'transactions', 'potLedger', 'decisionLedger', 'currentBalance'],
    storeWrites: ['cycles', 'potLedger', 'nextYouNote', 'decisionLedger'],
    engines: ['Trusted Safe Range', 'Forecast evaluation', 'Decision Ledger'],
    ledgerRule: 'required',
    exitState: 'cycle closed with prior forecast, actuals and next assumptions',
  },
  {
    id: 'correction_and_recalculation',
    label: 'Correction and recalculation',
    currentEntryPoints: ['Review', 'Timeline', 'Decision Receipt', 'Safe Range source sheet'],
    targetEntryPoints: ['challenge answer', 'correct fact', 'before/after recalculation'],
    storeReads: ['transactions', 'edits', 'decisionLedger', 'materialChanges'],
    storeWrites: ['edits', 'correctionImpacts', 'decisionLedger', 'materialChanges'],
    engines: ['Trusted Safe Range', 'Correction impact', 'Decision Ledger'],
    ledgerRule: 'required',
    exitState: 'original preserved, affected receipts marked corrected',
  },
];

export type FirstAnswerInput = Readonly<{
  workspaceId: WorkspaceId;
  question: string;
  balanceMinor?: number | null;
  paydayDay?: number | null;
  monthlyIncomeMinor?: number | null;
  essentialBillsMinor?: number | null;
  now: Date | string;
  savedToSetup?: boolean;
}>;

function instant(input: Date | string): ReturnType<typeof createInstantString> {
  return createInstantString(
    input instanceof Date ? input.toISOString() : new Date(input).toISOString(),
  );
}

function poundsFromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

function money(minor: number | null | undefined): Money | null {
  if (minor === null || minor === undefined) return null;
  return createMoney({ minorUnits: Math.round(minor), currency: GBP });
}

function addDaysISO(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function truthForEnteredFact(sourceType: TrustedCoreSourceType): TrustedCoreTruthClass {
  return sourceType === 'sample_demo' ? 'sample_demo' : 'user_confirmed';
}

function enteredFact(
  id: string,
  label: string,
  sourceType: TrustedCoreSourceType,
  sourceIds: readonly string[],
): ProvisionalAnswerInputFact {
  return {
    id,
    label,
    truth: truthForEnteredFact(sourceType),
    sourceType,
    sourceIds,
  };
}

export function buildProvisionalFirstAnswer(
  baseState: AppState,
  input: FirstAnswerInput,
): ProvisionalAnswerRecord {
  const now = input.now instanceof Date ? input.now : new Date(input.now);
  const nowISO = instant(now);
  const balanceMajor =
    input.balanceMinor === undefined || input.balanceMinor === null
      ? null
      : poundsFromMinor(input.balanceMinor);
  const currentBalance: CurrentBalance =
    balanceMajor === null
      ? baseState.currentBalance
      : {
          amount: balanceMajor,
          source: 'user-entered',
          confidence: 'rough',
          setAt: nowISO,
        };
  const essentialEvent: CalendarEvent | null =
    input.essentialBillsMinor === undefined || input.essentialBillsMinor === null
      ? null
      : {
          id: 'phase-e-provisional-essential-bills',
          workspaceId: input.workspaceId,
          date: addDaysISO(now, 7),
          kind: 'out',
          title: 'Essential bills',
          amount: -poundsFromMinor(Math.abs(input.essentialBillsMinor)),
        };
  const monthlyIncomeMajor =
    input.monthlyIncomeMinor === undefined || input.monthlyIncomeMinor === null
      ? baseState.onboarding.monthlyIncome
      : poundsFromMinor(input.monthlyIncomeMinor);
  const tempState: AppState = {
    ...baseState,
    activeWorkspaceId: input.workspaceId,
    dataWorkspaceId: input.workspaceId,
    currentBalance,
    onboarding: {
      ...baseState.onboarding,
      done: true,
      payday: input.paydayDay ?? baseState.onboarding.payday,
      monthlyIncome: monthlyIncomeMajor,
    },
    ...(balanceMajor === null
      ? {}
      : {
          accounts: [
            {
              id: DEFAULT_ACCOUNT_ID,
              workspaceId: input.workspaceId,
              name: 'Main',
              kind: 'bank',
              isLiability: false,
              balanceMinor: balanceMajor,
              balanceAsOfISO: nowISO,
              addedAt: nowISO,
            },
          ],
        }),
    calendarEvents:
      essentialEvent === null
        ? baseState.calendarEvents
        : [essentialEvent, ...baseState.calendarEvents],
    incomeSources:
      input.monthlyIncomeMinor === undefined || input.monthlyIncomeMinor === null
        ? (baseState.incomeSources ?? [])
        : [
            {
              id: 'phase-e-provisional-income',
              workspaceId: input.workspaceId,
              label: 'Income',
              cadence: 'monthly',
              dayOfMonth: input.paydayDay ?? baseState.onboarding.payday,
              amount: monthlyIncomeMajor,
              source: 'manual',
            },
          ],
  };
  const safeRange = buildTrustedSafeRangeFromAppState(tempState, { now });
  const snapshot = safeRangeSnapshotFromResult(safeRange);
  const enteredFacts = [
    ...(balanceMajor === null
      ? []
      : [
          enteredFact('phase-e-current-balance', 'Current balance', 'manual_entry', [
            'fact_current_balance',
          ]),
        ]),
    ...(input.paydayDay === undefined || input.paydayDay === null
      ? []
      : [enteredFact('phase-e-payday', 'Payday', 'manual_entry', ['fact_income_payday'])]),
    ...(input.monthlyIncomeMinor === undefined || input.monthlyIncomeMinor === null
      ? []
      : [enteredFact('phase-e-income', 'Income amount', 'manual_entry', ['fact_income_amount'])]),
    ...(essentialEvent === null
      ? []
      : [
          enteredFact('phase-e-essential-bills', 'Essential bills', 'manual_entry', [
            'fact_calendar_user_event_phase-e-provisional-essential-bills',
          ]),
        ]),
  ];
  const missingMaterialInfo = [
    ...(balanceMajor === null ? ['current balance'] : []),
    ...(input.paydayDay === undefined || input.paydayDay === null ? ['next payday'] : []),
    ...(input.monthlyIncomeMinor === undefined || input.monthlyIncomeMinor === null
      ? ['income amount']
      : []),
    ...(essentialEvent === null ? ['essential bills'] : []),
    ...safeRange.missingMaterialInfo,
  ];
  const nextBestInput =
    missingMaterialInfo[0] ??
    safeRange.nextAction?.label ??
    (baseState.subs.length === 0 ? 'regular commitments' : null);

  return {
    id: `provisional_answer_${stableHash(
      [
        input.workspaceId,
        input.question,
        nowISO,
        String(input.balanceMinor ?? ''),
        String(input.paydayDay ?? ''),
        String(input.monthlyIncomeMinor ?? ''),
        String(input.essentialBillsMinor ?? ''),
      ].join('|'),
    )}`,
    workspaceId: input.workspaceId,
    createdAt: nowISO,
    updatedAt: nowISO,
    question: input.question,
    enteredFacts,
    safeRange: snapshot,
    truth: safeRange.truthClass,
    reliance: safeRange.reliance,
    assumptions: [...safeRange.assumptions],
    missingMaterialInfo: Array.from(new Set(missingMaterialInfo)),
    contradictions: safeRange.contradictions.map((item) => item.label),
    nextBestInput,
    savedToSetup: input.savedToSetup === true,
    decisionLedgerEntryId: null,
  };
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function moneyDelta(
  after: Money | null | undefined,
  before: Money | null | undefined,
): Money | undefined {
  if (after === null || after === undefined || before === null || before === undefined)
    return undefined;
  return money(after.minorUnits - before.minorUnits) ?? undefined;
}

function deltaMinor(value: Money | undefined): number {
  return value?.minorUnits ?? 0;
}

function materialChangeLabel(
  type: MaterialFinancialChangeType,
  direction: 'improved' | 'worsened' | 'same',
) {
  const subject: Record<MaterialFinancialChangeType, string> = {
    new_transaction: 'A new transaction',
    balance_correction: 'A corrected balance',
    bill_amount_change: 'A bill amount change',
    bill_date_shift: 'A bill date shift',
    income_change: 'An income change',
    subscription_detected: 'A detected subscription',
    debt_payment: 'A debt payment',
    pot_move: 'A pot move',
    reviewed_statement: 'A reviewed statement',
    provider_stale: 'A stale provider source',
    restored_backup: 'A restored backup',
    user_correction: 'A user correction',
    forecast_recalculation: 'A forecast recalculation',
  };
  const suffix =
    direction === 'improved'
      ? 'improved the Safe Range'
      : direction === 'worsened'
        ? 'reduced the Safe Range'
        : 'changed the evidence without moving the range materially';
  return `${subject[type]} ${suffix}`;
}

function directionForDelta(delta: number): 'improved' | 'worsened' | 'same' {
  if (delta > 0) return 'improved';
  if (delta < 0) return 'worsened';
  return 'same';
}

function decisionAffectedBy(
  decision: DecisionLedgerEntry,
  sourceIds: readonly string[],
  before: TrustedSafeRangeSnapshot | undefined,
  after: TrustedSafeRangeSnapshot | undefined,
): boolean {
  const sourceSet = new Set(sourceIds);
  const decisionSources = [
    ...decision.factRefs,
    ...(decision.safeRange?.sourceFactIds ?? []),
    ...(decision.forecast?.sourceFactIds ?? []),
  ];
  if (decisionSources.some((sourceId) => sourceSet.has(sourceId))) return true;
  if (before === undefined || after === undefined) return false;
  return before.status !== after.status || before.reliance !== after.reliance;
}

export type MaterialChangeInput = Readonly<{
  workspaceId: WorkspaceId;
  type: MaterialFinancialChangeType;
  sourceIds: readonly string[];
  truth: TrustedCoreTruthClass;
  occurredAt: Date | string;
  detectedAt: Date | string;
  before?: TrustedSafeRangeSnapshot;
  after?: TrustedSafeRangeSnapshot;
  monetaryEffectMinor?: number | null;
  decisions?: readonly DecisionLedgerEntry[];
  reviewRequired?: boolean;
}>;

export function deriveMaterialFinancialChange(
  input: MaterialChangeInput,
): MaterialFinancialChange | null {
  const lowerDelta = moneyDelta(input.after?.expectedSafeMin, input.before?.expectedSafeMin);
  const upperDelta = moneyDelta(input.after?.expectedSafeMax, input.before?.expectedSafeMax);
  const conservativeBoundaryDelta = moneyDelta(
    input.after?.conservativeBoundary,
    input.before?.conservativeBoundary,
  );
  const strongestDelta = [lowerDelta, upperDelta, conservativeBoundaryDelta].reduce(
    (strongest, candidate) =>
      Math.abs(deltaMinor(candidate)) > Math.abs(deltaMinor(strongest)) ? candidate : strongest,
    undefined as Money | undefined,
  );
  const monetaryEffect = money(input.monetaryEffectMinor ?? null) ?? strongestDelta;
  const direction = directionForDelta(deltaMinor(strongestDelta));
  const affectedDecisionIds = (input.decisions ?? [])
    .filter((decision) => decisionAffectedBy(decision, input.sourceIds, input.before, input.after))
    .map((decision) => decision.id);
  const truthNeedsReview = [
    'inferred',
    'estimated',
    'assumed',
    'missing',
    'stale',
    'contradicted',
    'sample_demo',
  ].includes(input.truth);
  const reviewRequired = input.reviewRequired === true || truthNeedsReview;
  const userActionRequired =
    reviewRequired ||
    affectedDecisionIds.length > 0 ||
    input.after?.status === 'shortfall' ||
    input.after?.status === 'contradicted' ||
    input.after?.status === 'stale';
  const materiallyMoved =
    Math.max(
      Math.abs(deltaMinor(lowerDelta)),
      Math.abs(deltaMinor(upperDelta)),
      Math.abs(deltaMinor(conservativeBoundaryDelta)),
      Math.abs(deltaMinor(monetaryEffect)),
    ) >= MATERIAL_RANGE_DELTA_MINOR;
  if (!materiallyMoved && !reviewRequired && affectedDecisionIds.length === 0) return null;
  const occurredAt = instant(input.occurredAt);
  const detectedAt = instant(input.detectedAt);
  const id = `material_change_${stableHash(
    [
      input.workspaceId,
      input.type,
      occurredAt,
      detectedAt,
      input.sourceIds.join(','),
      String(deltaMinor(strongestDelta)),
    ].join('|'),
  )}`;
  return {
    id,
    workspaceId: input.workspaceId,
    occurredAt,
    detectedAt,
    type: input.type,
    sourceIds: [...input.sourceIds],
    truth: input.truth,
    ...(input.before === undefined ? {} : { before: input.before }),
    ...(input.after === undefined ? {} : { after: input.after }),
    ...(monetaryEffect === undefined ? {} : { monetaryEffect }),
    rangeEffect: {
      ...(lowerDelta === undefined ? {} : { lowerDelta }),
      ...(upperDelta === undefined ? {} : { upperDelta }),
      ...(conservativeBoundaryDelta === undefined ? {} : { conservativeBoundaryDelta }),
    },
    causes: [
      {
        id: `${id}:primary`,
        label: materialChangeLabel(input.type, direction),
        weight: 'primary',
        sourceFactIds: [...input.sourceIds],
        amount: strongestDelta ?? monetaryEffect ?? null,
      },
    ],
    affectedDecisionIds,
    reviewRequired,
    userActionRequired,
    explanationCode: `material.${input.type}.${direction}.${input.truth}`,
  };
}

export type ScenarioComparisonInput = Readonly<{
  baseline: TrustedSafeRangeSnapshot;
  proposed: Readonly<{
    id: string;
    label: string;
    decisionType: MaterialDecisionKind;
    immediateCashEffectMinor: number;
    expectedBufferEffectMinor: number;
    reversible: boolean;
    risk: 'low' | 'medium' | 'high' | 'unknown';
    assumptionFactIds?: readonly string[];
  }>;
  modified: Readonly<{
    id: string;
    label: string;
    immediateCashEffectMinor: number;
    expectedBufferEffectMinor: number;
    reversible: boolean;
    risk: 'low' | 'medium' | 'high' | 'unknown';
    assumptionFactIds?: readonly string[];
  }>;
}>;

export type ScenarioComparisonRow = Readonly<{
  id: string;
  label: string;
  immediateCashEffectMinor: number;
  tightestPointEffectMinor: number;
  expectedRangeEffectMinor: number;
  conservativeBoundaryEffectMinor: number;
  essentialCommitmentRisk: 'unchanged' | 'higher' | 'lower' | 'unknown';
  reversible: boolean;
  reliance: TrustedSafeRangeSnapshot['reliance'];
  forecastHorizon: string;
  scenario: DecisionLedgerScenario;
}>;

function scenarioRow(
  baseline: TrustedSafeRangeSnapshot,
  id: string,
  label: string,
  immediateCashEffectMinor: number,
  expectedBufferEffectMinor: number,
  reversible: boolean,
  risk: 'low' | 'medium' | 'high' | 'unknown',
  assumptionFactIds: readonly string[],
): ScenarioComparisonRow {
  return {
    id,
    label,
    immediateCashEffectMinor,
    tightestPointEffectMinor: expectedBufferEffectMinor,
    expectedRangeEffectMinor: expectedBufferEffectMinor,
    conservativeBoundaryEffectMinor: expectedBufferEffectMinor,
    essentialCommitmentRisk:
      expectedBufferEffectMinor < 0
        ? 'higher'
        : expectedBufferEffectMinor > 0
          ? 'lower'
          : 'unchanged',
    reversible,
    reliance: baseline.reliance,
    forecastHorizon: `${baseline.horizonStartISO} to ${baseline.horizonEndISO}`,
    scenario: {
      id: createScenarioId(`scenario_${stableHash(`${id}:${label}`)}`),
      label,
      forecastVersionId: baseline.forecastVersionId,
      summary: `${label}: ${expectedBufferEffectMinor >= 0 ? '+' : ''}${expectedBufferEffectMinor}p buffer effect`,
      assumptionFactIds: [...assumptionFactIds],
      expectedCashDelta: money(immediateCashEffectMinor),
      expectedBufferDelta: money(expectedBufferEffectMinor),
      risk,
    },
  };
}

export function buildDecisionScenarioComparison(
  input: ScenarioComparisonInput,
): readonly ScenarioComparisonRow[] {
  return [
    scenarioRow(input.baseline, 'baseline', 'Do nothing', 0, 0, true, 'low', []),
    scenarioRow(
      input.baseline,
      input.proposed.id,
      input.proposed.label,
      input.proposed.immediateCashEffectMinor,
      input.proposed.expectedBufferEffectMinor,
      input.proposed.reversible,
      input.proposed.risk,
      input.proposed.assumptionFactIds ?? [],
    ),
    scenarioRow(
      input.baseline,
      input.modified.id,
      input.modified.label,
      input.modified.immediateCashEffectMinor,
      input.modified.expectedBufferEffectMinor,
      input.modified.reversible,
      input.modified.risk,
      input.modified.assumptionFactIds ?? [],
    ),
  ];
}

export const RECOVERY_PROTECTION_ORDER = [
  'housing',
  'energy and essential utilities',
  'food and essential transport',
  'legally or practically urgent commitments',
  'user-defined protected buffer',
  'non-essential recurring commitments',
  'flexible savings contributions',
  'optional spending',
] as const;

export type RecoveryMoveOption = Readonly<{
  id: string;
  label: string;
  decisionType: MaterialDecisionKind;
  supportedByState: true;
  reversible: boolean;
  expectedCashDeltaMinor: number;
  expectedBufferDeltaMinor: number;
  affectedFactIds: readonly string[];
  limitation: string | null;
}>;

function optionalSubscription(subscription: Sub): boolean {
  return subscription.usesPerMonth === 0 || subscription.lastUsedDaysAgo >= 30;
}

function potAvailable(pot: Pot): boolean {
  return pot.saved > 0 && pot.allowNegative !== true;
}

export function supportedRecoveryMoves(
  state: AppState,
  safeRange: TrustedSafeRangeSnapshot,
): readonly RecoveryMoveOption[] {
  const shortfallMinor = safeRange.shortfall?.minorUnits ?? 0;
  const moves: RecoveryMoveOption[] = [];
  if (safeRange.missingMaterialInfo.length > 0) {
    moves.push({
      id: 'correct_missing_information',
      label: 'Correct missing information',
      decisionType: 'manual-financial-adjustment',
      supportedByState: true,
      reversible: true,
      expectedCashDeltaMinor: 0,
      expectedBufferDeltaMinor: 0,
      affectedFactIds: safeRange.sourceFactIds,
      limitation: null,
    });
  }
  for (const subscription of state.subs.filter(optionalSubscription).slice(0, 3)) {
    const monthlyMinor = Math.round(subscription.cost * 100);
    moves.push({
      id: `pause_subscription_${stableHash(subscription.name)}`,
      label: `Pause ${subscription.name}`,
      decisionType: 'recurring-commitment-change',
      supportedByState: true,
      reversible: true,
      expectedCashDeltaMinor: monthlyMinor,
      expectedBufferDeltaMinor: monthlyMinor,
      affectedFactIds: [`fact_subscription_${stableHash(subscription.name)}`],
      limitation: 'Only available when the subscription is optional in local state.',
    });
  }
  for (const pot of state.pots.filter(potAvailable).slice(0, 3)) {
    const availableMinor = Math.round(Math.min(pot.saved, Math.max(0, shortfallMinor / 100)) * 100);
    if (availableMinor <= 0) continue;
    moves.push({
      id: `use_pot_${stableHash(pot.id)}`,
      label: `Use ${pot.name}`,
      decisionType: 'pot-borrow',
      supportedByState: true,
      reversible: true,
      expectedCashDeltaMinor: availableMinor,
      expectedBufferDeltaMinor: availableMinor,
      affectedFactIds: [`fact_pot_${pot.id}`],
      limitation: 'Shows repayment consequences; does not assume the pot can go negative.',
    });
  }
  moves.push({
    id: 'bounded_spending_hold',
    label: 'Set a bounded spending hold',
    decisionType: 'spending-hold',
    supportedByState: true,
    reversible: true,
    expectedCashDeltaMinor: 0,
    expectedBufferDeltaMinor: 0,
    affectedFactIds: ['fact_spending_hold'],
    limitation: null,
  });
  moves.push({
    id: 'add_known_incoming_money',
    label: 'Add known incoming money',
    decisionType: 'income-assumption',
    supportedByState: true,
    reversible: true,
    expectedCashDeltaMinor: 0,
    expectedBufferDeltaMinor: 0,
    affectedFactIds: ['fact_income_known_manual'],
    limitation: 'Only user-known income is accepted; future income is not fabricated.',
  });
  return moves;
}

export type PaydayForecastAccountability = Readonly<{
  priorForecast: ReturnType<typeof forecastSnapshotFromSafeRange> | null;
  actualEndPosition: Money | null;
  classification: 'inside_range' | 'conservative' | 'outside_range' | 'unverifiable';
  mainSourceOfError: string;
  relianceAtTheTime: TrustedSafeRangeSnapshot['reliance'] | 'unknown';
  relianceMatchedOutcome: boolean | null;
}>;

export function evaluatePaydayForecastAccountability(
  prior: TrustedSafeRangeSnapshot | null,
  actualEndPositionMinor: number | null,
): PaydayForecastAccountability {
  if (prior === null || actualEndPositionMinor === null) {
    return {
      priorForecast: prior === null ? null : forecastSnapshotFromSafeRange(prior),
      actualEndPosition: money(actualEndPositionMinor),
      classification: 'unverifiable',
      mainSourceOfError: 'Missing prior forecast or closing actual.',
      relianceAtTheTime: prior?.reliance ?? 'unknown',
      relianceMatchedOutcome: null,
    };
  }
  const actual = money(actualEndPositionMinor)!;
  const min = prior.expectedSafeMin?.minorUnits ?? null;
  const max = prior.expectedSafeMax?.minorUnits ?? null;
  const conservative = prior.conservativeBoundary?.minorUnits ?? null;
  const inside =
    min !== null && max !== null && actual.minorUnits >= min && actual.minorUnits <= max;
  const classification = inside
    ? 'inside_range'
    : conservative !== null && actual.minorUnits >= conservative
      ? 'conservative'
      : 'outside_range';
  return {
    priorForecast: forecastSnapshotFromSafeRange(prior),
    actualEndPosition: actual,
    classification,
    mainSourceOfError:
      classification === 'inside_range'
        ? 'No material miss against the recorded forecast range.'
        : (prior.missingMaterialInfo[0] ??
          'Observed cash movement differed from the recorded assumptions.'),
    relianceAtTheTime: prior.reliance,
    relianceMatchedOutcome:
      classification === 'inside_range' || classification === 'conservative'
        ? prior.reliance !== 'blocked'
        : prior.reliance !== 'safe_to_rely',
  };
}

export type CorrectionImpactInput = Readonly<{
  workspaceId: WorkspaceId;
  subject: CorrectionImpactRecord['subject'];
  field: string;
  original: string | number | boolean | null;
  corrected: string | number | boolean | null;
  sourceIds: readonly string[];
  before?: TrustedSafeRangeSnapshot;
  after?: TrustedSafeRangeSnapshot;
  decisions?: readonly DecisionLedgerEntry[];
  correctedAt: Date | string;
  correctedBy: CorrectionImpactRecord['correctedBy'];
  futureBehaviour?: CorrectionImpactRecord['futureBehaviour'];
  reversedByCorrectionId?: string | null;
}>;

function contradictionState(
  before: TrustedSafeRangeSnapshot | undefined,
  after: TrustedSafeRangeSnapshot | undefined,
): CorrectionImpactRecord['contradictionState'] {
  const beforeContradicted = before?.status === 'contradicted' || before?.reliance === 'blocked';
  const afterContradicted = after?.status === 'contradicted' || after?.reliance === 'blocked';
  if (beforeContradicted && !afterContradicted) return 'resolved';
  if (!beforeContradicted && afterContradicted) return 'introduced';
  if (afterContradicted) return 'still_present';
  return 'none';
}

export function deriveCorrectionImpact(input: CorrectionImpactInput): CorrectionImpactRecord {
  const affectedDecisionIds = (input.decisions ?? [])
    .filter((decision) => decisionAffectedBy(decision, input.sourceIds, input.before, input.after))
    .map((decision) => decision.id);
  const correctedAt = instant(input.correctedAt);
  const material = deriveMaterialFinancialChange({
    workspaceId: input.workspaceId,
    type: 'user_correction',
    sourceIds: input.sourceIds,
    truth: 'user_confirmed',
    occurredAt: correctedAt,
    detectedAt: correctedAt,
    ...(input.before === undefined ? {} : { before: input.before }),
    ...(input.after === undefined ? {} : { after: input.after }),
    ...(input.decisions === undefined ? {} : { decisions: input.decisions }),
  });
  return {
    id: `correction_impact_${stableHash(
      [input.workspaceId, input.subject.kind, input.subject.id, input.field, correctedAt].join('|'),
    )}`,
    workspaceId: input.workspaceId,
    correctedAt,
    correctedBy: input.correctedBy,
    subject: input.subject,
    field: input.field,
    original: input.original,
    corrected: input.corrected,
    sourceIds: [...input.sourceIds],
    ...(input.before === undefined ? {} : { before: input.before }),
    ...(input.after === undefined ? {} : { after: input.after }),
    materialChangeId: material?.id ?? null,
    affectedDecisionIds,
    contradictionState: contradictionState(input.before, input.after),
    futureBehaviour: input.futureBehaviour ?? 'ask_before_reusing',
    reversedByCorrectionId: input.reversedByCorrectionId ?? null,
  };
}
