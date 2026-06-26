export const storeReleaseBoundary = {
  packageName: '@folio/store-release',
  storeSubmissionEnabled: false,
  productionLaunchEnabled: false,
  billingProviderRuntime: 'contract-only',
  writesToStoreKit: false,
  writesToPlayBilling: false,
  importsNativeModules: false,
  networkRequiredForContracts: false,
  blocksRoadmapExpansionsByDefault: true,
} as const;

export type ReleaseReadinessState = 'implemented' | 'passed' | 'needs_review' | 'blocked';

export type EvidenceRow = Readonly<{
  label: string;
  value: string;
  state: ReleaseReadinessState;
}>;

export type Phase14TaskId =
  | 'T183'
  | 'T184'
  | 'T185'
  | 'T186'
  | 'T187'
  | 'T188'
  | 'T189'
  | 'T190'
  | 'T191'
  | 'T192';

export type Phase14CoverageRow = Readonly<{
  taskId: Phase14TaskId;
  label: string;
  state: ReleaseReadinessState;
  evidence: string;
  blocker?: string;
}>;

export type StoreDeclarationInput = Readonly<{
  localCoreWorksWithoutLogin: boolean;
  syntheticDemoVaultAvailable: boolean;
  privacyPolicyCurrent: boolean;
  processorListCurrent: boolean;
  appleAppPrivacyAnswersMatchCode: boolean;
  applePrivacyManifestComplete: boolean;
  googleDataSafetyComplete: boolean;
  googleFinancialFeaturesComplete: boolean;
  accountDeletionInAppTested: boolean;
  googleWebDeletionRouteTested: boolean;
  accessibilityCriticalPathsPassed: boolean;
  submittedFeaturesCompleteAndReviewable: boolean;
  businessModeDeclarationMatchesBinary: boolean;
  openBankingEvidenceAvailableToReviewers: boolean;
  legalReviewCoversAdvicePrivacyBankingAndTax: boolean;
  sdkInventoryReviewComplete: boolean;
}>;

export type StoreDeclarationState = Readonly<{
  declarationsMatchBinary: boolean;
  reviewerModeSafe: boolean;
  localCoreNoAccount: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type EntitlementCapabilityId =
  | 'local_core'
  | 'cloud_backup'
  | 'multi_device_sync'
  | 'cloud_ai_units'
  | 'advanced_imports'
  | 'business_workspace'
  | 'business_exports'
  | 'open_banking_connection_count'
  | 'full_export';

export type EntitlementCapability = Readonly<{
  capabilityId: EntitlementCapabilityId;
  displayName: string;
  localDataAccessRequired: boolean;
  exportAccessRequiredAfterExpiry: boolean;
}>;

export type ProductCapabilityMapping = Readonly<{
  productId: string;
  store: 'apple' | 'google' | 'backend';
  capabilityIds: readonly EntitlementCapabilityId[];
  priceLocked: boolean;
}>;

export type BillingEntitlementInput = Readonly<{
  capabilities: readonly EntitlementCapability[];
  productMappings: readonly ProductCapabilityMapping[];
  storeKit2NativeProof: boolean;
  playBillingNativeProof: boolean;
  backendReceiptVerificationReady: boolean;
  restorePurchasesTested: boolean;
  offlineGraceDays: number;
  subscriptionOutagePreservesLocalCore: boolean;
  downgradePreservesRecords: boolean;
  businessRecordsExportableAfterExpiry: boolean;
  aiQuotaVisibleBeforeUse: boolean;
  noSurpriseDocumentCharges: boolean;
}>;

export type BillingEntitlementState = Readonly<{
  capabilityCount: number;
  mappedProductCount: number;
  coreDataNotTierBound: boolean;
  exportNeverPaywalled: boolean;
  offlineGraceValid: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type IncidentKind =
  | 'calculation'
  | 'sync'
  | 'provider'
  | 'ai'
  | 'tax'
  | 'security'
  | 'store_removal';

export type IncidentRunbook = Readonly<{
  kind: IncidentKind;
  owner: string;
  severityModelled: boolean;
  userNoticeTemplateReady: boolean;
  rollbackOrCorrectionReady: boolean;
  noSilentHistoryRewrite: boolean;
}>;

export type OperationsRunbookInput = Readonly<{
  runbooks: readonly IncidentRunbook[];
  tabletopExerciseComplete: boolean;
  secureSupportDiagnosticsReady: boolean;
  supportCannotRequestRecoverySecret: boolean;
  breachNotificationOwnerAssigned: boolean;
  rotationDrillsComplete: boolean;
  vulnerabilityDisclosureChannelReady: boolean;
}>;

export type OperationsRunbookState = Readonly<{
  coveredIncidentKinds: readonly IncidentKind[];
  missingIncidentKinds: readonly IncidentKind[];
  supportBoundarySafe: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type FinalReviewInput = Readonly<{
  penetrationTestComplete: boolean;
  highCriticalFindingsOpen: number;
  dpiaApproved: boolean;
  processorInventoryApproved: boolean;
  legalSignoffComplete: boolean;
  privacyReviewComplete: boolean;
  securityReviewComplete: boolean;
  accessibilityReviewComplete: boolean;
  storePolicyReviewedOn: string | null;
}>;

export type FinalReviewState = Readonly<{
  noHighCriticalFindings: boolean;
  signedForPublicRelease: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type RegressionSuiteInput = Readonly<{
  moduleNamesCovered: readonly string[];
  goldenVectorsPass: boolean;
  migrationSuitePass: boolean;
  offlineE2ePass: boolean;
  accountDeletionE2ePass: boolean;
  iosReleaseBuildPass: boolean;
  androidReleaseBuildPass: boolean;
  storeBuildMetadataComplete: boolean;
  noTestKeysOrFinancialFixturesInRelease: boolean;
  allReleaseBlockingCriteriaPass: boolean;
}>;

export type RegressionSuiteState = Readonly<{
  moduleCount: number;
  coreRegressionClean: boolean;
  releaseBuildsComplete: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type ReleaseTrack =
  | 'internal_security_engine'
  | 'staff_dogfood'
  | 'private_alpha'
  | 'testflight_closed_play'
  | 'limited_uk'
  | 'staged_rollout';

export type LimitedLaunchInput = Readonly<{
  track: ReleaseTrack;
  productionLaunchEnabled: boolean;
  stagedCohortsDefined: boolean;
  rollbackPlanReady: boolean;
  operationalThresholdsStable: boolean;
  supportOnCallReady: boolean;
  incidentMonitoringReady: boolean;
  limitedUkOnly: boolean;
  expansionBlockedUntilThresholdsPass: boolean;
}>;

export type LimitedLaunchState = Readonly<{
  track: ReleaseTrack;
  productionLaunchEnabled: boolean;
  stagedAndReversible: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type OutcomeResearchInput = Readonly<{
  firstMinuteOutcomeDefined: boolean;
  confidenceOutcomeDefined: boolean;
  correctionOutcomeDefined: boolean;
  avoidanceOutcomeDefined: boolean;
  planProgressOutcomeDefined: boolean;
  hiddenProfilingUsed: boolean;
  dataMinimised: boolean;
  roadmapFeedbackLoopReady: boolean;
}>;

export type OutcomeResearchState = Readonly<{
  outcomeCount: number;
  privacySafe: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type RoadmapProgramKind =
  | 'household_collaboration'
  | 'direct_hmrc_mtd'
  | 'additional_jurisdictions'
  | 'accountant_collaboration'
  | 'multiple_businesses';

export type RoadmapProgram = Readonly<{
  kind: RoadmapProgramKind;
  signedReviewComplete: boolean;
  threatModelComplete: boolean;
  privacyModelComplete: boolean;
  regulatoryCaseComplete: boolean;
  goNoGoDecision: 'not_started' | 'blocked' | 'approved';
  implementationStarted: boolean;
}>;

export type RoadmapProgramGateState = Readonly<{
  programCount: number;
  blockedProgramCount: number;
  unauthorisedImplementationCount: number;
  requiredProgramsSeparated: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type Phase14ReleaseGateInput = Readonly<{
  storeDeclarations: StoreDeclarationState;
  billing: BillingEntitlementState;
  operations: OperationsRunbookState;
  finalReview: FinalReviewState;
  regression: RegressionSuiteState;
  limitedLaunch: LimitedLaunchState;
  outcomeResearch: OutcomeResearchState;
  roadmap: RoadmapProgramGateState;
}>;

export type Phase14ReleaseGateState = Readonly<{
  readyForLimitedUkProduction: boolean;
  productionLaunchEnabled: boolean;
  releaseBlockingCount: number;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

const requiredIncidentKinds: readonly IncidentKind[] = [
  'calculation',
  'sync',
  'provider',
  'ai',
  'tax',
  'security',
  'store_removal',
];

const requiredRoadmapKinds: readonly RoadmapProgramKind[] = [
  'household_collaboration',
  'direct_hmrc_mtd',
  'additional_jurisdictions',
  'accountant_collaboration',
  'multiple_businesses',
];

export function evaluateStoreDeclarations(input: StoreDeclarationInput): StoreDeclarationState {
  const blockers: string[] = [];

  if (!input.localCoreWorksWithoutLogin) blockers.push('local personal core requires an account');
  if (!input.syntheticDemoVaultAvailable) blockers.push('synthetic reviewer vault is unavailable');
  if (!input.privacyPolicyCurrent) blockers.push('privacy policy is not current');
  if (!input.processorListCurrent) blockers.push('processor list is not current');
  if (!input.appleAppPrivacyAnswersMatchCode) {
    blockers.push('Apple App Privacy answers do not yet match code');
  }
  if (!input.applePrivacyManifestComplete) blockers.push('Apple privacy manifest is incomplete');
  if (!input.googleDataSafetyComplete) blockers.push('Google Data Safety form is incomplete');
  if (!input.googleFinancialFeaturesComplete) {
    blockers.push('Google Financial Features declaration is incomplete');
  }
  if (!input.accountDeletionInAppTested) blockers.push('in-app account deletion is not tested');
  if (!input.googleWebDeletionRouteTested) blockers.push('Google web deletion route is not tested');
  if (!input.accessibilityCriticalPathsPassed) {
    blockers.push('independent accessibility critical-path review is incomplete');
  }
  if (!input.submittedFeaturesCompleteAndReviewable) {
    blockers.push('submitted store feature set is not complete and reviewable');
  }
  if (!input.businessModeDeclarationMatchesBinary) {
    blockers.push('business mode declaration does not yet match binary scope');
  }
  if (!input.openBankingEvidenceAvailableToReviewers) {
    blockers.push('Open Banking review evidence is not available to store reviewers');
  }
  if (!input.legalReviewCoversAdvicePrivacyBankingAndTax) {
    blockers.push('legal review does not yet cover advice, privacy, banking and tax claims');
  }
  if (!input.sdkInventoryReviewComplete) blockers.push('SDK inventory review is incomplete');

  const declarationsMatchBinary =
    input.privacyPolicyCurrent &&
    input.processorListCurrent &&
    input.appleAppPrivacyAnswersMatchCode &&
    input.applePrivacyManifestComplete &&
    input.googleDataSafetyComplete &&
    input.googleFinancialFeaturesComplete &&
    input.businessModeDeclarationMatchesBinary &&
    input.sdkInventoryReviewComplete;

  const reviewerModeSafe =
    input.syntheticDemoVaultAvailable &&
    input.submittedFeaturesCompleteAndReviewable &&
    input.openBankingEvidenceAvailableToReviewers;

  return {
    declarationsMatchBinary,
    reviewerModeSafe,
    localCoreNoAccount: input.localCoreWorksWithoutLogin,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Local core',
        input.localCoreWorksWithoutLogin ? 'works without login' : 'account required',
        input.localCoreWorksWithoutLogin ? 'passed' : 'blocked',
      ),
      row(
        'Store declarations',
        declarationsMatchBinary ? 'match binary and data flows' : 'still incomplete',
        declarationsMatchBinary ? 'passed' : 'blocked',
      ),
      row(
        'Reviewer mode',
        reviewerModeSafe ? 'synthetic demo is safe for review' : 'review evidence incomplete',
        reviewerModeSafe ? 'passed' : 'blocked',
      ),
      row(
        'Deletion routes',
        input.accountDeletionInAppTested && input.googleWebDeletionRouteTested
          ? 'in-app and web deletion tested'
          : 'deletion routes not yet proven',
        input.accountDeletionInAppTested && input.googleWebDeletionRouteTested
          ? 'passed'
          : 'blocked',
      ),
      row(
        'Legal/store scope',
        input.legalReviewCoversAdvicePrivacyBankingAndTax
          ? 'legal review covers submitted scope'
          : 'legal review still required',
        input.legalReviewCoversAdvicePrivacyBankingAndTax ? 'passed' : 'blocked',
      ),
    ],
  };
}

export function evaluateBillingEntitlements(
  input: BillingEntitlementInput,
): BillingEntitlementState {
  const capabilityIds = new Set(input.capabilities.map((capability) => capability.capabilityId));
  const coreDataNotTierBound =
    capabilityIds.has('local_core') &&
    input.subscriptionOutagePreservesLocalCore &&
    input.downgradePreservesRecords;
  const exportNeverPaywalled =
    capabilityIds.has('full_export') &&
    input.capabilities.some(
      (capability) =>
        capability.capabilityId === 'full_export' && capability.exportAccessRequiredAfterExpiry,
    ) &&
    input.businessRecordsExportableAfterExpiry;
  const offlineGraceValid = input.offlineGraceDays >= 3 && input.offlineGraceDays <= 30;

  const blockers: string[] = [];
  if (!input.storeKit2NativeProof) blockers.push('StoreKit 2 native proof is missing');
  if (!input.playBillingNativeProof) blockers.push('Google Play Billing native proof is missing');
  if (!input.backendReceiptVerificationReady) {
    blockers.push('backend receipt verification is not ready');
  }
  if (!input.restorePurchasesTested) blockers.push('purchase restore is not tested');
  if (!offlineGraceValid) blockers.push('offline entitlement grace period is not in range');
  if (!coreDataNotTierBound) blockers.push('local core or existing records could be tier-bound');
  if (!exportNeverPaywalled) blockers.push('full export is not guaranteed after expiry');
  if (!input.aiQuotaVisibleBeforeUse) blockers.push('AI quota is not visible before use');
  if (!input.noSurpriseDocumentCharges) blockers.push('document charging boundary is unclear');
  if (input.productMappings.some((mapping) => mapping.priceLocked)) {
    blockers.push('product mapping locks price before business model approval');
  }

  return {
    capabilityCount: input.capabilities.length,
    mappedProductCount: input.productMappings.length,
    coreDataNotTierBound,
    exportNeverPaywalled,
    offlineGraceValid,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Capabilities',
        `${input.capabilities.length} capabilities modelled without price-tier coupling`,
        input.capabilities.length > 0 ? 'implemented' : 'blocked',
      ),
      row(
        'Local access',
        coreDataNotTierBound ? 'subscription lapse preserves local core' : 'local access risk',
        coreDataNotTierBound ? 'passed' : 'blocked',
      ),
      row(
        'Export after expiry',
        exportNeverPaywalled ? 'full export remains available' : 'export access not proven',
        exportNeverPaywalled ? 'passed' : 'blocked',
      ),
      row(
        'Native billing',
        input.storeKit2NativeProof && input.playBillingNativeProof
          ? 'StoreKit and Play Billing proven'
          : 'native billing proof missing',
        input.storeKit2NativeProof && input.playBillingNativeProof ? 'passed' : 'blocked',
      ),
      row(
        'Restore and grace',
        input.restorePurchasesTested && offlineGraceValid
          ? `${input.offlineGraceDays} day offline grace with restore`
          : 'restore or grace not proven',
        input.restorePurchasesTested && offlineGraceValid ? 'passed' : 'blocked',
      ),
    ],
  };
}

export function evaluateOperationsRunbooks(input: OperationsRunbookInput): OperationsRunbookState {
  const coveredIncidentKinds = requiredIncidentKinds.filter((kind) =>
    input.runbooks.some((runbook) => runbook.kind === kind),
  );
  const missingIncidentKinds = requiredIncidentKinds.filter(
    (kind) => !coveredIncidentKinds.includes(kind),
  );
  const incompleteRunbooks = input.runbooks.filter(
    (runbook) =>
      !runbook.severityModelled ||
      !runbook.userNoticeTemplateReady ||
      !runbook.rollbackOrCorrectionReady ||
      !runbook.noSilentHistoryRewrite,
  );
  const supportBoundarySafe =
    input.secureSupportDiagnosticsReady && input.supportCannotRequestRecoverySecret;

  const blockers: string[] = [];
  if (missingIncidentKinds.length > 0) {
    blockers.push(`missing incident runbooks: ${missingIncidentKinds.join(', ')}`);
  }
  if (incompleteRunbooks.length > 0) {
    blockers.push(
      `incomplete incident runbooks: ${incompleteRunbooks.map((item) => item.kind).join(', ')}`,
    );
  }
  if (!input.tabletopExerciseComplete) blockers.push('tabletop exercise is not complete');
  if (!supportBoundarySafe) blockers.push('secure support diagnostic boundary is not proven');
  if (!input.breachNotificationOwnerAssigned) {
    blockers.push('breach notification owner is not assigned');
  }
  if (!input.rotationDrillsComplete)
    blockers.push('key/provider/model rotation drills are missing');
  if (!input.vulnerabilityDisclosureChannelReady) {
    blockers.push('vulnerability disclosure channel is not ready');
  }

  return {
    coveredIncidentKinds,
    missingIncidentKinds,
    supportBoundarySafe,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Incident coverage',
        `${coveredIncidentKinds.length}/${requiredIncidentKinds.length} incident kinds covered`,
        missingIncidentKinds.length === 0 ? 'implemented' : 'blocked',
      ),
      row(
        'Tabletop',
        input.tabletopExerciseComplete ? 'exercise complete' : 'exercise still required',
        input.tabletopExerciseComplete ? 'passed' : 'blocked',
      ),
      row(
        'Support boundary',
        supportBoundarySafe
          ? 'diagnostics are redacted and recovery secrets stay private'
          : 'support boundary incomplete',
        supportBoundarySafe ? 'passed' : 'blocked',
      ),
      row(
        'Rotation drills',
        input.rotationDrillsComplete ? 'rotation drills complete' : 'rotation drills missing',
        input.rotationDrillsComplete ? 'passed' : 'blocked',
      ),
    ],
  };
}

export function evaluateFinalReview(input: FinalReviewInput): FinalReviewState {
  const noHighCriticalFindings = input.highCriticalFindingsOpen === 0;
  const signedForPublicRelease =
    input.penetrationTestComplete &&
    noHighCriticalFindings &&
    input.dpiaApproved &&
    input.processorInventoryApproved &&
    input.legalSignoffComplete &&
    input.privacyReviewComplete &&
    input.securityReviewComplete &&
    input.accessibilityReviewComplete &&
    input.storePolicyReviewedOn !== null;

  const blockers: string[] = [];
  if (!input.penetrationTestComplete) blockers.push('final penetration test is incomplete');
  if (!noHighCriticalFindings) {
    blockers.push(`${input.highCriticalFindingsOpen} high/critical findings remain open`);
  }
  if (!input.dpiaApproved) blockers.push('DPIA is not approved');
  if (!input.processorInventoryApproved) blockers.push('processor inventory is not approved');
  if (!input.legalSignoffComplete) blockers.push('legal signoff is incomplete');
  if (!input.privacyReviewComplete) blockers.push('privacy review is incomplete');
  if (!input.securityReviewComplete) blockers.push('security review is incomplete');
  if (!input.accessibilityReviewComplete) blockers.push('accessibility review is incomplete');
  if (input.storePolicyReviewedOn === null) blockers.push('current store policy review is missing');

  return {
    noHighCriticalFindings,
    signedForPublicRelease,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Penetration test',
        input.penetrationTestComplete ? 'complete' : 'not complete',
        input.penetrationTestComplete ? 'passed' : 'blocked',
      ),
      row(
        'Findings',
        noHighCriticalFindings
          ? 'no high or critical findings open'
          : `${input.highCriticalFindingsOpen} high/critical open`,
        noHighCriticalFindings ? 'passed' : 'blocked',
      ),
      row(
        'DPIA and processors',
        input.dpiaApproved && input.processorInventoryApproved
          ? 'approved'
          : 'approval still required',
        input.dpiaApproved && input.processorInventoryApproved ? 'passed' : 'blocked',
      ),
      row(
        'Legal/privacy/security/a11y',
        signedForPublicRelease ? 'signed for public release' : 'signoff incomplete',
        signedForPublicRelease ? 'passed' : 'blocked',
      ),
    ],
  };
}

export function evaluateRegressionSuite(input: RegressionSuiteInput): RegressionSuiteState {
  const coreRegressionClean =
    input.goldenVectorsPass &&
    input.migrationSuitePass &&
    input.offlineE2ePass &&
    input.accountDeletionE2ePass &&
    input.noTestKeysOrFinancialFixturesInRelease;
  const releaseBuildsComplete =
    input.iosReleaseBuildPass && input.androidReleaseBuildPass && input.storeBuildMetadataComplete;

  const blockers: string[] = [];
  if (!input.goldenVectorsPass) blockers.push('golden vectors are failing');
  if (!input.migrationSuitePass) blockers.push('migration suite is failing');
  if (!input.offlineE2ePass) blockers.push('offline E2E suite is failing');
  if (!input.accountDeletionE2ePass) blockers.push('account deletion E2E is missing');
  if (!input.iosReleaseBuildPass) blockers.push('iOS release build is not proven');
  if (!input.androidReleaseBuildPass) blockers.push('Android release build is not proven');
  if (!input.storeBuildMetadataComplete) blockers.push('store build metadata is incomplete');
  if (!input.noTestKeysOrFinancialFixturesInRelease) {
    blockers.push('release may include test keys or financial fixtures');
  }
  if (!input.allReleaseBlockingCriteriaPass) {
    blockers.push('not all release-blocking acceptance criteria pass');
  }

  return {
    moduleCount: input.moduleNamesCovered.length,
    coreRegressionClean,
    releaseBuildsComplete,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Module coverage',
        `${input.moduleNamesCovered.length} modules covered by final regression plan`,
        input.moduleNamesCovered.length > 0 ? 'implemented' : 'blocked',
      ),
      row(
        'Core regression',
        coreRegressionClean
          ? 'golden, migration, offline and deletion suites clean'
          : 'suite gaps remain',
        coreRegressionClean ? 'passed' : 'blocked',
      ),
      row(
        'Store builds',
        releaseBuildsComplete
          ? 'iOS and Android release builds proven'
          : 'release build proof missing',
        releaseBuildsComplete ? 'passed' : 'blocked',
      ),
      row(
        'Release criteria',
        input.allReleaseBlockingCriteriaPass
          ? 'all criteria pass'
          : 'release criteria still blocked',
        input.allReleaseBlockingCriteriaPass ? 'passed' : 'blocked',
      ),
    ],
  };
}

export function evaluateLimitedLaunch(input: LimitedLaunchInput): LimitedLaunchState {
  const stagedAndReversible =
    input.stagedCohortsDefined &&
    input.rollbackPlanReady &&
    input.incidentMonitoringReady &&
    input.expansionBlockedUntilThresholdsPass;

  const blockers: string[] = [];
  if (!input.productionLaunchEnabled) blockers.push('production launch is disabled');
  if (!input.stagedCohortsDefined) blockers.push('staged cohorts are not defined');
  if (!input.rollbackPlanReady) blockers.push('rollback plan is not ready');
  if (!input.operationalThresholdsStable) blockers.push('operational thresholds are not stable');
  if (!input.supportOnCallReady) blockers.push('support on-call is not ready');
  if (!input.incidentMonitoringReady) blockers.push('incident monitoring is not ready');
  if (!input.limitedUkOnly) blockers.push('launch scope is not limited to approved UK cohort');
  if (!input.expansionBlockedUntilThresholdsPass) {
    blockers.push('expansion is not blocked until operational thresholds pass');
  }

  return {
    track: input.track,
    productionLaunchEnabled: input.productionLaunchEnabled,
    stagedAndReversible,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Track', input.track.replaceAll('_', ' '), 'implemented'),
      row(
        'Production flag',
        input.productionLaunchEnabled ? 'enabled' : 'disabled',
        input.productionLaunchEnabled ? 'passed' : 'blocked',
      ),
      row(
        'Rollback',
        stagedAndReversible ? 'staged and reversible' : 'staging or rollback gap',
        stagedAndReversible ? 'passed' : 'blocked',
      ),
      row(
        'Operations',
        input.operationalThresholdsStable && input.supportOnCallReady
          ? 'thresholds stable and support ready'
          : 'operations not ready',
        input.operationalThresholdsStable && input.supportOnCallReady ? 'passed' : 'blocked',
      ),
    ],
  };
}

export function evaluateOutcomeResearch(input: OutcomeResearchInput): OutcomeResearchState {
  const outcomeCount = [
    input.firstMinuteOutcomeDefined,
    input.confidenceOutcomeDefined,
    input.correctionOutcomeDefined,
    input.avoidanceOutcomeDefined,
    input.planProgressOutcomeDefined,
  ].filter(Boolean).length;
  const privacySafe = !input.hiddenProfilingUsed && input.dataMinimised;

  const blockers: string[] = [];
  if (outcomeCount < 5) blockers.push('not every outcome measure is defined');
  if (input.hiddenProfilingUsed) blockers.push('hidden profiling is present');
  if (!input.dataMinimised) blockers.push('research data minimisation is incomplete');
  if (!input.roadmapFeedbackLoopReady) blockers.push('roadmap feedback loop is not ready');

  return {
    outcomeCount,
    privacySafe,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Outcomes',
        `${outcomeCount}/5 outcome families defined`,
        outcomeCount === 5 ? 'implemented' : 'blocked',
      ),
      row(
        'Profiling',
        privacySafe ? 'no hidden profiling and data minimised' : 'privacy risk remains',
        privacySafe ? 'passed' : 'blocked',
      ),
      row(
        'Roadmap loop',
        input.roadmapFeedbackLoopReady ? 'evidence feeds roadmap' : 'feedback loop missing',
        input.roadmapFeedbackLoopReady ? 'implemented' : 'blocked',
      ),
    ],
  };
}

export function evaluateRoadmapProgramGates(
  programs: readonly RoadmapProgram[],
): RoadmapProgramGateState {
  const presentKinds = new Set(programs.map((program) => program.kind));
  const requiredProgramsSeparated = requiredRoadmapKinds.every((kind) => presentKinds.has(kind));
  const programApproved = (program: RoadmapProgram): boolean =>
    program.signedReviewComplete &&
    program.threatModelComplete &&
    program.privacyModelComplete &&
    program.regulatoryCaseComplete &&
    program.goNoGoDecision === 'approved';
  const blockedPrograms = programs.filter((program) => !programApproved(program));
  const unauthorisedImplementationCount = programs.filter(
    (program) => program.implementationStarted && !programApproved(program),
  ).length;

  const blockers: string[] = [];
  if (!requiredProgramsSeparated) blockers.push('not every roadmap expansion has a separate gate');
  for (const program of blockedPrograms) {
    blockers.push(`${program.kind.replaceAll('_', ' ')} is not approved for implementation`);
  }
  if (unauthorisedImplementationCount > 0) {
    blockers.push(`${unauthorisedImplementationCount} roadmap programmes started without approval`);
  }

  return {
    programCount: programs.length,
    blockedProgramCount: blockedPrograms.length,
    unauthorisedImplementationCount,
    requiredProgramsSeparated,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Programme separation',
        requiredProgramsSeparated
          ? `${programs.length} separate programmes tracked`
          : 'programme coverage incomplete',
        requiredProgramsSeparated ? 'implemented' : 'blocked',
      ),
      row(
        'Implementation guard',
        unauthorisedImplementationCount === 0
          ? 'no roadmap implementation has started'
          : 'unauthorised implementation detected',
        unauthorisedImplementationCount === 0 ? 'passed' : 'blocked',
      ),
      row(
        'Approvals',
        `${blockedPrograms.length} programmes still blocked`,
        blockedPrograms.length === 0 ? 'passed' : 'blocked',
      ),
    ],
  };
}

export function evaluatePhase14ReleaseGate(
  input: Phase14ReleaseGateInput,
): Phase14ReleaseGateState {
  const releaseBlockingStates = [
    input.storeDeclarations,
    input.billing,
    input.operations,
    input.finalReview,
    input.regression,
    input.limitedLaunch,
  ];
  const blockers = releaseBlockingStates.flatMap((state) => state.blockers);
  const releaseBlockingCount = releaseBlockingStates.filter((state) => state.releaseBlocked).length;
  const readyForLimitedUkProduction =
    releaseBlockingCount === 0 && input.limitedLaunch.productionLaunchEnabled;

  return {
    readyForLimitedUkProduction,
    productionLaunchEnabled: input.limitedLaunch.productionLaunchEnabled,
    releaseBlockingCount,
    blockers,
    rows: [
      row(
        'Limited UK production',
        readyForLimitedUkProduction ? 'ready' : `${releaseBlockingCount} release gates blocked`,
        readyForLimitedUkProduction ? 'passed' : 'blocked',
      ),
      row(
        'Roadmap expansions',
        `${input.roadmap.blockedProgramCount} separate programmes blocked by default`,
        input.roadmap.blockedProgramCount === 0 ? 'passed' : 'blocked',
      ),
      row(
        'Research loop',
        input.outcomeResearch.releaseBlocked
          ? 'measurement plan incomplete'
          : 'privacy-safe outcomes defined',
        input.outcomeResearch.releaseBlocked ? 'blocked' : 'implemented',
      ),
    ],
  };
}

export function buildPhase14CoverageRows(
  input: Phase14ReleaseGateInput & Readonly<{ gate: Phase14ReleaseGateState }>,
): readonly Phase14CoverageRow[] {
  return [
    coverage(
      'T183',
      'Apple/Google declarations',
      input.storeDeclarations.releaseBlocked ? 'blocked' : 'passed',
      input.storeDeclarations.declarationsMatchBinary
        ? 'Declarations match binary and data flows'
        : 'Declaration matrix exists but is incomplete',
      firstBlocker(input.storeDeclarations.blockers),
    ),
    coverage(
      'T184',
      'Capability entitlements and store billing',
      input.billing.releaseBlocked ? 'blocked' : 'passed',
      `${input.billing.capabilityCount} capabilities and ${input.billing.mappedProductCount} product mappings modelled`,
      firstBlocker(input.billing.blockers),
    ),
    coverage(
      'T185',
      'Incident and support runbooks',
      input.operations.releaseBlocked ? 'blocked' : 'passed',
      `${input.operations.coveredIncidentKinds.length}/${requiredIncidentKinds.length} incident kinds covered`,
      firstBlocker(input.operations.blockers),
    ),
    coverage(
      'T186',
      'Final penetration and privacy review',
      input.finalReview.releaseBlocked ? 'blocked' : 'passed',
      input.finalReview.noHighCriticalFindings
        ? 'No high/critical finding count is modelled as open'
        : 'High/critical findings remain open',
      firstBlocker(input.finalReview.blockers),
    ),
    coverage(
      'T187',
      'Full regression and golden-vector suite',
      input.regression.releaseBlocked ? 'blocked' : 'passed',
      `${input.regression.moduleCount} modules covered by regression plan`,
      firstBlocker(input.regression.blockers),
    ),
    coverage(
      'T188',
      'Limited UK production launch',
      input.limitedLaunch.releaseBlocked ? 'blocked' : 'passed',
      input.limitedLaunch.stagedAndReversible
        ? 'Staged rollback plan exists'
        : 'Launch staging remains incomplete',
      firstBlocker(input.limitedLaunch.blockers),
    ),
    coverage(
      'T189',
      'First-minute and confidence outcomes',
      input.outcomeResearch.releaseBlocked ? 'blocked' : 'implemented',
      `${input.outcomeResearch.outcomeCount}/5 outcome families defined without hidden profiling`,
      firstBlocker(input.outcomeResearch.blockers),
    ),
    coverage(
      'T190',
      'Household collaboration roadmap',
      'blocked',
      'Separate privacy/threat/permissions programme is tracked',
      roadmapBlocker(input.roadmap, 'household_collaboration'),
    ),
    coverage(
      'T191',
      'Direct HMRC MTD roadmap',
      'blocked',
      'Dedicated HMRC conformance and legal programme is tracked',
      roadmapBlocker(input.roadmap, 'direct_hmrc_mtd'),
    ),
    coverage(
      'T192',
      'Additional jurisdictions roadmap',
      'blocked',
      'Country launch checklist and owner are required before implementation',
      roadmapBlocker(input.roadmap, 'additional_jurisdictions'),
    ),
  ];
}

export function storeReleaseRowsByState<Row extends EvidenceRow | Phase14CoverageRow>(
  rows: readonly Row[],
  state: Row['state'],
): readonly Row[] {
  return rows.filter((rowItem) => rowItem.state === state);
}

function row(label: string, value: string, state: ReleaseReadinessState): EvidenceRow {
  return { label, value, state };
}

function coverage(
  taskId: Phase14TaskId,
  label: string,
  state: ReleaseReadinessState,
  evidence: string,
  blocker?: string,
): Phase14CoverageRow {
  return blocker ? { taskId, label, state, evidence, blocker } : { taskId, label, state, evidence };
}

function firstBlocker(blockers: readonly string[]): string | undefined {
  return blockers[0];
}

function roadmapBlocker(
  roadmap: RoadmapProgramGateState,
  kind: RoadmapProgramKind,
): string | undefined {
  return roadmap.blockers.find((blocker) => blocker.startsWith(kind.replaceAll('_', ' ')));
}
