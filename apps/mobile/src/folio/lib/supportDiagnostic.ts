import { inspectDiagnosticBundle, sanitiseDiagnosticBundle, type JsonRecord } from '@folio/storage';

import type { AppState } from '@/folio/store';

type DiagnosticState = Pick<
  AppState,
  | 'accounts'
  | 'activeWorkspaceId'
  | 'calendarEvents'
  | 'correctionImpacts'
  | 'cycles'
  | 'dataWorkspaceId'
  | 'debts'
  | 'decisionLedger'
  | 'droppedTransactionCount'
  | 'evidenceDocuments'
  | 'incomeSources'
  | 'materialChanges'
  | 'meloMemoryThread'
  | 'onboarding'
  | 'plans'
  | 'readerCandidates'
  | 'reviewQueue'
  | 'reviewQueueSpillover'
  | 'schemaVersion'
  | 'statementImports'
  | 'subs'
  | 'pots'
  | 'transactions'
  | 'workspaces'
>;

export type SupportDiagnosticEnvironment = Readonly<{
  appLockEnabled: boolean;
  appVersion: string;
  buildVersion: string;
  currentScreen: string;
  executionEnvironment: string;
  isDevice: boolean;
  platform: string;
  platformVersion: string;
}>;

export type SupportDiagnosticBundle = Readonly<{
  generatedAt: string;
  jsonText: string;
  redacted: JsonRecord;
  redactedPaths: readonly string[];
  safeForExport: boolean;
}>;

/**
 * Build the exact support payload the user previews and, only after confirmation, shares. The
 * function deliberately selects counts and health states from AppState instead of serialising the
 * store and attempting to redact it afterwards. The storage sanitizer remains a second defence.
 */
export function buildSupportDiagnosticBundle(
  state: DiagnosticState,
  environment: SupportDiagnosticEnvironment,
  now = new Date(),
): SupportDiagnosticBundle {
  const activeWorkspace = state.workspaces.find(
    (workspace) => String(workspace.id) === String(state.activeWorkspaceId),
  );
  const generatedAt = now.toISOString();
  const diagnostic = {
    schema: 'melo-support-diagnostic-v1',
    generatedAt,
    appBuild: {
      appVersion: environment.appVersion,
      buildVersion: environment.buildVersion,
      schemaVersion: state.schemaVersion,
    },
    runtime: {
      executionEnvironment: environment.executionEnvironment,
      isDevice: environment.isDevice,
      platform: environment.platform,
      platformVersion: environment.platformVersion,
    },
    currentRoute: {
      screen: environment.currentScreen,
    },
    workspaceState: {
      activeKind: activeWorkspace?.kind ?? 'unavailable',
      activePartitionMatchesSelection:
        String(state.dataWorkspaceId) === String(state.activeWorkspaceId),
      availableWorkspaceCount: state.workspaces.filter((workspace) => workspace.archivedAt === null)
        .length,
      hasBusinessWorkspace: state.workspaces.some(
        (workspace) => workspace.kind === 'business' && workspace.archivedAt === null,
      ),
    },
    recordCounts: {
      accounts: state.accounts?.length ?? 0,
      calendarItems: state.calendarEvents.length,
      companionMemoryLines: state.meloMemoryThread?.length ?? 0,
      corrections: state.correctionImpacts?.length ?? 0,
      cycles: state.cycles.length,
      debts: state.debts?.length ?? 0,
      decisions: state.decisionLedger?.length ?? 0,
      incomeSources: state.incomeSources?.length ?? 0,
      materialChanges: state.materialChanges?.length ?? 0,
      plans: state.plans?.length ?? 0,
      pots: state.pots.length,
      reviewQueue: state.reviewQueue?.length ?? 0,
      reviewSpillover: state.reviewQueueSpillover?.length ?? 0,
      savedSources: state.evidenceDocuments?.length ?? 0,
      statementImports: state.statementImports?.length ?? 0,
      subscriptions: state.subs.length,
      transactions: state.transactions.length,
    },
    localHealth: {
      appLockEnabled: environment.appLockEnabled,
      onboardingComplete: state.onboarding.done,
      retainedRowRollOffCount: state.droppedTransactionCount ?? 0,
      stagedReaderItemCount: state.readerCandidates.length,
    },
    redactionPolicy: {
      exactPreviewBeforeShare: true,
      rawAccountReferencesIncluded: false,
      rawConversationTextIncluded: false,
      rawDocumentTextIncluded: false,
      rawFinancialRowsIncluded: false,
      rawIdentifiersIncluded: false,
      rawSourceTextIncluded: false,
      recoverySecretsIncluded: false,
      uploadAutomatic: false,
    },
  } satisfies JsonRecord;

  const sanitised = sanitiseDiagnosticBundle(diagnostic);
  const postRedactionInspection = inspectDiagnosticBundle(sanitised.redacted);
  const jsonText = JSON.stringify(sanitised.redacted, null, 2);

  return {
    generatedAt,
    jsonText,
    redacted: sanitised.redacted,
    redactedPaths: sanitised.redactedPaths,
    safeForExport: postRedactionInspection.safeForExport,
  };
}
