import { describe, expect, it } from 'vitest';

import {
  buildBusinessBriefing,
  buildBusinessCalendar,
  buildBusinessExport,
  buildMileageState,
  buildPhase13CoverageRows,
  buildTaxPeriodRecords,
  businessRowsByState,
  businessWorkspaceBoundary,
  estimateTaxReserve,
  evaluateBusinessBetaGate,
  evaluateBusinessLedgerScope,
  evaluateReceiptWorkflow,
  evaluateTaxLegalReview,
  evaluateWorkspaceSwitcher,
  proposePaymentMatches,
  runIsolationAttackSuite,
  buildInvoiceLifecycle,
  type BusinessAccount,
  type BusinessTransaction,
  type ClientRecord,
  type InvoiceRecord,
  type IsolationAttackCase,
  type ReceiptDocument,
  type TaxPeriodRecord,
  type TaxRecordLink,
  type WorkspaceSummary,
} from '../src/index.js';

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
    encryptedSubkeyId: 'subkey_personal',
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
    amountMinor: 1_20000,
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
    totalMinor: 1_20000,
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
    totalMinor: 1_00000,
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

const taxPeriod: TaxPeriodRecord = {
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
    amountMinor: 1_20000,
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

describe('business workspace pure contracts', () => {
  it('keeps business optional and separated from personal, direct filing and shared memory', () => {
    expect(businessWorkspaceBoundary).toMatchObject({
      packageName: '@folio/business-workspace',
      optional: true,
      personalWorkspaceDefault: true,
      businessIsNotFilterOverPersonal: true,
      directTaxFilingEnabled: false,
      combinedTaxLedgerAllowed: false,
      writesDirectlyToStorage: false,
      sharesMeloMemoryAcrossWorkspaces: false,
    });
  });

  it('builds a non-coercive workspace switcher with persistent business identity', () => {
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

    expect(switcher.activeWorkspace.label).toBe('Northstar Studio');
    expect(switcher.businessWorkspaceCount).toBe(1);
    expect(switcher.personalDefaultPreserved).toBe(true);
    expect(switcher.releaseBlocked).toBe(false);
  });

  it('proves accounts and transactions stay under the business workspace query scope', () => {
    const ledger = evaluateBusinessLedgerScope({
      businessWorkspaceId,
      personalWorkspaceIds: [personalWorkspaceId],
      accounts,
      transactions,
      queryWorkspaceIds: [businessWorkspaceId],
    });

    expect(ledger.businessOnlyAccounts).toBe(true);
    expect(ledger.businessOnlyTransactions).toBe(true);
    expect(ledger.personalQueryLeakage).toBe(false);
    expect(ledger.releaseBlocked).toBe(false);
  });

  it('generates invoice events and expected cash flow from clients and invoices', () => {
    const lifecycle = buildInvoiceLifecycle({
      businessWorkspaceId,
      clients,
      invoices,
      nowDate: '2026-06-21',
      expectedCashFlowGenerated: true,
    });

    expect(lifecycle.invoiceCount).toBe(4);
    expect(lifecycle.openInvoiceCount).toBe(4);
    expect(lifecycle.overdueInvoiceIds).toEqual(['invoice_2']);
    expect(lifecycle.expectedCashFlowMinor).toBe(3_45000);
    expect(lifecycle.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining([
        'invoice_issued',
        'payment_expected',
        'payment_part_paid',
        'invoice_overdue',
      ]),
    );
  });

  it('proposes payment matches and keeps ambiguous invoice matches review-only', () => {
    const matching = proposePaymentMatches({
      businessWorkspaceId,
      invoices,
      transactions,
      ambiguousMatchesRequireReview: true,
      openBankingLive: false,
    });

    expect(matching.proposalCount).toBe(4);
    expect(matching.ambiguousCount).toBe(3);
    expect(matching.autoAppliedCount).toBe(1);
    expect(matching.reviewRequiredCount).toBe(3);
    expect(matching.proposals.filter((proposal) => proposal.confidence === 'ambiguous')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ invoiceId: 'invoice_3', autoApplyAllowed: false }),
        expect.objectContaining({ invoiceId: 'invoice_4', autoApplyAllowed: false }),
      ]),
    );
  });

  it('keeps receipt evidence retained and in a tax review queue', () => {
    const receipts = evaluateReceiptWorkflow({
      businessWorkspaceId,
      documents,
      captureAvailable: true,
      extractionReviewAvailable: true,
      documentSubkeyAvailable: true,
    });

    expect(receipts.workflowComplete).toBe(true);
    expect(receipts.retainedEvidenceCount).toBe(2);
    expect(receipts.reviewQueueCount).toBe(1);
  });

  it('builds tax-period records with policy-pack version and source evidence', () => {
    const taxState = buildTaxPeriodRecords({
      businessWorkspaceId,
      period: taxPeriod,
      links: taxLinks,
      unresolvedItemIds: ['txn_payment_2'],
      policyPackAvailable: true,
      officialGuidanceLinksVisible: true,
    });

    expect(taxState.everyFigureHasSourceAndPolicy).toBe(true);
    expect(taxState.acceptedAmountMinor).toBe(1_08000);
    expect(taxState.unresolvedCount).toBe(1);
    expect(taxState.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Unresolved items', state: 'needs_review' }),
      ]),
    );
  });

  it('estimates a tax reserve without final-bill language', () => {
    const reserve = estimateTaxReserve({
      businessWorkspaceId,
      acceptedTaxableAmountMinor: 1_08000,
      reserveRateBasisPoints: 2000,
      assumptionsVisible: true,
      uncertaintyVisible: true,
      finalBillLanguageUsed: false,
      userOverrideAvailable: true,
    });

    expect(reserve.estimatedReserveMinor).toBe(21600);
    expect(reserve.adviceBoundaryPassed).toBe(true);
    expect(reserve.releaseBlocked).toBe(false);
  });

  it('keeps business calendar and Melo briefing separate from personal content', () => {
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
      ],
      personalItemIdsVisible: [],
      distinctCalendarLabelVisible: true,
      localNotificationsBlockedUntilNativeProof: true,
    });
    const briefing = buildBusinessBriefing({
      businessWorkspaceId,
      cashFlowRows: 2,
      invoiceRows: 2,
      deadlineRows: 1,
      recordRows: 2,
      personalMemoryIncluded: false,
      personalContentIncluded: false,
      meloWorkspaceLabelVisible: true,
    });

    expect(calendar.businessCalendarComplete).toBe(true);
    expect(calendar.releaseBlocked).toBe(false);
    expect(briefing.noPersonalContext).toBe(true);
    expect(briefing.briefingRowCount).toBe(7);
  });

  it('creates traceable exports and mileage without personal data or direct filing', () => {
    const businessExport = buildBusinessExport({
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
    const mileage = buildMileageState(businessWorkspaceId, [
      {
        mileageId: 'mile_1',
        workspaceId: businessWorkspaceId,
        tripDate: '2026-06-14',
        purpose: 'Client meeting',
        distanceMilli: 12500,
        distanceUnit: 'mile',
        manualEntry: true,
      },
    ]);

    expect(businessExport.exportReady).toBe(true);
    expect(businessExport.personalRecordCount).toBe(0);
    expect(mileage.businessOnly).toBe(true);
    expect(mileage.manualEntryOnly).toBe(true);
    expect(mileage.exportReady).toBe(true);
  });

  it('blocks tax/legal review while direct filing remains disabled', () => {
    const review = evaluateTaxLegalReview({
      ukClaimsReviewed: false,
      recordkeepingReviewed: false,
      mtdReadinessReviewed: false,
      legalCounselSigned: false,
      directFilingDisabled: true,
      officialGuidanceVerifiedOn: null,
    });

    expect(review.signed).toBe(false);
    expect(review.directFilingDisabled).toBe(true);
    expect(review.releaseBlocked).toBe(true);
    expect(review.blockers).toEqual(
      expect.arrayContaining([
        'UK tax/business claims have not been reviewed',
        'tax/legal counsel signoff is missing',
      ]),
    );
  });

  it('passes the isolation attack suite only with zero personal leakage across required surfaces', () => {
    const suite = runIsolationAttackSuite(isolationCases);

    expect(suite.caseCount).toBe(6);
    expect(suite.surfaceCount).toBe(6);
    expect(suite.leakageCount).toBe(0);
    expect(suite.passed).toBe(true);
  });

  it('keeps business beta blocked until legal, entitlement, support and accessibility gates close', () => {
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
    const taxState = buildTaxPeriodRecords({
      businessWorkspaceId,
      period: taxPeriod,
      links: taxLinks,
      unresolvedItemIds: ['txn_payment_2'],
      policyPackAvailable: true,
      officialGuidanceLinksVisible: true,
    });
    const taxReserve = estimateTaxReserve({
      businessWorkspaceId,
      acceptedTaxableAmountMinor: taxState.acceptedAmountMinor,
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
      ],
      personalItemIdsVisible: [],
      distinctCalendarLabelVisible: true,
      localNotificationsBlockedUntilNativeProof: true,
    });
    const briefing = buildBusinessBriefing({
      businessWorkspaceId,
      cashFlowRows: 2,
      invoiceRows: 2,
      deadlineRows: 1,
      recordRows: 2,
      personalMemoryIncluded: false,
      personalContentIncluded: false,
      meloWorkspaceLabelVisible: true,
    });
    const businessExport = buildBusinessExport({
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
    const mileage = buildMileageState(businessWorkspaceId, [
      {
        mileageId: 'mile_1',
        workspaceId: businessWorkspaceId,
        tripDate: '2026-06-14',
        purpose: 'Client meeting',
        distanceMilli: 12500,
        distanceUnit: 'mile',
        manualEntry: true,
      },
    ]);
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
      taxPeriod: taxState,
      taxReserve,
      calendar,
      briefing,
      exports: businessExport,
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
      taxPeriod: taxState,
      taxReserve,
      calendar,
      briefing,
      exports: businessExport,
      mileage,
      taxLegalReview,
      isolationSuite,
      betaGate,
    });

    expect(betaGate.ready).toBe(false);
    expect(betaGate.releaseTrack).toBe('beta_blocked');
    expect(coverageRows.map((row) => row.taskId)).toEqual([
      'T169',
      'T170',
      'T171',
      'T172',
      'T173',
      'T174',
      'T175',
      'T176',
      'T177',
      'T178',
      'T179',
      'T180',
      'T181',
      'T182',
    ]);
    expect(businessRowsByState(coverageRows, 'blocked')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'T180' }),
        expect.objectContaining({ taskId: 'T182' }),
      ]),
    );
  });
});
