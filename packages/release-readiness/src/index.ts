export const releaseReadinessBoundary = {
  packageName: '@folio/release-readiness',
  modelRequired: false,
  networkRequired: false,
  writesDirectlyToStorage: false,
  nativeRequiredForContracts: false,
} as const;

export type Phase9TaskId =
  | 'T122'
  | 'T123'
  | 'T124'
  | 'T125'
  | 'T126'
  | 'T127'
  | 'T128'
  | 'T129'
  | 'T130'
  | 'T131'
  | 'T132'
  | 'T133';

export type ReadinessState = 'implemented' | 'blocked' | 'needs_review' | 'passed';

export type Phase9CoverageRow = Readonly<{
  taskId: Phase9TaskId;
  label: string;
  state: ReadinessState;
  evidence: string;
  blocker?: string;
}>;

export type DocumentKind =
  | 'statement'
  | 'receipt'
  | 'invoice'
  | 'payslip'
  | 'bill'
  | 'tax_evidence'
  | 'letter';

export type DocumentRetentionChoice =
  | 'retain_original'
  | 'retain_until_verified'
  | 'delete_original_after_extraction';

export type DocumentLibraryRecord = Readonly<{
  id: string;
  title: string;
  kind: DocumentKind;
  workspaceId: string;
  retention: DocumentRetentionChoice;
  encryptedAtRest: boolean;
  linkedEntityIds: readonly string[];
  extractedTextApproved: boolean;
  searchIndexed: boolean;
  deleteAvailable: boolean;
}>;

export type DocumentLibraryCapabilities = Readonly<{
  nativeEncryptedFileStore: boolean;
  workspaceSubkeys: boolean;
  localSearchIndex: boolean;
  accessibleDeleteControl: boolean;
}>;

export type DocumentLibraryState = Readonly<{
  workspaceId: string;
  documentCount: number;
  encryptedCount: number;
  linkedCount: number;
  retainedOriginalCount: number;
  searchReadyCount: number;
  locallyEncryptedAndAccessible: boolean;
  blockers: readonly string[];
  rows: readonly ReadinessDisplayRow[];
}>;

export type ExtractionField =
  | 'date'
  | 'total'
  | 'currency'
  | 'merchant'
  | 'invoice_number'
  | 'tax_amount'
  | 'account_reference'
  | 'period';

export type ExtractionSourceLocation = Readonly<{
  page: number;
  label: string;
  textSnippet: string;
}>;

export type ExtractionCandidate = Readonly<{
  id: string;
  field: ExtractionField;
  value: string;
  confidence: number;
  source: ExtractionSourceLocation;
  reviewed: boolean;
}>;

export type ExtractionReviewState = Readonly<{
  threshold: number;
  candidateCount: number;
  lowConfidenceCount: number;
  unreviewedCount: number;
  commitAllowed: boolean;
  rows: readonly ExtractionReviewRow[];
}>;

export type ExtractionReviewRow = Readonly<{
  id: string;
  label: string;
  value: string;
  confidenceLabel: string;
  sourceLabel: string;
  state: 'ready' | 'needs_review' | 'blocked';
}>;

export type DataRouteLocation = 'device' | 'optional_cloud' | 'external_processor' | 'disabled';

export type PrivacyDataRoute = Readonly<{
  id: string;
  label: string;
  location: DataRouteLocation;
  permissionLabel: string;
  cloudEnabled: boolean;
  exportAvailable: boolean;
  deleteAvailable: boolean;
  memoryResetAvailable: boolean;
}>;

export type PrivacyDataCentreState = Readonly<{
  routeCount: number;
  cloudRouteCount: number;
  defaultCloudOff: boolean;
  allRoutesControllable: boolean;
  memoryResetAvailable: boolean;
  rows: readonly ReadinessDisplayRow[];
}>;

export type ExportFormat = 'csv' | 'json' | 'pdf_summary' | 'encrypted_backup';

export type ExportSurface = Readonly<{
  id: string;
  format: ExportFormat;
  label: string;
  workspaceScope: 'active_workspace' | 'all_workspaces' | 'business_only';
  humanReadable: boolean;
  includesProvenance: boolean;
  cloudRequired: boolean;
  subscriptionRequired: boolean;
}>;

export type HumanExportPlan = Readonly<{
  portableFormats: readonly ExportFormat[];
  completeAndPortable: boolean;
  noSubscriptionGate: boolean;
  noCloudRequirement: boolean;
  rows: readonly ReadinessDisplayRow[];
}>;

export type ThreatControlStatus = 'implemented' | 'partial' | 'blocked' | 'needs_review';

export type ThreatModelControl = Readonly<{
  id: string;
  asset: string;
  actor: string;
  control: string;
  status: ThreatControlStatus;
  residualRisk: 'low' | 'medium' | 'high' | 'critical';
}>;

export type ThreatModelState = Readonly<{
  controlCount: number;
  highOrCriticalResidualRisks: number;
  reviewedAndSigned: boolean;
  releaseBlocked: boolean;
  rows: readonly ReadinessDisplayRow[];
}>;

export type MasvsArea = 'storage' | 'crypto' | 'auth' | 'network' | 'platform' | 'code' | 'privacy';

export type MasvsCheck = Readonly<{
  id: string;
  area: MasvsArea;
  label: string;
  status: 'passed' | 'blocked' | 'not_applicable';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}>;

export type MasvsVerificationState = Readonly<{
  areaCount: number;
  passedCount: number;
  blockedCount: number;
  highOrCriticalOpen: number;
  releaseBlocked: boolean;
  rows: readonly ReadinessDisplayRow[];
}>;

export type SecurityEvidenceScope =
  | 'local_static_analysis'
  | 'local_unit_test'
  | 'local_command'
  | 'local_document_review'
  | 'native_device_proof'
  | 'provider_console'
  | 'external_review';

export type SecurityEvidenceResult = 'passed' | 'blocked' | 'needs_review';

export type SecurityChecklistStatus =
  | 'passed_local'
  | 'blocked'
  | 'external_required'
  | 'not_applicable';

export type SecurityEvidenceClaim = Readonly<{
  id: string;
  checkId: string;
  scope: SecurityEvidenceScope;
  result: SecurityEvidenceResult;
  artifactPaths: readonly string[];
  summary: string;
  containsSecrets: boolean;
  containsPrivateData: boolean;
  claimsExternalSignoff: boolean;
  externalReviewer?: string;
}>;

export type SecurityChecklistItem = Readonly<{
  id: string;
  area: MasvsArea;
  label: string;
  requirement: string;
  severity: MasvsCheck['severity'];
  status: SecurityChecklistStatus;
  requiresExternalSignoff: boolean;
  blockerId?: string;
  evidenceClaimIds: readonly string[];
}>;

export type SecurityEvidenceGateState = Readonly<{
  checkCount: number;
  localPassedCount: number;
  externalRequiredCount: number;
  blockedCount: number;
  notApplicableCount: number;
  missingEvidenceCount: number;
  leakedEvidenceCount: number;
  fakeExternalSignoffCount: number;
  highOrCriticalOpen: number;
  releaseBlocked: boolean;
  preservedBlockerIds: readonly string[];
  rows: readonly ReadinessDisplayRow[];
}>;

export type ProcessorRoute = Readonly<{
  id: string;
  label: string;
  route: 'local_only' | 'optional_cloud' | 'disabled_pre_beta';
  processor: string;
  dataCategories: readonly string[];
  dpiaRequired: boolean;
  approved: boolean;
}>;

export type DpiaState = Readonly<{
  routeCount: number;
  dpiaRequiredCount: number;
  unapprovedRequiredCount: number;
  publicBetaBlocked: boolean;
  rows: readonly ReadinessDisplayRow[];
}>;

export type AccessibilityJourneyResult = Readonly<{
  id: string;
  label: string;
  voiceOver: boolean;
  talkBack: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  cognitiveReview: boolean;
  criticalIssueOpen: boolean;
}>;

export type AccessibilityAuditState = Readonly<{
  independentlyReviewed: boolean;
  journeyCount: number;
  completeJourneyCount: number;
  criticalIssueCount: number;
  releaseBlocked: boolean;
  rows: readonly ReadinessDisplayRow[];
}>;

export type DiagnosticSignal = Readonly<{
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'blocked';
  detail: string;
  containsFinancialContent: boolean;
}>;

export type LocalDiagnosticState = Readonly<{
  signalCount: number;
  sanitisedExportAllowed: boolean;
  blockedSignals: number;
  rows: readonly ReadinessDisplayRow[];
}>;

export type SyntheticReviewerVault = Readonly<{
  id: string;
  label: string;
  realData: false;
  isolatedFromUserVault: boolean;
  accountRequired: boolean;
  flows: readonly string[];
  warningLabel: string;
}>;

export type ResilienceDrillKind =
  | 'migration_interrupt'
  | 'corrupt_database'
  | 'low_storage'
  | 'kill_during_import'
  | 'restore_export';

export type ResilienceDrill = Readonly<{
  id: string;
  kind: ResilienceDrillKind;
  status: 'passed' | 'blocked' | 'failed';
  automated: boolean;
  silentDataLossObserved: boolean;
  evidence: string;
}>;

export type ResilienceDrillState = Readonly<{
  drillCount: number;
  passedCount: number;
  blockedCount: number;
  silentDataLossObserved: boolean;
  releaseBlocked: boolean;
  rows: readonly ReadinessDisplayRow[];
}>;

export type LocalOnlyPrivateBetaState = Readonly<{
  ready: boolean;
  releaseTrack: 'internal_dogfood' | 'private_alpha' | 'closed_beta';
  blockers: readonly string[];
  rows: readonly ReadinessDisplayRow[];
}>;

export type ReadinessDisplayRow = Readonly<{
  label: string;
  value: string;
  state: ReadinessState;
}>;

export function buildDocumentLibraryState(input: {
  workspaceId: string;
  documents: readonly DocumentLibraryRecord[];
  capabilities: DocumentLibraryCapabilities;
}): DocumentLibraryState {
  assertNonEmpty(input.workspaceId, 'workspaceId');
  const records = input.documents.filter((document) => document.workspaceId === input.workspaceId);
  const encryptedCount = records.filter((document) => document.encryptedAtRest).length;
  const linkedCount = records.filter((document) => document.linkedEntityIds.length > 0).length;
  const retainedOriginalCount = records.filter(
    (document) => document.retention !== 'delete_original_after_extraction',
  ).length;
  const searchReadyCount = records.filter(
    (document) => document.extractedTextApproved && document.searchIndexed,
  ).length;
  const blockers = [
    input.capabilities.nativeEncryptedFileStore ? null : 'native encrypted document store',
    input.capabilities.workspaceSubkeys ? null : 'workspace document subkeys',
    input.capabilities.localSearchIndex ? null : 'local document search index',
    input.capabilities.accessibleDeleteControl ? null : 'accessible delete control',
    encryptedCount === records.length ? null : 'all document blobs encrypted',
    records.every((document) => document.deleteAvailable) ? null : 'delete action on every row',
  ].filter((value): value is string => Boolean(value));

  return {
    workspaceId: input.workspaceId,
    documentCount: records.length,
    encryptedCount,
    linkedCount,
    retainedOriginalCount,
    searchReadyCount,
    locallyEncryptedAndAccessible: blockers.length === 0,
    blockers,
    rows: [
      row('Documents', `${records.length} metadata rows`, 'implemented'),
      row(
        'Encrypted',
        `${encryptedCount}/${records.length}`,
        encryptedCount === records.length ? 'passed' : 'blocked',
      ),
      row(
        'Search',
        `${searchReadyCount} approved extracts indexed`,
        input.capabilities.localSearchIndex ? 'implemented' : 'blocked',
      ),
      row(
        'Delete',
        input.capabilities.accessibleDeleteControl ? 'available per row' : 'blocked',
        input.capabilities.accessibleDeleteControl ? 'implemented' : 'blocked',
      ),
    ],
  };
}

export function buildExtractionReviewState(
  candidates: readonly ExtractionCandidate[],
  threshold = 0.8,
): ExtractionReviewState {
  if (threshold <= 0 || threshold > 1) {
    throw new Error('threshold must be within (0, 1]');
  }

  const rows = candidates.map((candidate) => {
    const state: ExtractionReviewRow['state'] =
      candidate.confidence < threshold ? 'blocked' : candidate.reviewed ? 'ready' : 'needs_review';
    return {
      id: candidate.id,
      label: candidate.field.replaceAll('_', ' '),
      value: candidate.value,
      confidenceLabel: `${Math.round(candidate.confidence * 100)}%`,
      sourceLabel: `p${candidate.source.page}: ${candidate.source.label}`,
      state,
    };
  });

  const lowConfidenceCount = candidates.filter(
    (candidate) => candidate.confidence < threshold,
  ).length;
  const unreviewedCount = candidates.filter((candidate) => !candidate.reviewed).length;

  return {
    threshold,
    candidateCount: candidates.length,
    lowConfidenceCount,
    unreviewedCount,
    commitAllowed: lowConfidenceCount === 0 && unreviewedCount === 0,
    rows,
  };
}

export function buildPrivacyDataCentre(
  routes: readonly PrivacyDataRoute[],
): PrivacyDataCentreState {
  const cloudRouteCount = routes.filter((route) => route.location === 'optional_cloud').length;
  const defaultCloudOff = routes.every(
    (route) => route.location !== 'optional_cloud' || !route.cloudEnabled,
  );
  const allRoutesControllable = routes.every(
    (route) => route.exportAvailable && route.deleteAvailable && route.permissionLabel.length > 0,
  );
  const memoryResetAvailable = routes.some((route) => route.memoryResetAvailable);

  return {
    routeCount: routes.length,
    cloudRouteCount,
    defaultCloudOff,
    allRoutesControllable,
    memoryResetAvailable,
    rows: routes.map((route) =>
      row(
        route.label,
        `${route.location}; ${route.permissionLabel}`,
        route.cloudEnabled ? 'needs_review' : 'implemented',
      ),
    ),
  };
}

export function buildHumanExportPlan(surfaces: readonly ExportSurface[]): HumanExportPlan {
  const formats = surfaces.map((surface) => surface.format);
  const hasFormat = (format: ExportFormat) => formats.includes(format);
  const noCloudRequirement = surfaces.every((surface) => !surface.cloudRequired);
  const noSubscriptionGate = surfaces.every((surface) => !surface.subscriptionRequired);
  const completeAndPortable =
    hasFormat('csv') &&
    hasFormat('json') &&
    hasFormat('pdf_summary') &&
    surfaces.every((surface) => surface.includesProvenance);

  return {
    portableFormats: [...new Set(formats)],
    completeAndPortable,
    noSubscriptionGate,
    noCloudRequirement,
    rows: surfaces.map((surface) =>
      row(
        surface.label,
        `${surface.format}; ${surface.workspaceScope}`,
        surface.cloudRequired || surface.subscriptionRequired ? 'blocked' : 'implemented',
      ),
    ),
  };
}

export function buildThreatModelState(input: {
  controls: readonly ThreatModelControl[];
  reviewedAndSigned: boolean;
}): ThreatModelState {
  const highOrCriticalResidualRisks = input.controls.filter(
    (control) => control.residualRisk === 'high' || control.residualRisk === 'critical',
  ).length;
  const openControls = input.controls.filter(
    (control) => control.status === 'blocked' || control.status === 'needs_review',
  ).length;
  return {
    controlCount: input.controls.length,
    highOrCriticalResidualRisks,
    reviewedAndSigned: input.reviewedAndSigned,
    releaseBlocked: !input.reviewedAndSigned || highOrCriticalResidualRisks > 0 || openControls > 0,
    rows: input.controls.map((control) =>
      row(control.asset, `${control.actor}: ${control.control}`, statusToReadiness(control.status)),
    ),
  };
}

export function evaluateMasvsVerification(checks: readonly MasvsCheck[]): MasvsVerificationState {
  const areaCount = new Set(checks.map((check) => check.area)).size;
  const passedCount = checks.filter((check) => check.status === 'passed').length;
  const blockedCount = checks.filter((check) => check.status === 'blocked').length;
  const highOrCriticalOpen = checks.filter(
    (check) =>
      check.status === 'blocked' && (check.severity === 'high' || check.severity === 'critical'),
  ).length;

  return {
    areaCount,
    passedCount,
    blockedCount,
    highOrCriticalOpen,
    releaseBlocked: highOrCriticalOpen > 0 || blockedCount > 0,
    rows: checks.map((check) =>
      row(
        check.area,
        check.label,
        check.status === 'passed'
          ? 'passed'
          : check.status === 'not_applicable'
            ? 'needs_review'
            : 'blocked',
      ),
    ),
  };
}

export function evaluateSecurityEvidenceGate(input: {
  checks: readonly SecurityChecklistItem[];
  claims: readonly SecurityEvidenceClaim[];
  openBlockerIds?: readonly string[];
}): SecurityEvidenceGateState {
  const claimsById = new Map(input.claims.map((claim) => [claim.id, claim]));
  const preservedBlockerIds = new Set(input.openBlockerIds ?? []);
  let localPassedCount = 0;
  let externalRequiredCount = 0;
  let blockedCount = 0;
  let notApplicableCount = 0;
  let missingEvidenceCount = 0;
  let leakedEvidenceCount = 0;
  let fakeExternalSignoffCount = 0;
  let highOrCriticalOpen = 0;

  const rows = input.checks.map((check) => {
    const claims = check.evidenceClaimIds
      .map((claimId) => claimsById.get(claimId))
      .filter((claim): claim is SecurityEvidenceClaim => claim !== undefined);
    const missingEvidence = check.evidenceClaimIds.length - claims.length;
    const leakedEvidence = claims.filter(
      (claim) => claim.containsSecrets || claim.containsPrivateData,
    ).length;
    const fakeExternalSignoff = claims.filter(isFakeExternalSignoffClaim).length;
    const externalSatisfied =
      !check.requiresExternalSignoff || claims.some(isRealExternalSignoffClaim);
    const blockedByClaim = claims.some(
      (claim) => claim.result === 'blocked' || claim.result === 'needs_review',
    );
    const externalRequired = check.requiresExternalSignoff && !externalSatisfied;
    const blocked =
      check.status === 'blocked' ||
      blockedByClaim ||
      externalRequired ||
      missingEvidence > 0 ||
      leakedEvidence > 0 ||
      fakeExternalSignoff > 0;

    missingEvidenceCount += missingEvidence;
    leakedEvidenceCount += leakedEvidence;
    fakeExternalSignoffCount += fakeExternalSignoff;
    if (externalRequired) externalRequiredCount += 1;
    if (check.status === 'not_applicable') notApplicableCount += 1;
    if (blocked) blockedCount += 1;
    if (!blocked && check.status === 'passed_local') localPassedCount += 1;

    if (blocked && isHighOrCritical(check.severity)) {
      highOrCriticalOpen += 1;
    }

    if ((blocked || externalRequired) && check.blockerId !== undefined) {
      preservedBlockerIds.add(check.blockerId);
    }

    return row(
      `${check.area}: ${check.label}`,
      securityEvidenceRowValue({
        check,
        missingEvidence,
        leakedEvidence,
        fakeExternalSignoff,
        externalRequired,
      }),
      blocked ? 'blocked' : check.status === 'not_applicable' ? 'needs_review' : 'passed',
    );
  });

  return {
    checkCount: input.checks.length,
    localPassedCount,
    externalRequiredCount,
    blockedCount,
    notApplicableCount,
    missingEvidenceCount,
    leakedEvidenceCount,
    fakeExternalSignoffCount,
    highOrCriticalOpen,
    releaseBlocked:
      blockedCount > 0 ||
      externalRequiredCount > 0 ||
      leakedEvidenceCount > 0 ||
      fakeExternalSignoffCount > 0 ||
      highOrCriticalOpen > 0,
    preservedBlockerIds: [...preservedBlockerIds].sort((left, right) => left.localeCompare(right)),
    rows,
  };
}

export function buildDpiaProcessorInventory(routes: readonly ProcessorRoute[]): DpiaState {
  const required = routes.filter((route) => route.dpiaRequired);
  const unapprovedRequired = required.filter((route) => !route.approved);
  return {
    routeCount: routes.length,
    dpiaRequiredCount: required.length,
    unapprovedRequiredCount: unapprovedRequired.length,
    publicBetaBlocked: unapprovedRequired.length > 0,
    rows: routes.map((route) =>
      row(
        route.label,
        `${route.route}; ${route.processor}`,
        route.dpiaRequired && !route.approved ? 'blocked' : 'implemented',
      ),
    ),
  };
}

export function evaluateAccessibilityAudit(input: {
  independentlyReviewed: boolean;
  journeys: readonly AccessibilityJourneyResult[];
}): AccessibilityAuditState {
  const completeJourneyCount = input.journeys.filter(
    (journey) =>
      journey.voiceOver &&
      journey.talkBack &&
      journey.largeText &&
      journey.reducedMotion &&
      journey.cognitiveReview,
  ).length;
  const criticalIssueCount = input.journeys.filter((journey) => journey.criticalIssueOpen).length;
  return {
    independentlyReviewed: input.independentlyReviewed,
    journeyCount: input.journeys.length,
    completeJourneyCount,
    criticalIssueCount,
    releaseBlocked:
      !input.independentlyReviewed ||
      completeJourneyCount !== input.journeys.length ||
      criticalIssueCount > 0,
    rows: input.journeys.map((journey) =>
      row(
        journey.label,
        `${completedAccessibilityModes(journey)}/5 modes`,
        journey.criticalIssueOpen
          ? 'blocked'
          : completedAccessibilityModes(journey) === 5
            ? 'passed'
            : 'blocked',
      ),
    ),
  };
}

export function buildLocalDiagnosticScreen(
  signals: readonly DiagnosticSignal[],
): LocalDiagnosticState {
  const blockedSignals = signals.filter((signal) => signal.status === 'blocked').length;
  const sanitisedExportAllowed = signals.every((signal) => !signal.containsFinancialContent);

  return {
    signalCount: signals.length,
    sanitisedExportAllowed,
    blockedSignals,
    rows: signals.map((signal) =>
      row(
        signal.label,
        signal.detail,
        signal.status === 'ok'
          ? 'implemented'
          : signal.status === 'warning'
            ? 'needs_review'
            : 'blocked',
      ),
    ),
  };
}

export function createSyntheticReviewerVault(input: {
  id: string;
  label: string;
  flows: readonly string[];
}): SyntheticReviewerVault {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.label, 'label');
  if (input.flows.length === 0) {
    throw new Error('synthetic reviewer vault requires at least one review flow');
  }

  return {
    id: input.id,
    label: input.label,
    realData: false,
    isolatedFromUserVault: true,
    accountRequired: false,
    flows: input.flows,
    warningLabel: 'Synthetic reviewer vault; no real financial records.',
  };
}

export function buildResilienceDrillReport(
  drills: readonly ResilienceDrill[],
): ResilienceDrillState {
  const passedCount = drills.filter((drill) => drill.status === 'passed').length;
  const blockedCount = drills.filter((drill) => drill.status === 'blocked').length;
  const silentDataLossObserved = drills.some((drill) => drill.silentDataLossObserved);

  return {
    drillCount: drills.length,
    passedCount,
    blockedCount,
    silentDataLossObserved,
    releaseBlocked: silentDataLossObserved || blockedCount > 0 || passedCount !== drills.length,
    rows: drills.map((drill) =>
      row(
        drill.kind.replaceAll('_', ' '),
        drill.evidence,
        drill.status === 'passed' ? 'passed' : 'blocked',
      ),
    ),
  };
}

export function evaluateLocalOnlyPrivateBeta(input: {
  documentLibrary: DocumentLibraryState;
  extractionReview: ExtractionReviewState;
  privacyCentre: PrivacyDataCentreState;
  exportPlan: HumanExportPlan;
  threatModel: ThreatModelState;
  securityEvidence?: SecurityEvidenceGateState;
  masvs: MasvsVerificationState;
  dpia: DpiaState;
  accessibility: AccessibilityAuditState;
  diagnostics: LocalDiagnosticState;
  reviewerVault: SyntheticReviewerVault;
  resilience: ResilienceDrillState;
}): LocalOnlyPrivateBetaState {
  const blockers = [
    input.documentLibrary.locallyEncryptedAndAccessible
      ? null
      : 'document library native encryption/accessibility',
    input.extractionReview.commitAllowed
      ? null
      : 'extraction review low-confidence or unreviewed candidates',
    input.privacyCentre.allRoutesControllable ? null : 'privacy routes not fully controllable',
    input.exportPlan.completeAndPortable &&
    input.exportPlan.noCloudRequirement &&
    input.exportPlan.noSubscriptionGate
      ? null
      : 'complete local export without cloud/subscription',
    input.threatModel.releaseBlocked ? 'threat model review/signoff' : null,
    input.securityEvidence?.releaseBlocked ? 'security evidence gate' : null,
    input.masvs.releaseBlocked ? 'MASVS high/critical or blocked checks' : null,
    input.dpia.publicBetaBlocked ? 'DPIA/processor approval' : null,
    input.accessibility.releaseBlocked ? 'independent accessibility audit' : null,
    input.diagnostics.sanitisedExportAllowed ? null : 'sanitised diagnostic export',
    input.reviewerVault.realData ? 'reviewer vault isolation' : null,
    input.resilience.releaseBlocked ? 'migration/corruption/low-storage drills' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    ready: blockers.length === 0,
    releaseTrack: blockers.length === 0 ? 'closed_beta' : 'internal_dogfood',
    blockers,
    rows: [
      row(
        'Documents',
        input.documentLibrary.locallyEncryptedAndAccessible ? 'ready' : 'blocked',
        input.documentLibrary.locallyEncryptedAndAccessible ? 'passed' : 'blocked',
      ),
      row(
        'Extraction',
        input.extractionReview.commitAllowed ? 'commit allowed' : 'review required',
        input.extractionReview.commitAllowed ? 'passed' : 'blocked',
      ),
      row(
        'Privacy/export',
        input.exportPlan.noSubscriptionGate ? 'not paywalled' : 'blocked',
        input.exportPlan.noSubscriptionGate ? 'implemented' : 'blocked',
      ),
      row(
        'Security',
        securityReadinessLabel(input.threatModel, input.securityEvidence),
        input.threatModel.releaseBlocked || input.securityEvidence?.releaseBlocked
          ? 'blocked'
          : 'passed',
      ),
      row('Reviewer vault', input.reviewerVault.warningLabel, 'implemented'),
      row(
        'Beta',
        blockers.length === 0 ? 'ready' : `${blockers.length} blockers`,
        blockers.length === 0 ? 'passed' : 'blocked',
      ),
    ],
  };
}

export function buildPhase9CoverageRows(input: {
  documentLibrary: DocumentLibraryState;
  extractionReview: ExtractionReviewState;
  privacyCentre: PrivacyDataCentreState;
  exportPlan: HumanExportPlan;
  threatModel: ThreatModelState;
  masvs: MasvsVerificationState;
  dpia: DpiaState;
  accessibility: AccessibilityAuditState;
  diagnostics: LocalDiagnosticState;
  reviewerVault: SyntheticReviewerVault;
  resilience: ResilienceDrillState;
  privateBeta: LocalOnlyPrivateBetaState;
}): readonly Phase9CoverageRow[] {
  return [
    coverage(
      'T122',
      'Document library',
      input.documentLibrary.locallyEncryptedAndAccessible ? 'passed' : 'blocked',
      'Pure library state and blockers modelled',
      input.documentLibrary.locallyEncryptedAndAccessible
        ? undefined
        : input.documentLibrary.blockers.join('; '),
    ),
    coverage(
      'T123',
      'Extraction review',
      'implemented',
      input.extractionReview.commitAllowed
        ? 'Reviewed candidates may commit'
        : 'Low-confidence or unreviewed candidates cannot commit',
    ),
    coverage(
      'T124',
      'Privacy/data centre',
      input.privacyCentre.defaultCloudOff &&
        input.privacyCentre.allRoutesControllable &&
        input.privacyCentre.memoryResetAvailable
        ? 'passed'
        : 'blocked',
      'Routes, permissions, memory and cloud status modelled',
      input.privacyCentre.defaultCloudOff &&
        input.privacyCentre.allRoutesControllable &&
        input.privacyCentre.memoryResetAvailable
        ? undefined
        : 'privacy routes, memory reset or cloud default needs closure',
    ),
    coverage(
      'T125',
      'Human export',
      input.exportPlan.completeAndPortable &&
        input.exportPlan.noCloudRequirement &&
        input.exportPlan.noSubscriptionGate
        ? 'passed'
        : 'blocked',
      'CSV/JSON/PDF-style local export surfaces modelled',
      input.exportPlan.completeAndPortable &&
        input.exportPlan.noCloudRequirement &&
        input.exportPlan.noSubscriptionGate
        ? undefined
        : 'complete local export without cloud/subscription is not proven',
    ),
    coverage(
      'T126',
      'Threat model',
      input.threatModel.releaseBlocked ? 'blocked' : 'passed',
      'Threat model draft exists',
      input.threatModel.releaseBlocked ? 'External review/signoff required' : undefined,
    ),
    coverage(
      'T127',
      'MASVS',
      input.masvs.releaseBlocked ? 'blocked' : 'passed',
      'MASVS check state modelled',
      input.masvs.releaseBlocked ? 'No independent high/critical clearance' : undefined,
    ),
    coverage(
      'T128',
      'DPIA/processors',
      input.dpia.publicBetaBlocked ? 'blocked' : 'passed',
      'DPIA inventory modelled',
      input.dpia.publicBetaBlocked ? 'Privacy/legal approval required' : undefined,
    ),
    coverage(
      'T129',
      'Accessibility audit',
      input.accessibility.releaseBlocked ? 'blocked' : 'passed',
      'Audit state modelled',
      input.accessibility.releaseBlocked ? 'Manual independent audit required' : undefined,
    ),
    coverage(
      'T130',
      'Diagnostics',
      input.diagnostics.sanitisedExportAllowed ? 'implemented' : 'blocked',
      'Sanitised local diagnostic state modelled',
      input.diagnostics.sanitisedExportAllowed
        ? undefined
        : 'diagnostic export still contains financial content',
    ),
    coverage(
      'T131',
      'Reviewer vault',
      input.reviewerVault.realData || !input.reviewerVault.isolatedFromUserVault
        ? 'blocked'
        : 'implemented',
      'Synthetic labelled vault created',
      input.reviewerVault.realData || !input.reviewerVault.isolatedFromUserVault
        ? 'reviewer vault isolation failed'
        : undefined,
    ),
    coverage(
      'T132',
      'Resilience drills',
      input.resilience.releaseBlocked ? 'blocked' : 'passed',
      'Drill report modelled',
      input.resilience.releaseBlocked ? 'Native destructive drills required' : undefined,
    ),
    coverage(
      'T133',
      'Private beta',
      input.privateBeta.ready ? 'passed' : 'blocked',
      'Gate summary modelled',
      input.privateBeta.ready ? undefined : 'Local-only beta not ready',
    ),
  ];
}

function coverage(
  taskId: Phase9TaskId,
  label: string,
  state: ReadinessState,
  evidence: string,
  blocker?: string,
): Phase9CoverageRow {
  if (blocker === undefined) {
    return { taskId, label, state, evidence };
  }

  return { taskId, label, state, evidence, blocker };
}

function row(label: string, value: string, state: ReadinessState): ReadinessDisplayRow {
  return { label, value, state };
}

function isFakeExternalSignoffClaim(claim: SecurityEvidenceClaim): boolean {
  if (!claim.claimsExternalSignoff) return false;

  return !isRealExternalSignoffClaim(claim);
}

function isRealExternalSignoffClaim(claim: SecurityEvidenceClaim): boolean {
  return (
    claim.claimsExternalSignoff &&
    claim.scope === 'external_review' &&
    claim.result === 'passed' &&
    claim.externalReviewer !== undefined &&
    claim.externalReviewer.trim().length > 0 &&
    !claim.containsSecrets &&
    !claim.containsPrivateData
  );
}

function isHighOrCritical(severity: MasvsCheck['severity']): boolean {
  return severity === 'high' || severity === 'critical';
}

function securityEvidenceRowValue(input: {
  check: SecurityChecklistItem;
  missingEvidence: number;
  leakedEvidence: number;
  fakeExternalSignoff: number;
  externalRequired: boolean;
}): string {
  const issues = [
    input.missingEvidence > 0 ? `${input.missingEvidence} missing evidence claim(s)` : null,
    input.leakedEvidence > 0 ? `${input.leakedEvidence} unsafe evidence artifact(s)` : null,
    input.fakeExternalSignoff > 0 ? 'fake external signoff rejected' : null,
    input.externalRequired ? 'external signoff still required' : null,
    input.check.status === 'blocked' ? 'check blocked' : null,
  ].filter((value): value is string => Boolean(value));

  if (issues.length > 0) {
    return issues.join('; ');
  }

  if (input.check.status === 'not_applicable') {
    return 'not applicable; keep reviewed';
  }

  return `${input.check.requirement}; evidence local-pass`;
}

function securityReadinessLabel(
  threatModel: ThreatModelState,
  securityEvidence?: SecurityEvidenceGateState,
): string {
  if (threatModel.releaseBlocked) return 'threat model blocked';
  if (securityEvidence?.releaseBlocked) {
    return `${securityEvidence.blockedCount} evidence blocker(s)`;
  }

  return securityEvidence ? 'signed and locally evidenced' : 'signed';
}

function statusToReadiness(status: ThreatControlStatus): ReadinessState {
  if (status === 'implemented') return 'implemented';
  if (status === 'partial') return 'needs_review';
  return status;
}

function completedAccessibilityModes(journey: AccessibilityJourneyResult): number {
  return [
    journey.voiceOver,
    journey.talkBack,
    journey.largeText,
    journey.reducedMotion,
    journey.cognitiveReview,
  ].filter(Boolean).length;
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} cannot be empty`);
  }
}
