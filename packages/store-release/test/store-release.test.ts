import { describe, expect, it } from 'vitest';

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
  storeReleaseBoundary,
  storeReleaseRowsByState,
  type EntitlementCapability,
  type IncidentRunbook,
  type ProductCapabilityMapping,
  type RoadmapProgram,
} from '../src/index.js';

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

function buildSyntheticPhase14States() {
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
  const gate = evaluatePhase14ReleaseGate({
    storeDeclarations,
    billing,
    operations,
    finalReview,
    regression,
    limitedLaunch,
    outcomeResearch,
    roadmap,
  });

  return {
    storeDeclarations,
    billing,
    operations,
    finalReview,
    regression,
    limitedLaunch,
    outcomeResearch,
    roadmap,
    gate,
  };
}

describe('Phase 14 release operations contracts', () => {
  it('stays pure and cannot submit store, billing or production launch work', () => {
    expect(storeReleaseBoundary).toMatchObject({
      packageName: '@folio/store-release',
      storeSubmissionEnabled: false,
      productionLaunchEnabled: false,
      billingProviderRuntime: 'contract-only',
      importsNativeModules: false,
      networkRequiredForContracts: false,
    });
  });

  it('models store declarations while blocking unmatched public release claims', () => {
    const { storeDeclarations } = buildSyntheticPhase14States();

    expect(storeDeclarations.localCoreNoAccount).toBe(true);
    expect(storeDeclarations.reviewerModeSafe).toBe(false);
    expect(storeDeclarations.declarationsMatchBinary).toBe(false);
    expect(storeDeclarations.blockers).toContain('privacy policy is not current');
    expect(storeDeclarations.blockers).toContain('Google web deletion route is not tested');
  });

  it('keeps entitlements capability-based and protects local records/export on lapse', () => {
    const { billing } = buildSyntheticPhase14States();

    expect(billing.capabilityCount).toBe(9);
    expect(billing.mappedProductCount).toBe(2);
    expect(billing.coreDataNotTierBound).toBe(true);
    expect(billing.exportNeverPaywalled).toBe(true);
    expect(billing.offlineGraceValid).toBe(true);
    expect(billing.releaseBlocked).toBe(true);
    expect(billing.blockers).toEqual(
      expect.arrayContaining([
        'StoreKit 2 native proof is missing',
        'Google Play Billing native proof is missing',
      ]),
    );
  });

  it('requires tabletop, rotation and disclosure operations before release', () => {
    const { operations } = buildSyntheticPhase14States();

    expect(operations.coveredIncidentKinds).toHaveLength(7);
    expect(operations.missingIncidentKinds).toHaveLength(0);
    expect(operations.supportBoundarySafe).toBe(true);
    expect(operations.blockers).toEqual(
      expect.arrayContaining([
        'tabletop exercise is not complete',
        'key/provider/model rotation drills are missing',
      ]),
    );
  });

  it('blocks final review until pen test, DPIA, legal, privacy, security and accessibility signoff', () => {
    const { finalReview } = buildSyntheticPhase14States();

    expect(finalReview.noHighCriticalFindings).toBe(false);
    expect(finalReview.signedForPublicRelease).toBe(false);
    expect(finalReview.blockers).toContain('1 high/critical findings remain open');
    expect(finalReview.blockers).toContain('DPIA is not approved');
  });

  it('separates current regression evidence from missing store release build proof', () => {
    const { regression } = buildSyntheticPhase14States();

    expect(regression.moduleCount).toBe(7);
    expect(regression.coreRegressionClean).toBe(false);
    expect(regression.releaseBuildsComplete).toBe(false);
    expect(regression.blockers).toEqual(
      expect.arrayContaining([
        'offline E2E suite is failing',
        'iOS release build is not proven',
        'Android release build is not proven',
      ]),
    );
  });

  it('keeps limited UK launch disabled until operations thresholds are stable', () => {
    const { limitedLaunch } = buildSyntheticPhase14States();

    expect(limitedLaunch.track).toBe('limited_uk');
    expect(limitedLaunch.productionLaunchEnabled).toBe(false);
    expect(limitedLaunch.stagedAndReversible).toBe(false);
    expect(limitedLaunch.blockers).toContain('production launch is disabled');
    expect(limitedLaunch.blockers).toContain('operational thresholds are not stable');
  });

  it('allows privacy-safe outcome measurement without hidden profiling', () => {
    const { outcomeResearch } = buildSyntheticPhase14States();

    expect(outcomeResearch.outcomeCount).toBe(5);
    expect(outcomeResearch.privacySafe).toBe(true);
    expect(outcomeResearch.releaseBlocked).toBe(false);
  });

  it('blocks household, HMRC and jurisdiction roadmap programmes by default', () => {
    const { roadmap } = buildSyntheticPhase14States();

    expect(roadmap.programCount).toBe(5);
    expect(roadmap.requiredProgramsSeparated).toBe(true);
    expect(roadmap.unauthorisedImplementationCount).toBe(0);
    expect(roadmap.blockedProgramCount).toBe(5);
    expect(roadmap.blockers).toEqual(
      expect.arrayContaining([
        'household collaboration is not approved for implementation',
        'direct hmrc mtd is not approved for implementation',
        'additional jurisdictions is not approved for implementation',
      ]),
    );
  });

  it('builds complete T183-T192 coverage while preventing production launch readiness', () => {
    const states = buildSyntheticPhase14States();
    const coverageRows = buildPhase14CoverageRows(states);

    expect(coverageRows.map((row) => row.taskId)).toEqual([
      'T183',
      'T184',
      'T185',
      'T186',
      'T187',
      'T188',
      'T189',
      'T190',
      'T191',
      'T192',
    ]);
    expect(states.gate.readyForLimitedUkProduction).toBe(false);
    expect(states.gate.releaseBlockingCount).toBe(6);
    expect(storeReleaseRowsByState(coverageRows, 'blocked').map((row) => row.taskId)).toEqual([
      'T183',
      'T184',
      'T185',
      'T186',
      'T187',
      'T188',
      'T190',
      'T191',
      'T192',
    ]);
    expect(storeReleaseRowsByState(coverageRows, 'implemented').map((row) => row.taskId)).toEqual([
      'T189',
    ]);
  });

  it('is deterministic', () => {
    expect(buildSyntheticPhase14States()).toEqual(buildSyntheticPhase14States());
  });
});
