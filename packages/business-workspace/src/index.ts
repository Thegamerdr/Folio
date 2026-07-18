export const businessWorkspaceBoundary = {
  packageName: '@folio/business-workspace',
  optional: true,
  personalWorkspaceDefault: true,
  businessIsNotFilterOverPersonal: true,
  directTaxFilingEnabled: false,
  combinedTaxLedgerAllowed: false,
  writesDirectlyToStorage: false,
  importsNativeModules: false,
  networkRequiredForContracts: false,
  sharesMeloMemoryAcrossWorkspaces: false,
} as const;

export * from './operations.js';

export type BusinessReadinessState = 'implemented' | 'passed' | 'needs_review' | 'blocked';

export type EvidenceRow = Readonly<{
  label: string;
  value: string;
  state: BusinessReadinessState;
}>;

export type Phase13TaskId =
  | 'T169'
  | 'T170'
  | 'T171'
  | 'T172'
  | 'T173'
  | 'T174'
  | 'T175'
  | 'T176'
  | 'T177'
  | 'T178'
  | 'T179'
  | 'T180'
  | 'T181'
  | 'T182';

export type Phase13CoverageRow = Readonly<{
  taskId: Phase13TaskId;
  label: string;
  state: BusinessReadinessState;
  evidence: string;
  blocker?: string;
}>;

export type WorkspaceKind = 'personal' | 'business';

export type WorkspaceSummary = Readonly<{
  workspaceId: string;
  kind: WorkspaceKind;
  label: string;
  iconLabel: string;
  legalName: string | null;
  tradingName: string | null;
  encryptedSubkeyId: string;
  created: boolean;
}>;

export type WorkspaceSwitcherInput = Readonly<{
  workspaces: readonly WorkspaceSummary[];
  activeWorkspaceId: string;
  persistentTextLabelVisible: boolean;
  iconOrSymbolVisible: boolean;
  distinctNavigationLabels: boolean;
  screenReaderLabelIncludesWorkspace: boolean;
  largeTextDoesNotTruncateWorkspace: boolean;
  businessCreationShownDuringPersonalOnboarding: boolean;
  optionalCreationAvailable: boolean;
}>;

export type WorkspaceSwitcherState = Readonly<{
  activeWorkspace: WorkspaceSummary;
  businessWorkspaceCount: number;
  personalDefaultPreserved: boolean;
  visualSeparationComplete: boolean;
  optionalAndNonCoercive: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type BusinessAccount = Readonly<{
  accountId: string;
  workspaceId: string;
  label: string;
  currency: string;
}>;

export type BusinessTransactionStatus = 'pending' | 'posted';

export type BusinessTransaction = Readonly<{
  transactionId: string;
  workspaceId: string;
  accountId: string;
  occurredAt: string;
  amountMinor: number;
  currency: string;
  description: string;
  status: BusinessTransactionStatus;
  reviewStatus: 'proposed' | 'accepted' | 'needs_review';
  taxCategoryId: string | null;
  sourceEvidenceId: string | null;
}>;

export type BusinessLedgerInput = Readonly<{
  businessWorkspaceId: string;
  personalWorkspaceIds: readonly string[];
  accounts: readonly BusinessAccount[];
  transactions: readonly BusinessTransaction[];
  queryWorkspaceIds: readonly string[];
}>;

export type BusinessLedgerState = Readonly<{
  transactionCount: number;
  accountCount: number;
  businessOnlyAccounts: boolean;
  businessOnlyTransactions: boolean;
  personalQueryLeakage: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type ClientRecord = Readonly<{
  clientId: string;
  workspaceId: string;
  displayName: string;
  emailEncrypted: boolean;
  addressEncrypted: boolean;
}>;

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'part_paid'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'credited';

export type InvoiceRecord = Readonly<{
  invoiceId: string;
  workspaceId: string;
  clientId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalMinor: number;
  paidMinor: number;
  linkedDocumentId: string | null;
}>;

export type InvoiceEventKind =
  | 'invoice_drafted'
  | 'invoice_issued'
  | 'payment_expected'
  | 'payment_part_paid'
  | 'payment_paid'
  | 'invoice_overdue'
  | 'invoice_voided'
  | 'invoice_credited';

export type InvoiceEvent = Readonly<{
  invoiceId: string;
  workspaceId: string;
  kind: InvoiceEventKind;
  dueDate: string | null;
  amountMinor: number;
}>;

export type InvoiceLifecycleInput = Readonly<{
  businessWorkspaceId: string;
  clients: readonly ClientRecord[];
  invoices: readonly InvoiceRecord[];
  nowDate: string;
  expectedCashFlowGenerated: boolean;
}>;

export type InvoiceLifecycleState = Readonly<{
  clientCount: number;
  invoiceCount: number;
  openInvoiceCount: number;
  overdueInvoiceIds: readonly string[];
  expectedCashFlowMinor: number;
  events: readonly InvoiceEvent[];
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type PaymentMatchProposal = Readonly<{
  invoiceId: string;
  transactionId: string;
  confidence: 'high' | 'medium' | 'ambiguous';
  amountMinor: number;
  autoApplyAllowed: boolean;
  reason: string;
}>;

export type PaymentMatchingInput = Readonly<{
  businessWorkspaceId: string;
  invoices: readonly InvoiceRecord[];
  transactions: readonly BusinessTransaction[];
  ambiguousMatchesRequireReview: boolean;
  openBankingLive: boolean;
}>;

export type PaymentMatchingState = Readonly<{
  proposalCount: number;
  ambiguousCount: number;
  autoAppliedCount: number;
  reviewRequiredCount: number;
  releaseBlocked: boolean;
  blockers: readonly string[];
  proposals: readonly PaymentMatchProposal[];
  rows: readonly EvidenceRow[];
}>;

export type ReceiptDocument = Readonly<{
  documentId: string;
  workspaceId: string;
  linkedTransactionId: string | null;
  sourceEvidenceRetained: boolean;
  retentionPolicy: 'retain_original' | 'retain_until_export' | 'delete_after_verified';
  taxReviewStatus: 'unreviewed' | 'ready' | 'accepted' | 'excluded';
}>;

export type ReceiptWorkflowInput = Readonly<{
  businessWorkspaceId: string;
  documents: readonly ReceiptDocument[];
  captureAvailable: boolean;
  extractionReviewAvailable: boolean;
  documentSubkeyAvailable: boolean;
}>;

export type ReceiptWorkflowState = Readonly<{
  documentCount: number;
  retainedEvidenceCount: number;
  reviewQueueCount: number;
  workflowComplete: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type TaxPeriodStatus = 'open' | 'review' | 'exported' | 'submitted_external' | 'closed';

export type TaxPeriodRecord = Readonly<{
  taxPeriodId: string;
  workspaceId: string;
  jurisdiction: string;
  taxKind: 'self_assessment' | 'income_tax_mtd' | 'vat' | 'corporation_tax' | 'custom';
  startDate: string;
  endDate: string;
  status: TaxPeriodStatus;
  policyPackVersion: string;
  verifiedOn: string;
}>;

export type TaxRecordLink = Readonly<{
  linkId: string;
  workspaceId: string;
  taxPeriodId: string;
  taxCategoryId: string;
  sourceRecordId: string;
  sourceEvidenceId: string | null;
  amountMinor: number;
  reviewStatus: 'proposed' | 'accepted' | 'excluded' | 'adjusted';
  policyPackVersion: string;
}>;

export type TaxPeriodInput = Readonly<{
  businessWorkspaceId: string;
  period: TaxPeriodRecord;
  links: readonly TaxRecordLink[];
  unresolvedItemIds: readonly string[];
  policyPackAvailable: boolean;
  officialGuidanceLinksVisible: boolean;
}>;

export type TaxPeriodState = Readonly<{
  linkCount: number;
  acceptedAmountMinor: number;
  unresolvedCount: number;
  everyFigureHasSourceAndPolicy: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type TaxReserveEstimateInput = Readonly<{
  businessWorkspaceId: string;
  acceptedTaxableAmountMinor: number;
  reserveRateBasisPoints: number;
  assumptionsVisible: boolean;
  uncertaintyVisible: boolean;
  finalBillLanguageUsed: boolean;
  userOverrideAvailable: boolean;
}>;

export type TaxReserveEstimateState = Readonly<{
  estimatedReserveMinor: number;
  adviceBoundaryPassed: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type BusinessCalendarItem = Readonly<{
  itemId: string;
  workspaceId: string;
  kind: 'invoice_due' | 'tax_deadline' | 'client_task' | 'subscription' | 'follow_up';
  title: string;
  dueDate: string;
  sourceEntityId: string;
}>;

export type BusinessCalendarInput = Readonly<{
  businessWorkspaceId: string;
  items: readonly BusinessCalendarItem[];
  personalItemIdsVisible: readonly string[];
  distinctCalendarLabelVisible: boolean;
  localNotificationsBlockedUntilNativeProof: boolean;
}>;

export type BusinessCalendarState = Readonly<{
  itemCount: number;
  personalItemLeakage: boolean;
  businessCalendarComplete: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type BusinessBriefingInput = Readonly<{
  businessWorkspaceId: string;
  cashFlowRows: number;
  invoiceRows: number;
  deadlineRows: number;
  recordRows: number;
  personalMemoryIncluded: boolean;
  personalContentIncluded: boolean;
  meloWorkspaceLabelVisible: boolean;
}>;

export type BusinessBriefingState = Readonly<{
  briefingRowCount: number;
  noPersonalContext: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type BusinessExportRecord = Readonly<{
  recordId: string;
  workspaceId: string;
  periodId: string;
  amountMinor: number;
  sourceEvidenceId: string | null;
  policyPackVersion: string;
}>;

export type BusinessExportInput = Readonly<{
  businessWorkspaceId: string;
  periodId: string;
  records: readonly BusinessExportRecord[];
  workspaceLabelVisible: boolean;
  periodLabelVisible: boolean;
  policyVersionVisible: boolean;
  generatedTimestampVisible: boolean;
  unresolvedItemsVisible: boolean;
  directFilingEnabled: boolean;
  subscriptionRequiredForExport: boolean;
}>;

export type BusinessExportState = Readonly<{
  recordCount: number;
  totalMinor: number;
  personalRecordCount: number;
  labelledAndTraceable: boolean;
  exportReady: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type MileageEntry = Readonly<{
  mileageId: string;
  workspaceId: string;
  tripDate: string;
  purpose: string;
  distanceMilli: number;
  distanceUnit: 'mile' | 'kilometre';
  manualEntry: boolean;
}>;

export type MileageState = Readonly<{
  mileageCount: number;
  businessOnly: boolean;
  manualEntryOnly: boolean;
  exportReady: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type TaxLegalReviewInput = Readonly<{
  ukClaimsReviewed: boolean;
  recordkeepingReviewed: boolean;
  mtdReadinessReviewed: boolean;
  legalCounselSigned: boolean;
  directFilingDisabled: boolean;
  officialGuidanceVerifiedOn: string | null;
}>;

export type TaxLegalReviewState = Readonly<{
  signed: boolean;
  directFilingDisabled: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type IsolationAttackCase = Readonly<{
  caseId: string;
  surface: 'ids' | 'search' | 'sync' | 'ai' | 'export' | 'calendar' | 'documents' | 'transfers';
  description: string;
  personalLeakDetected: boolean;
  businessWorkspaceId: string;
  personalWorkspaceId: string;
}>;

export type IsolationAttackSuiteState = Readonly<{
  caseCount: number;
  surfaceCount: number;
  leakageCount: number;
  passed: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
  cases: readonly IsolationAttackCase[];
}>;

export type BusinessBetaGateInput = Readonly<{
  switcher: WorkspaceSwitcherState;
  ledger: BusinessLedgerState;
  invoiceLifecycle: InvoiceLifecycleState;
  matching: PaymentMatchingState;
  receipts: ReceiptWorkflowState;
  taxPeriod: TaxPeriodState;
  taxReserve: TaxReserveEstimateState;
  calendar: BusinessCalendarState;
  briefing: BusinessBriefingState;
  exports: BusinessExportState;
  mileage: MileageState;
  taxLegalReview: TaxLegalReviewState;
  isolationSuite: IsolationAttackSuiteState;
  entitlementSeamReady: boolean;
  personalUsersSeeNoSetupPressure: boolean;
  supportRunbookReady: boolean;
  accessibilityReviewPassed: boolean;
}>;

export type BusinessBetaGateState = Readonly<{
  ready: boolean;
  releaseTrack: 'internal_contract' | 'beta_blocked' | 'business_beta';
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type Phase13CoverageInput = Readonly<{
  switcher: WorkspaceSwitcherState;
  ledger: BusinessLedgerState;
  invoiceLifecycle: InvoiceLifecycleState;
  matching: PaymentMatchingState;
  receipts: ReceiptWorkflowState;
  taxPeriod: TaxPeriodState;
  taxReserve: TaxReserveEstimateState;
  calendar: BusinessCalendarState;
  briefing: BusinessBriefingState;
  exports: BusinessExportState;
  mileage: MileageState;
  taxLegalReview: TaxLegalReviewState;
  isolationSuite: IsolationAttackSuiteState;
  betaGate: BusinessBetaGateState;
}>;

export function evaluateWorkspaceSwitcher(input: WorkspaceSwitcherInput): WorkspaceSwitcherState {
  const activeWorkspace = input.workspaces.find(
    (workspace) => workspace.workspaceId === input.activeWorkspaceId,
  );
  if (!activeWorkspace) {
    throw new Error('active workspace must exist');
  }

  const businessWorkspaceCount = input.workspaces.filter(
    (workspace) => workspace.kind === 'business' && workspace.created,
  ).length;
  const personalDefaultPreserved = input.workspaces.some(
    (workspace) => workspace.kind === 'personal' && workspace.created,
  );
  const visualSeparationComplete =
    input.persistentTextLabelVisible &&
    input.iconOrSymbolVisible &&
    input.distinctNavigationLabels &&
    input.screenReaderLabelIncludesWorkspace &&
    input.largeTextDoesNotTruncateWorkspace;
  const optionalAndNonCoercive =
    !input.businessCreationShownDuringPersonalOnboarding && input.optionalCreationAvailable;
  const blockers = compact([
    personalDefaultPreserved ? '' : 'personal workspace default is missing',
    businessWorkspaceCount > 0 ? '' : 'no business workspace exists for preview',
    visualSeparationComplete ? '' : 'workspace visual/accessibility separation is incomplete',
    optionalAndNonCoercive ? '' : 'business creation is coercive or unavailable',
  ]);

  return {
    activeWorkspace,
    businessWorkspaceCount,
    personalDefaultPreserved,
    visualSeparationComplete,
    optionalAndNonCoercive,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Active workspace', activeWorkspace.label, 'implemented'),
      row(
        'Business workspaces',
        String(businessWorkspaceCount),
        stateFor(businessWorkspaceCount > 0),
      ),
      row(
        'Persistent label',
        boolText(input.persistentTextLabelVisible),
        stateFor(input.persistentTextLabelVisible),
      ),
      row(
        'Distinct navigation',
        boolText(input.distinctNavigationLabels),
        stateFor(input.distinctNavigationLabels),
      ),
      row(
        'No onboarding pressure',
        boolText(!input.businessCreationShownDuringPersonalOnboarding),
        stateFor(!input.businessCreationShownDuringPersonalOnboarding),
      ),
      row(
        'Large text safe',
        boolText(input.largeTextDoesNotTruncateWorkspace),
        stateFor(input.largeTextDoesNotTruncateWorkspace),
      ),
    ],
  };
}

export function evaluateBusinessLedgerScope(input: BusinessLedgerInput): BusinessLedgerState {
  const businessOnlyAccounts = input.accounts.every(
    (account) => account.workspaceId === input.businessWorkspaceId,
  );
  const accountIds = new Set(input.accounts.map((account) => account.accountId));
  const businessOnlyTransactions = input.transactions.every(
    (transaction) =>
      transaction.workspaceId === input.businessWorkspaceId &&
      accountIds.has(transaction.accountId),
  );
  const personalQueryLeakage = input.queryWorkspaceIds.some((workspaceId) =>
    input.personalWorkspaceIds.includes(workspaceId),
  );
  const blockers = compact([
    businessOnlyAccounts ? '' : 'one or more accounts are not business-scoped',
    businessOnlyTransactions ? '' : 'one or more transactions are not business-scoped',
    personalQueryLeakage ? 'business query includes a personal workspace id' : '',
  ]);

  return {
    transactionCount: input.transactions.length,
    accountCount: input.accounts.length,
    businessOnlyAccounts,
    businessOnlyTransactions,
    personalQueryLeakage,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Business accounts', String(input.accounts.length), stateFor(input.accounts.length > 0)),
      row(
        'Business transactions',
        String(input.transactions.length),
        stateFor(input.transactions.length > 0),
      ),
      row(
        'Account scope',
        businessOnlyAccounts ? 'business only' : 'mixed',
        stateFor(businessOnlyAccounts),
      ),
      row(
        'Transaction scope',
        businessOnlyTransactions ? 'business only' : 'mixed',
        stateFor(businessOnlyTransactions),
      ),
      row(
        'Personal query leakage',
        personalQueryLeakage ? 'yes' : 'no',
        stateFor(!personalQueryLeakage),
      ),
    ],
  };
}

export function buildInvoiceLifecycle(input: InvoiceLifecycleInput): InvoiceLifecycleState {
  const clientIds = new Set(
    input.clients
      .filter((client) => client.workspaceId === input.businessWorkspaceId)
      .map((client) => client.clientId),
  );
  const validInvoices = input.invoices.filter(
    (invoice) =>
      invoice.workspaceId === input.businessWorkspaceId && clientIds.has(invoice.clientId),
  );
  const openInvoices = validInvoices.filter((invoice) =>
    ['issued', 'part_paid', 'overdue'].includes(invoice.status),
  );
  const overdueInvoiceIds = validInvoices
    .filter(
      (invoice) =>
        invoice.status !== 'paid' &&
        invoice.status !== 'void' &&
        invoice.status !== 'credited' &&
        invoice.dueDate < input.nowDate,
    )
    .map((invoice) => invoice.invoiceId);
  const expectedCashFlowMinor = openInvoices.reduce(
    (total, invoice) => total + Math.max(0, invoice.totalMinor - invoice.paidMinor),
    0,
  );
  const events = validInvoices.flatMap((invoice) => invoiceEventsFor(invoice, input.nowDate));
  const allInvoiceEventsGenerated =
    input.expectedCashFlowGenerated && events.length >= validInvoices.length;
  const blockers = compact([
    input.clients.length === clientIds.size ? '' : 'one or more clients are outside business scope',
    validInvoices.length === input.invoices.length
      ? ''
      : 'one or more invoices are outside business scope',
    allInvoiceEventsGenerated ? '' : 'invoice events or expected cash flow are not generated',
  ]);

  return {
    clientCount: clientIds.size,
    invoiceCount: validInvoices.length,
    openInvoiceCount: openInvoices.length,
    overdueInvoiceIds,
    expectedCashFlowMinor,
    events,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Clients', String(clientIds.size), stateFor(clientIds.size > 0)),
      row('Invoices', String(validInvoices.length), stateFor(validInvoices.length > 0)),
      row('Open invoices', String(openInvoices.length), 'implemented'),
      row(
        'Overdue invoices',
        String(overdueInvoiceIds.length),
        overdueInvoiceIds.length > 0 ? 'needs_review' : 'implemented',
      ),
      row(
        'Expected cash flow',
        moneyMinor(expectedCashFlowMinor, 'GBP'),
        stateFor(input.expectedCashFlowGenerated),
      ),
      row('Invoice events', String(events.length), stateFor(allInvoiceEventsGenerated)),
    ],
  };
}

export function proposePaymentMatches(input: PaymentMatchingInput): PaymentMatchingState {
  const openInvoices = input.invoices.filter(
    (invoice) =>
      invoice.workspaceId === input.businessWorkspaceId &&
      invoice.status !== 'paid' &&
      invoice.status !== 'void' &&
      invoice.status !== 'credited',
  );
  const candidateTransactions = input.transactions.filter(
    (transaction) =>
      transaction.workspaceId === input.businessWorkspaceId &&
      transaction.status === 'posted' &&
      transaction.amountMinor > 0,
  );
  const proposals: PaymentMatchProposal[] = [];

  for (const transaction of candidateTransactions) {
    const matches = openInvoices.filter(
      (invoice) =>
        invoice.currency === transaction.currency &&
        Math.max(0, invoice.totalMinor - invoice.paidMinor) === transaction.amountMinor,
    );
    for (const invoice of matches) {
      const ambiguous = matches.length > 1;
      proposals.push({
        invoiceId: invoice.invoiceId,
        transactionId: transaction.transactionId,
        confidence: ambiguous ? 'ambiguous' : 'high',
        amountMinor: transaction.amountMinor,
        autoApplyAllowed: !ambiguous && input.ambiguousMatchesRequireReview,
        reason: ambiguous
          ? 'amount matches more than one open invoice'
          : 'posted payment equals outstanding invoice balance',
      });
    }
  }

  const ambiguousCount = proposals.filter((proposal) => proposal.confidence === 'ambiguous').length;
  const autoAppliedCount = proposals.filter((proposal) => proposal.autoApplyAllowed).length;
  const reviewRequiredCount = proposals.length - autoAppliedCount;
  const blockers = compact([
    input.ambiguousMatchesRequireReview ? '' : 'ambiguous payment matches can apply without review',
    input.openBankingLive
      ? 'live Open Banking payment feed is not part of this contract proof'
      : '',
  ]);

  return {
    proposalCount: proposals.length,
    ambiguousCount,
    autoAppliedCount,
    reviewRequiredCount,
    releaseBlocked: blockers.length > 0,
    blockers,
    proposals,
    rows: [
      row('Match proposals', String(proposals.length), stateFor(proposals.length > 0)),
      row(
        'Ambiguous matches',
        String(ambiguousCount),
        ambiguousCount > 0 ? 'needs_review' : 'implemented',
      ),
      row('Auto-applied', String(autoAppliedCount), stateFor(autoAppliedCount >= 0)),
      row(
        'Review required',
        String(reviewRequiredCount),
        reviewRequiredCount > 0 ? 'needs_review' : 'implemented',
      ),
      row(
        'Open Banking dependency',
        input.openBankingLive ? 'live' : 'not required',
        stateFor(!input.openBankingLive),
      ),
    ],
  };
}

export function evaluateReceiptWorkflow(input: ReceiptWorkflowInput): ReceiptWorkflowState {
  const businessDocuments = input.documents.filter(
    (document) => document.workspaceId === input.businessWorkspaceId,
  );
  const retainedEvidenceCount = businessDocuments.filter(
    (document) => document.sourceEvidenceRetained,
  ).length;
  const reviewQueueCount = businessDocuments.filter(
    (document) => document.taxReviewStatus === 'unreviewed' || document.taxReviewStatus === 'ready',
  ).length;
  const workflowComplete =
    input.captureAvailable &&
    input.extractionReviewAvailable &&
    input.documentSubkeyAvailable &&
    businessDocuments.length === input.documents.length &&
    retainedEvidenceCount === businessDocuments.length;
  const blockers = compact([
    input.captureAvailable ? '' : 'business evidence capture is unavailable',
    input.extractionReviewAvailable ? '' : 'business tax extraction review is unavailable',
    input.documentSubkeyAvailable ? '' : 'business document subkey is not available',
    businessDocuments.length === input.documents.length
      ? ''
      : 'one or more documents are outside business scope',
    retainedEvidenceCount === businessDocuments.length
      ? ''
      : 'one or more source documents are not retained by policy',
  ]);

  return {
    documentCount: businessDocuments.length,
    retainedEvidenceCount,
    reviewQueueCount,
    workflowComplete,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Business documents',
        String(businessDocuments.length),
        stateFor(businessDocuments.length > 0),
      ),
      row(
        'Evidence retained',
        String(retainedEvidenceCount),
        stateFor(
          retainedEvidenceCount === businessDocuments.length && businessDocuments.length > 0,
        ),
      ),
      row(
        'Review queue',
        String(reviewQueueCount),
        reviewQueueCount > 0 ? 'needs_review' : 'implemented',
      ),
      row('Capture', boolText(input.captureAvailable), stateFor(input.captureAvailable)),
      row(
        'Document subkey',
        boolText(input.documentSubkeyAvailable),
        stateFor(input.documentSubkeyAvailable),
      ),
    ],
  };
}

export function buildTaxPeriodRecords(input: TaxPeriodInput): TaxPeriodState {
  const inScopeLinks = input.links.filter(
    (link) =>
      link.workspaceId === input.businessWorkspaceId &&
      link.taxPeriodId === input.period.taxPeriodId,
  );
  const everyFigureHasSourceAndPolicy =
    inScopeLinks.length === input.links.length &&
    inScopeLinks.every(
      (link) =>
        link.sourceRecordId.length > 0 &&
        link.sourceEvidenceId !== null &&
        link.policyPackVersion === input.period.policyPackVersion,
    );
  const acceptedAmountMinor = inScopeLinks
    .filter((link) => link.reviewStatus === 'accepted' || link.reviewStatus === 'adjusted')
    .reduce((total, link) => total + link.amountMinor, 0);
  const blockers = compact([
    input.period.workspaceId === input.businessWorkspaceId
      ? ''
      : 'tax period is not business-scoped',
    input.policyPackAvailable ? '' : 'jurisdiction policy pack is unavailable',
    input.officialGuidanceLinksVisible ? '' : 'official guidance links/verified-on date are hidden',
    everyFigureHasSourceAndPolicy
      ? ''
      : 'one or more tax figures lack source evidence or policy version',
  ]);

  return {
    linkCount: inScopeLinks.length,
    acceptedAmountMinor,
    unresolvedCount: input.unresolvedItemIds.length,
    everyFigureHasSourceAndPolicy,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Tax period',
        `${input.period.jurisdiction} ${input.period.taxKind}`,
        stateFor(input.period.workspaceId === input.businessWorkspaceId),
      ),
      row('Policy pack', input.period.policyPackVersion, stateFor(input.policyPackAvailable)),
      row(
        'Accepted amount',
        moneyMinor(acceptedAmountMinor, 'GBP'),
        stateFor(everyFigureHasSourceAndPolicy),
      ),
      row(
        'Unresolved items',
        String(input.unresolvedItemIds.length),
        input.unresolvedItemIds.length > 0 ? 'needs_review' : 'implemented',
      ),
      row(
        'Official guidance',
        input.period.verifiedOn,
        stateFor(input.officialGuidanceLinksVisible),
      ),
    ],
  };
}

export function estimateTaxReserve(input: TaxReserveEstimateInput): TaxReserveEstimateState {
  const estimatedReserveMinor = Math.round(
    (input.acceptedTaxableAmountMinor * input.reserveRateBasisPoints) / 10_000,
  );
  const adviceBoundaryPassed =
    input.assumptionsVisible &&
    input.uncertaintyVisible &&
    !input.finalBillLanguageUsed &&
    input.userOverrideAvailable;
  const blockers = compact([
    input.assumptionsVisible ? '' : 'tax reserve assumptions are hidden',
    input.uncertaintyVisible ? '' : 'tax reserve uncertainty is hidden',
    input.finalBillLanguageUsed ? 'tax reserve uses final-bill language' : '',
    input.userOverrideAvailable ? '' : 'user override for reserve rule is unavailable',
  ]);

  return {
    estimatedReserveMinor,
    adviceBoundaryPassed,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Estimated reserve',
        moneyMinor(estimatedReserveMinor, 'GBP'),
        stateFor(estimatedReserveMinor >= 0),
      ),
      row(
        'Assumptions shown',
        boolText(input.assumptionsVisible),
        stateFor(input.assumptionsVisible),
      ),
      row(
        'Uncertainty shown',
        boolText(input.uncertaintyVisible),
        stateFor(input.uncertaintyVisible),
      ),
      row(
        'Final bill language',
        input.finalBillLanguageUsed ? 'used' : 'not used',
        stateFor(!input.finalBillLanguageUsed),
      ),
      row(
        'User override',
        boolText(input.userOverrideAvailable),
        stateFor(input.userOverrideAvailable),
      ),
    ],
  };
}

export function buildBusinessCalendar(input: BusinessCalendarInput): BusinessCalendarState {
  const businessItems = input.items.filter(
    (item) => item.workspaceId === input.businessWorkspaceId,
  );
  const personalItemLeakage = input.personalItemIdsVisible.length > 0;
  const businessCalendarComplete =
    businessItems.length === input.items.length &&
    input.distinctCalendarLabelVisible &&
    !personalItemLeakage;
  const blockers = compact([
    businessItems.length === input.items.length
      ? ''
      : 'one or more calendar items are not business-scoped',
    input.distinctCalendarLabelVisible ? '' : 'business calendar label is hidden',
    personalItemLeakage ? 'personal calendar items are visible in business calendar' : '',
    input.localNotificationsBlockedUntilNativeProof
      ? ''
      : 'native notification blocker is not carried forward',
  ]);

  return {
    itemCount: businessItems.length,
    personalItemLeakage,
    businessCalendarComplete,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Business calendar items',
        String(businessItems.length),
        stateFor(businessItems.length > 0),
      ),
      row(
        'Personal item leakage',
        personalItemLeakage ? 'yes' : 'no',
        stateFor(!personalItemLeakage),
      ),
      row(
        'Distinct label',
        boolText(input.distinctCalendarLabelVisible),
        stateFor(input.distinctCalendarLabelVisible),
      ),
      row(
        'Native alerts',
        input.localNotificationsBlockedUntilNativeProof
          ? 'blocked until native proof'
          : 'unblocked',
        input.localNotificationsBlockedUntilNativeProof ? 'needs_review' : 'blocked',
      ),
    ],
  };
}

export function buildBusinessBriefing(input: BusinessBriefingInput): BusinessBriefingState {
  const briefingRowCount =
    input.cashFlowRows + input.invoiceRows + input.deadlineRows + input.recordRows;
  const noPersonalContext =
    !input.personalMemoryIncluded &&
    !input.personalContentIncluded &&
    input.meloWorkspaceLabelVisible;
  const blockers = compact([
    briefingRowCount > 0 ? '' : 'business briefing has no rows',
    input.personalMemoryIncluded ? 'personal Melo memory included in business context' : '',
    input.personalContentIncluded ? 'personal content included in business context' : '',
    input.meloWorkspaceLabelVisible ? '' : 'Melo business workspace label is hidden',
  ]);

  return {
    briefingRowCount,
    noPersonalContext,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Cash flow rows', String(input.cashFlowRows), stateFor(input.cashFlowRows > 0)),
      row('Invoice rows', String(input.invoiceRows), stateFor(input.invoiceRows > 0)),
      row('Deadline rows', String(input.deadlineRows), stateFor(input.deadlineRows > 0)),
      row('Record rows', String(input.recordRows), stateFor(input.recordRows > 0)),
      row('Personal context', noPersonalContext ? 'none' : 'present', stateFor(noPersonalContext)),
    ],
  };
}

export function buildBusinessExport(input: BusinessExportInput): BusinessExportState {
  const exportRecords = input.records.filter(
    (record) =>
      record.workspaceId === input.businessWorkspaceId && record.periodId === input.periodId,
  );
  const personalRecordCount = input.records.length - exportRecords.length;
  const labelledAndTraceable =
    input.workspaceLabelVisible &&
    input.periodLabelVisible &&
    input.policyVersionVisible &&
    input.generatedTimestampVisible &&
    input.unresolvedItemsVisible &&
    exportRecords.every(
      (record) => record.sourceEvidenceId !== null && record.policyPackVersion.length > 0,
    );
  const exportReady =
    labelledAndTraceable &&
    personalRecordCount === 0 &&
    !input.directFilingEnabled &&
    !input.subscriptionRequiredForExport;
  const totalMinor = exportRecords.reduce((total, record) => total + record.amountMinor, 0);
  const blockers = compact([
    labelledAndTraceable ? '' : 'export is missing workspace/period/policy/source labelling',
    personalRecordCount === 0 ? '' : 'business export includes personal or wrong-period records',
    input.directFilingEnabled ? 'direct tax filing is enabled before compliance programme' : '',
    input.subscriptionRequiredForExport ? 'portable business export is subscription-gated' : '',
  ]);

  return {
    recordCount: exportRecords.length,
    totalMinor,
    personalRecordCount,
    labelledAndTraceable,
    exportReady,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Export records', String(exportRecords.length), stateFor(exportRecords.length > 0)),
      row('Total', moneyMinor(totalMinor, 'GBP'), stateFor(labelledAndTraceable)),
      row('Personal records', String(personalRecordCount), stateFor(personalRecordCount === 0)),
      row(
        'Policy version',
        boolText(input.policyVersionVisible),
        stateFor(input.policyVersionVisible),
      ),
      row(
        'Direct filing',
        input.directFilingEnabled ? 'enabled' : 'disabled',
        stateFor(!input.directFilingEnabled),
      ),
      row(
        'Subscription gate',
        input.subscriptionRequiredForExport ? 'yes' : 'no',
        stateFor(!input.subscriptionRequiredForExport),
      ),
    ],
  };
}

export function buildMileageState(
  businessWorkspaceId: string,
  entries: readonly MileageEntry[],
): MileageState {
  const businessEntries = entries.filter((entry) => entry.workspaceId === businessWorkspaceId);
  const businessOnly = businessEntries.length === entries.length;
  const manualEntryOnly = businessEntries.every((entry) => entry.manualEntry);
  const exportReady =
    businessOnly &&
    manualEntryOnly &&
    businessEntries.every((entry) => entry.purpose.length > 0 && entry.distanceMilli > 0);
  const blockers = compact([
    businessOnly ? '' : 'one or more mileage records are not business-scoped',
    manualEntryOnly ? '' : 'automatic mileage capture requires separate privacy/native proof',
    exportReady ? '' : 'one or more mileage records lack purpose or distance',
  ]);

  return {
    mileageCount: businessEntries.length,
    businessOnly,
    manualEntryOnly,
    exportReady,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Mileage records', String(businessEntries.length), stateFor(businessEntries.length > 0)),
      row('Business only', boolText(businessOnly), stateFor(businessOnly)),
      row('Manual entry', boolText(manualEntryOnly), stateFor(manualEntryOnly)),
      row('Export ready', boolText(exportReady), stateFor(exportReady)),
    ],
  };
}

export function evaluateTaxLegalReview(input: TaxLegalReviewInput): TaxLegalReviewState {
  const signed =
    input.ukClaimsReviewed &&
    input.recordkeepingReviewed &&
    input.mtdReadinessReviewed &&
    input.legalCounselSigned &&
    input.officialGuidanceVerifiedOn !== null;
  const blockers = compact([
    input.ukClaimsReviewed ? '' : 'UK tax/business claims have not been reviewed',
    input.recordkeepingReviewed ? '' : 'recordkeeping claims have not been reviewed',
    input.mtdReadinessReviewed ? '' : 'MTD readiness has not been reviewed',
    input.legalCounselSigned ? '' : 'tax/legal counsel signoff is missing',
    input.directFilingDisabled ? '' : 'direct tax filing is enabled before compliance signoff',
    input.officialGuidanceVerifiedOn ? '' : 'official guidance verified-on date is missing',
  ]);

  return {
    signed,
    directFilingDisabled: input.directFilingDisabled,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('UK claims review', boolText(input.ukClaimsReviewed), stateFor(input.ukClaimsReviewed)),
      row(
        'Recordkeeping review',
        boolText(input.recordkeepingReviewed),
        stateFor(input.recordkeepingReviewed),
      ),
      row(
        'MTD readiness review',
        boolText(input.mtdReadinessReviewed),
        stateFor(input.mtdReadinessReviewed),
      ),
      row('Legal signoff', boolText(input.legalCounselSigned), stateFor(input.legalCounselSigned)),
      row(
        'Direct filing',
        input.directFilingDisabled ? 'disabled' : 'enabled',
        stateFor(input.directFilingDisabled),
      ),
      row(
        'Guidance verified',
        input.officialGuidanceVerifiedOn ?? 'missing',
        stateFor(input.officialGuidanceVerifiedOn !== null),
      ),
    ],
  };
}

export function runIsolationAttackSuite(
  cases: readonly IsolationAttackCase[],
): IsolationAttackSuiteState {
  const surfaces = new Set(cases.map((attackCase) => attackCase.surface));
  const leakageCount = cases.filter((attackCase) => attackCase.personalLeakDetected).length;
  const requiredSurfaces: readonly IsolationAttackCase['surface'][] = [
    'ids',
    'search',
    'sync',
    'ai',
    'export',
    'calendar',
  ];
  const requiredSurfacesCovered = requiredSurfaces.every((surface) => surfaces.has(surface));
  const passed = cases.length > 0 && leakageCount === 0 && requiredSurfacesCovered;
  const blockers = compact([
    cases.length > 0 ? '' : 'isolation attack suite has no cases',
    leakageCount === 0 ? '' : `${leakageCount} isolation cases detected personal leakage`,
    requiredSurfacesCovered ? '' : 'required isolation surfaces are not all covered',
  ]);

  return {
    caseCount: cases.length,
    surfaceCount: surfaces.size,
    leakageCount,
    passed,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Attack cases', String(cases.length), stateFor(cases.length > 0)),
      row('Surfaces covered', String(surfaces.size), stateFor(requiredSurfacesCovered)),
      row('Leakage detected', String(leakageCount), leakageCount === 0 ? 'passed' : 'blocked'),
      row('Isolation suite', passed ? 'passed' : 'blocked', passed ? 'passed' : 'blocked'),
    ],
    cases,
  };
}

export function evaluateBusinessBetaGate(input: BusinessBetaGateInput): BusinessBetaGateState {
  const blockers = [
    ...input.switcher.blockers,
    ...input.ledger.blockers,
    ...input.invoiceLifecycle.blockers,
    ...input.matching.blockers,
    ...input.receipts.blockers,
    ...input.taxPeriod.blockers,
    ...input.taxReserve.blockers,
    ...input.calendar.blockers,
    ...input.briefing.blockers,
    ...input.exports.blockers,
    ...input.mileage.blockers,
    ...input.taxLegalReview.blockers,
    ...input.isolationSuite.blockers,
    ...compact([
      input.entitlementSeamReady ? '' : 'business entitlement seam is not ready',
      input.personalUsersSeeNoSetupPressure ? '' : 'personal users see business setup pressure',
      input.supportRunbookReady ? '' : 'business support runbook is not ready',
      input.accessibilityReviewPassed
        ? ''
        : 'business workspace accessibility review is not complete',
    ]),
  ];
  const internalContractsReady =
    !input.switcher.releaseBlocked &&
    !input.ledger.releaseBlocked &&
    !input.invoiceLifecycle.releaseBlocked &&
    !input.receipts.releaseBlocked &&
    !input.taxPeriod.releaseBlocked &&
    !input.taxReserve.releaseBlocked &&
    !input.calendar.personalItemLeakage &&
    !input.briefing.releaseBlocked &&
    !input.exports.releaseBlocked &&
    !input.mileage.releaseBlocked &&
    input.isolationSuite.passed &&
    input.personalUsersSeeNoSetupPressure;

  return {
    ready: blockers.length === 0,
    releaseTrack:
      blockers.length === 0
        ? 'business_beta'
        : internalContractsReady
          ? 'beta_blocked'
          : 'internal_contract',
    blockers,
    rows: [
      row(
        'Business beta ready',
        boolText(blockers.length === 0),
        blockers.length === 0 ? 'passed' : 'blocked',
      ),
      row('Internal contracts', boolText(internalContractsReady), stateFor(internalContractsReady)),
      row(
        'Isolation suite',
        input.isolationSuite.passed ? 'passed' : 'blocked',
        input.isolationSuite.passed ? 'passed' : 'blocked',
      ),
      row(
        'Tax/legal signoff',
        boolText(input.taxLegalReview.signed),
        stateFor(input.taxLegalReview.signed),
      ),
      row(
        'Entitlement seam',
        boolText(input.entitlementSeamReady),
        stateFor(input.entitlementSeamReady),
      ),
      row(
        'Personal setup pressure',
        input.personalUsersSeeNoSetupPressure ? 'none' : 'present',
        stateFor(input.personalUsersSeeNoSetupPressure),
      ),
      row(
        'Support runbook',
        boolText(input.supportRunbookReady),
        stateFor(input.supportRunbookReady),
      ),
    ],
  };
}

export function buildPhase13CoverageRows(
  input: Phase13CoverageInput,
): readonly Phase13CoverageRow[] {
  return [
    coverageRow(
      'T169',
      'Business workspace switcher',
      input.switcher.releaseBlocked ? 'blocked' : 'implemented',
      'distinct persistent workspace label, navigation context and optional creation',
      firstBlocker(input.switcher.blockers),
    ),
    coverageRow(
      'T170',
      'Business accounts and transactions',
      input.ledger.releaseBlocked ? 'blocked' : 'implemented',
      'shared engine records are scoped to the business workspace only',
      firstBlocker(input.ledger.blockers),
    ),
    coverageRow(
      'T171',
      'Clients and invoice lifecycle',
      input.invoiceLifecycle.releaseBlocked ? 'blocked' : 'implemented',
      'client records, invoice status, events and expected cash flow are generated',
      firstBlocker(input.invoiceLifecycle.blockers),
    ),
    coverageRow(
      'T172',
      'Payment matching',
      input.matching.releaseBlocked ? 'blocked' : 'implemented',
      'invoice-to-transaction matches are proposed and ambiguous matches require review',
      firstBlocker(input.matching.blockers),
    ),
    coverageRow(
      'T173',
      'Receipt/document workflow',
      input.receipts.releaseBlocked ? 'blocked' : 'implemented',
      'business evidence capture, retention and tax-review queue are modelled',
      firstBlocker(input.receipts.blockers),
    ),
    coverageRow(
      'T174',
      'Tax-period records',
      input.taxPeriod.releaseBlocked ? 'blocked' : 'implemented',
      'jurisdiction, period, policy pack, source evidence and unresolved queue are visible',
      firstBlocker(input.taxPeriod.blockers),
    ),
    coverageRow(
      'T175',
      'Tax reserve estimate',
      input.taxReserve.releaseBlocked ? 'blocked' : 'implemented',
      'reserve estimate shows assumptions, uncertainty and no final-bill language',
      firstBlocker(input.taxReserve.blockers),
    ),
    coverageRow(
      'T176',
      'Business calendar/planner',
      input.calendar.releaseBlocked ? 'blocked' : 'implemented',
      'invoice, tax, client and subscription items are separated from personal calendar',
      firstBlocker(input.calendar.blockers),
    ),
    coverageRow(
      'T177',
      'Business briefing and Melo context',
      input.briefing.releaseBlocked ? 'blocked' : 'implemented',
      'cash flow, invoices, deadlines and records exclude personal memory/content',
      firstBlocker(input.briefing.blockers),
    ),
    coverageRow(
      'T178',
      'Business reports and exports',
      input.exports.releaseBlocked ? 'blocked' : 'implemented',
      'workspace, period, policy version, source evidence and unresolved items are labelled',
      firstBlocker(input.exports.blockers),
    ),
    coverageRow(
      'T179',
      'Mileage records',
      input.mileage.releaseBlocked ? 'blocked' : 'implemented',
      'manual business-only trip purpose/distance records are export-ready',
      firstBlocker(input.mileage.blockers),
    ),
    coverageRow(
      'T180',
      'Tax/legal review',
      input.taxLegalReview.releaseBlocked ? 'blocked' : 'passed',
      'UK claims, recordkeeping, MTD readiness and direct-filing boundary require signoff',
      firstBlocker(input.taxLegalReview.blockers),
    ),
    coverageRow(
      'T181',
      'Workspace isolation attack suite',
      input.isolationSuite.passed ? 'passed' : 'blocked',
      'ids, search, sync, AI, export and calendar surfaces prove zero personal leakage',
      firstBlocker(input.isolationSuite.blockers),
    ),
    coverageRow(
      'T182',
      'Business beta gate',
      input.betaGate.ready ? 'passed' : 'blocked',
      'beta waits for tax/legal, entitlement, support and accessibility gates',
      firstBlocker(input.betaGate.blockers),
    ),
  ];
}

export function businessRowsByState<Row extends EvidenceRow | Phase13CoverageRow>(
  rows: readonly Row[],
  state: Row['state'],
): readonly Row[] {
  return rows.filter((row) => row.state === state);
}

function invoiceEventsFor(invoice: InvoiceRecord, nowDate: string): readonly InvoiceEvent[] {
  const outstandingMinor = Math.max(0, invoice.totalMinor - invoice.paidMinor);
  const base: InvoiceEvent[] = [
    {
      invoiceId: invoice.invoiceId,
      workspaceId: invoice.workspaceId,
      kind: invoice.status === 'draft' ? 'invoice_drafted' : 'invoice_issued',
      dueDate: invoice.dueDate,
      amountMinor: outstandingMinor,
    },
  ];

  if (['issued', 'part_paid', 'overdue'].includes(invoice.status) && outstandingMinor > 0) {
    base.push({
      invoiceId: invoice.invoiceId,
      workspaceId: invoice.workspaceId,
      kind: 'payment_expected',
      dueDate: invoice.dueDate,
      amountMinor: outstandingMinor,
    });
  }

  if (invoice.status === 'part_paid') {
    base.push({
      invoiceId: invoice.invoiceId,
      workspaceId: invoice.workspaceId,
      kind: 'payment_part_paid',
      dueDate: null,
      amountMinor: invoice.paidMinor,
    });
  }

  if (invoice.status === 'paid') {
    base.push({
      invoiceId: invoice.invoiceId,
      workspaceId: invoice.workspaceId,
      kind: 'payment_paid',
      dueDate: null,
      amountMinor: invoice.paidMinor,
    });
  }

  if (
    invoice.status !== 'paid' &&
    invoice.status !== 'void' &&
    invoice.status !== 'credited' &&
    invoice.dueDate < nowDate
  ) {
    base.push({
      invoiceId: invoice.invoiceId,
      workspaceId: invoice.workspaceId,
      kind: 'invoice_overdue',
      dueDate: invoice.dueDate,
      amountMinor: outstandingMinor,
    });
  }

  if (invoice.status === 'void') {
    base.push({
      invoiceId: invoice.invoiceId,
      workspaceId: invoice.workspaceId,
      kind: 'invoice_voided',
      dueDate: null,
      amountMinor: 0,
    });
  }

  if (invoice.status === 'credited') {
    base.push({
      invoiceId: invoice.invoiceId,
      workspaceId: invoice.workspaceId,
      kind: 'invoice_credited',
      dueDate: null,
      amountMinor: outstandingMinor,
    });
  }

  return base;
}

function coverageRow(
  taskId: Phase13TaskId,
  label: string,
  state: BusinessReadinessState,
  evidence: string,
  blocker?: string,
): Phase13CoverageRow {
  if (blocker) {
    return { taskId, label, state, evidence, blocker };
  }

  return { taskId, label, state, evidence };
}

function row(label: string, value: string, state: BusinessReadinessState): EvidenceRow {
  return { label, value, state };
}

function stateFor(condition: boolean): BusinessReadinessState {
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

function moneyMinor(amountMinor: number, currency: string): string {
  const sign = amountMinor < 0 ? '-' : '';
  const absolute = Math.abs(amountMinor);
  const units = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, '0');
  return `${sign}${currency} ${units}.${cents}`;
}
