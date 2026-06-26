export const openBankingBoundary = {
  packageName: '@folio/open-banking',
  optional: true,
  providerRequiredForLocalCore: false,
  networkRequiredForManualMode: false,
  writesDirectlyToStorage: false,
  importsBankProviderSdk: false,
  importsNativeModules: false,
  storesProviderTokenInApp: false,
  directAispAuthorisationClaimed: false,
} as const;

export type OpenBankingReadinessState = 'implemented' | 'passed' | 'needs_review' | 'blocked';

export type EvidenceRow = Readonly<{
  label: string;
  value: string;
  state: OpenBankingReadinessState;
}>;

export type Phase12TaskId =
  | 'T160'
  | 'T161'
  | 'T162'
  | 'T163'
  | 'T164'
  | 'T165'
  | 'T166'
  | 'T167'
  | 'T168';

export type Phase12CoverageRow = Readonly<{
  taskId: Phase12TaskId;
  label: string;
  state: OpenBankingReadinessState;
  evidence: string;
  blocker?: string;
}>;

export type ProviderReviewState = 'not_started' | 'candidate' | 'approved' | 'rejected';

export type ProviderPricingScenario = Readonly<{
  connectedAccounts: 1_000 | 10_000 | 100_000;
  monthlyCostUnits: number;
}>;

export type BankProviderCandidate = Readonly<{
  providerId: string;
  label: string;
  regulatedStatus: ProviderReviewState;
  ukPersonalCoverage: boolean;
  ukBusinessCoverage: boolean;
  consentUxReviewed: boolean;
  pendingPostedQualityReviewed: boolean;
  webhookReliabilityReviewed: boolean;
  sandboxQualityReviewed: boolean;
  securityReviewPassed: boolean;
  processorTermsApproved: boolean;
  dataResidencyApproved: boolean;
  exitPlanDocumented: boolean;
  pricing: readonly ProviderPricingScenario[];
}>;

export type ProviderSelectionInput = Readonly<{
  candidates: readonly BankProviderCandidate[];
  selectedProviderId: string | null;
  procurementDecisionRecorded: boolean;
  legalDecisionRecorded: boolean;
  storeDisclosureDrafted: boolean;
}>;

export type ProviderSelectionState = Readonly<{
  candidateCount: number;
  selectedProviderId: string | null;
  selectedProviderRegulated: boolean;
  coverageReviewed: boolean;
  securityAndProcessorReviewPassed: boolean;
  exitPlanDocumented: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
  candidates: readonly BankProviderCandidate[];
}>;

export type BankConsentScope =
  | 'account_details'
  | 'balances'
  | 'transactions'
  | 'standing_orders'
  | 'direct_debits';

export type BankAccountKind = 'personal' | 'business';

export type BankConsentStatus =
  | 'draft'
  | 'pending_redirect'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'error';

export type BankConnectionStatus = 'selected' | 'paused' | 'revoked' | 'stale' | 'error';

export type BankConsentAccountState = Readonly<{
  accountAlias: string;
  workspaceId: string;
  kind: BankAccountKind;
  selected: boolean;
  status: BankConnectionStatus;
  lastSuccessfulRefreshAt: string | null;
}>;

export type BankConsentRecord = Readonly<{
  consentId: string;
  providerId: string;
  workspaceId: string;
  status: BankConsentStatus;
  scopes: readonly BankConsentScope[];
  accounts: readonly BankConsentAccountState[];
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastSuccessfulRefreshAt: string | null;
  revokeAvailable: boolean;
  localDataRetentionChoiceVisible: boolean;
}>;

export type BankDataProviderContractInput = Readonly<{
  interfaceVersion: number;
  supportsStartConsent: boolean;
  supportsCallback: boolean;
  supportsListConsentState: boolean;
  supportsCanonicalRows: boolean;
  supportsRefreshConsent: boolean;
  supportsRevokeConsent: boolean;
  fakeProviderContractPassed: boolean;
  providerSandboxContractPassed: boolean;
  providerProductionContractPassed: boolean;
  mobilePinsProviderSdk: boolean;
}>;

export type BankDataProviderContractState = Readonly<{
  interfaceVersion: number;
  providerNeutral: boolean;
  fakeContractPassed: boolean;
  sandboxContractPassed: boolean;
  productionContractPassed: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type ConsentJourneyInput = Readonly<{
  userSelectedConnectBank: boolean;
  firstLaunchPromptShown: boolean;
  explanationVisibleBeforeRedirect: boolean;
  scopesExplained: boolean;
  eligibleAccountsChosenAtProvider: boolean;
  providerRedirectUrlCreated: boolean;
  callbackHandledServerSide: boolean;
  tokenEncryptedServerSide: boolean;
  providerTokenPresentInApp: boolean;
  appLogsContainProviderToken: boolean;
}>;

export type ConsentJourneyState = Readonly<{
  contextualOnly: boolean;
  explanationComplete: boolean;
  serverTokenBoundary: boolean;
  appHasNoToken: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type ConsentDashboardInput = Readonly<{
  consents: readonly BankConsentRecord[];
  providerLabelVisible: boolean;
  accountScopeVisible: boolean;
  expiryVisible: boolean;
  lastRefreshVisible: boolean;
  revokeControlVisible: boolean;
  workspaceMismatchPrevented: boolean;
}>;

export type ConsentDashboardState = Readonly<{
  consentCount: number;
  activeConsentCount: number;
  revokedConsentCount: number;
  accountCount: number;
  dashboardComplete: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
  consents: readonly BankConsentRecord[];
}>;

export type ProviderBookingStatus = 'pending' | 'posted';

export type ProviderTransactionRow = Readonly<{
  providerRowId: string;
  providerAccountRef: string;
  providerTransactionId: string;
  bookingStatus: ProviderBookingStatus;
  occurredAt: string;
  amountMinor: number;
  currency: string;
  description: string;
  merchantName: string | null;
  pendingReplacementFor: string | null;
}>;

export type BankAccountMapping = Readonly<{
  providerAccountRef: string;
  accountAlias: string;
  workspaceId: string;
  kind: BankAccountKind;
}>;

export type CanonicalBankRow = Readonly<{
  canonicalRowId: string;
  sourceKind: 'open_banking';
  workspaceId: string;
  accountAlias: string;
  providerTransactionId: string;
  bookingStatus: ProviderBookingStatus;
  occurredAt: string;
  amountMinor: number;
  currency: string;
  descriptionAlias: string;
  merchantAlias: string | null;
  pendingReplacementFor: string | null;
  stageOnly: true;
  provenance: Readonly<{
    providerRowId: string;
    providerAccountRef: string;
  }>;
}>;

export type NormalizeProviderRowsInput = Readonly<{
  workspaceId: string;
  providerId: string;
  accountMappings: readonly BankAccountMapping[];
  rows: readonly ProviderTransactionRow[];
  writeDirectlyToTransactions: boolean;
  routeThroughImportReview: boolean;
  encryptTransport: boolean;
}>;

export type CanonicalIngestionState = Readonly<{
  rowCount: number;
  canonicalRows: readonly CanonicalBankRow[];
  rejectedProviderRowIds: readonly string[];
  routeThroughImportReview: boolean;
  writeDirectlyToTransactions: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type ExistingTransactionReference = Readonly<{
  transactionId: string;
  providerTransactionId: string | null;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  accountAlias: string;
}>;

export type ReconciliationState = Readonly<{
  duplicateProviderIds: readonly string[];
  pendingReplacements: readonly string[];
  possibleTransferIds: readonly string[];
  unmatchedCanonicalIds: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type MissingDateRange = Readonly<{
  fromIso: string;
  toIso: string;
  reason: 'provider_outage' | 'rate_limited' | 'consent_expired' | 'unknown';
}>;

export type FeedHealthInput = Readonly<{
  nowIso: string;
  lastSuccessfulRefreshAt: string | null;
  staleAfterHours: number;
  providerUnavailable: boolean;
  rateLimited: boolean;
  missingRanges: readonly MissingDateRange[];
  pendingRowsVisible: boolean;
  manualOrCsvGapFillAvailable: boolean;
}>;

export type FeedHealthState = Readonly<{
  stale: boolean;
  gapped: boolean;
  status: 'fresh' | 'stale' | 'gapped' | 'unavailable';
  forecastMustShowStaleData: boolean;
  localAppContinues: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
  missingRanges: readonly MissingDateRange[];
}>;

export type RevocationInput = Readonly<{
  consent: BankConsentRecord;
  providerRevokeCalled: boolean;
  futureRefreshDisabled: boolean;
  serverTokenDeleted: boolean;
  providerTokenPresentInApp: boolean;
  importedHistoryChoicePresented: boolean;
  deleteImportedHistoryAvailable: boolean;
}>;

export type RevocationState = Readonly<{
  consentId: string;
  futureAccessStopped: boolean;
  serverTokenDeleted: boolean;
  localHistorySeparateChoice: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type OpenBankingReleaseGateInput = Readonly<{
  providerSelection: ProviderSelectionState;
  providerContract: BankDataProviderContractState;
  consentJourney: ConsentJourneyState;
  dashboard: ConsentDashboardState;
  ingestion: CanonicalIngestionState;
  feedHealth: FeedHealthState;
  revocation: RevocationState;
  sandboxPilotPassed: boolean;
  productionPilotPassed: boolean;
  legalSignoffComplete: boolean;
  storeReviewComplete: boolean;
  supportRunbookReady: boolean;
  incidentMonitoringReady: boolean;
  manualImportStillAvailable: boolean;
}>;

export type OpenBankingReleaseGateState = Readonly<{
  ready: boolean;
  releaseTrack: 'not_started' | 'internal_contract' | 'staged_rollout';
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type Phase12CoverageInput = Readonly<{
  providerSelection: ProviderSelectionState;
  providerContract: BankDataProviderContractState;
  consentJourney: ConsentJourneyState;
  dashboard: ConsentDashboardState;
  ingestion: CanonicalIngestionState;
  feedHealth: FeedHealthState;
  revocation: RevocationState;
  releaseGate: OpenBankingReleaseGateState;
}>;

export function evaluateProviderSelection(input: ProviderSelectionInput): ProviderSelectionState {
  const selected = input.selectedProviderId
    ? input.candidates.find((candidate) => candidate.providerId === input.selectedProviderId)
    : undefined;
  const selectedProviderRegulated = selected?.regulatedStatus === 'approved';
  const coverageReviewed = Boolean(
    selected?.ukPersonalCoverage && selected.ukBusinessCoverage && selected.consentUxReviewed,
  );
  const securityAndProcessorReviewPassed = Boolean(
    selected?.securityReviewPassed &&
    selected.processorTermsApproved &&
    selected.dataResidencyApproved &&
    selected.pendingPostedQualityReviewed &&
    selected.webhookReliabilityReviewed &&
    selected.sandboxQualityReviewed,
  );
  const exitPlanDocumented = selected?.exitPlanDocumented === true;
  const pricingComplete =
    selected?.pricing.some((scenario) => scenario.connectedAccounts === 1_000) === true &&
    selected?.pricing.some((scenario) => scenario.connectedAccounts === 10_000) === true &&
    selected?.pricing.some((scenario) => scenario.connectedAccounts === 100_000) === true;
  const blockers = compact([
    input.candidates.length > 0 ? '' : 'provider candidate list is empty',
    selected ? '' : 'regulated AISP provider has not been selected',
    selectedProviderRegulated ? '' : 'selected provider is not approved as regulated/authorised',
    coverageReviewed ? '' : 'personal/business coverage and consent UX are not reviewed',
    securityAndProcessorReviewPassed
      ? ''
      : 'security, processor, data residency or quality review is incomplete',
    pricingComplete ? '' : '1k/10k/100k pricing scenarios are incomplete',
    exitPlanDocumented ? '' : 'provider exit plan is not documented',
    input.procurementDecisionRecorded ? '' : 'procurement decision is not recorded',
    input.legalDecisionRecorded ? '' : 'legal decision is not recorded',
    input.storeDisclosureDrafted ? '' : 'store disclosure is not drafted',
  ]);

  return {
    candidateCount: input.candidates.length,
    selectedProviderId: selected?.providerId ?? null,
    selectedProviderRegulated,
    coverageReviewed,
    securityAndProcessorReviewPassed,
    exitPlanDocumented,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Candidate count',
        String(input.candidates.length),
        stateFor(input.candidates.length > 0),
      ),
      row('Selected provider', selected?.label ?? 'none', selected ? 'needs_review' : 'blocked'),
      row(
        'Regulated status',
        selectedProviderRegulated ? 'approved' : 'not approved',
        stateFor(selectedProviderRegulated),
      ),
      row('Coverage and UX', boolText(coverageReviewed), stateFor(coverageReviewed)),
      row(
        'Security/processor review',
        boolText(securityAndProcessorReviewPassed),
        stateFor(securityAndProcessorReviewPassed),
      ),
      row('Exit plan', boolText(exitPlanDocumented), stateFor(exitPlanDocumented)),
    ],
    candidates: input.candidates,
  };
}

export function evaluateBankDataProviderContract(
  input: BankDataProviderContractInput,
): BankDataProviderContractState {
  const providerNeutral =
    input.interfaceVersion >= 1 &&
    input.supportsStartConsent &&
    input.supportsCallback &&
    input.supportsListConsentState &&
    input.supportsCanonicalRows &&
    input.supportsRefreshConsent &&
    input.supportsRevokeConsent &&
    !input.mobilePinsProviderSdk;
  const blockers = compact([
    providerNeutral
      ? ''
      : 'provider-neutral BankDataProvider surface is incomplete or mobile-pinned',
    input.fakeProviderContractPassed ? '' : 'fake provider contract suite has not passed',
    input.providerSandboxContractPassed
      ? ''
      : 'regulated provider sandbox contract suite has not passed',
    input.providerProductionContractPassed ? '' : 'production pilot contract suite has not passed',
  ]);

  return {
    interfaceVersion: input.interfaceVersion,
    providerNeutral,
    fakeContractPassed: input.fakeProviderContractPassed,
    sandboxContractPassed: input.providerSandboxContractPassed,
    productionContractPassed: input.providerProductionContractPassed,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Interface version',
        String(input.interfaceVersion),
        stateFor(input.interfaceVersion >= 1),
      ),
      row('Provider neutral', boolText(providerNeutral), stateFor(providerNeutral)),
      row(
        'Fake contract',
        boolText(input.fakeProviderContractPassed),
        stateFor(input.fakeProviderContractPassed),
      ),
      row(
        'Sandbox contract',
        boolText(input.providerSandboxContractPassed),
        stateFor(input.providerSandboxContractPassed),
      ),
      row(
        'Production contract',
        boolText(input.providerProductionContractPassed),
        stateFor(input.providerProductionContractPassed),
      ),
    ],
  };
}

export function evaluateConsentJourney(input: ConsentJourneyInput): ConsentJourneyState {
  const contextualOnly = input.userSelectedConnectBank && !input.firstLaunchPromptShown;
  const explanationComplete =
    input.explanationVisibleBeforeRedirect &&
    input.scopesExplained &&
    input.eligibleAccountsChosenAtProvider;
  const serverTokenBoundary =
    input.callbackHandledServerSide &&
    input.tokenEncryptedServerSide &&
    !input.providerTokenPresentInApp &&
    !input.appLogsContainProviderToken;
  const appHasNoToken = !input.providerTokenPresentInApp && !input.appLogsContainProviderToken;
  const blockers = compact([
    contextualOnly ? '' : 'bank prompt is not contextual or appears on first launch',
    explanationComplete ? '' : 'scope/account explanation is incomplete before provider redirect',
    input.providerRedirectUrlCreated ? '' : 'provider redirect was not created by backend adapter',
    serverTokenBoundary ? '' : 'provider token boundary is not server-side and encrypted',
  ]);

  return {
    contextualOnly,
    explanationComplete,
    serverTokenBoundary,
    appHasNoToken,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'First launch prompt',
        input.firstLaunchPromptShown ? 'shown' : 'not shown',
        stateFor(!input.firstLaunchPromptShown),
      ),
      row(
        'User selected connect',
        boolText(input.userSelectedConnectBank),
        stateFor(input.userSelectedConnectBank),
      ),
      row('Explanation', boolText(explanationComplete), stateFor(explanationComplete)),
      row('Server token boundary', boolText(serverTokenBoundary), stateFor(serverTokenBoundary)),
      row('App token/logs', appHasNoToken ? 'none' : 'present', stateFor(appHasNoToken)),
    ],
  };
}

export function buildConsentDashboard(input: ConsentDashboardInput): ConsentDashboardState {
  const consentCount = input.consents.length;
  const activeConsentCount = input.consents.filter((consent) => consent.status === 'active').length;
  const revokedConsentCount = input.consents.filter(
    (consent) => consent.status === 'revoked',
  ).length;
  const accountCount = input.consents.reduce(
    (count, consent) => count + consent.accounts.length,
    0,
  );
  const eachConsentHasControls = input.consents.every(
    (consent) =>
      consent.providerId.length > 0 &&
      consent.scopes.length > 0 &&
      consent.accounts.length > 0 &&
      consent.localDataRetentionChoiceVisible &&
      (consent.status === 'revoked' || consent.revokeAvailable),
  );
  const dashboardComplete =
    consentCount > 0 &&
    input.providerLabelVisible &&
    input.accountScopeVisible &&
    input.expiryVisible &&
    input.lastRefreshVisible &&
    input.revokeControlVisible &&
    input.workspaceMismatchPrevented &&
    eachConsentHasControls;
  const blockers = compact([
    consentCount > 0 ? '' : 'dashboard has no consent records',
    input.providerLabelVisible ? '' : 'provider label is hidden',
    input.accountScopeVisible ? '' : 'account/scope state is hidden',
    input.expiryVisible ? '' : 'expiry or reconfirmation state is hidden',
    input.lastRefreshVisible ? '' : 'last successful refresh is hidden',
    input.revokeControlVisible ? '' : 'revoke control is hidden',
    input.workspaceMismatchPrevented ? '' : 'workspace mismatch prevention is not proven',
    eachConsentHasControls ? '' : 'one or more consent rows lack controls, scopes or accounts',
  ]);

  return {
    consentCount,
    activeConsentCount,
    revokedConsentCount,
    accountCount,
    dashboardComplete,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Consent records', String(consentCount), stateFor(consentCount > 0)),
      row('Accounts shown', String(accountCount), stateFor(accountCount > 0)),
      row(
        'Scopes and expiry',
        boolText(input.accountScopeVisible && input.expiryVisible),
        stateFor(input.accountScopeVisible && input.expiryVisible),
      ),
      row('Last refresh', boolText(input.lastRefreshVisible), stateFor(input.lastRefreshVisible)),
      row(
        'Revoke control',
        boolText(input.revokeControlVisible),
        stateFor(input.revokeControlVisible),
      ),
      row(
        'Workspace guard',
        boolText(input.workspaceMismatchPrevented),
        stateFor(input.workspaceMismatchPrevented),
      ),
    ],
    consents: input.consents,
  };
}

export function normalizeProviderRows(input: NormalizeProviderRowsInput): CanonicalIngestionState {
  const accountMap = new Map(
    input.accountMappings.map((mapping) => [mapping.providerAccountRef, mapping]),
  );
  const canonicalRows: CanonicalBankRow[] = [];
  const rejectedProviderRowIds: string[] = [];
  const merchantAliases = new Map<string, string>();

  for (const providerRow of input.rows) {
    const account = accountMap.get(providerRow.providerAccountRef);
    if (!account || account.workspaceId !== input.workspaceId) {
      rejectedProviderRowIds.push(providerRow.providerRowId);
      continue;
    }

    canonicalRows.push({
      canonicalRowId: `${input.providerId}:${providerRow.providerRowId}`,
      sourceKind: 'open_banking',
      workspaceId: account.workspaceId,
      accountAlias: account.accountAlias,
      providerTransactionId: providerRow.providerTransactionId,
      bookingStatus: providerRow.bookingStatus,
      occurredAt: providerRow.occurredAt,
      amountMinor: providerRow.amountMinor,
      currency: providerRow.currency,
      descriptionAlias: aliasFor(providerRow.description, merchantAliases, 'bank_desc'),
      merchantAlias: providerRow.merchantName
        ? aliasFor(providerRow.merchantName, merchantAliases, 'bank_party')
        : null,
      pendingReplacementFor: providerRow.pendingReplacementFor,
      stageOnly: true,
      provenance: {
        providerRowId: providerRow.providerRowId,
        providerAccountRef: providerRow.providerAccountRef,
      },
    });
  }

  const blockers = compact([
    input.routeThroughImportReview ? '' : 'canonical rows bypass import review staging',
    input.writeDirectlyToTransactions ? 'provider rows write directly to transactions' : '',
    input.encryptTransport ? '' : 'canonical rows are not marked encrypted in transit',
    rejectedProviderRowIds.length === 0
      ? ''
      : `${rejectedProviderRowIds.length} provider rows had no safe account mapping`,
  ]);

  return {
    rowCount: canonicalRows.length,
    canonicalRows,
    rejectedProviderRowIds,
    routeThroughImportReview: input.routeThroughImportReview,
    writeDirectlyToTransactions: input.writeDirectlyToTransactions,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Provider rows', String(input.rows.length), stateFor(input.rows.length > 0)),
      row('Canonical staged', String(canonicalRows.length), stateFor(canonicalRows.length > 0)),
      row(
        'Import review route',
        boolText(input.routeThroughImportReview),
        stateFor(input.routeThroughImportReview),
      ),
      row(
        'Direct transaction write',
        input.writeDirectlyToTransactions ? 'yes' : 'no',
        stateFor(!input.writeDirectlyToTransactions),
      ),
      row(
        'Rejected rows',
        String(rejectedProviderRowIds.length),
        stateFor(rejectedProviderRowIds.length === 0),
      ),
    ],
  };
}

export function reconcileCanonicalRows(
  canonicalRows: readonly CanonicalBankRow[],
  existingTransactions: readonly ExistingTransactionReference[],
): ReconciliationState {
  const existingProviderIds = new Set(
    existingTransactions
      .map((transaction) => transaction.providerTransactionId)
      .filter((providerId): providerId is string => providerId !== null),
  );
  const duplicateProviderIds = canonicalRows
    .filter((canonicalRow) => existingProviderIds.has(canonicalRow.providerTransactionId))
    .map((canonicalRow) => canonicalRow.providerTransactionId);
  const pendingReplacements = canonicalRows
    .filter((canonicalRow) => canonicalRow.pendingReplacementFor !== null)
    .map((canonicalRow) => canonicalRow.canonicalRowId);
  const possibleTransferIds = canonicalRows
    .filter((rowA, index) =>
      canonicalRows.some(
        (rowB, rowBIndex) =>
          rowBIndex > index &&
          rowA.currency === rowB.currency &&
          rowA.amountMinor === -rowB.amountMinor &&
          rowA.occurredAt === rowB.occurredAt &&
          rowA.accountAlias !== rowB.accountAlias,
      ),
    )
    .map((canonicalRow) => canonicalRow.canonicalRowId);
  const unmatchedCanonicalIds = canonicalRows
    .filter(
      (canonicalRow) =>
        !duplicateProviderIds.includes(canonicalRow.providerTransactionId) &&
        !pendingReplacements.includes(canonicalRow.canonicalRowId),
    )
    .map((canonicalRow) => canonicalRow.canonicalRowId);

  return {
    duplicateProviderIds,
    pendingReplacements,
    possibleTransferIds,
    unmatchedCanonicalIds,
    rows: [
      row(
        'Provider duplicates',
        String(duplicateProviderIds.length),
        duplicateProviderIds.length === 0 ? 'implemented' : 'needs_review',
      ),
      row(
        'Pending replacements',
        String(pendingReplacements.length),
        pendingReplacements.length === 0 ? 'implemented' : 'needs_review',
      ),
      row(
        'Possible transfers',
        String(possibleTransferIds.length),
        possibleTransferIds.length === 0 ? 'implemented' : 'needs_review',
      ),
      row('Unmatched staged rows', String(unmatchedCanonicalIds.length), 'implemented'),
    ],
  };
}

export function evaluateFeedHealth(input: FeedHealthInput): FeedHealthState {
  const ageHours = input.lastSuccessfulRefreshAt
    ? hoursBetween(input.lastSuccessfulRefreshAt, input.nowIso)
    : Number.POSITIVE_INFINITY;
  const stale =
    !Number.isFinite(ageHours) ||
    ageHours > input.staleAfterHours ||
    input.providerUnavailable ||
    input.rateLimited;
  const gapped = input.missingRanges.length > 0;
  const status = input.providerUnavailable
    ? 'unavailable'
    : gapped
      ? 'gapped'
      : stale
        ? 'stale'
        : 'fresh';
  const forecastMustShowStaleData = stale || gapped;
  const localAppContinues = input.manualOrCsvGapFillAvailable;
  const blockers = compact([
    input.pendingRowsVisible ? '' : 'pending/posted state is hidden',
    localAppContinues ? '' : 'manual or CSV gap filling is not available',
    forecastMustShowStaleData ? '' : '',
  ]);

  return {
    stale,
    gapped,
    status,
    forecastMustShowStaleData,
    localAppContinues,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Feed status', status, status === 'fresh' ? 'implemented' : 'needs_review'),
      row(
        'Stale visible',
        boolText(forecastMustShowStaleData),
        forecastMustShowStaleData ? 'implemented' : 'needs_review',
      ),
      row(
        'Gap ranges',
        String(input.missingRanges.length),
        gapped ? 'needs_review' : 'implemented',
      ),
      row(
        'Pending/posted visible',
        boolText(input.pendingRowsVisible),
        stateFor(input.pendingRowsVisible),
      ),
      row('Manual gap fill', boolText(localAppContinues), stateFor(localAppContinues)),
    ],
    missingRanges: input.missingRanges,
  };
}

export function evaluateRevocation(input: RevocationInput): RevocationState {
  const consentRevoked = input.consent.status === 'revoked' && input.consent.revokedAt !== null;
  const futureAccessStopped =
    consentRevoked &&
    input.providerRevokeCalled &&
    input.futureRefreshDisabled &&
    !input.providerTokenPresentInApp;
  const localHistorySeparateChoice =
    input.importedHistoryChoicePresented && input.deleteImportedHistoryAvailable;
  const blockers = compact([
    consentRevoked ? '' : 'consent is not recorded as revoked',
    input.providerRevokeCalled ? '' : 'provider revoke call has not succeeded',
    input.futureRefreshDisabled ? '' : 'future refresh is still enabled',
    input.serverTokenDeleted ? '' : 'server token is not deleted',
    input.providerTokenPresentInApp ? 'provider token is present in app' : '',
    localHistorySeparateChoice
      ? ''
      : 'retained local history choice is not separate from revocation',
  ]);

  return {
    consentId: input.consent.consentId,
    futureAccessStopped,
    serverTokenDeleted: input.serverTokenDeleted,
    localHistorySeparateChoice,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Consent status', input.consent.status, consentRevoked ? 'implemented' : 'blocked'),
      row(
        'Future access',
        futureAccessStopped ? 'stopped' : 'not stopped',
        stateFor(futureAccessStopped),
      ),
      row(
        'Server token',
        input.serverTokenDeleted ? 'deleted' : 'not deleted',
        stateFor(input.serverTokenDeleted),
      ),
      row(
        'App token',
        input.providerTokenPresentInApp ? 'present' : 'none',
        stateFor(!input.providerTokenPresentInApp),
      ),
      row(
        'Local history choice',
        boolText(localHistorySeparateChoice),
        stateFor(localHistorySeparateChoice),
      ),
    ],
  };
}

export function evaluateOpenBankingReleaseGate(
  input: OpenBankingReleaseGateInput,
): OpenBankingReleaseGateState {
  const blockers = [
    ...input.providerSelection.blockers,
    ...input.providerContract.blockers,
    ...input.consentJourney.blockers,
    ...input.dashboard.blockers,
    ...input.ingestion.blockers,
    ...input.feedHealth.blockers,
    ...input.revocation.blockers,
    ...compact([
      input.sandboxPilotPassed ? '' : 'provider sandbox pilot acceptance has not passed',
      input.productionPilotPassed ? '' : 'provider production pilot acceptance has not passed',
      input.legalSignoffComplete ? '' : 'regulated partner/legal signoff is incomplete',
      input.storeReviewComplete ? '' : 'store privacy/reviewer disclosure is incomplete',
      input.supportRunbookReady ? '' : 'Open Banking support runbook is not ready',
      input.incidentMonitoringReady ? '' : 'provider incident monitoring is not ready',
      input.manualImportStillAvailable ? '' : 'manual/import paths are not fully available',
    ]),
  ];
  const internalContractsReady =
    !input.consentJourney.releaseBlocked &&
    !input.dashboard.releaseBlocked &&
    !input.ingestion.releaseBlocked &&
    !input.feedHealth.releaseBlocked &&
    input.manualImportStillAvailable;

  return {
    ready: blockers.length === 0,
    releaseTrack:
      blockers.length === 0
        ? 'staged_rollout'
        : internalContractsReady
          ? 'internal_contract'
          : 'not_started',
    blockers,
    rows: [
      row(
        'Open Banking ready',
        boolText(blockers.length === 0),
        blockers.length === 0 ? 'passed' : 'blocked',
      ),
      row('Internal contracts', boolText(internalContractsReady), stateFor(internalContractsReady)),
      row('Sandbox pilot', boolText(input.sandboxPilotPassed), stateFor(input.sandboxPilotPassed)),
      row(
        'Production pilot',
        boolText(input.productionPilotPassed),
        stateFor(input.productionPilotPassed),
      ),
      row(
        'Legal/store review',
        boolText(input.legalSignoffComplete && input.storeReviewComplete),
        stateFor(input.legalSignoffComplete && input.storeReviewComplete),
      ),
      row(
        'Manual/import paths',
        boolText(input.manualImportStillAvailable),
        stateFor(input.manualImportStillAvailable),
      ),
    ],
  };
}

export function buildPhase12CoverageRows(
  input: Phase12CoverageInput,
): readonly Phase12CoverageRow[] {
  return [
    coverageRow(
      'T160',
      'Regulated AISP provider selection',
      input.providerSelection.releaseBlocked ? 'blocked' : 'passed',
      'provider candidates are scored for coverage, consent UX, cost, security, processor terms and exit',
      firstBlocker(input.providerSelection.blockers),
    ),
    coverageRow(
      'T161',
      'BankDataProvider contract',
      input.providerContract.releaseBlocked ? 'blocked' : 'implemented',
      'provider-neutral start/callback/list/rows/refresh/revoke surface with fake contract suite',
      firstBlocker(input.providerContract.blockers),
    ),
    coverageRow(
      'T162',
      'Consent journey and token store',
      input.consentJourney.releaseBlocked ? 'blocked' : 'implemented',
      'contextual connect-bank journey keeps provider token in encrypted backend boundary only',
      firstBlocker(input.consentJourney.blockers),
    ),
    coverageRow(
      'T163',
      'Consent dashboard',
      input.dashboard.dashboardComplete ? 'implemented' : 'blocked',
      'provider, accounts, scopes, expiry, last refresh, workspace guard and revoke controls visible',
      firstBlocker(input.dashboard.blockers),
    ),
    coverageRow(
      'T164',
      'Canonical row ingestion',
      input.ingestion.releaseBlocked ? 'blocked' : 'implemented',
      'provider rows are normalised to staged import-review records, not direct transaction writes',
      firstBlocker(input.ingestion.blockers),
    ),
    coverageRow(
      'T165',
      'Refresh, gap and stale state',
      input.feedHealth.localAppContinues ? 'implemented' : 'blocked',
      'outages, stale data, pending rows and missing ranges are visible while manual import continues',
      firstBlocker(input.feedHealth.blockers),
    ),
    coverageRow(
      'T166',
      'Revocation and deletion paths',
      input.revocation.futureAccessStopped && input.revocation.localHistorySeparateChoice
        ? 'implemented'
        : 'blocked',
      'revocation stops future access and separates retained local history from delete choices',
      firstBlocker(input.revocation.blockers),
    ),
    coverageRow(
      'T167',
      'Provider sandbox/production pilot',
      input.releaseGate.blockers.some((blocker) => blocker.includes('pilot'))
        ? 'blocked'
        : 'passed',
      'pending/posted, account selection, refresh and revocation require provider pilot acceptance',
      firstPilotBlocker(input.releaseGate.blockers),
    ),
    coverageRow(
      'T168',
      'Staged Open Banking rollout',
      input.releaseGate.ready ? 'passed' : 'blocked',
      'staged rollout waits for legal/store review, support, incident monitoring and manual-mode proof',
      firstBlocker(input.releaseGate.blockers),
    ),
  ];
}

export function openBankingRowsByState<Row extends EvidenceRow | Phase12CoverageRow>(
  rows: readonly Row[],
  state: Row['state'],
): readonly Row[] {
  return rows.filter((row) => row.state === state);
}

function coverageRow(
  taskId: Phase12TaskId,
  label: string,
  state: OpenBankingReadinessState,
  evidence: string,
  blocker?: string,
): Phase12CoverageRow {
  if (blocker) {
    return { taskId, label, state, evidence, blocker };
  }

  return { taskId, label, state, evidence };
}

function row(label: string, value: string, state: OpenBankingReadinessState): EvidenceRow {
  return { label, value, state };
}

function stateFor(condition: boolean): OpenBankingReadinessState {
  return condition ? 'implemented' : 'blocked';
}

function boolText(value: boolean): string {
  return value ? 'yes' : 'no';
}

function compact(values: readonly string[]): readonly string[] {
  return values.filter((value) => value.length > 0);
}

function firstBlocker(blockers: readonly string[]): string | undefined {
  return blockers[0];
}

function firstPilotBlocker(blockers: readonly string[]): string | undefined {
  return blockers.find((blocker) => blocker.includes('pilot'));
}

function aliasFor(value: string, aliases: Map<string, string>, prefix: string): string {
  const existing = aliases.get(value);
  if (existing) return existing;

  const alias = `${prefix}_${aliases.size + 1}`;
  aliases.set(value, alias);
  return alias;
}

function hoursBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    return Number.POSITIVE_INFINITY;
  return (end - start) / 3_600_000;
}
