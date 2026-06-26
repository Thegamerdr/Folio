import {
  buildBusinessBriefing,
  buildBusinessCalendar,
  buildBusinessExport,
  buildInvoiceLifecycle,
  buildMileageState,
  buildPhase13CoverageRows,
  buildTaxPeriodRecords,
  businessRowsByState,
  estimateTaxReserve,
  evaluateBusinessBetaGate,
  evaluateBusinessLedgerScope,
  evaluateReceiptWorkflow,
  evaluateTaxLegalReview,
  evaluateWorkspaceSwitcher,
  proposePaymentMatches,
  runIsolationAttackSuite,
  type BusinessAccount,
  type BusinessBetaGateState,
  type BusinessBriefingState,
  type BusinessCalendarState,
  type BusinessExportState,
  type BusinessLedgerState,
  type BusinessReadinessState,
  type BusinessTransaction,
  type ClientRecord,
  type EvidenceRow,
  type InvoiceLifecycleState,
  type InvoiceRecord,
  type IsolationAttackCase,
  type IsolationAttackSuiteState,
  type MileageEntry,
  type MileageState,
  type PaymentMatchingState,
  type Phase13CoverageRow,
  type ReceiptDocument,
  type ReceiptWorkflowState,
  type TaxLegalReviewState,
  type TaxPeriodRecord,
  type TaxPeriodState,
  type TaxRecordLink,
  type TaxReserveEstimateState,
  type WorkspaceSummary,
  type WorkspaceSwitcherState,
} from '@folio/business-workspace';

export type Phase13Source = Readonly<{
  kind: 'synthetic';
  label: 'Synthetic sample';
  description: string;
}>;

export type Phase13EvidenceArea =
  | 'workspace_switcher'
  | 'business_ledger'
  | 'clients_invoices'
  | 'payment_matching'
  | 'receipts_documents'
  | 'tax_periods'
  | 'tax_reserve'
  | 'business_calendar'
  | 'business_melo'
  | 'business_exports'
  | 'mileage'
  | 'tax_legal_review'
  | 'isolation_suite'
  | 'business_beta_gate';

export type Phase13GateMetadata = Readonly<{
  phase: 'phase13';
  slice: 'business-workspace';
  sourceLabel: 'Synthetic sample';
  realBusinessData: false;
  realTaxAdvice: false;
  directTaxFilingEnabled: false;
  personalWorkspaceDefault: true;
  businessCreationShownDuringPersonalOnboarding: false;
  personalDataInBusinessExport: false;
  personalMeloMemoryIncluded: false;
  isolationSuitePassed: true;
  legalTaxSignoffComplete: false;
  entitlementSeamReady: false;
  businessBetaReady: false;
  evidenceAreas: readonly Phase13EvidenceArea[];
}>;

export type Phase13ProofRow = Readonly<{
  label: string;
  value: string;
  state: BusinessReadinessState;
}>;

export type Phase13BlockerRow = Readonly<{
  label: string;
  value: string;
  source: Phase13Source;
}>;

export type Phase13HuashuReview = Readonly<{
  score: number;
  rows: readonly EvidenceRow[];
  criticalIssuesFixed: readonly string[];
  remainingNotes: readonly string[];
}>;

export type Phase13BusinessWorkspaceEvidence = Readonly<{
  metadata: Phase13GateMetadata;
  source: Phase13Source;
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
  coverageRows: readonly Phase13CoverageRow[];
  proofRows: readonly Phase13ProofRow[];
  blockerRows: readonly Phase13BlockerRow[];
  huashuReview: Phase13HuashuReview;
}>;

const syntheticSource: Phase13Source = {
  kind: 'synthetic',
  label: 'Synthetic sample',
  description:
    'Phase 13 mobile shell evidence uses fictional business workspace, invoice, tax and export records only; it performs no account creation, tax filing, provider call, real client storage, native document capture, payment matching write, billing entitlement check or beta release operation.',
};

const personalWorkspaceId = 'workspace_personal_demo';
const businessWorkspaceId = 'workspace_business_studio';

const workspaces: readonly WorkspaceSummary[] = [
  {
    workspaceId: personalWorkspaceId,
    kind: 'personal',
    label: 'Personal',
    iconLabel: 'home',
    legalName: null,
    tradingName: null,
    encryptedSubkeyId: 'subkey_personal_demo',
    created: true,
  },
  {
    workspaceId: businessWorkspaceId,
    kind: 'business',
    label: 'Northstar Studio',
    iconLabel: 'briefcase',
    legalName: 'Northstar Studio Ltd',
    tradingName: 'Northstar Studio',
    encryptedSubkeyId: 'subkey_business_studio',
    created: true,
  },
];

const accounts: readonly BusinessAccount[] = [
  {
    accountId: 'business_current',
    workspaceId: businessWorkspaceId,
    label: 'Business current',
    currency: 'GBP',
  },
];

const transactions: readonly BusinessTransaction[] = [
  {
    transactionId: 'txn_payment_1',
    workspaceId: businessWorkspaceId,
    accountId: 'business_current',
    occurredAt: '2026-06-19',
    amountMinor: 120000,
    currency: 'GBP',
    description: 'Acme Ltd payment',
    status: 'posted',
    reviewStatus: 'accepted',
    taxCategoryId: 'tax_income_services',
    sourceEvidenceId: 'doc_invoice_1',
  },
  {
    transactionId: 'txn_payment_2',
    workspaceId: businessWorkspaceId,
    accountId: 'business_current',
    occurredAt: '2026-06-20',
    amountMinor: 75000,
    currency: 'GBP',
    description: 'Possible duplicate amount',
    status: 'posted',
    reviewStatus: 'needs_review',
    taxCategoryId: null,
    sourceEvidenceId: null,
  },
  {
    transactionId: 'txn_expense_1',
    workspaceId: businessWorkspaceId,
    accountId: 'business_current',
    occurredAt: '2026-06-20',
    amountMinor: -12000,
    currency: 'GBP',
    description: 'Software subscription',
    status: 'posted',
    reviewStatus: 'accepted',
    taxCategoryId: 'tax_software',
    sourceEvidenceId: 'doc_receipt_1',
  },
];

const clients: readonly ClientRecord[] = [
  {
    clientId: 'client_acme',
    workspaceId: businessWorkspaceId,
    displayName: 'Acme Ltd',
    emailEncrypted: true,
    addressEncrypted: true,
  },
];

const invoices: readonly InvoiceRecord[] = [
  {
    invoiceId: 'invoice_1',
    workspaceId: businessWorkspaceId,
    clientId: 'client_acme',
    invoiceNumber: 'NS-001',
    status: 'issued',
    issueDate: '2026-06-01',
    dueDate: '2026-06-30',
    currency: 'GBP',
    totalMinor: 120000,
    paidMinor: 0,
    linkedDocumentId: 'doc_invoice_1',
  },
  {
    invoiceId: 'invoice_2',
    workspaceId: businessWorkspaceId,
    clientId: 'client_acme',
    invoiceNumber: 'NS-002',
    status: 'part_paid',
    issueDate: '2026-05-01',
    dueDate: '2026-06-15',
    currency: 'GBP',
    totalMinor: 100000,
    paidMinor: 25000,
    linkedDocumentId: 'doc_invoice_2',
  },
  {
    invoiceId: 'invoice_3',
    workspaceId: businessWorkspaceId,
    clientId: 'client_acme',
    invoiceNumber: 'NS-003',
    status: 'issued',
    issueDate: '2026-06-10',
    dueDate: '2026-07-10',
    currency: 'GBP',
    totalMinor: 75000,
    paidMinor: 0,
    linkedDocumentId: 'doc_invoice_3',
  },
  {
    invoiceId: 'invoice_4',
    workspaceId: businessWorkspaceId,
    clientId: 'client_acme',
    invoiceNumber: 'NS-004',
    status: 'issued',
    issueDate: '2026-06-11',
    dueDate: '2026-07-11',
    currency: 'GBP',
    totalMinor: 75000,
    paidMinor: 0,
    linkedDocumentId: 'doc_invoice_4',
  },
];

const documents: readonly ReceiptDocument[] = [
  {
    documentId: 'doc_receipt_1',
    workspaceId: businessWorkspaceId,
    linkedTransactionId: 'txn_expense_1',
    sourceEvidenceRetained: true,
    retentionPolicy: 'retain_until_export',
    taxReviewStatus: 'ready',
  },
  {
    documentId: 'doc_invoice_1',
    workspaceId: businessWorkspaceId,
    linkedTransactionId: 'txn_payment_1',
    sourceEvidenceRetained: true,
    retentionPolicy: 'retain_original',
    taxReviewStatus: 'accepted',
  },
];

const taxPeriodRecord: TaxPeriodRecord = {
  taxPeriodId: 'tax_2026_q2',
  workspaceId: businessWorkspaceId,
  jurisdiction: 'UK',
  taxKind: 'self_assessment',
  startDate: '2026-04-06',
  endDate: '2027-04-05',
  status: 'review',
  policyPackVersion: 'uk-sa-2026.v1',
  verifiedOn: '2026-06-21',
};

const taxLinks: readonly TaxRecordLink[] = [
  {
    linkId: 'tax_link_income',
    workspaceId: businessWorkspaceId,
    taxPeriodId: 'tax_2026_q2',
    taxCategoryId: 'tax_income_services',
    sourceRecordId: 'txn_payment_1',
    sourceEvidenceId: 'doc_invoice_1',
    amountMinor: 120000,
    reviewStatus: 'accepted',
    policyPackVersion: 'uk-sa-2026.v1',
  },
  {
    linkId: 'tax_link_software',
    workspaceId: businessWorkspaceId,
    taxPeriodId: 'tax_2026_q2',
    taxCategoryId: 'tax_software',
    sourceRecordId: 'txn_expense_1',
    sourceEvidenceId: 'doc_receipt_1',
    amountMinor: -12000,
    reviewStatus: 'accepted',
    policyPackVersion: 'uk-sa-2026.v1',
  },
];

const mileageEntries: readonly MileageEntry[] = [
  {
    mileageId: 'mile_1',
    workspaceId: businessWorkspaceId,
    tripDate: '2026-06-14',
    purpose: 'Client meeting',
    distanceMilli: 12500,
    distanceUnit: 'mile',
    manualEntry: true,
  },
];

const isolationCases: readonly IsolationAttackCase[] = [
  {
    caseId: 'ids_no_personal_workspace',
    surface: 'ids',
    description: 'Business repository rejects personal workspace IDs',
    personalLeakDetected: false,
    businessWorkspaceId,
    personalWorkspaceId,
  },
  {
    caseId: 'search_business_scope',
    surface: 'search',
    description: 'Business search cannot return personal documents',
    personalLeakDetected: false,
    businessWorkspaceId,
    personalWorkspaceId,
  },
  {
    caseId: 'sync_business_envelope',
    surface: 'sync',
    description: 'Business sync envelope cannot include personal workspace payload',
    personalLeakDetected: false,
    businessWorkspaceId,
    personalWorkspaceId,
  },
  {
    caseId: 'ai_business_context',
    surface: 'ai',
    description: 'Business Melo context excludes personal memory',
    personalLeakDetected: false,
    businessWorkspaceId,
    personalWorkspaceId,
  },
  {
    caseId: 'export_tax_scope',
    surface: 'export',
    description: 'Tax export contains business period records only',
    personalLeakDetected: false,
    businessWorkspaceId,
    personalWorkspaceId,
  },
  {
    caseId: 'calendar_business_deadlines',
    surface: 'calendar',
    description: 'Business calendar excludes personal events',
    personalLeakDetected: false,
    businessWorkspaceId,
    personalWorkspaceId,
  },
];

export const defaultPhase13BusinessWorkspaceEvidence = buildPhase13BusinessWorkspaceEvidence();

export const phase13ProofRows: readonly Phase13ProofRow[] =
  defaultPhase13BusinessWorkspaceEvidence.proofRows;

export function buildPhase13BusinessWorkspaceEvidence(): Phase13BusinessWorkspaceEvidence {
  const switcher = evaluateWorkspaceSwitcher({
    workspaces,
    activeWorkspaceId: businessWorkspaceId,
    persistentTextLabelVisible: true,
    iconOrSymbolVisible: true,
    distinctNavigationLabels: true,
    screenReaderLabelIncludesWorkspace: true,
    largeTextDoesNotTruncateWorkspace: true,
    businessCreationShownDuringPersonalOnboarding: false,
    optionalCreationAvailable: true,
  });
  const ledger = evaluateBusinessLedgerScope({
    businessWorkspaceId,
    personalWorkspaceIds: [personalWorkspaceId],
    accounts,
    transactions,
    queryWorkspaceIds: [businessWorkspaceId],
  });
  const invoiceLifecycle = buildInvoiceLifecycle({
    businessWorkspaceId,
    clients,
    invoices,
    nowDate: '2026-06-21',
    expectedCashFlowGenerated: true,
  });
  const matching = proposePaymentMatches({
    businessWorkspaceId,
    invoices,
    transactions,
    ambiguousMatchesRequireReview: true,
    openBankingLive: false,
  });
  const receipts = evaluateReceiptWorkflow({
    businessWorkspaceId,
    documents,
    captureAvailable: true,
    extractionReviewAvailable: true,
    documentSubkeyAvailable: true,
  });
  const taxPeriod = buildTaxPeriodRecords({
    businessWorkspaceId,
    period: taxPeriodRecord,
    links: taxLinks,
    unresolvedItemIds: ['txn_payment_2'],
    policyPackAvailable: true,
    officialGuidanceLinksVisible: true,
  });
  const taxReserve = estimateTaxReserve({
    businessWorkspaceId,
    acceptedTaxableAmountMinor: taxPeriod.acceptedAmountMinor,
    reserveRateBasisPoints: 2000,
    assumptionsVisible: true,
    uncertaintyVisible: true,
    finalBillLanguageUsed: false,
    userOverrideAvailable: true,
  });
  const calendar = buildBusinessCalendar({
    businessWorkspaceId,
    items: [
      {
        itemId: 'cal_invoice_due',
        workspaceId: businessWorkspaceId,
        kind: 'invoice_due',
        title: 'Invoice NS-001 due',
        dueDate: '2026-06-30',
        sourceEntityId: 'invoice_1',
      },
      {
        itemId: 'cal_tax_review',
        workspaceId: businessWorkspaceId,
        kind: 'tax_deadline',
        title: 'Review tax period',
        dueDate: '2026-07-05',
        sourceEntityId: 'tax_2026_q2',
      },
      {
        itemId: 'cal_subscription',
        workspaceId: businessWorkspaceId,
        kind: 'subscription',
        title: 'Software renewal',
        dueDate: '2026-07-01',
        sourceEntityId: 'txn_expense_1',
      },
    ],
    personalItemIdsVisible: [],
    distinctCalendarLabelVisible: true,
    localNotificationsBlockedUntilNativeProof: true,
  });
  const briefing = buildBusinessBriefing({
    businessWorkspaceId,
    cashFlowRows: 2,
    invoiceRows: 2,
    deadlineRows: 2,
    recordRows: 2,
    personalMemoryIncluded: false,
    personalContentIncluded: false,
    meloWorkspaceLabelVisible: true,
  });
  const exports = buildBusinessExport({
    businessWorkspaceId,
    periodId: 'tax_2026_q2',
    records: taxLinks.map((link) => ({
      recordId: link.linkId,
      workspaceId: link.workspaceId,
      periodId: link.taxPeriodId,
      amountMinor: link.amountMinor,
      sourceEvidenceId: link.sourceEvidenceId,
      policyPackVersion: link.policyPackVersion,
    })),
    workspaceLabelVisible: true,
    periodLabelVisible: true,
    policyVersionVisible: true,
    generatedTimestampVisible: true,
    unresolvedItemsVisible: true,
    directFilingEnabled: false,
    subscriptionRequiredForExport: false,
  });
  const mileage = buildMileageState(businessWorkspaceId, mileageEntries);
  const taxLegalReview = evaluateTaxLegalReview({
    ukClaimsReviewed: false,
    recordkeepingReviewed: false,
    mtdReadinessReviewed: false,
    legalCounselSigned: false,
    directFilingDisabled: true,
    officialGuidanceVerifiedOn: null,
  });
  const isolationSuite = runIsolationAttackSuite(isolationCases);
  const betaGate = evaluateBusinessBetaGate({
    switcher,
    ledger,
    invoiceLifecycle,
    matching,
    receipts,
    taxPeriod,
    taxReserve,
    calendar,
    briefing,
    exports,
    mileage,
    taxLegalReview,
    isolationSuite,
    entitlementSeamReady: false,
    personalUsersSeeNoSetupPressure: true,
    supportRunbookReady: false,
    accessibilityReviewPassed: false,
  });
  const coverageRows = buildPhase13CoverageRows({
    switcher,
    ledger,
    invoiceLifecycle,
    matching,
    receipts,
    taxPeriod,
    taxReserve,
    calendar,
    briefing,
    exports,
    mileage,
    taxLegalReview,
    isolationSuite,
    betaGate,
  });

  return {
    metadata: {
      phase: 'phase13',
      slice: 'business-workspace',
      sourceLabel: syntheticSource.label,
      realBusinessData: false,
      realTaxAdvice: false,
      directTaxFilingEnabled: false,
      personalWorkspaceDefault: true,
      businessCreationShownDuringPersonalOnboarding: false,
      personalDataInBusinessExport: false,
      personalMeloMemoryIncluded: false,
      isolationSuitePassed: true,
      legalTaxSignoffComplete: false,
      entitlementSeamReady: false,
      businessBetaReady: false,
      evidenceAreas: [
        'workspace_switcher',
        'business_ledger',
        'clients_invoices',
        'payment_matching',
        'receipts_documents',
        'tax_periods',
        'tax_reserve',
        'business_calendar',
        'business_melo',
        'business_exports',
        'mileage',
        'tax_legal_review',
        'isolation_suite',
        'business_beta_gate',
      ],
    },
    source: syntheticSource,
    switcher,
    ledger,
    invoiceLifecycle,
    matching,
    receipts,
    taxPeriod,
    taxReserve,
    calendar,
    briefing,
    exports,
    mileage,
    taxLegalReview,
    isolationSuite,
    betaGate,
    coverageRows,
    proofRows: coverageRows.map((coverageRow) => ({
      label: `${coverageRow.taskId} ${coverageRow.label}`,
      value: formatCoverageValue(coverageRow),
      state: coverageRow.state,
    })),
    blockerRows: betaGate.blockers.slice(0, 12).map((blocker) => ({
      label: 'Business beta blocker',
      value: blocker,
      source: syntheticSource,
    })),
    huashuReview: {
      score: 8.4,
      rows: [
        {
          label: 'Function',
          value:
            'business is optional; personal workspace remains default and export remains available',
          state: 'implemented',
        },
        {
          label: 'Hierarchy',
          value:
            'workspace identity, leakage proof, tax assumptions and blockers precede beta claims',
          state: 'implemented',
        },
        {
          label: 'Craft',
          value:
            'plain rows avoid fake accountant confidence, revenue hero cards and tax authority theatre',
          state: 'implemented',
        },
        {
          label: 'Anti slop',
          value: 'no fake client logos, no final-tax-bill claim, no MTD filing success badge',
          state: 'implemented',
        },
        {
          label: 'Remaining review',
          value:
            'UK legal/tax review, accessibility audit, entitlement seam and support runbook remain required',
          state: 'blocked',
        },
      ],
      criticalIssuesFixed: [
        'Kept personal workspace as the default; business setup is not shown during personal onboarding.',
        'Placed workspace label and isolation proof above tax/export and beta readiness.',
        'Disabled direct filing and final-bill language while showing tax assumptions and uncertainty.',
        'Kept ambiguous payment matching in review rather than applying silently.',
      ],
      remainingNotes: [
        'Signed UK tax/legal review is required before public claims.',
        'Independent accessibility review must validate the switcher and business review sheets.',
        'Business entitlement and support operations remain blocked before beta.',
      ],
    },
  };
}

export function phase13RowsByState<Row extends EvidenceRow | Phase13CoverageRow>(
  rows: readonly Row[],
  state: Row['state'],
): readonly Row[] {
  return businessRowsByState(rows, state);
}

function formatCoverageValue(row: Phase13CoverageRow): string {
  return row.blocker ? `${row.evidence}; blocker: ${row.blocker}` : row.evidence;
}
