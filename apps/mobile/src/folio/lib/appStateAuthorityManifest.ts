import type { AppState } from '../store';

/**
 * Explicit ownership for every shipping AppState field. `satisfies Record<keyof AppState, ...>` is
 * intentional: adding a field to the persisted contract cannot silently leave it outside the
 * canonical-migration plan.
 */
export type AppStateFieldAuthority =
  | 'workspace-root'
  | 'canonical-ledger-authority'
  | 'canonical-financial-context-authority'
  | 'canonical-route-planning-authority'
  | 'canonical-transaction-intelligence-authority'
  | 'canonical-companion-runtime-authority'
  | 'exact-encrypted-authority'
  | 'transient-not-persisted';

export const appStateAuthorityManifest = {
  schemaVersion: 'workspace-root',
  workspaces: 'workspace-root',
  activeWorkspaceId: 'workspace-root',
  dataWorkspaceId: 'workspace-root',

  pots: 'canonical-ledger-authority',
  subs: 'canonical-ledger-authority',
  subPaused: 'canonical-ledger-authority',
  // Per-sub check-in cooldown is workspace-local companion state. Keep the encrypted partition
  // authoritative until the canonical companion schema has a dedicated keyed-date table.
  subCheckIns: 'exact-encrypted-authority',
  subOverrides: 'canonical-ledger-authority',
  cycles: 'canonical-ledger-authority',
  currentBalance: 'canonical-ledger-authority',
  potLedger: 'canonical-ledger-authority',
  transactions: 'canonical-ledger-authority',
  debts: 'canonical-ledger-authority',
  accounts: 'canonical-ledger-authority',
  cancelledSubs: 'canonical-ledger-authority',

  timelineEvents: 'canonical-transaction-intelligence-authority',
  reviewQueue: 'canonical-transaction-intelligence-authority',
  reviewQueueSpillover: 'canonical-transaction-intelligence-authority',

  onboarding: 'canonical-financial-context-authority',
  nextYouNote: 'canonical-financial-context-authority',
  tightPointGoal: 'canonical-financial-context-authority',
  droppedTransactionCount: 'canonical-financial-context-authority',
  edits: 'canonical-transaction-intelligence-authority',
  calendarEvents: 'canonical-route-planning-authority',
  spendHold: 'canonical-route-planning-authority',
  whatIfHolds: 'canonical-route-planning-authority',
  decisionLedger: 'exact-encrypted-authority',
  provisionalAnswers: 'exact-encrypted-authority',
  materialChanges: 'exact-encrypted-authority',
  correctionImpacts: 'exact-encrypted-authority',
  criticalJourneyContinuity: 'exact-encrypted-authority',
  ignoredReviewSigs: 'canonical-transaction-intelligence-authority',
  moneyMode: 'canonical-financial-context-authority',
  bufferAmount: 'canonical-financial-context-authority',
  modeExtras: 'canonical-financial-context-authority',
  aiReads: 'canonical-companion-runtime-authority',
  aiReadCache: 'canonical-companion-runtime-authority',
  whatChangedSeenISO: 'canonical-companion-runtime-authority',
  meloPrimerSeen: 'canonical-companion-runtime-authority',
  meloPrimerBeat: 'canonical-companion-runtime-authority',
  meloPrimerSeenAt: 'canonical-companion-runtime-authority',
  lastOpenedAt: 'canonical-companion-runtime-authority',
  oneMoveHistory: 'canonical-companion-runtime-authority',
  meloMoves: 'canonical-companion-runtime-authority',
  meloDismissLog: 'canonical-companion-runtime-authority',
  meloMemoryThread: 'canonical-companion-runtime-authority',
  meloForgottenMemoryIds: 'canonical-companion-runtime-authority',
  // The approved Business operating model is already inside the encrypted
  // workspace partition. Its dedicated canonical tables are the next storage
  // migration; until then the exact encrypted object remains authoritative so
  // recovery cannot reconstruct a lossy approximation.
  business: 'exact-encrypted-authority',
  household: 'canonical-financial-context-authority',
  plans: 'canonical-route-planning-authority',
  lens: 'canonical-companion-runtime-authority',
  melo: 'canonical-companion-runtime-authority',
  // Chart style is a shared device preference. Keep the exact encrypted value
  // authoritative until the companion canonical schema has a dedicated column.
  chartStyle: 'exact-encrypted-authority',
  // Phoenix progression is financial state owned by this encrypted workspace
  // partition. It must never be projected into cross-workspace continuity.
  stage: 'exact-encrypted-authority',
  streak: 'exact-encrypted-authority',
  tinyWins: 'canonical-companion-runtime-authority',
  ignoredBankExternalIds: 'canonical-transaction-intelligence-authority',
  incomeSources: 'canonical-route-planning-authority',
  dismissedIncomeSignals: 'canonical-transaction-intelligence-authority',
  dismissedBillSignals: 'canonical-transaction-intelligence-authority',
  dismissedDriftSignals: 'canonical-transaction-intelligence-authority',
  dismissedAnnualSignals: 'canonical-transaction-intelligence-authority',
  merchantCategories: 'canonical-transaction-intelligence-authority',
  statementImports: 'canonical-transaction-intelligence-authority',
  evidenceDocuments: 'canonical-transaction-intelligence-authority',

  calendarFocusDate: 'transient-not-persisted',
  routeFocusDate: 'transient-not-persisted',
  readerCandidates: 'transient-not-persisted',
  readerClosingBalance: 'transient-not-persisted',
} as const satisfies Readonly<Record<keyof AppState, AppStateFieldAuthority>>;

export type AppStateFieldName = keyof typeof appStateAuthorityManifest;

export function appStateFieldsWithAuthority(
  authority: AppStateFieldAuthority,
): readonly AppStateFieldName[] {
  return (
    Object.entries(appStateAuthorityManifest) as Array<[AppStateFieldName, AppStateFieldAuthority]>
  )
    .filter(([, candidate]) => candidate === authority)
    .map(([field]) => field);
}
