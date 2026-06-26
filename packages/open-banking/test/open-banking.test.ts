import { describe, expect, it } from 'vitest';

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
  openBankingBoundary,
  openBankingRowsByState,
  reconcileCanonicalRows,
  type BankConsentRecord,
  type BankProviderCandidate,
  type ExistingTransactionReference,
  type MissingDateRange,
  type ProviderTransactionRow,
} from '../src/index.js';

const candidate: BankProviderCandidate = {
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
      accountAlias: 'business_account_rejected',
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

const providerRows: readonly ProviderTransactionRow[] = [
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
    providerAccountRef: 'acct_personal',
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
    providerAccountRef: 'acct_savings',
    providerTransactionId: 'bank_txn_4',
    bookingStatus: 'posted',
    occurredAt: '2026-06-19',
    amountMinor: -2500,
    currency: 'GBP',
    description: 'Transfer out',
    merchantName: null,
    pendingReplacementFor: null,
  },
];

const existingTransactions: readonly ExistingTransactionReference[] = [
  {
    transactionId: 'txn_existing_1',
    providerTransactionId: 'bank_txn_1',
    amountMinor: -4200,
    currency: 'GBP',
    occurredAt: '2026-06-18',
    accountAlias: 'bank_account_1',
  },
];

describe('Open Banking pure contracts', () => {
  it('stays optional and detached from provider SDKs, native modules and local-core network needs', () => {
    expect(openBankingBoundary).toMatchObject({
      packageName: '@folio/open-banking',
      optional: true,
      providerRequiredForLocalCore: false,
      networkRequiredForManualMode: false,
      writesDirectlyToStorage: false,
      importsBankProviderSdk: false,
      importsNativeModules: false,
      storesProviderTokenInApp: false,
      directAispAuthorisationClaimed: false,
    });
  });

  it('records provider-selection blockers until regulated, security and legal gates close', () => {
    const selection = evaluateProviderSelection({
      candidates: [candidate],
      selectedProviderId: 'regulated_candidate',
      procurementDecisionRecorded: false,
      legalDecisionRecorded: false,
      storeDisclosureDrafted: false,
    });

    expect(selection.candidateCount).toBe(1);
    expect(selection.selectedProviderRegulated).toBe(false);
    expect(selection.coverageReviewed).toBe(true);
    expect(selection.securityAndProcessorReviewPassed).toBe(false);
    expect(selection.blockers).toEqual(
      expect.arrayContaining([
        'selected provider is not approved as regulated/authorised',
        'security, processor, data residency or quality review is incomplete',
        'procurement decision is not recorded',
        'legal decision is not recorded',
      ]),
    );
  });

  it('models BankDataProvider fake-contract readiness separately from provider pilot readiness', () => {
    const contract = evaluateBankDataProviderContract({
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

    expect(contract.providerNeutral).toBe(true);
    expect(contract.fakeContractPassed).toBe(true);
    expect(contract.releaseBlocked).toBe(true);
    expect(contract.blockers).toEqual(
      expect.arrayContaining([
        'regulated provider sandbox contract suite has not passed',
        'production pilot contract suite has not passed',
      ]),
    );
  });

  it('keeps consent contextual and provider tokens outside the app', () => {
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

    expect(consentJourney.contextualOnly).toBe(true);
    expect(consentJourney.explanationComplete).toBe(true);
    expect(consentJourney.serverTokenBoundary).toBe(true);
    expect(consentJourney.appHasNoToken).toBe(true);
    expect(consentJourney.releaseBlocked).toBe(false);
  });

  it('builds a dashboard with account scope, expiry, refresh and revoke controls', () => {
    const dashboard = buildConsentDashboard({
      consents: [activeConsent, revokedConsent],
      providerLabelVisible: true,
      accountScopeVisible: true,
      expiryVisible: true,
      lastRefreshVisible: true,
      revokeControlVisible: true,
      workspaceMismatchPrevented: true,
    });

    expect(dashboard).toMatchObject({
      consentCount: 2,
      activeConsentCount: 1,
      revokedConsentCount: 1,
      accountCount: 4,
      dashboardComplete: true,
      releaseBlocked: false,
    });
  });

  it('normalises provider rows to staged import-review records without direct transaction writes', () => {
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

    expect(ingestion.releaseBlocked).toBe(false);
    expect(ingestion.canonicalRows).toHaveLength(4);
    expect(ingestion.canonicalRows[0]).toMatchObject({
      sourceKind: 'open_banking',
      stageOnly: true,
      descriptionAlias: 'bank_desc_1',
      merchantAlias: 'bank_party_2',
    });
    expect(ingestion.writeDirectlyToTransactions).toBe(false);
  });

  it('detects duplicates, pending replacements and possible transfers during reconciliation', () => {
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

    expect(reconciliation.duplicateProviderIds).toEqual(['bank_txn_1']);
    expect(reconciliation.pendingReplacements).toEqual(['regulated_candidate:row_2']);
    expect(reconciliation.possibleTransferIds).toEqual(['regulated_candidate:row_3']);
    expect(reconciliation.unmatchedCanonicalIds).toEqual([
      'regulated_candidate:row_3',
      'regulated_candidate:row_4',
    ]);
  });

  it('marks stale and gapped feed state while keeping manual or CSV gap filling available', () => {
    const missingRanges: readonly MissingDateRange[] = [
      { fromIso: '2026-06-19', toIso: '2026-06-20', reason: 'provider_outage' },
    ];
    const feed = evaluateFeedHealth({
      nowIso: '2026-06-21T09:30:00.000Z',
      lastSuccessfulRefreshAt: '2026-06-19T08:00:00.000Z',
      staleAfterHours: 24,
      providerUnavailable: true,
      rateLimited: false,
      missingRanges,
      pendingRowsVisible: true,
      manualOrCsvGapFillAvailable: true,
    });

    expect(feed).toMatchObject({
      stale: true,
      gapped: true,
      status: 'unavailable',
      forecastMustShowStaleData: true,
      localAppContinues: true,
      releaseBlocked: false,
    });
  });

  it('stops future access on revocation without silently deleting retained local history', () => {
    const revocation = evaluateRevocation({
      consent: revokedConsent,
      providerRevokeCalled: true,
      futureRefreshDisabled: true,
      serverTokenDeleted: true,
      providerTokenPresentInApp: false,
      importedHistoryChoicePresented: true,
      deleteImportedHistoryAvailable: true,
    });

    expect(revocation).toMatchObject({
      consentId: 'consent_demo_revoked',
      futureAccessStopped: true,
      serverTokenDeleted: true,
      localHistorySeparateChoice: true,
      releaseBlocked: false,
    });
  });

  it('builds Phase 12 coverage and keeps staged rollout blocked until external provider gates pass', () => {
    const providerSelection = evaluateProviderSelection({
      candidates: [candidate],
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
      ],
      rows: providerRows.slice(0, 2),
      writeDirectlyToTransactions: false,
      routeThroughImportReview: true,
      encryptTransport: true,
    });
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

    expect(releaseGate.ready).toBe(false);
    expect(releaseGate.releaseTrack).toBe('internal_contract');
    expect(coverageRows.map((row) => row.taskId)).toEqual([
      'T160',
      'T161',
      'T162',
      'T163',
      'T164',
      'T165',
      'T166',
      'T167',
      'T168',
    ]);
    expect(openBankingRowsByState(coverageRows, 'blocked')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'T160' }),
        expect.objectContaining({ taskId: 'T167' }),
        expect.objectContaining({ taskId: 'T168' }),
      ]),
    );
  });
});
