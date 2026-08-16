import {
  createCurrencyCode,
  createDecisionRecordId,
  createForecastId,
  createInstantString,
  createLocalDate,
  createMoney,
  createProvenanceId,
  type CurrencyCode,
  type DecisionLedgerAssumption,
  type DecisionLedgerAuditEntry,
  type DecisionLedgerChoiceState,
  type DecisionLedgerConsent,
  type DecisionLedgerCorrection,
  type DecisionLedgerEntry,
  type DecisionLedgerFactSnapshot,
  type DecisionLedgerForecastEvaluation,
  type DecisionLedgerForecastEvaluationClassification,
  type DecisionLedgerForecastSnapshot,
  type DecisionLedgerMateriality,
  type DecisionLedgerMove,
  type DecisionLedgerPriorityType,
  type DecisionLedgerQuestionSource,
  type DecisionLedgerSafeRangeSnapshot,
  type DecisionLedgerScenario,
  type DecisionRecordId,
  type InstantString,
  type MaterialDecisionKind,
  type Money,
  type ScenarioId,
  type TrustedCoreConfidence,
  type TrustedSafeRangeResult,
  type UserCorrectionId,
  type WorkspaceId,
  type WorkspaceKind,
} from '@folio/domain';

const GBP = createCurrencyCode('GBP');

export const DECISION_LEDGER_MATERIALITY_THRESHOLDS = {
  cashEffectMinor: 1_000,
  bufferEffectMinor: 500,
  assumptionIncomeMinor: 5_000,
  daysShifted: 1,
} as const;

export const PHASE_D_BUSINESS_LEDGER_ENABLED = false;

export type DecisionLedgerWorkspaceKind = Extract<WorkspaceKind, 'personal' | 'business'>;

export type DecisionLedgerMutationResult = Readonly<{
  entries: DecisionLedgerEntry[];
  entry: DecisionLedgerEntry | null;
  accepted: boolean;
  reason: string;
}>;

export type DecisionLedgerMaterialityInput = Readonly<{
  decisionType: MaterialDecisionKind;
  amountMinor?: number | null;
  bufferDeltaMinor?: number | null;
  daysShifted?: number | null;
  affectsShortfall?: boolean;
  confirmedAction?: boolean;
  currency?: CurrencyCode | string;
}>;

export type CreateDecisionDraftInput = DecisionLedgerMaterialityInput &
  Readonly<{
    idempotencyKey: string;
    workspaceId: WorkspaceId;
    workspaceKind: DecisionLedgerWorkspaceKind;
    contextRoute: string;
    question: string;
    questionSource?: DecisionLedgerQuestionSource;
    priority?: DecisionLedgerPriorityType;
    now: Date | string;
    safeRange?: TrustedSafeRangeResult | DecisionLedgerSafeRangeSnapshot | null;
    forecast?: DecisionLedgerForecastSnapshot | null;
    factSnapshots?: readonly DecisionLedgerFactSnapshot[];
    unknowns?: DecisionLedgerEntry['unknowns'];
    contradictions?: DecisionLedgerEntry['contradictions'];
    assumptions?: readonly DecisionLedgerAssumption[] | readonly string[];
    scenarios?: readonly DecisionLedgerScenario[];
    proposedMoves?: readonly DecisionLedgerMove[];
    meloExplanation?: string | null;
    outcomeExpected?: boolean;
    learningPermitted?: boolean;
    provenanceLabel?: string;
    enableBusinessWorkspace?: boolean;
  }>;

export type RecordChoiceInput = Readonly<{
  entryId: DecisionRecordId;
  state: DecisionLedgerChoiceState;
  selectedScenarioId?: ScenarioId | null;
  selectedMoveIds?: readonly string[];
  note?: string | null;
  actor?: 'user' | 'melo' | 'system';
  now: Date | string;
  commandId?: string | null;
}>;

export type ConsentInput = Readonly<{
  entryId: DecisionRecordId;
  required: boolean;
  granted: boolean | null;
  label?: string | null;
  sourceControlId?: string | null;
  now: Date | string;
  commandId?: string | null;
}>;

export type OutcomeInput = Readonly<{
  entryId: DecisionRecordId;
  state: DecisionLedgerEntry['outcome']['state'];
  actualCashDeltaMinor?: number | null;
  actualBufferDeltaMinor?: number | null;
  actualSourceFactIds?: readonly string[];
  note?: string | null;
  forecastErrorMinor?: number | null;
  now: Date | string;
  commandId?: string | null;
  currency?: CurrencyCode | string;
}>;

export type ForecastEvaluationInput = Readonly<{
  entryId: DecisionRecordId;
  forecast?: DecisionLedgerForecastSnapshot | null;
  actualTightestPointMinor?: number | null;
  actualEndPositionMinor?: number | null;
  note?: string | null;
  now: Date | string;
  sourceFactIds?: readonly string[];
  currency?: CurrencyCode | string;
}>;

export type CorrectionInput = Readonly<{
  entryId: DecisionRecordId;
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
  reason: string;
  userCorrectionId?: UserCorrectionId | null;
  recalculatesForecast?: boolean;
  now: Date | string;
  commandId?: string | null;
}>;

function currency(input?: CurrencyCode | string): CurrencyCode {
  return typeof input === 'string' ? createCurrencyCode(input) : (input ?? GBP);
}

function money(minorUnits: number | null | undefined, code?: CurrencyCode | string): Money | null {
  if (minorUnits === null || minorUnits === undefined) return null;
  return createMoney({ minorUnits: Math.round(minorUnits), currency: currency(code) });
}

function cloneMoney(value: Money | null): Money | null {
  return value === null
    ? null
    : createMoney({ minorUnits: value.minorUnits, currency: value.currency });
}

function cloneFactSnapshot(fact: DecisionLedgerFactSnapshot): DecisionLedgerFactSnapshot {
  const base = {
    ...fact,
    amount: cloneMoney(fact.amount),
    assumptions: [...fact.assumptions],
    derivedFrom: [...fact.derivedFrom],
  };
  return fact.sourceRecordIds === undefined
    ? base
    : { ...base, sourceRecordIds: [...fact.sourceRecordIds] };
}

function cloneUnknown(unknown: DecisionLedgerEntry['unknowns'][number]) {
  return { ...unknown, sourceFactIds: [...unknown.sourceFactIds] };
}

function cloneContradiction(contradiction: DecisionLedgerEntry['contradictions'][number]) {
  return { ...contradiction, sourceFactIds: [...contradiction.sourceFactIds] };
}

function cloneAssumption(assumption: DecisionLedgerAssumption): DecisionLedgerAssumption {
  return {
    ...assumption,
    amount: cloneMoney(assumption.amount),
    sourceFactIds: [...assumption.sourceFactIds],
  };
}

function cloneScenario(scenario: DecisionLedgerScenario): DecisionLedgerScenario {
  return {
    ...scenario,
    assumptionFactIds: [...scenario.assumptionFactIds],
    expectedCashDelta: cloneMoney(scenario.expectedCashDelta),
    expectedBufferDelta: cloneMoney(scenario.expectedBufferDelta),
  };
}

function cloneForecastSnapshot(
  forecast: DecisionLedgerForecastSnapshot,
): DecisionLedgerForecastSnapshot {
  return {
    ...forecast,
    predictedTightestPoint: cloneMoney(forecast.predictedTightestPoint),
    predictedEndPosition: cloneMoney(forecast.predictedEndPosition),
    predictedSafeMin: cloneMoney(forecast.predictedSafeMin),
    predictedSafeMax: cloneMoney(forecast.predictedSafeMax),
    conservativeBoundary: cloneMoney(forecast.conservativeBoundary),
    sourceFactIds: [...forecast.sourceFactIds],
  };
}

function cloneMove(move: DecisionLedgerMove): DecisionLedgerMove {
  return {
    ...move,
    expectedCashDelta: cloneMoney(move.expectedCashDelta),
    expectedBufferDelta: cloneMoney(move.expectedBufferDelta),
    affectedFactIds: [...move.affectedFactIds],
  };
}

function instant(input: Date | string): InstantString {
  const raw = input instanceof Date ? input.toISOString() : input;
  return createInstantString(new Date(raw).toISOString());
}

function dayFromInstant(input: InstantString) {
  return createLocalDate(String(input).slice(0, 10));
}

function idPart(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 88);
  return normalized.length >= 3 ? normalized : 'material_decision';
}

function decisionId(input: string): DecisionRecordId {
  return createDecisionRecordId(`decision_${idPart(input)}`);
}

function stableDerivedId(prefix: string, entryId: DecisionRecordId, at: InstantString): string {
  return `${prefix}_${idPart(`${String(entryId)}_${String(at)}`)}`.slice(0, 128);
}

function audit(
  at: InstantString,
  action: DecisionLedgerAuditEntry['action'],
  actor: DecisionLedgerAuditEntry['actor'],
  ref: string | null = null,
  commandId: string | null = null,
): DecisionLedgerAuditEntry {
  return { at, action, actor, ref, commandId };
}

function replaceEntry(
  entries: readonly DecisionLedgerEntry[],
  next: DecisionLedgerEntry,
): DecisionLedgerEntry[] {
  return entries.map((entry) => (entry.id === next.id ? next : entry));
}

function findEntry(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
): DecisionLedgerEntry | null {
  return entries.find((entry) => entry.id === entryId) ?? null;
}

function commandAlreadyApplied(
  entries: readonly DecisionLedgerEntry[],
  commandId: string,
): DecisionLedgerEntry | null {
  return (
    entries.find((entry) => entry.audit.some((event) => event.commandId === commandId)) ?? null
  );
}

export function evaluateDecisionMateriality(
  input: DecisionLedgerMaterialityInput,
): DecisionLedgerMateriality {
  const code = currency(input.currency);
  const amountMinor = Math.round(input.amountMinor ?? 0);
  const bufferMinor = Math.round(input.bufferDeltaMinor ?? 0);
  const daysShifted = input.daysShifted ?? null;
  const rules: string[] = [];

  if (Math.abs(amountMinor) >= DECISION_LEDGER_MATERIALITY_THRESHOLDS.cashEffectMinor) {
    rules.push('cash-effect-gte-10gbp');
  }
  if (Math.abs(bufferMinor) >= DECISION_LEDGER_MATERIALITY_THRESHOLDS.bufferEffectMinor) {
    rules.push('safe-buffer-effect-gte-5gbp');
  }
  if (Math.abs(daysShifted ?? 0) >= DECISION_LEDGER_MATERIALITY_THRESHOLDS.daysShifted) {
    rules.push('date-shift-gte-1-day');
  }
  if (input.affectsShortfall === true) rules.push('changes-shortfall-state');
  if (
    input.decisionType === 'income-assumption' &&
    Math.abs(amountMinor) >= DECISION_LEDGER_MATERIALITY_THRESHOLDS.assumptionIncomeMinor
  ) {
    rules.push('income-assumption-gte-50gbp');
  }
  if (input.decisionType === 'payday-plan') rules.push('cycle-close-accountability');

  return {
    accepted: rules.length > 0,
    ruleIds: rules,
    reason:
      rules.length > 0
        ? `Accepted by ${rules.join(', ')}.`
        : 'Rejected: below materiality thresholds.',
    cashEffect: amountMinor === 0 ? null : createMoney({ minorUnits: amountMinor, currency: code }),
    bufferEffect:
      bufferMinor === 0 ? null : createMoney({ minorUnits: bufferMinor, currency: code }),
    daysShifted,
    affectsShortfall: input.affectsShortfall === true,
  };
}

export function safeRangeSnapshotFromResult(
  result: TrustedSafeRangeResult | DecisionLedgerSafeRangeSnapshot,
): DecisionLedgerSafeRangeSnapshot {
  if ('tightestPointAmount' in result) {
    return {
      ...result,
      currentKnownPosition: cloneMoney(result.currentKnownPosition),
      knownCommittedFloor: cloneMoney(result.knownCommittedFloor),
      expectedSafeMin: cloneMoney(result.expectedSafeMin),
      expectedSafeMax: cloneMoney(result.expectedSafeMax),
      conservativeBoundary: cloneMoney(result.conservativeBoundary),
      tightestPointAmount: cloneMoney(result.tightestPointAmount),
      shortfall: cloneMoney(result.shortfall),
      missingMaterialInfo: [...result.missingMaterialInfo],
      assumptions: [...result.assumptions],
      sourceFactIds: [...result.sourceFactIds],
    };
  }
  const sourceFactIds = Array.from(
    new Set([
      ...result.sourceBreakdown.map((source) => source.factId),
      ...result.mainCauses.flatMap((cause) => cause.sourceFactIds),
      ...result.missingInputs.flatMap((issue) => issue.sourceFactIds),
      ...result.contradictions.flatMap((issue) => issue.sourceFactIds),
    ]),
  );
  return {
    forecastVersionId: result.forecastVersionId,
    provenanceId: result.provenanceId,
    calculatedAt: result.calculatedAt,
    horizonStartISO: result.horizonStartISO,
    horizonEndISO: result.horizonEndISO,
    status: result.status,
    reliance: result.reliance,
    confidence: result.confidence,
    freshness: result.freshness,
    currentKnownPosition: cloneMoney(result.currentKnownPosition),
    knownCommittedFloor: cloneMoney(result.knownCommittedFloor),
    expectedSafeMin: cloneMoney(result.expectedSafeMin),
    expectedSafeMax: cloneMoney(result.expectedSafeMax),
    conservativeBoundary: cloneMoney(result.conservativeBoundary),
    tightestPointDateISO: result.tightestPoint.dateISO,
    tightestPointAmount: cloneMoney(result.tightestPoint.amount),
    shortfall: cloneMoney(result.shortfall),
    missingMaterialInfo: [...result.missingMaterialInfo],
    assumptions: [...result.assumptions],
    sourceFactIds,
    canUserRelyOnAnswer: result.canUserRelyOnAnswer,
  };
}

export function forecastSnapshotFromSafeRange(
  safeRange: DecisionLedgerSafeRangeSnapshot | null,
): DecisionLedgerForecastSnapshot | null {
  if (safeRange === null) return null;
  return {
    forecastVersionId: safeRange.forecastVersionId,
    createdAt: safeRange.calculatedAt,
    horizonStartISO: safeRange.horizonStartISO,
    horizonEndISO: safeRange.horizonEndISO,
    predictedTightestPoint: cloneMoney(safeRange.tightestPointAmount),
    predictedEndPosition: cloneMoney(safeRange.expectedSafeMax),
    predictedSafeMin: cloneMoney(safeRange.expectedSafeMin),
    predictedSafeMax: cloneMoney(safeRange.expectedSafeMax),
    conservativeBoundary: cloneMoney(safeRange.conservativeBoundary),
    confidence: safeRange.confidence,
    sourceFactIds: [...safeRange.sourceFactIds],
  };
}

function localDateMs(input: string): number {
  return Date.parse(`${input}T00:00:00.000Z`);
}

function forecastSnapshotIsValid(snapshot: DecisionLedgerForecastSnapshot): boolean {
  const start = localDateMs(String(snapshot.horizonStartISO));
  const end = localDateMs(String(snapshot.horizonEndISO));
  return (
    String(snapshot.forecastVersionId).length > 0 &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= end &&
    Array.isArray(snapshot.sourceFactIds)
  );
}

function safeRangeSnapshotIsValid(snapshot: DecisionLedgerSafeRangeSnapshot): boolean {
  const start = localDateMs(String(snapshot.horizonStartISO));
  const end = localDateMs(String(snapshot.horizonEndISO));
  return (
    String(snapshot.forecastVersionId).length > 0 &&
    String(snapshot.provenanceId).length > 0 &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= end &&
    Array.isArray(snapshot.sourceFactIds) &&
    Array.isArray(snapshot.assumptions) &&
    Array.isArray(snapshot.missingMaterialInfo)
  );
}

function assumptionsFromInput(
  input: readonly DecisionLedgerAssumption[] | readonly string[] | undefined,
  code: CurrencyCode,
): { assumptions: DecisionLedgerAssumption[]; labels: string[] } {
  if (!input) return { assumptions: [], labels: [] };
  if (input.every((item): item is string => typeof item === 'string')) {
    const assumptions = input.map((label, index) => ({
      id: `assumption_${index + 1}_${idPart(label)}`.slice(0, 128),
      label,
      truthClass: 'assumed' as const,
      confidence: 'medium' as const,
      amount: null,
      sourceFactIds: [],
    }));
    return { assumptions, labels: [...input] };
  }
  const assumptions = input as readonly DecisionLedgerAssumption[];
  return {
    assumptions: assumptions.map(cloneAssumption),
    labels: assumptions.map((item) => item.label),
  };
}

function makeFallbackForecast(input: {
  idempotencyKey: string;
  now: InstantString;
  amountMinor: number;
  bufferDeltaMinor: number;
  currency: CurrencyCode;
  sourceFactIds: readonly string[];
}): DecisionLedgerForecastSnapshot {
  const amount = money(input.amountMinor, input.currency);
  const buffer = money(input.bufferDeltaMinor || input.amountMinor, input.currency);
  return {
    forecastVersionId: createForecastId(`forecast_decision_${idPart(input.idempotencyKey)}`),
    createdAt: input.now,
    horizonStartISO: dayFromInstant(input.now),
    horizonEndISO: dayFromInstant(input.now),
    predictedTightestPoint: buffer,
    predictedEndPosition: amount,
    predictedSafeMin: buffer,
    predictedSafeMax: buffer,
    conservativeBoundary: buffer,
    confidence: 'medium',
    sourceFactIds: input.sourceFactIds,
  };
}

export function createDecisionDraft(
  entries: readonly DecisionLedgerEntry[],
  input: CreateDecisionDraftInput,
): DecisionLedgerMutationResult {
  if (input.workspaceKind === 'business' && input.enableBusinessWorkspace !== true) {
    return {
      entries: [...entries],
      entry: null,
      accepted: false,
      reason: 'Business Decision Ledger is out of Phase D scope.',
    };
  }
  const existing = commandAlreadyApplied(entries, input.idempotencyKey);
  if (existing !== null) {
    return {
      entries: [...entries],
      entry: existing,
      accepted: true,
      reason: 'Already recorded.',
    };
  }

  const materiality = evaluateDecisionMateriality(input);
  if (!materiality.accepted) {
    return { entries: [...entries], entry: null, accepted: false, reason: materiality.reason };
  }

  const at = instant(input.now);
  const id = decisionId(input.idempotencyKey);
  const code = currency(input.currency);
  let safeRange: DecisionLedgerSafeRangeSnapshot | null = null;
  try {
    safeRange = input.safeRange ? safeRangeSnapshotFromResult(input.safeRange) : null;
  } catch {
    return {
      entries: [...entries],
      entry: null,
      accepted: false,
      reason: 'Rejected: malformed Safe Range snapshot.',
    };
  }
  if (safeRange !== null && !safeRangeSnapshotIsValid(safeRange)) {
    return {
      entries: [...entries],
      entry: null,
      accepted: false,
      reason: 'Rejected: malformed Safe Range snapshot.',
    };
  }
  if (
    input.forecast !== null &&
    input.forecast !== undefined &&
    !forecastSnapshotIsValid(input.forecast)
  ) {
    return {
      entries: [...entries],
      entry: null,
      accepted: false,
      reason: 'Rejected: malformed forecast snapshot.',
    };
  }
  const factSnapshots = (input.factSnapshots ?? []).map(cloneFactSnapshot);
  const factRefs = Array.from(
    new Set([
      ...factSnapshots.map((fact) => fact.factId),
      ...(safeRange?.sourceFactIds ?? []),
      ...(input.forecast?.sourceFactIds ?? []),
    ]),
  );
  const truthClasses = Object.fromEntries(
    factSnapshots.map((fact) => [fact.factId, fact.truthClass]),
  );
  const { assumptions, labels: assumptionLabels } = assumptionsFromInput(input.assumptions, code);
  const forecast =
    (input.forecast === undefined || input.forecast === null
      ? null
      : cloneForecastSnapshot(input.forecast)) ??
    forecastSnapshotFromSafeRange(safeRange) ??
    makeFallbackForecast({
      idempotencyKey: input.idempotencyKey,
      now: at,
      amountMinor: Math.round(input.amountMinor ?? 0),
      bufferDeltaMinor: Math.round(input.bufferDeltaMinor ?? 0),
      currency: code,
      sourceFactIds: factRefs,
    });

  const consent: DecisionLedgerConsent = {
    required: false,
    granted: null,
    capturedAt: null,
    label: null,
    sourceControlId: null,
  };

  const entry: DecisionLedgerEntry = {
    id,
    workspaceId: input.workspaceId,
    workspaceKind: input.workspaceKind,
    decisionType: input.decisionType,
    materialDecisionKind: input.decisionType,
    status: 'draft',
    createdAt: at,
    updatedAt: at,
    presentedAt: null,
    resolvedAt: null,
    expiresAt: null,
    question: {
      text: input.question.trim(),
      source: input.questionSource ?? 'user',
      priority: input.priority ?? 'cashflow_confidence',
    },
    userQuestion: input.question.trim(),
    userPriority: input.priority ?? 'cashflow_confidence',
    contextRoute: input.contextRoute,
    materiality,
    factSnapshots,
    factRefs,
    truthClasses,
    unknowns: (input.unknowns ?? []).map(cloneUnknown),
    missingInformation: [...(safeRange?.missingMaterialInfo ?? [])],
    contradictions: (input.contradictions ?? []).map(cloneContradiction),
    assumptions,
    assumptionLabels,
    safeRange,
    forecast,
    scenarios: (input.scenarios ?? []).map(cloneScenario),
    chosenScenarioId: null,
    forecastVersionId: forecast.forecastVersionId,
    meloExplanation: input.meloExplanation ?? null,
    proposedMoves: (input.proposedMoves ?? []).map(cloneMove),
    userChoice: {
      state: 'unknown',
      selectedScenarioId: null,
      selectedMoveIds: [],
      recordedAt: null,
      actor: 'user',
      note: null,
    },
    consent,
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
      permitted: input.learningPermitted === true,
      disabledAt: input.learningPermitted === true ? null : at,
      removedAt: null,
      memoryRefs: [],
    },
    learningPermitted: input.learningPermitted === true,
    audit: [audit(at, 'draft_created', 'system', input.contextRoute, input.idempotencyKey)],
    provenanceId: createProvenanceId(
      `provenance_decision_${idPart(input.provenanceLabel ?? input.idempotencyKey)}`,
    ),
  };

  return {
    entries: [entry, ...entries],
    entry,
    accepted: true,
    reason: materiality.reason,
  };
}

export function attachSafeRange(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  safeRange: TrustedSafeRangeResult | DecisionLedgerSafeRangeSnapshot,
  now: Date | string,
  commandId: string | null = null,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(now);
  const snapshot = safeRangeSnapshotFromResult(safeRange);
  const forecast = forecastSnapshotFromSafeRange(snapshot);
  const next: DecisionLedgerEntry = {
    ...entry,
    updatedAt: at,
    safeRange: snapshot,
    forecast,
    forecastVersionId: forecast?.forecastVersionId ?? entry.forecastVersionId,
    factRefs: Array.from(new Set([...entry.factRefs, ...snapshot.sourceFactIds])),
    missingInformation: snapshot.missingMaterialInfo,
    audit: [...entry.audit, audit(at, 'safe_range_attached', 'system', null, commandId)],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Safe Range attached.',
  };
}

export function attachScenarios(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  scenarios: readonly DecisionLedgerScenario[],
  now: Date | string,
  commandId: string | null = null,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(now);
  const next: DecisionLedgerEntry = {
    ...entry,
    updatedAt: at,
    scenarios: scenarios.map(cloneScenario),
    audit: [...entry.audit, audit(at, 'scenarios_attached', 'system', null, commandId)],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Scenarios attached.',
  };
}

export function markPresented(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  now: Date | string,
  commandId: string | null = null,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(now);
  const next: DecisionLedgerEntry = {
    ...entry,
    status: 'presented',
    updatedAt: at,
    presentedAt: entry.presentedAt ?? at,
    audit: [...entry.audit, audit(at, 'presented', 'system', entry.contextRoute, commandId)],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Decision presented.',
  };
}

export function recordChoice(
  entries: readonly DecisionLedgerEntry[],
  input: RecordChoiceInput,
): DecisionLedgerMutationResult {
  if (input.commandId && commandAlreadyApplied(entries, input.commandId) !== null) {
    const existing = findEntry(entries, input.entryId);
    return { entries: [...entries], entry: existing, accepted: true, reason: 'Already recorded.' };
  }
  const entry = findEntry(entries, input.entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  if (entry.status === 'resolved' || entry.status === 'deleted') {
    return { entries: [...entries], entry, accepted: false, reason: 'Decision is closed.' };
  }
  const at = instant(input.now);
  const next: DecisionLedgerEntry = {
    ...entry,
    status: input.state === 'rejected' ? 'declined' : 'chosen',
    updatedAt: at,
    chosenScenarioId: input.selectedScenarioId ?? null,
    userChoice: {
      state: input.state,
      selectedScenarioId: input.selectedScenarioId ?? null,
      selectedMoveIds: [...(input.selectedMoveIds ?? [])],
      recordedAt: at,
      actor: input.actor ?? 'user',
      note: input.note ?? null,
    },
    audit: [
      ...entry.audit,
      audit(at, 'choice_recorded', input.actor ?? 'user', null, input.commandId ?? null),
    ],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Choice recorded.',
  };
}

export function recordConsent(
  entries: readonly DecisionLedgerEntry[],
  input: ConsentInput,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, input.entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(input.now);
  const next: DecisionLedgerEntry = {
    ...entry,
    status: entry.status,
    updatedAt: at,
    consent: {
      required: input.required,
      granted: input.granted,
      capturedAt: input.granted === null ? null : at,
      label: input.label ?? null,
      sourceControlId: input.sourceControlId ?? null,
    },
    audit: [...entry.audit, audit(at, 'consent_recorded', 'user', null, input.commandId ?? null)],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Consent recorded.',
  };
}

export function markAwaitingOutcome(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  now: Date | string,
  commandId: string | null = null,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(now);
  const next: DecisionLedgerEntry = {
    ...entry,
    status: 'awaiting-outcome',
    updatedAt: at,
    audit: [...entry.audit, audit(at, 'awaiting_outcome', 'system', null, commandId)],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Awaiting outcome.',
  };
}

export function resolveOutcome(
  entries: readonly DecisionLedgerEntry[],
  input: OutcomeInput,
): DecisionLedgerMutationResult {
  if (input.commandId && commandAlreadyApplied(entries, input.commandId) !== null) {
    const existing = findEntry(entries, input.entryId);
    return { entries: [...entries], entry: existing, accepted: true, reason: 'Already recorded.' };
  }
  const entry = findEntry(entries, input.entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  if (entry.outcome.checkedAt !== null && entry.status === 'resolved') {
    return { entries: [...entries], entry, accepted: false, reason: 'Outcome already resolved.' };
  }
  const at = instant(input.now);
  const code = currency(input.currency);
  const next: DecisionLedgerEntry = {
    ...entry,
    status: 'resolved',
    updatedAt: at,
    resolvedAt: at,
    outcome: {
      checkedAt: at,
      state: input.state,
      actualCashDelta: money(input.actualCashDeltaMinor ?? null, code),
      actualBufferDelta: money(input.actualBufferDeltaMinor ?? null, code),
      actualSourceFactIds: [...(input.actualSourceFactIds ?? [])],
      note: input.note ?? null,
      forecastError: money(input.forecastErrorMinor ?? null, code),
    },
    audit: [...entry.audit, audit(at, 'outcome_resolved', 'system', null, input.commandId ?? null)],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Outcome resolved.',
  };
}

export function evaluateForecast(
  entries: readonly DecisionLedgerEntry[],
  input: ForecastEvaluationInput,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, input.entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const expected =
    input.forecast === undefined || input.forecast === null
      ? entry.forecast
      : cloneForecastSnapshot(input.forecast);
  if (expected === null) {
    return {
      entries: [...entries],
      entry,
      accepted: false,
      reason: 'No forecast snapshot to evaluate.',
    };
  }
  const at = instant(input.now);
  const code = currency(input.currency);
  const actualTightest = money(input.actualTightestPointMinor ?? null, code);
  const actualEnd = money(input.actualEndPositionMinor ?? null, code);
  const expectedPoint = expected.predictedTightestPoint ?? expected.predictedEndPosition;
  const actualPoint = actualTightest ?? actualEnd;
  const error =
    expectedPoint !== null && actualPoint !== null
      ? money(actualPoint.minorUnits - expectedPoint.minorUnits, code)
      : null;
  const classification = classifyForecastEvaluation(expected, actualPoint);
  const evaluation: DecisionLedgerForecastEvaluation = {
    id: stableDerivedId('forecast_eval', entry.id, at),
    evaluatedAt: at,
    forecastVersionId: expected.forecastVersionId,
    expected: cloneForecastSnapshot(expected),
    actualTightestPoint: actualTightest,
    actualEndPosition: actualEnd,
    error,
    classification,
    confidence: classification === 'unknown' ? 'blocked' : evaluationConfidence(error),
    note: input.note ?? null,
    sourceFactIds: [...(input.sourceFactIds ?? [])],
  };
  const next: DecisionLedgerEntry = {
    ...entry,
    updatedAt: at,
    forecastEvaluations: [evaluation, ...entry.forecastEvaluations],
    audit: [...entry.audit, audit(at, 'forecast_evaluated', 'system', null, evaluation.id)],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Forecast evaluated.',
  };
}

function classifyForecastEvaluation(
  expected: DecisionLedgerForecastSnapshot,
  actual: Money | null,
): DecisionLedgerForecastEvaluationClassification {
  if (actual === null) return 'unknown';
  if (
    expected.predictedSafeMin !== null &&
    expected.predictedSafeMax !== null &&
    actual.minorUnits >= expected.predictedSafeMin.minorUnits &&
    actual.minorUnits <= expected.predictedSafeMax.minorUnits
  ) {
    return 'inside_range';
  }
  if (
    expected.conservativeBoundary !== null &&
    actual.minorUnits >= expected.conservativeBoundary.minorUnits
  ) {
    return 'conservative';
  }
  return 'outside_range';
}

function evaluationConfidence(error: Money | null): TrustedCoreConfidence {
  if (error === null) return 'blocked';
  const magnitude = Math.abs(error.minorUnits);
  if (magnitude <= 500) return 'high';
  if (magnitude <= 2_500) return 'medium';
  return 'low';
}

export function addCorrection(
  entries: readonly DecisionLedgerEntry[],
  input: CorrectionInput,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, input.entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(input.now);
  const correction: DecisionLedgerCorrection = {
    id: stableDerivedId('decision_correction', entry.id, at),
    correctedAt: at,
    field: input.field,
    before: input.before,
    after: input.after,
    reason: input.reason,
    userCorrectionId: input.userCorrectionId ?? null,
    recalculatesForecast: input.recalculatesForecast === true,
  };
  const refs =
    correction.userCorrectionId === null
      ? entry.userCorrectionRefs
      : Array.from(new Set([...entry.userCorrectionRefs, correction.userCorrectionId]));
  const next: DecisionLedgerEntry = {
    ...entry,
    status: 'corrected',
    updatedAt: at,
    corrections: [correction, ...entry.corrections],
    userCorrectionRefs: refs,
    audit: [
      ...entry.audit,
      audit(at, 'correction_added', 'user', correction.id, input.commandId ?? null),
    ],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Correction added.',
  };
}

export function cancelDecision(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  now: Date | string,
  commandId: string | null = null,
): DecisionLedgerMutationResult {
  return closeDecision(entries, entryId, 'cancelled', 'cancelled', now, commandId);
}

export function expireDecision(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  now: Date | string,
  commandId: string | null = null,
): DecisionLedgerMutationResult {
  return closeDecision(entries, entryId, 'expired', 'expired', now, commandId);
}

function closeDecision(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  status: 'cancelled' | 'expired',
  action: 'cancelled' | 'expired',
  now: Date | string,
  commandId: string | null,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(now);
  const next: DecisionLedgerEntry = {
    ...entry,
    status,
    updatedAt: at,
    resolvedAt: at,
    outcome: {
      ...entry.outcome,
      checkedAt: at,
      state: status === 'cancelled' ? 'user-reversed' : 'expired',
    },
    audit: [...entry.audit, audit(at, action, 'user', null, commandId)],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: `Decision ${status}.`,
  };
}

export function disableDecisionLearning(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  now: Date | string,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(now);
  const next: DecisionLedgerEntry = {
    ...entry,
    updatedAt: at,
    learning: { ...entry.learning, permitted: false, disabledAt: entry.learning.disabledAt ?? at },
    learningPermitted: false,
    audit: [...entry.audit, audit(at, 'learning_disabled', 'user')],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Learning disabled.',
  };
}

export function removeDecisionLearning(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  now: Date | string,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(now);
  const next: DecisionLedgerEntry = {
    ...entry,
    updatedAt: at,
    learning: {
      ...entry.learning,
      permitted: false,
      disabledAt: entry.learning.disabledAt ?? at,
      removedAt: at,
      memoryRefs: [],
    },
    learningPermitted: false,
    audit: [...entry.audit, audit(at, 'learning_removed', 'user')],
  };
  return {
    entries: replaceEntry(entries, next),
    entry: next,
    accepted: true,
    reason: 'Learning removed.',
  };
}

export function deleteDecision(
  entries: readonly DecisionLedgerEntry[],
  entryId: DecisionRecordId,
  now: Date | string,
): DecisionLedgerMutationResult {
  const entry = findEntry(entries, entryId);
  if (entry === null)
    return { entries: [...entries], entry: null, accepted: false, reason: 'Missing decision.' };
  const at = instant(now);
  // Individual delete is a privacy action, not a soft-hide. Return a redacted receipt for the caller's
  // immediate UI, but remove the durable entry so the next JSON/CSV export no longer carries it.
  const tombstone: DecisionLedgerEntry = {
    ...entry,
    status: 'deleted',
    updatedAt: at,
    resolvedAt: at,
    learning: {
      ...entry.learning,
      permitted: false,
      disabledAt: entry.learning.disabledAt ?? at,
      removedAt: at,
      memoryRefs: [],
    },
    learningPermitted: false,
    audit: [...entry.audit, audit(at, 'deleted', 'user')],
  };
  return {
    entries: entries.filter((candidate) => candidate.id !== entryId),
    entry: tombstone,
    accepted: true,
    reason: 'Decision deleted.',
  };
}

export function exportDecisionLedger(
  entries: readonly DecisionLedgerEntry[],
  workspaceId: WorkspaceId,
): readonly DecisionLedgerEntry[] {
  return entries.filter((entry) => entry.workspaceId === workspaceId && entry.status !== 'deleted');
}

export function decisionLedgerGroups(entries: readonly DecisionLedgerEntry[]) {
  const visible = entries.filter((entry) => entry.status !== 'deleted');
  return {
    awaitingOutcome: visible.filter((entry) => entry.status === 'awaiting-outcome'),
    recentlyResolved: visible.filter(
      (entry) => entry.status === 'resolved' || entry.status === 'corrected',
    ),
    draftOrCancelled: visible.filter(
      (entry) =>
        entry.status === 'draft' ||
        entry.status === 'presented' ||
        entry.status === 'chosen' ||
        entry.status === 'declined' ||
        entry.status === 'cancelled' ||
        entry.status === 'expired',
    ),
  };
}

export function receiptSummary(entry: DecisionLedgerEntry): readonly string[] {
  const lines = [
    `${entry.question.text}`,
    `Decision: ${entry.decisionType}`,
    `Status: ${entry.status}`,
    entry.safeRange?.canUserRelyOnAnswer === false ? 'Safe Range: use caution' : null,
    entry.outcome.state !== 'unknown' ? `Outcome: ${entry.outcome.state}` : null,
    entry.forecastEvaluations[0]
      ? `Forecast: ${entry.forecastEvaluations[0].classification}`
      : null,
  ];
  return lines.filter((line): line is string => line !== null);
}
