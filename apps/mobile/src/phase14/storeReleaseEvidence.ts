import {
  buildPhase14CoverageRows,
  evaluateBillingEntitlements,
  evaluateFinalReview,
  evaluateLimitedLaunch,
  evaluateOperationsRunbooks,
  evaluateOutcomeResearch,
  evaluatePhase14ReleaseGate,
  evaluateRegressionSuite,
  evaluateRoadmapProgramGates,
  evaluateStoreDeclarations,
  storeReleaseRowsByState,
  type BillingEntitlementState,
  type EntitlementCapability,
  type EvidenceRow,
  type FinalReviewState,
  type IncidentRunbook,
  type LimitedLaunchState,
  type OperationsRunbookState,
  type OutcomeResearchState,
  type Phase14CoverageRow,
  type Phase14ReleaseGateState,
  type ProductCapabilityMapping,
  type RegressionSuiteState,
  type ReleaseReadinessState,
  type RoadmapProgram,
  type RoadmapProgramGateState,
  type StoreDeclarationState,
} from '@folio/store-release';

export type Phase14Source = Readonly<{
  kind: 'synthetic';
  label: 'Synthetic release sample';
  description: string;
}>;

export type Phase14EvidenceArea =
  | 'store_declarations'
  | 'billing_entitlements'
  | 'operations_runbooks'
  | 'final_review'
  | 'regression_suite'
  | 'limited_launch'
  | 'outcome_research'
  | 'roadmap_guardrails';

export type Phase14GateMetadata = Readonly<{
  phase: 'phase14';
  slice: 'store-billing-operations-release';
  sourceLabel: 'Synthetic release sample';
  realStoreSubmission: false;
  realBillingProvider: false;
  realProductionLaunch: false;
  directHmrcMtdImplemented: false;
  householdCollaborationImplemented: false;
  additionalJurisdictionsImplemented: false;
  existingRecordsPaywalled: false;
  fullExportPaywalled: false;
  localCoreRequiresAccount: false;
  legalSignoffComplete: false;
  penTestComplete: false;
  dpiaApproved: false;
  limitedUkProductionReady: false;
  evidenceAreas: readonly Phase14EvidenceArea[];
}>;

export type Phase14ProofRow = Readonly<{
  label: string;
  value: string;
  state: ReleaseReadinessState;
}>;

export type Phase14BlockerRow = Readonly<{
  label: string;
  value: string;
  source: Phase14Source;
}>;

export type Phase14HuashuReview = Readonly<{
  score: number;
  rows: readonly EvidenceRow[];
  criticalIssuesFixed: readonly string[];
  remainingNotes: readonly string[];
}>;

export type Phase14StoreReleaseEvidence = Readonly<{
  metadata: Phase14GateMetadata;
  source: Phase14Source;
  storeDeclarations: StoreDeclarationState;
  billing: BillingEntitlementState;
  operations: OperationsRunbookState;
  finalReview: FinalReviewState;
  regression: RegressionSuiteState;
  limitedLaunch: LimitedLaunchState;
  outcomeResearch: OutcomeResearchState;
  roadmap: RoadmapProgramGateState;
  releaseGate: Phase14ReleaseGateState;
  coverageRows: readonly Phase14CoverageRow[];
  proofRows: readonly Phase14ProofRow[];
  blockerRows: readonly Phase14BlockerRow[];
  huashuReview: Phase14HuashuReview;
}>;

const syntheticSource: Phase14Source = {
  kind: 'synthetic',
  label: 'Synthetic release sample',
  description:
    'Phase 14 mobile shell evidence uses release-governance fixtures only; it performs no App Store submission, Play submission, StoreKit call, Play Billing call, backend entitlement verification, production launch, HMRC filing, household collaboration or jurisdiction rollout.',
};

const capabilities: readonly EntitlementCapability[] = [
  {
    capabilityId: 'local_core',
    displayName: 'Local core',
    localDataAccessRequired: true,
    exportAccessRequiredAfterExpiry: true,
  },
  {
    capabilityId: 'cloud_backup',
    displayName: 'Cloud backup',
    localDataAccessRequired: false,
    exportAccessRequiredAfterExpiry: false,
  },
  {
    capabilityId: 'multi_device_sync',
    displayName: 'Multi-device sync',
    localDataAccessRequired: false,
    exportAccessRequiredAfterExpiry: false,
  },
  {
    capabilityId: 'cloud_ai_units',
    displayName: 'Cloud AI units',
    localDataAccessRequired: false,
    exportAccessRequiredAfterExpiry: false,
  },
  {
    capabilityId: 'advanced_imports',
    displayName: 'Advanced imports',
    localDataAccessRequired: false,
    exportAccessRequiredAfterExpiry: false,
  },
  {
    capabilityId: 'business_workspace',
    displayName: 'Business workspace',
    localDataAccessRequired: false,
    exportAccessRequiredAfterExpiry: true,
  },
  {
    capabilityId: 'business_exports',
    displayName: 'Business exports',
    localDataAccessRequired: false,
    exportAccessRequiredAfterExpiry: true,
  },
  {
    capabilityId: 'open_banking_connection_count',
    displayName: 'Open Banking connections',
    localDataAccessRequired: false,
    exportAccessRequiredAfterExpiry: false,
  },
  {
    capabilityId: 'full_export',
    displayName: 'Full export',
    localDataAccessRequired: true,
    exportAccessRequiredAfterExpiry: true,
  },
];

const productMappings: readonly ProductCapabilityMapping[] = [
  {
    productId: 'folio.pro.monthly.placeholder',
    store: 'backend',
    capabilityIds: ['cloud_backup', 'multi_device_sync', 'cloud_ai_units'],
    priceLocked: false,
  },
  {
    productId: 'folio.business.monthly.placeholder',
    store: 'backend',
    capabilityIds: ['business_workspace', 'business_exports'],
    priceLocked: false,
  },
];

const runbooks: readonly IncidentRunbook[] = [
  'calculation',
  'sync',
  'provider',
  'ai',
  'tax',
  'security',
  'store_removal',
].map((kind) => ({
  kind,
  owner: `${kind}_owner`,
  severityModelled: true,
  userNoticeTemplateReady: true,
  rollbackOrCorrectionReady: true,
  noSilentHistoryRewrite: true,
})) as readonly IncidentRunbook[];

const roadmapPrograms: readonly RoadmapProgram[] = [
  'household_collaboration',
  'direct_hmrc_mtd',
  'additional_jurisdictions',
  'accountant_collaboration',
  'multiple_businesses',
].map((kind) => ({
  kind,
  signedReviewComplete: false,
  threatModelComplete: false,
  privacyModelComplete: false,
  regulatoryCaseComplete: false,
  goNoGoDecision: 'blocked',
  implementationStarted: false,
})) as readonly RoadmapProgram[];

export const defaultPhase14StoreReleaseEvidence = buildPhase14StoreReleaseEvidence();

export const phase14ProofRows: readonly Phase14ProofRow[] =
  defaultPhase14StoreReleaseEvidence.proofRows;

export function buildPhase14StoreReleaseEvidence(): Phase14StoreReleaseEvidence {
  const storeDeclarations = evaluateStoreDeclarations({
    localCoreWorksWithoutLogin: true,
    syntheticDemoVaultAvailable: true,
    privacyPolicyCurrent: false,
    processorListCurrent: false,
    appleAppPrivacyAnswersMatchCode: false,
    applePrivacyManifestComplete: false,
    googleDataSafetyComplete: false,
    googleFinancialFeaturesComplete: false,
    accountDeletionInAppTested: false,
    googleWebDeletionRouteTested: false,
    accessibilityCriticalPathsPassed: false,
    submittedFeaturesCompleteAndReviewable: false,
    businessModeDeclarationMatchesBinary: false,
    openBankingEvidenceAvailableToReviewers: false,
    legalReviewCoversAdvicePrivacyBankingAndTax: false,
    sdkInventoryReviewComplete: false,
  });
  const billing = evaluateBillingEntitlements({
    capabilities,
    productMappings,
    storeKit2NativeProof: false,
    playBillingNativeProof: false,
    backendReceiptVerificationReady: false,
    restorePurchasesTested: false,
    offlineGraceDays: 14,
    subscriptionOutagePreservesLocalCore: true,
    downgradePreservesRecords: true,
    businessRecordsExportableAfterExpiry: true,
    aiQuotaVisibleBeforeUse: true,
    noSurpriseDocumentCharges: true,
  });
  const operations = evaluateOperationsRunbooks({
    runbooks,
    tabletopExerciseComplete: false,
    secureSupportDiagnosticsReady: true,
    supportCannotRequestRecoverySecret: true,
    breachNotificationOwnerAssigned: true,
    rotationDrillsComplete: false,
    vulnerabilityDisclosureChannelReady: false,
  });
  const finalReview = evaluateFinalReview({
    penetrationTestComplete: false,
    highCriticalFindingsOpen: 1,
    dpiaApproved: false,
    processorInventoryApproved: false,
    legalSignoffComplete: false,
    privacyReviewComplete: false,
    securityReviewComplete: false,
    accessibilityReviewComplete: false,
    storePolicyReviewedOn: null,
  });
  const regression = evaluateRegressionSuite({
    moduleNamesCovered: [
      'domain',
      'storage',
      'release-readiness',
      'sync',
      'ai-contracts',
      'open-banking',
      'business-workspace',
      'store-release',
    ],
    goldenVectorsPass: true,
    migrationSuitePass: true,
    offlineE2ePass: false,
    accountDeletionE2ePass: false,
    iosReleaseBuildPass: false,
    androidReleaseBuildPass: false,
    storeBuildMetadataComplete: false,
    noTestKeysOrFinancialFixturesInRelease: true,
    allReleaseBlockingCriteriaPass: false,
  });
  const limitedLaunch = evaluateLimitedLaunch({
    track: 'limited_uk',
    productionLaunchEnabled: false,
    stagedCohortsDefined: true,
    rollbackPlanReady: true,
    operationalThresholdsStable: false,
    supportOnCallReady: false,
    incidentMonitoringReady: false,
    limitedUkOnly: true,
    expansionBlockedUntilThresholdsPass: true,
  });
  const outcomeResearch = evaluateOutcomeResearch({
    firstMinuteOutcomeDefined: true,
    confidenceOutcomeDefined: true,
    correctionOutcomeDefined: true,
    avoidanceOutcomeDefined: true,
    planProgressOutcomeDefined: true,
    hiddenProfilingUsed: false,
    dataMinimised: true,
    roadmapFeedbackLoopReady: true,
  });
  const roadmap = evaluateRoadmapProgramGates(roadmapPrograms);
  const releaseGate = evaluatePhase14ReleaseGate({
    storeDeclarations,
    billing,
    operations,
    finalReview,
    regression,
    limitedLaunch,
    outcomeResearch,
    roadmap,
  });
  const coverageRows = buildPhase14CoverageRows({
    storeDeclarations,
    billing,
    operations,
    finalReview,
    regression,
    limitedLaunch,
    outcomeResearch,
    roadmap,
    gate: releaseGate,
  });

  return {
    metadata: {
      phase: 'phase14',
      slice: 'store-billing-operations-release',
      sourceLabel: syntheticSource.label,
      realStoreSubmission: false,
      realBillingProvider: false,
      realProductionLaunch: false,
      directHmrcMtdImplemented: false,
      householdCollaborationImplemented: false,
      additionalJurisdictionsImplemented: false,
      existingRecordsPaywalled: false,
      fullExportPaywalled: false,
      localCoreRequiresAccount: false,
      legalSignoffComplete: false,
      penTestComplete: false,
      dpiaApproved: false,
      limitedUkProductionReady: false,
      evidenceAreas: [
        'store_declarations',
        'billing_entitlements',
        'operations_runbooks',
        'final_review',
        'regression_suite',
        'limited_launch',
        'outcome_research',
        'roadmap_guardrails',
      ],
    },
    source: syntheticSource,
    storeDeclarations,
    billing,
    operations,
    finalReview,
    regression,
    limitedLaunch,
    outcomeResearch,
    roadmap,
    releaseGate,
    coverageRows,
    proofRows: coverageRows.map((coverageRow) => ({
      label: `${coverageRow.taskId} ${coverageRow.label}`,
      value: formatCoverageValue(coverageRow),
      state: coverageRow.state,
    })),
    blockerRows: releaseGate.blockers.slice(0, 14).map((blocker) => ({
      label: 'Release blocker',
      value: blocker,
      source: syntheticSource,
    })),
    huashuReview: {
      score: 8.6,
      rows: [
        {
          label: 'Function',
          value:
            'store, billing, operations and launch states are visible without pretending to launch',
          state: 'implemented',
        },
        {
          label: 'Hierarchy',
          value:
            'local core/no-account and export safety appear before billing and production claims',
          state: 'implemented',
        },
        {
          label: 'Craft',
          value:
            'plain operational rows avoid celebratory launch theatre and fake store approval badges',
          state: 'implemented',
        },
        {
          label: 'Anti slop',
          value:
            'no fake Apple/Google marks, fake pricing cards, confetti launch states or compliance seals',
          state: 'implemented',
        },
        {
          label: 'Remaining review',
          value:
            'store declarations, native billing, legal, DPIA, pen test, accessibility and launch ops remain blocked',
          state: 'blocked',
        },
      ],
      criticalIssuesFixed: [
        'Kept local core and full export available outside billing capability checks.',
        'Marked production launch disabled even with a synthetic limited-UK track visible.',
        'Kept T190-T192 as evaluation-only roadmap programmes with no implementation start.',
        'Made unresolved store, legal, security and accessibility evidence visible before release claims.',
      ],
      remainingNotes: [
        'Use real StoreKit 2, Play Billing and backend receipt proof before enabling entitlement claims.',
        'Store declarations must be rechecked against the submitted binary and SDK inventory.',
        'Final launch remains blocked until legal, DPIA, pen-test, accessibility and operations gates pass.',
      ],
    },
  };
}

export function phase14RowsByState<Row extends EvidenceRow | Phase14CoverageRow>(
  rows: readonly Row[],
  state: Row['state'],
): readonly Row[] {
  return storeReleaseRowsByState(rows, state);
}

function formatCoverageValue(row: Phase14CoverageRow): string {
  return row.blocker ? `${row.evidence}; blocker: ${row.blocker}` : row.evidence;
}
