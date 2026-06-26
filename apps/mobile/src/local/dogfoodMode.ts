import {
  sanitiseDiagnosticBundle,
  type CanonicalRepositorySnapshot,
  type JsonRecord,
} from '@folio/storage';

import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import {
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  isPrivateExampleLedger,
  type LocalLedgerState,
  type LocalRouteSummary,
} from './localLedger.js';
import {
  createProductExperienceFixtures,
  type ProductExperienceFixtureId,
} from './productExperienceFixtures.js';

export const dogfoodModeContract = {
  id: 'folio-v2-pre-dogfood-owner-harness',
  label: 'Internal test mode',
  localOnly: true,
  uploadAllowed: false,
  requiresAccount: false,
  requiresAi: false,
  requiresCloud: false,
  requiresOpenBanking: false,
  syntheticSeedsOnly: true,
} as const;

export type DogfoodTargetScreen =
  | 'calendar'
  | 'data'
  | 'firstMinute'
  | 'import'
  | 'plans'
  | 'recovery'
  | 'sampleBriefing'
  | 'timeline'
  | 'today';

export type DogfoodScenarioSeed = Readonly<{
  canonicalRecordCounts: Readonly<{
    auditLog: number;
    calendarItems: number;
    decisions: number;
    documents: number;
    events: number;
    importDrafts: number;
    importedClaims: number;
    plans: number;
    scenarios: number;
    transactions: number;
  }>;
  description: string;
  expectedSurfaces: readonly string[];
  id: ProductExperienceFixtureId;
  sampleOnly: boolean;
  state: LocalLedgerState;
  synthetic: true;
  targetScreen: DogfoodTargetScreen;
  title: string;
}>;

export type DogfoodCanonicalObjectCounts = Readonly<
  Record<keyof CanonicalRepositorySnapshot['collections'], number>
>;

export type DogfoodStatus = Readonly<{
  canonicalObjectCounts: DogfoodCanonicalObjectCounts;
  dogfoodMode: typeof dogfoodModeContract;
  importReviewState: Readonly<{
    activeDrafts: number;
    rejectedEvidence: number;
    sourceFiles: number;
  }>;
  meloProposalCount: number;
  planRecoveryState: Readonly<{
    activePlans: number;
    acceptedRecoveries: number;
    decisions: number;
    impactsNeedingReview: number;
    planRules: number;
    previewWritesImmediately: false;
  }>;
  routeState: Readonly<{
    confirmedRecords: number;
    pendingReview: number;
    protectedItemCount: number;
    routePoints: number;
    tightestLabel: string;
  }>;
  workspaceState: Readonly<{
    empty: boolean;
    privateExample: boolean;
    workspaceKind: 'personal';
  }>;
}>;

export type DogfoodDiagnosticInput = Readonly<{
  appEvents?: readonly Readonly<{ at: string; kind: string }>[];
  appVersion?: string;
  buildVersion?: string;
  currentScreen: string;
  dogfoodModeEnabled: boolean;
  lastAction?: string | null;
  route: LocalRouteSummary;
  runtime?: Readonly<Record<string, string | number | boolean | null>>;
  state: LocalLedgerState;
}>;

export type DogfoodDiagnosticBundle = Readonly<{
  bytePreview: string;
  markdown: string;
  redacted: JsonRecord;
  redactedPaths: readonly string[];
  safeForExport: boolean;
}>;

const dogfoodHistoryPrefix = 'history_dogfood_seed_';
const dogfoodHistoryLabelPrefix = 'Internal test fake seed loaded:';

const targetScreenByFixture: Readonly<Record<ProductExperienceFixtureId, DogfoodTargetScreen>> = {
  accepted_import: 'import',
  accepted_recovery: 'recovery',
  active_plan: 'plans',
  bad_month_recovery_preview: 'recovery',
  calendar_planner_items: 'calendar',
  data_control_export: 'data',
  document_attachment: 'data',
  duplicate_rejected_import: 'import',
  edited_import: 'import',
  empty_first_launch: 'firstMinute',
  minimal_manual_user: 'today',
  one_upcoming_bill: 'plans',
  rejected_import: 'import',
  sample_briefing: 'sampleBriefing',
};

export function createDogfoodScenarioSeeds(asOfDate: string): readonly DogfoodScenarioSeed[] {
  return createProductExperienceFixtures(asOfDate).map((fixture) => ({
    canonicalRecordCounts: fixture.canonicalRecordCounts,
    description: fixture.description,
    expectedSurfaces: fixture.expectedSurfaces,
    id: fixture.id,
    sampleOnly: fixture.sampleOnly,
    state: fixture.state,
    synthetic: true,
    targetScreen: targetScreenByFixture[fixture.id],
    title: fixture.title,
  }));
}

export function findDogfoodScenarioSeed(
  seeds: readonly DogfoodScenarioSeed[],
  id: ProductExperienceFixtureId,
): DogfoodScenarioSeed {
  const seed = seeds.find((candidate) => candidate.id === id);
  if (seed === undefined) throw new Error(`Dogfood scenario seed not found: ${id}`);
  return seed;
}

export function createDogfoodResetState(asOfDate: string): LocalLedgerState {
  return createEmptyLocalLedgerState(asOfDate);
}

export function prepareDogfoodScenarioState(seed: DogfoodScenarioSeed): LocalLedgerState {
  if (seed.sampleOnly || seed.id === 'empty_first_launch') return seed.state;
  if (isDogfoodScenarioState(seed.state)) return seed.state;

  return {
    ...seed.state,
    history: [
      {
        id: `${dogfoodHistoryPrefix}${seed.id}`,
        kind: 'manual_added',
        createdAt: `${seed.state.asOfDate}T10:00:00.000Z`,
        label: `${dogfoodHistoryLabelPrefix} ${seed.title}.`,
      },
      ...seed.state.history,
    ],
  };
}

export function isDogfoodScenarioState(state: LocalLedgerState): boolean {
  return state.history.some(
    (entry) =>
      entry.id.startsWith(dogfoodHistoryPrefix) ||
      entry.label.startsWith(dogfoodHistoryLabelPrefix),
  );
}

export function buildDogfoodStatus(
  state: LocalLedgerState,
  route: LocalRouteSummary = buildLocalRouteSummary(state),
): DogfoodStatus {
  const snapshot = createCanonicalRepositoryForLocalLedgerState(state).snapshot();
  const canonicalObjectCounts = countCanonicalObjects(snapshot);

  return {
    canonicalObjectCounts,
    dogfoodMode: dogfoodModeContract,
    importReviewState: {
      activeDrafts: state.importDrafts.length,
      rejectedEvidence: state.rejectedImports.length,
      sourceFiles: state.documentStages.length,
    },
    meloProposalCount: canonicalObjectCounts.meloProposals,
    planRecoveryState: {
      activePlans: snapshot.collections.plans.filter((plan) => plan.status === 'active').length,
      acceptedRecoveries: snapshot.collections.scenarios.filter(
        (scenario) => scenario.status === 'accepted',
      ).length,
      decisions: snapshot.collections.decisions.length,
      impactsNeedingReview: snapshot.collections.planImpacts.filter((impact) => impact.needsReview)
        .length,
      planRules: snapshot.collections.planRules.length,
      previewWritesImmediately: false,
    },
    routeState: {
      confirmedRecords: route.confirmedTransactionCount,
      pendingReview: route.pendingReviewCount,
      protectedItemCount: route.protectedItems.length,
      routePoints: route.points.length,
      tightestLabel: route.tightestDay,
    },
    workspaceState: {
      empty:
        state.transactions.length === 0 &&
        state.importDrafts.length === 0 &&
        state.rejectedImports.length === 0 &&
        state.documentStages.length === 0 &&
        state.history.length === 0,
      privateExample: isPrivateExampleLedger(state),
      workspaceKind: 'personal',
    },
  };
}

export function buildRedactedDogfoodDiagnosticBundle(
  input: DogfoodDiagnosticInput,
): DogfoodDiagnosticBundle {
  const status = buildDogfoodStatus(input.state, input.route);
  const snapshot = createCanonicalRepositoryForLocalLedgerState(input.state).snapshot();
  const exportedAt = `${input.state.asOfDate}T10:00:00.000Z`;
  const diagnostic = {
    schema: 'folio-dogfood-diagnostic-v1',
    exportedAt,
    appBuild: {
      appVersion: input.appVersion ?? 'unknown',
      buildVersion: input.buildVersion ?? 'unknown',
    },
    deviceRuntime: input.runtime ?? {},
    currentRoute: {
      screen: input.currentScreen,
      routePoints: status.routeState.routePoints,
      pendingReview: status.routeState.pendingReview,
      confirmedRecords: status.routeState.confirmedRecords,
      tightestLabel: status.routeState.tightestLabel,
    },
    canonicalObjectCounts: status.canonicalObjectCounts,
    workspaceState: status.workspaceState,
    recentAuditLog: snapshot.collections.auditLog.slice(0, 20).map((entry) => ({
      action: entry.action,
      actor: entry.actor,
      occurredAt: entry.occurredAt,
      reversible: entry.reversible,
    })),
    recentDecisionRecords: snapshot.collections.decisions.slice(0, 20).map((decision) => ({
      actor: decision.actor,
      affectedCount: decision.affectedIds.length,
      decidedAt: decision.decidedAt,
      kind: decision.kind,
    })),
    importReviewState: status.importReviewState,
    planRecoveryState: status.planRecoveryState,
    meloProposalCount: status.meloProposalCount,
    rejectedEvidenceCount: status.importReviewState.rejectedEvidence,
    featureFlags: {
      accountRequired: dogfoodModeContract.requiresAccount,
      aiRequired: dogfoodModeContract.requiresAi,
      cloudRequired: dogfoodModeContract.requiresCloud,
      dogfoodModeEnabled: input.dogfoodModeEnabled,
      openBankingRequired: dogfoodModeContract.requiresOpenBanking,
      uploadAllowed: dogfoodModeContract.uploadAllowed,
    },
    lastNonSensitiveAppEvents: (input.appEvents ?? historyEvents(input.state)).slice(0, 20),
    lastActionKind:
      input.lastAction === null || input.lastAction === undefined
        ? 'none'
        : classifyLastAction(input.lastAction),
    redactionPolicy: {
      defaultExport: 'counts-and-states-only',
      rawFinancialRowsIncluded: false,
      rawSourceTextIncluded: false,
    },
  } satisfies JsonRecord;
  const sanitised = sanitiseDiagnosticBundle(diagnostic);
  const markdown = buildDiagnosticMarkdown({
    currentScreen: input.currentScreen,
    exportedAt,
    redactedPaths: sanitised.redactedPaths,
    safeForExport: sanitised.findings.length === 0,
    status,
  });

  return {
    bytePreview: JSON.stringify(sanitised.redacted).slice(0, 220),
    markdown,
    redacted: sanitised.redacted,
    redactedPaths: sanitised.redactedPaths,
    safeForExport: sanitised.findings.length === 0,
  };
}

function countCanonicalObjects(
  snapshot: CanonicalRepositorySnapshot,
): DogfoodCanonicalObjectCounts {
  return Object.fromEntries(
    Object.entries(snapshot.collections).map(([collection, records]) => [
      collection,
      records.length,
    ]),
  ) as DogfoodCanonicalObjectCounts;
}

function historyEvents(state: LocalLedgerState): readonly Readonly<{ at: string; kind: string }>[] {
  return state.history.map((entry) => ({
    at: entry.createdAt,
    kind: entry.kind,
  }));
}

function classifyLastAction(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes('import')) return 'import';
  if (normalized.includes('recovery')) return 'recovery';
  if (normalized.includes('clear')) return 'reset';
  if (normalized.includes('export')) return 'export';
  if (normalized.includes('sample')) return 'sample';
  return 'local-action';
}

function buildDiagnosticMarkdown({
  currentScreen,
  exportedAt,
  redactedPaths,
  safeForExport,
  status,
}: Readonly<{
  currentScreen: string;
  exportedAt: string;
  redactedPaths: readonly string[];
  safeForExport: boolean;
  status: DogfoodStatus;
}>): string {
  return [
    '# Folio Dogfood Diagnostic Bundle',
    '',
    `- Generated: ${exportedAt}`,
    `- Current screen: ${currentScreen}`,
    `- Internal test label: ${dogfoodModeContract.label}`,
    `- Local only: ${String(dogfoodModeContract.localOnly)}`,
    `- Upload allowed: ${String(dogfoodModeContract.uploadAllowed)}`,
    `- Safe for diagnostic export: ${String(safeForExport)}`,
    `- Redacted paths: ${redactedPaths.length === 0 ? 'none' : redactedPaths.join(', ')}`,
    '',
    '## Counts',
    '',
    `- Transactions: ${status.canonicalObjectCounts.transactions}`,
    `- Import drafts: ${status.canonicalObjectCounts.importDrafts}`,
    `- Plans: ${status.canonicalObjectCounts.plans}`,
    `- Plan rules: ${status.canonicalObjectCounts.planRules}`,
    `- Scenarios: ${status.canonicalObjectCounts.scenarios}`,
    `- Decisions: ${status.canonicalObjectCounts.decisions}`,
    `- Audit log: ${status.canonicalObjectCounts.auditLog}`,
    `- Melo proposals: ${status.canonicalObjectCounts.meloProposals}`,
    '',
    'Raw financial rows, source text, account details and personal identifiers are not included.',
  ].join('\n');
}
