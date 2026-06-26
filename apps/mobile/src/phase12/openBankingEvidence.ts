import {
  buildConsentDashboard,
  buildPhase12CoverageRows,
  evaluateBankDataProviderContract,
  evaluateConsentJourney,
  evaluateFeedHealth,
  evaluateOpenBankingReleaseGate,
  evaluateProviderSelection,
  evaluateRevocation,
  normalizeProviderRows,
  openBankingRowsByState,
  reconcileCanonicalRows,
  type BankConsentRecord,
  type BankProviderCandidate,
  type BankDataProviderContractState,
  type CanonicalIngestionState,
  type ConsentDashboardState,
  type ConsentJourneyState,
  type EvidenceRow,
  type FeedHealthState,
  type OpenBankingReadinessState,
  type OpenBankingReleaseGateState,
  type Phase12CoverageRow,
  type ProviderSelectionState,
  type ReconciliationState,
  type RevocationState,
} from '@folio/open-banking';

export type Phase12Source = Readonly<{
  kind: 'synthetic';
  label: 'Synthetic sample';
  description: string;
}>;

export type Phase12EvidenceArea =
  | 'provider_selection'
  | 'provider_contract'
  | 'consent_journey'
  | 'consent_dashboard'
  | 'canonical_ingestion'
  | 'reconciliation'
  | 'stale_gap_state'
  | 'revocation'
  | 'staged_rollout_gate';

export type Phase12GateMetadata = Readonly<{
  phase: 'phase12';
  slice: 'open-banking';
  sourceLabel: 'Synthetic sample';
  networkRequiredForManualMode: false;
  firstLaunchBankPromptShown: false;
  realProviderConnected: false;
  regulatedProviderSelected: false;
  providerTokenInApp: false;
  realBankData: false;
  backendTokenAdapterLive: false;
  directTransactionWrites: false;
  manualImportStillAvailable: true;
  providerSandboxPilotPassed: false;
  providerProductionPilotPassed: false;
  legalSignoffComplete: false;
  openBankingBetaReady: false;
  evidenceAreas: readonly Phase12EvidenceArea[];
}>;

export type Phase12ProofRow = Readonly<{
  label: string;
  value: string;
  state: OpenBankingReadinessState;
}>;

export type Phase12BlockerRow = Readonly<{
  label: string;
  value: string;
  source: Phase12Source;
}>;

export type Phase12HuashuReview = Readonly<{
  score: number;
  rows: readonly EvidenceRow[];
  criticalIssuesFixed: readonly string[];
  remainingNotes: readonly string[];
}>;

export type Phase12OpenBankingEvidence = Readonly<{
  metadata: Phase12GateMetadata;
  source: Phase12Source;
  providerSelection: ProviderSelectionState;
  providerContract: BankDataProviderContractState;
  consentJourney: ConsentJourneyState;
  dashboard: ConsentDashboardState;
  ingestion: CanonicalIngestionState;
  reconciliation: ReconciliationState;
  feedHealth: FeedHealthState;
  revocation: RevocationState;
  releaseGate: OpenBankingReleaseGateState;
  coverageRows: readonly Phase12CoverageRow[];
  proofRows: readonly Phase12ProofRow[];
  blockerRows: readonly Phase12BlockerRow[];
  huashuReview: Phase12HuashuReview;
}>;

const syntheticSource: Phase12Source = {
  kind: 'synthetic',
  label: 'Synthetic sample',
  description:
    'Phase 12 mobile shell evidence uses fictional provider, consent and bank-row records only; it performs no provider redirect, network request, account login, token storage, real bank-data fetch or transaction write.',
};

const providerCandidate: BankProviderCandidate = {
  providerId: 'regulated_candidate',
  label: 'Regulated provider candidate',
  regulatedStatus: 'candidate',
  ukPersonalCoverage: true,
  ukBusinessCoverage: true,
  consentUxReviewed: true,
  pendingPostedQualityReviewed: false,
  webhookReliabilityReviewed: false,
  sandboxQualityReviewed: false,
  securityReviewPassed: false,
  processorTermsApproved: false,
  dataResidencyApproved: false,
  exitPlanDocumented: true,
  pricing: [
    { connectedAccounts: 1_000, monthlyCostUnits: 450 },
    { connectedAccounts: 10_000, monthlyCostUnits: 3_500 },
    { connectedAccounts: 100_000, monthlyCostUnits: 28_000 },
  ],
};

const activeConsent: BankConsentRecord = {
  consentId: 'consent_demo_active',
  providerId: 'regulated_candidate',
  workspaceId: 'workspace_personal_demo',
  status: 'active',
  scopes: ['account_details', 'balances', 'transactions'],
  accounts: [
    {
      accountAlias: 'bank_account_1',
      workspaceId: 'workspace_personal_demo',
      kind: 'personal',
      selected: true,
      status: 'stale',
      lastSuccessfulRefreshAt: '2026-06-19T08:00:00.000Z',
    },
    {
      accountAlias: 'business_account_blocked',
      workspaceId: 'workspace_business_demo',
      kind: 'business',
      selected: false,
      status: 'paused',
      lastSuccessfulRefreshAt: null,
    },
  ],
  grantedAt: '2026-06-10T08:00:00.000Z',
  expiresAt: '2026-09-08T08:00:00.000Z',
  revokedAt: null,
  lastSuccessfulRefreshAt: '2026-06-19T08:00:00.000Z',
  revokeAvailable: true,
  localDataRetentionChoiceVisible: true,
};

const revokedConsent: BankConsentRecord = {
  ...activeConsent,
  consentId: 'consent_demo_revoked',
  status: 'revoked',
  revokedAt: '2026-06-21T09:00:00.000Z',
  revokeAvailable: false,
};

const providerRows = [
  {
    providerRowId: 'row_1',
    providerAccountRef: 'acct_personal',
    providerTransactionId: 'bank_txn_1',
    bookingStatus: 'posted',
    occurredAt: '2026-06-18',
    amountMinor: -4200,
    currency: 'GBP',
    description: 'Demo grocer',
    merchantName: 'Demo Grocer',
    pendingReplacementFor: null,
  },
  {
    providerRowId: 'row_2',
    providerAccountRef: 'acct_personal',
    providerTransactionId: 'bank_txn_2',
    bookingStatus: 'pending',
    occurredAt: '2026-06-19',
    amountMinor: -1099,
    currency: 'GBP',
    description: 'Demo cafe',
    merchantName: 'Demo Cafe',
    pendingReplacementFor: 'bank_txn_pending_old',
  },
  {
    providerRowId: 'row_3',
    providerAccountRef: 'acct_savings',
    providerTransactionId: 'bank_txn_3',
    bookingStatus: 'posted',
    occurredAt: '2026-06-19',
    amountMinor: 2500,
    currency: 'GBP',
    description: 'Transfer in',
    merchantName: null,
    pendingReplacementFor: null,
  },
  {
    providerRowId: 'row_4',
    providerAccountRef: 'acct_personal',
    providerTransactionId: 'bank_txn_4',
    bookingStatus: 'posted',
    occurredAt: '2026-06-19',
    amountMinor: -2500,
    currency: 'GBP',
    description: 'Transfer out',
    merchantName: null,
    pendingReplacementFor: null,
  },
] as const;

const existingTransactions = [
  {
    transactionId: 'txn_existing_1',
    providerTransactionId: 'bank_txn_1',
    amountMinor: -4200,
    currency: 'GBP',
    occurredAt: '2026-06-18',
    accountAlias: 'bank_account_1',
  },
] as const;

export const defaultPhase12OpenBankingEvidence = buildPhase12OpenBankingEvidence();

export const phase12ProofRows: readonly Phase12ProofRow[] =
  defaultPhase12OpenBankingEvidence.proofRows;

export function buildPhase12OpenBankingEvidence(): Phase12OpenBankingEvidence {
  const providerSelection = evaluateProviderSelection({
    candidates: [providerCandidate],
    selectedProviderId: 'regulated_candidate',
    procurementDecisionRecorded: false,
    legalDecisionRecorded: false,
    storeDisclosureDrafted: false,
  });
  const providerContract = evaluateBankDataProviderContract({
    interfaceVersion: 1,
    supportsStartConsent: true,
    supportsCallback: true,
    supportsListConsentState: true,
    supportsCanonicalRows: true,
    supportsRefreshConsent: true,
    supportsRevokeConsent: true,
    fakeProviderContractPassed: true,
    providerSandboxContractPassed: false,
    providerProductionContractPassed: false,
    mobilePinsProviderSdk: false,
  });
  const consentJourney = evaluateConsentJourney({
    userSelectedConnectBank: true,
    firstLaunchPromptShown: false,
    explanationVisibleBeforeRedirect: true,
    scopesExplained: true,
    eligibleAccountsChosenAtProvider: true,
    providerRedirectUrlCreated: true,
    callbackHandledServerSide: true,
    tokenEncryptedServerSide: true,
    providerTokenPresentInApp: false,
    appLogsContainProviderToken: false,
  });
  const dashboard = buildConsentDashboard({
    consents: [activeConsent, revokedConsent],
    providerLabelVisible: true,
    accountScopeVisible: true,
    expiryVisible: true,
    lastRefreshVisible: true,
    revokeControlVisible: true,
    workspaceMismatchPrevented: true,
  });
  const ingestion = normalizeProviderRows({
    workspaceId: 'workspace_personal_demo',
    providerId: 'regulated_candidate',
    accountMappings: [
      {
        providerAccountRef: 'acct_personal',
        accountAlias: 'bank_account_1',
        workspaceId: 'workspace_personal_demo',
        kind: 'personal',
      },
      {
        providerAccountRef: 'acct_savings',
        accountAlias: 'bank_account_2',
        workspaceId: 'workspace_personal_demo',
        kind: 'personal',
      },
    ],
    rows: providerRows,
    writeDirectlyToTransactions: false,
    routeThroughImportReview: true,
    encryptTransport: true,
  });
  const reconciliation = reconcileCanonicalRows(ingestion.canonicalRows, existingTransactions);
  const feedHealth = evaluateFeedHealth({
    nowIso: '2026-06-21T09:30:00.000Z',
    lastSuccessfulRefreshAt: '2026-06-19T08:00:00.000Z',
    staleAfterHours: 24,
    providerUnavailable: true,
    rateLimited: false,
    missingRanges: [{ fromIso: '2026-06-19', toIso: '2026-06-20', reason: 'provider_outage' }],
    pendingRowsVisible: true,
    manualOrCsvGapFillAvailable: true,
  });
  const revocation = evaluateRevocation({
    consent: revokedConsent,
    providerRevokeCalled: true,
    futureRefreshDisabled: true,
    serverTokenDeleted: true,
    providerTokenPresentInApp: false,
    importedHistoryChoicePresented: true,
    deleteImportedHistoryAvailable: true,
  });
  const releaseGate = evaluateOpenBankingReleaseGate({
    providerSelection,
    providerContract,
    consentJourney,
    dashboard,
    ingestion,
    feedHealth,
    revocation,
    sandboxPilotPassed: false,
    productionPilotPassed: false,
    legalSignoffComplete: false,
    storeReviewComplete: false,
    supportRunbookReady: false,
    incidentMonitoringReady: false,
    manualImportStillAvailable: true,
  });
  const coverageRows = buildPhase12CoverageRows({
    providerSelection,
    providerContract,
    consentJourney,
    dashboard,
    ingestion,
    feedHealth,
    revocation,
    releaseGate,
  });

  return {
    metadata: {
      phase: 'phase12',
      slice: 'open-banking',
      sourceLabel: syntheticSource.label,
      networkRequiredForManualMode: false,
      firstLaunchBankPromptShown: false,
      realProviderConnected: false,
      regulatedProviderSelected: false,
      providerTokenInApp: false,
      realBankData: false,
      backendTokenAdapterLive: false,
      directTransactionWrites: false,
      manualImportStillAvailable: true,
      providerSandboxPilotPassed: false,
      providerProductionPilotPassed: false,
      legalSignoffComplete: false,
      openBankingBetaReady: false,
      evidenceAreas: [
        'provider_selection',
        'provider_contract',
        'consent_journey',
        'consent_dashboard',
        'canonical_ingestion',
        'reconciliation',
        'stale_gap_state',
        'revocation',
        'staged_rollout_gate',
      ],
    },
    source: syntheticSource,
    providerSelection,
    providerContract,
    consentJourney,
    dashboard,
    ingestion,
    reconciliation,
    feedHealth,
    revocation,
    releaseGate,
    coverageRows,
    proofRows: coverageRows.map((coverageRow) => ({
      label: `${coverageRow.taskId} ${coverageRow.label}`,
      value: formatCoverageValue(coverageRow),
      state: coverageRow.state,
    })),
    blockerRows: releaseGate.blockers.slice(0, 12).map((blocker) => ({
      label: 'Open Banking blocker',
      value: blocker,
      source: syntheticSource,
    })),
    huashuReview: {
      score: 8.2,
      rows: [
        {
          label: 'Function',
          value: 'manual/import mode remains first; connect-bank copy is contextual and optional',
          state: 'implemented',
        },
        {
          label: 'Hierarchy',
          value:
            'token boundary, consent scope, stale feed, revoke and manual fallback precede rollout',
          state: 'implemented',
        },
        {
          label: 'Craft',
          value:
            'plain evidence rows avoid bank-grade claims, fake uptime and decorative trust signals',
          state: 'implemented',
        },
        {
          label: 'Anti slop',
          value: 'no fake bank logos, no balance hero, no consent dark pattern, no success theatre',
          state: 'implemented',
        },
        {
          label: 'Remaining review',
          value:
            'real provider screens, TalkBack/large text and legal/store review remain required',
          state: 'blocked',
        },
      ],
      criticalIssuesFixed: [
        'Kept Open Banking behind a contextual connect-bank action, never first launch.',
        'Showed no provider token in app and no direct transaction writes before staged rollout.',
        'Placed stale/gap and revocation state above rollout readiness.',
      ],
      remainingNotes: [
        'Real provider consent screens must preserve account scope, expiry and revoke hierarchy.',
        'Manual TalkBack, large text and reduced-motion checks are still required.',
        'Provider procurement, legal review, store disclosures and pilot acceptance remain blockers.',
      ],
    },
  };
}

export function phase12RowsByState<Row extends EvidenceRow | Phase12CoverageRow>(
  rows: readonly Row[],
  state: Row['state'],
): readonly Row[] {
  return openBankingRowsByState(rows, state);
}

function formatCoverageValue(row: Phase12CoverageRow): string {
  return row.blocker ? `${row.evidence}; blocker: ${row.blocker}` : row.evidence;
}
