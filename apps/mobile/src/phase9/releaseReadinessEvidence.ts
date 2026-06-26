import {
  buildDpiaProcessorInventory,
  buildDocumentLibraryState,
  buildExtractionReviewState,
  buildHumanExportPlan,
  buildLocalDiagnosticScreen,
  buildPhase9CoverageRows,
  buildPrivacyDataCentre,
  buildResilienceDrillReport,
  buildThreatModelState,
  createSyntheticReviewerVault,
  evaluateAccessibilityAudit,
  evaluateLocalOnlyPrivateBeta,
  evaluateMasvsVerification,
  releaseReadinessBoundary,
} from '@folio/release-readiness';
import type {
  AccessibilityAuditState,
  AccessibilityJourneyResult,
  DiagnosticSignal,
  DocumentLibraryRecord,
  DocumentLibraryState,
  ExportSurface,
  ExtractionCandidate,
  ExtractionReviewState,
  HumanExportPlan,
  LocalDiagnosticState,
  LocalOnlyPrivateBetaState,
  MasvsCheck,
  MasvsVerificationState,
  Phase9CoverageRow,
  PrivacyDataCentreState,
  PrivacyDataRoute,
  ProcessorRoute,
  ReadinessDisplayRow,
  ReadinessState,
  ResilienceDrill,
  ResilienceDrillState,
  SyntheticReviewerVault,
  ThreatModelControl,
  ThreatModelState,
} from '@folio/release-readiness';

export type Phase9Source = Readonly<{
  kind: 'synthetic';
  label: 'Synthetic sample';
  description: string;
}>;

export type Phase9EvidenceArea =
  | 'document_library'
  | 'extraction_review'
  | 'privacy_data_centre'
  | 'human_export'
  | 'threat_model'
  | 'masvs'
  | 'dpia'
  | 'accessibility_audit'
  | 'diagnostics'
  | 'reviewer_vault'
  | 'resilience_drills'
  | 'private_beta';

export type Phase9GateMetadata = Readonly<{
  phase: 'phase9';
  slice: 'security-export-local-launch-readiness';
  sourceLabel: 'Synthetic sample';
  modelRequired: false;
  networkRequired: false;
  cloudRequired: false;
  accountRequired: false;
  realData: false;
  directStorageWrite: false;
  nativeDocumentStore: false;
  independentSecurityReview: false;
  independentAccessibilityAudit: false;
  dpiaApproved: false;
  destructiveDrillsPassed: false;
  localOnlyPrivateBetaReady: false;
  evidenceAreas: readonly Phase9EvidenceArea[];
}>;

export type Phase9ProofRow = Readonly<{
  label: string;
  value: string;
  state: ReadinessState;
}>;

export type Phase9BlockerRow = Readonly<{
  label: string;
  value: string;
  source: Phase9Source;
}>;

export type Phase9ReleaseReadinessEvidence = Readonly<{
  metadata: Phase9GateMetadata;
  source: Phase9Source;
  documents: readonly DocumentLibraryRecord[];
  extractionCandidates: readonly ExtractionCandidate[];
  documentLibrary: DocumentLibraryState;
  extractionReview: ExtractionReviewState;
  privacyCentre: PrivacyDataCentreState;
  exportPlan: HumanExportPlan;
  threatModel: ThreatModelState;
  masvs: MasvsVerificationState;
  dpia: DpiaStateForMobile;
  accessibility: AccessibilityAuditState;
  diagnostics: LocalDiagnosticState;
  reviewerVault: SyntheticReviewerVault;
  resilience: ResilienceDrillState;
  privateBeta: LocalOnlyPrivateBetaState;
  coverageRows: readonly Phase9CoverageRow[];
  proofRows: readonly Phase9ProofRow[];
  blockerRows: readonly Phase9BlockerRow[];
}>;

export type DpiaStateForMobile = ReturnType<typeof buildDpiaProcessorInventory>;

const syntheticSource: Phase9Source = {
  kind: 'synthetic',
  label: 'Synthetic sample',
  description:
    'Phase 9 mobile shell evidence uses fictional records and status rows only; it performs no native file, network, cloud, account or model operation.',
};

const documents: readonly DocumentLibraryRecord[] = [
  {
    id: 'doc-fictional-repair-receipt',
    title: 'Fictional vehicle repair receipt',
    kind: 'receipt',
    workspaceId: 'workspace_personal_demo',
    retention: 'retain_until_verified',
    encryptedAtRest: true,
    linkedEntityIds: ['event-car-repair'],
    extractedTextApproved: true,
    searchIndexed: true,
    deleteAvailable: true,
  },
  {
    id: 'doc-fictional-current-account',
    title: 'Fictional current account statement',
    kind: 'statement',
    workspaceId: 'workspace_personal_demo',
    retention: 'retain_original',
    encryptedAtRest: true,
    linkedEntityIds: ['account-current-demo'],
    extractedTextApproved: false,
    searchIndexed: false,
    deleteAvailable: true,
  },
  {
    id: 'doc-fictional-tax-letter',
    title: 'Fictional tax evidence letter',
    kind: 'tax_evidence',
    workspaceId: 'workspace_personal_demo',
    retention: 'delete_original_after_extraction',
    encryptedAtRest: true,
    linkedEntityIds: ['tax-year-demo'],
    extractedTextApproved: true,
    searchIndexed: true,
    deleteAvailable: true,
  },
];

const extractionCandidates: readonly ExtractionCandidate[] = [
  {
    id: 'candidate-date',
    field: 'date',
    value: '2026-08-15',
    confidence: 0.93,
    source: { page: 1, label: 'receipt header', textSnippet: '15 Aug 2026' },
    reviewed: true,
  },
  {
    id: 'candidate-merchant',
    field: 'merchant',
    value: 'Roadside Repairs Demo',
    confidence: 0.87,
    source: { page: 1, label: 'trading name line', textSnippet: 'Roadside Repairs Demo' },
    reviewed: false,
  },
  {
    id: 'candidate-tax',
    field: 'tax_amount',
    value: 'GBP 84.00',
    confidence: 0.61,
    source: { page: 1, label: 'amount summary', textSnippet: 'VAT maybe 84.00' },
    reviewed: true,
  },
];

const privacyRoutes: readonly PrivacyDataRoute[] = [
  {
    id: 'local-vault',
    label: 'Local vault',
    location: 'device',
    permissionLabel: 'no account required',
    cloudEnabled: false,
    exportAvailable: true,
    deleteAvailable: true,
    memoryResetAvailable: false,
  },
  {
    id: 'melo-memory',
    label: 'Melo memory',
    location: 'device',
    permissionLabel: 'inspect and reset',
    cloudEnabled: false,
    exportAvailable: true,
    deleteAvailable: true,
    memoryResetAvailable: true,
  },
  {
    id: 'cloud-sync',
    label: 'Cloud sync',
    location: 'optional_cloud',
    permissionLabel: 'disabled before beta',
    cloudEnabled: false,
    exportAvailable: true,
    deleteAvailable: true,
    memoryResetAvailable: true,
  },
  {
    id: 'open-banking',
    label: 'Open Banking',
    location: 'disabled',
    permissionLabel: 'not available in local beta',
    cloudEnabled: false,
    exportAvailable: true,
    deleteAvailable: true,
    memoryResetAvailable: false,
  },
];

const exportSurfaces: readonly ExportSurface[] = [
  {
    id: 'csv-human-export',
    format: 'csv',
    label: 'CSV rows',
    workspaceScope: 'active_workspace',
    humanReadable: true,
    includesProvenance: true,
    cloudRequired: false,
    subscriptionRequired: false,
  },
  {
    id: 'json-human-export',
    format: 'json',
    label: 'JSON archive',
    workspaceScope: 'active_workspace',
    humanReadable: false,
    includesProvenance: true,
    cloudRequired: false,
    subscriptionRequired: false,
  },
  {
    id: 'pdf-summary-export',
    format: 'pdf_summary',
    label: 'PDF-style summary',
    workspaceScope: 'active_workspace',
    humanReadable: true,
    includesProvenance: true,
    cloudRequired: false,
    subscriptionRequired: false,
  },
];

const threatControls: readonly ThreatModelControl[] = [
  {
    id: 'document-store',
    asset: 'Document files',
    actor: 'lost device',
    control: 'native encrypted file store and workspace subkeys',
    status: 'blocked',
    residualRisk: 'high',
  },
  {
    id: 'app-lock',
    asset: 'App session',
    actor: 'shared device',
    control: 'Keychain/Keystore app lock with timeout proof',
    status: 'blocked',
    residualRisk: 'high',
  },
  {
    id: 'diagnostics',
    asset: 'Diagnostic bundle',
    actor: 'support workflow',
    control: 'sanitised preview before export',
    status: 'implemented',
    residualRisk: 'medium',
  },
  {
    id: 'disabled-cloud',
    asset: 'Optional cloud routes',
    actor: 'pre-beta feature drift',
    control: 'cloud and Open Banking remain disabled for local beta',
    status: 'implemented',
    residualRisk: 'low',
  },
];

const masvsChecks: readonly MasvsCheck[] = [
  {
    id: 'masvs-storage-docs',
    area: 'storage',
    label: 'document blobs encrypted outside SQLite',
    status: 'blocked',
    severity: 'high',
  },
  {
    id: 'masvs-crypto-keys',
    area: 'crypto',
    label: 'workspace document subkeys wrapped by platform keystore',
    status: 'blocked',
    severity: 'high',
  },
  {
    id: 'masvs-auth-lock',
    area: 'auth',
    label: 'biometric or PIN app lock timeout proof',
    status: 'blocked',
    severity: 'high',
  },
  {
    id: 'masvs-network-local',
    area: 'network',
    label: 'local beta has no mandatory cloud network route',
    status: 'passed',
    severity: 'none',
  },
  {
    id: 'masvs-platform-permissions',
    area: 'platform',
    label: 'document permission prompts are user initiated',
    status: 'not_applicable',
    severity: 'none',
  },
  {
    id: 'masvs-code-boundary',
    area: 'code',
    label: 'release readiness contracts are pure and dependency-light',
    status: 'passed',
    severity: 'none',
  },
  {
    id: 'masvs-privacy-telemetry',
    area: 'privacy',
    label: 'no undeclared financial telemetry in this shell',
    status: 'passed',
    severity: 'none',
  },
];

const processorRoutes: readonly ProcessorRoute[] = [
  {
    id: 'processor-local-vault',
    label: 'Local vault',
    route: 'local_only',
    processor: 'Folio app on device',
    dataCategories: ['financial records', 'documents', 'derived insights'],
    dpiaRequired: true,
    approved: false,
  },
  {
    id: 'processor-cloud-ai',
    label: 'Cloud AI',
    route: 'disabled_pre_beta',
    processor: 'none in local beta',
    dataCategories: ['none while disabled'],
    dpiaRequired: true,
    approved: false,
  },
  {
    id: 'processor-open-banking',
    label: 'Open Banking',
    route: 'disabled_pre_beta',
    processor: 'none in local beta',
    dataCategories: ['none while disabled'],
    dpiaRequired: true,
    approved: false,
  },
];

const accessibilityJourneys: readonly AccessibilityJourneyResult[] = [
  {
    id: 'export-delete',
    label: 'Export and delete',
    voiceOver: false,
    talkBack: false,
    largeText: true,
    reducedMotion: true,
    cognitiveReview: true,
    criticalIssueOpen: false,
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics preview',
    voiceOver: false,
    talkBack: false,
    largeText: true,
    reducedMotion: true,
    cognitiveReview: false,
    criticalIssueOpen: false,
  },
  {
    id: 'reviewer-vault',
    label: 'Reviewer vault',
    voiceOver: false,
    talkBack: false,
    largeText: true,
    reducedMotion: true,
    cognitiveReview: true,
    criticalIssueOpen: false,
  },
];

const diagnosticSignals: readonly DiagnosticSignal[] = [
  {
    id: 'integrity',
    label: 'Integrity',
    status: 'ok',
    detail: 'last contract check passed',
    containsFinancialContent: false,
  },
  {
    id: 'backup',
    label: 'Backup',
    status: 'warning',
    detail: 'encrypted backup route pending native drill',
    containsFinancialContent: false,
  },
  {
    id: 'index',
    label: 'Index',
    status: 'ok',
    detail: 'search index metadata only',
    containsFinancialContent: false,
  },
  {
    id: 'jobs',
    label: 'Jobs',
    status: 'ok',
    detail: 'no stuck background work in shell',
    containsFinancialContent: false,
  },
];

const resilienceDrills: readonly ResilienceDrill[] = [
  {
    id: 'migration-interrupt',
    kind: 'migration_interrupt',
    status: 'blocked',
    automated: false,
    silentDataLossObserved: false,
    evidence: 'native kill drill pending',
  },
  {
    id: 'corrupt-database',
    kind: 'corrupt_database',
    status: 'blocked',
    automated: false,
    silentDataLossObserved: false,
    evidence: 'corruption restore drill pending',
  },
  {
    id: 'low-storage',
    kind: 'low_storage',
    status: 'blocked',
    automated: false,
    silentDataLossObserved: false,
    evidence: 'full disk emulator drill pending',
  },
  {
    id: 'kill-import',
    kind: 'kill_during_import',
    status: 'blocked',
    automated: false,
    silentDataLossObserved: false,
    evidence: 'file import kill drill pending',
  },
  {
    id: 'restore-export',
    kind: 'restore_export',
    status: 'passed',
    automated: true,
    silentDataLossObserved: false,
    evidence: 'portable contract shape modelled',
  },
];

export const defaultPhase9ReleaseReadinessEvidence = buildPhase9ReleaseReadinessEvidence();

export const phase9ProofRows: readonly Phase9ProofRow[] =
  defaultPhase9ReleaseReadinessEvidence.proofRows;

export function buildPhase9ReleaseReadinessEvidence(): Phase9ReleaseReadinessEvidence {
  const documentLibrary = buildDocumentLibraryState({
    workspaceId: 'workspace_personal_demo',
    documents,
    capabilities: {
      nativeEncryptedFileStore: false,
      workspaceSubkeys: false,
      localSearchIndex: true,
      accessibleDeleteControl: true,
    },
  });
  const extractionReview = buildExtractionReviewState(extractionCandidates, 0.8);
  const privacyCentre = buildPrivacyDataCentre(privacyRoutes);
  const exportPlan = buildHumanExportPlan(exportSurfaces);
  const threatModel = buildThreatModelState({
    controls: threatControls,
    reviewedAndSigned: false,
  });
  const masvs = evaluateMasvsVerification(masvsChecks);
  const dpia = buildDpiaProcessorInventory(processorRoutes);
  const accessibility = evaluateAccessibilityAudit({
    independentlyReviewed: false,
    journeys: accessibilityJourneys,
  });
  const diagnostics = buildLocalDiagnosticScreen(diagnosticSignals);
  const reviewerVault = createSyntheticReviewerVault({
    id: 'reviewer-vault-local',
    label: 'Reviewer synthetic vault',
    flows: ['today briefing', 'privacy centre', 'export/delete', 'diagnostics'],
  });
  const resilience = buildResilienceDrillReport(resilienceDrills);
  const privateBeta = evaluateLocalOnlyPrivateBeta({
    documentLibrary,
    extractionReview,
    privacyCentre,
    exportPlan,
    threatModel,
    masvs,
    dpia,
    accessibility,
    diagnostics,
    reviewerVault,
    resilience,
  });
  const coverageRows = buildPhase9CoverageRows({
    documentLibrary,
    extractionReview,
    privacyCentre,
    exportPlan,
    threatModel,
    masvs,
    dpia,
    accessibility,
    diagnostics,
    reviewerVault,
    resilience,
    privateBeta,
  });

  return {
    metadata: {
      phase: 'phase9',
      slice: 'security-export-local-launch-readiness',
      sourceLabel: syntheticSource.label,
      modelRequired: releaseReadinessBoundary.modelRequired,
      networkRequired: releaseReadinessBoundary.networkRequired,
      cloudRequired: false,
      accountRequired: false,
      realData: false,
      directStorageWrite: releaseReadinessBoundary.writesDirectlyToStorage,
      nativeDocumentStore: false,
      independentSecurityReview: false,
      independentAccessibilityAudit: false,
      dpiaApproved: false,
      destructiveDrillsPassed: false,
      localOnlyPrivateBetaReady: false,
      evidenceAreas: [
        'document_library',
        'extraction_review',
        'privacy_data_centre',
        'human_export',
        'threat_model',
        'masvs',
        'dpia',
        'accessibility_audit',
        'diagnostics',
        'reviewer_vault',
        'resilience_drills',
        'private_beta',
      ],
    },
    source: syntheticSource,
    documents,
    extractionCandidates,
    documentLibrary,
    extractionReview,
    privacyCentre,
    exportPlan,
    threatModel,
    masvs,
    dpia,
    accessibility,
    diagnostics,
    reviewerVault,
    resilience,
    privateBeta,
    coverageRows,
    proofRows: coverageRows.map((row) => ({
      label: `${row.taskId} ${row.label}`,
      value: formatCoverageValue(row),
      state: row.state,
    })),
    blockerRows: privateBeta.blockers.map((blocker) => ({
      label: 'Release blocker',
      value: blocker,
      source: syntheticSource,
    })),
  };
}

export function phase9RowsByState<Row extends ReadinessDisplayRow | ExtractionReviewRowForMobile>(
  rows: readonly Row[],
  state: Row['state'],
): readonly Row[] {
  return rows.filter((row) => row.state === state);
}

type ExtractionReviewRowForMobile = Readonly<{
  state: ReadinessState | 'ready';
}>;

function formatCoverageValue(row: Phase9CoverageRow): string {
  return row.blocker ? `${row.evidence}; blocker: ${row.blocker}` : row.evidence;
}
