import { describe, expect, it } from 'vitest';

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
  evaluateSecurityEvidenceGate,
  releaseReadinessBoundary,
  type AccessibilityJourneyResult,
  type DiagnosticSignal,
  type DocumentLibraryRecord,
  type ExportSurface,
  type MasvsCheck,
  type ProcessorRoute,
  type ResilienceDrill,
  type SecurityChecklistItem,
  type SecurityEvidenceClaim,
  type ThreatModelControl,
} from '../src/index.js';

const documents: readonly DocumentLibraryRecord[] = [
  {
    id: 'doc_receipt_001',
    title: 'Fictional vehicle repair receipt',
    kind: 'receipt',
    workspaceId: 'workspace_personal_demo',
    retention: 'retain_until_verified',
    encryptedAtRest: true,
    linkedEntityIds: ['event_car_repair'],
    extractedTextApproved: true,
    searchIndexed: true,
    deleteAvailable: true,
  },
  {
    id: 'doc_statement_001',
    title: 'Fictional current account statement',
    kind: 'statement',
    workspaceId: 'workspace_personal_demo',
    retention: 'retain_original',
    encryptedAtRest: true,
    linkedEntityIds: ['account_current_demo'],
    extractedTextApproved: false,
    searchIndexed: false,
    deleteAvailable: true,
  },
];

const exportSurfaces: readonly ExportSurface[] = [
  {
    id: 'csv',
    format: 'csv',
    label: 'CSV rows',
    workspaceScope: 'active_workspace',
    humanReadable: true,
    includesProvenance: true,
    cloudRequired: false,
    subscriptionRequired: false,
  },
  {
    id: 'json',
    format: 'json',
    label: 'JSON archive',
    workspaceScope: 'active_workspace',
    humanReadable: false,
    includesProvenance: true,
    cloudRequired: false,
    subscriptionRequired: false,
  },
  {
    id: 'pdf',
    format: 'pdf_summary',
    label: 'PDF-style summary',
    workspaceScope: 'active_workspace',
    humanReadable: true,
    includesProvenance: true,
    cloudRequired: false,
    subscriptionRequired: false,
  },
];

describe('release readiness boundary', () => {
  it('is pure and model-off', () => {
    expect(releaseReadinessBoundary.modelRequired).toBe(false);
    expect(releaseReadinessBoundary.networkRequired).toBe(false);
    expect(releaseReadinessBoundary.writesDirectlyToStorage).toBe(false);
  });
});

describe('document and extraction readiness', () => {
  it('flags document library blockers when native encrypted file store is absent', () => {
    const state = buildDocumentLibraryState({
      workspaceId: 'workspace_personal_demo',
      documents,
      capabilities: {
        nativeEncryptedFileStore: false,
        workspaceSubkeys: false,
        localSearchIndex: true,
        accessibleDeleteControl: true,
      },
    });

    expect(state.documentCount).toBe(2);
    expect(state.encryptedCount).toBe(2);
    expect(state.searchReadyCount).toBe(1);
    expect(state.locallyEncryptedAndAccessible).toBe(false);
    expect(state.blockers).toContain('native encrypted document store');
    expect(state.blockers).toContain('workspace document subkeys');
  });

  it('blocks low-confidence or unreviewed extraction commits', () => {
    const state = buildExtractionReviewState([
      {
        id: 'date',
        field: 'date',
        value: '2026-07-12',
        confidence: 0.91,
        reviewed: true,
        source: { page: 1, label: 'receipt header', textSnippet: '12 Jul 2026' },
      },
      {
        id: 'tax',
        field: 'tax_amount',
        value: 'GBP 84.00',
        confidence: 0.62,
        reviewed: true,
        source: { page: 1, label: 'summary', textSnippet: 'VAT maybe 84' },
      },
      {
        id: 'merchant',
        field: 'merchant',
        value: 'Roadside Repairs',
        confidence: 0.88,
        reviewed: false,
        source: { page: 1, label: 'logo text', textSnippet: 'Roadside Repairs' },
      },
    ]);

    expect(state.lowConfidenceCount).toBe(1);
    expect(state.unreviewedCount).toBe(1);
    expect(state.commitAllowed).toBe(false);
    expect(state.rows.map((row) => row.state)).toContain('blocked');
  });
});

describe('privacy and export readiness', () => {
  it('proves privacy routes are controllable and cloud is off by default', () => {
    const state = buildPrivacyDataCentre([
      {
        id: 'vault',
        label: 'Local vault',
        location: 'device',
        permissionLabel: 'no account required',
        cloudEnabled: false,
        exportAvailable: true,
        deleteAvailable: true,
        memoryResetAvailable: false,
      },
      {
        id: 'melo',
        label: 'Melo memory',
        location: 'device',
        permissionLabel: 'inspect and reset',
        cloudEnabled: false,
        exportAvailable: true,
        deleteAvailable: true,
        memoryResetAvailable: true,
      },
    ]);

    expect(state.defaultCloudOff).toBe(true);
    expect(state.allRoutesControllable).toBe(true);
    expect(state.memoryResetAvailable).toBe(true);
  });

  it('keeps export portable without cloud or subscription gates', () => {
    const state = buildHumanExportPlan(exportSurfaces);

    expect(state.completeAndPortable).toBe(true);
    expect(state.noCloudRequirement).toBe(true);
    expect(state.noSubscriptionGate).toBe(true);
    expect(state.portableFormats).toEqual(['csv', 'json', 'pdf_summary']);
  });
});

describe('security, DPIA and accessibility gates', () => {
  const controls: readonly ThreatModelControl[] = [
    {
      id: 'doc_files',
      asset: 'Document files',
      actor: 'lost device',
      control: 'native encrypted file store',
      status: 'blocked',
      residualRisk: 'high',
    },
    {
      id: 'logs',
      asset: 'Diagnostics',
      actor: 'support workflow',
      control: 'sanitised preview',
      status: 'implemented',
      residualRisk: 'medium',
    },
  ];

  it('blocks release until threat model is signed and high residual risks are closed', () => {
    const state = buildThreatModelState({ controls, reviewedAndSigned: false });

    expect(state.reviewedAndSigned).toBe(false);
    expect(state.highOrCriticalResidualRisks).toBe(1);
    expect(state.releaseBlocked).toBe(true);
  });

  it('blocks MASVS when a high-severity storage check is open', () => {
    const checks: readonly MasvsCheck[] = [
      {
        id: 'masvs-storage-1',
        area: 'storage',
        label: 'document files encrypted outside SQLite',
        status: 'blocked',
        severity: 'high',
      },
      {
        id: 'masvs-privacy-1',
        area: 'privacy',
        label: 'no undeclared financial telemetry',
        status: 'passed',
        severity: 'none',
      },
    ];
    const state = evaluateMasvsVerification(checks);

    expect(state.highOrCriticalOpen).toBe(1);
    expect(state.releaseBlocked).toBe(true);
  });

  it('passes local security evidence when claims are complete and safe', () => {
    const checks: readonly SecurityChecklistItem[] = [
      {
        id: 'diagnostics',
        area: 'privacy',
        label: 'diagnostic export contains no financial content',
        requirement: 'sanitised diagnostics only',
        severity: 'medium',
        status: 'passed_local',
        requiresExternalSignoff: false,
        evidenceClaimIds: ['diagnostics-test'],
      },
    ];
    const claims: readonly SecurityEvidenceClaim[] = [
      {
        id: 'diagnostics-test',
        checkId: 'diagnostics',
        scope: 'local_unit_test',
        result: 'passed',
        artifactPaths: ['packages/storage/test/local-diagnostics.test.ts'],
        summary: 'synthetic diagnostics are redacted before export',
        containsSecrets: false,
        containsPrivateData: false,
        claimsExternalSignoff: false,
      },
    ];

    const state = evaluateSecurityEvidenceGate({ checks, claims });

    expect(state.localPassedCount).toBe(1);
    expect(state.releaseBlocked).toBe(false);
    expect(state.leakedEvidenceCount).toBe(0);
  });

  it('rejects local-only claims that pretend to satisfy external security signoff', () => {
    const checks: readonly SecurityChecklistItem[] = [
      {
        id: 'external-pen-test',
        area: 'code',
        label: 'independent mobile security review',
        requirement: 'external MASVS/security reviewer clears release blockers',
        severity: 'high',
        status: 'external_required',
        requiresExternalSignoff: true,
        blockerId: 'R0-independent-security-review',
        evidenceClaimIds: ['fake-signoff'],
      },
    ];
    const claims: readonly SecurityEvidenceClaim[] = [
      {
        id: 'fake-signoff',
        checkId: 'external-pen-test',
        scope: 'local_document_review',
        result: 'passed',
        artifactPaths: ['docs/release-evidence/local-security-notes.md'],
        summary: 'local reviewer says this is enough',
        containsSecrets: false,
        containsPrivateData: false,
        claimsExternalSignoff: true,
      },
    ];

    const state = evaluateSecurityEvidenceGate({ checks, claims });

    expect(state.fakeExternalSignoffCount).toBe(1);
    expect(state.externalRequiredCount).toBe(1);
    expect(state.highOrCriticalOpen).toBe(1);
    expect(state.releaseBlocked).toBe(true);
    expect(state.preservedBlockerIds).toContain('R0-independent-security-review');
  });

  it('blocks public beta until required DPIA routes are approved', () => {
    const routes: readonly ProcessorRoute[] = [
      {
        id: 'local',
        label: 'Local vault',
        route: 'local_only',
        processor: 'Folio app on device',
        dataCategories: ['financial records'],
        dpiaRequired: true,
        approved: false,
      },
      {
        id: 'cloud-ai',
        label: 'Cloud AI',
        route: 'disabled_pre_beta',
        processor: 'none in beta',
        dataCategories: ['none'],
        dpiaRequired: false,
        approved: false,
      },
    ];
    const state = buildDpiaProcessorInventory(routes);

    expect(state.unapprovedRequiredCount).toBe(1);
    expect(state.publicBetaBlocked).toBe(true);
  });

  it('requires independent accessibility coverage across all critical modes', () => {
    const journeys: readonly AccessibilityJourneyResult[] = [
      {
        id: 'export',
        label: 'Export/delete',
        voiceOver: false,
        talkBack: false,
        largeText: true,
        reducedMotion: true,
        cognitiveReview: true,
        criticalIssueOpen: false,
      },
    ];
    const state = evaluateAccessibilityAudit({ independentlyReviewed: false, journeys });

    expect(state.completeJourneyCount).toBe(0);
    expect(state.releaseBlocked).toBe(true);
  });
});

describe('diagnostics, reviewer vault and beta gate', () => {
  it('blocks diagnostic export when any signal contains financial content', () => {
    const signals: readonly DiagnosticSignal[] = [
      {
        id: 'integrity',
        label: 'DB integrity',
        status: 'ok',
        detail: 'last check passed',
        containsFinancialContent: false,
      },
      {
        id: 'unsafe',
        label: 'Raw last import',
        status: 'blocked',
        detail: 'contains merchant text',
        containsFinancialContent: true,
      },
    ];

    expect(buildLocalDiagnosticScreen(signals).sanitisedExportAllowed).toBe(false);
  });

  it('creates an isolated synthetic reviewer vault', () => {
    const vault = createSyntheticReviewerVault({
      id: 'reviewer_vault',
      label: 'Reviewer demo',
      flows: ['today', 'debt plan', 'privacy centre'],
    });

    expect(vault.realData).toBe(false);
    expect(vault.isolatedFromUserVault).toBe(true);
    expect(vault.accountRequired).toBe(false);
  });

  it('keeps resilience blocked until destructive drills pass without silent data loss', () => {
    const drills: readonly ResilienceDrill[] = [
      {
        id: 'migration',
        kind: 'migration_interrupt',
        status: 'blocked',
        automated: false,
        silentDataLossObserved: false,
        evidence: 'native kill drill pending',
      },
      {
        id: 'restore',
        kind: 'restore_export',
        status: 'passed',
        automated: true,
        silentDataLossObserved: false,
        evidence: 'contract only',
      },
    ];

    const state = buildResilienceDrillReport(drills);
    expect(state.releaseBlocked).toBe(true);
    expect(state.silentDataLossObserved).toBe(false);
  });

  it('summarises Phase 9 private beta blockers without losing implemented task coverage', () => {
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
    const extractionReview = buildExtractionReviewState([], 0.8);
    const privacyCentre = buildPrivacyDataCentre([
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
    ]);
    const exportPlan = buildHumanExportPlan(exportSurfaces);
    const threatModel = buildThreatModelState({
      controls: [
        {
          id: 'review',
          asset: 'Mobile app',
          actor: 'external assessor',
          control: 'independent signoff',
          status: 'needs_review',
          residualRisk: 'medium',
        },
      ],
      reviewedAndSigned: false,
    });
    const securityEvidence = evaluateSecurityEvidenceGate({
      checks: [
        {
          id: 'independent-review',
          area: 'code',
          label: 'independent mobile security review',
          requirement: 'external reviewer signs off MASVS evidence',
          severity: 'high',
          status: 'external_required',
          requiresExternalSignoff: true,
          blockerId: 'R0-independent-security-review',
          evidenceClaimIds: [],
        },
      ],
      claims: [],
    });
    const masvs = evaluateMasvsVerification([
      {
        id: 'storage',
        area: 'storage',
        label: 'native storage proof',
        status: 'blocked',
        severity: 'high',
      },
    ]);
    const dpia = buildDpiaProcessorInventory([
      {
        id: 'local',
        label: 'Local vault',
        route: 'local_only',
        processor: 'Folio app',
        dataCategories: ['financial records'],
        dpiaRequired: true,
        approved: false,
      },
    ]);
    const accessibility = evaluateAccessibilityAudit({
      independentlyReviewed: false,
      journeys: [],
    });
    const diagnostics = buildLocalDiagnosticScreen([]);
    const reviewerVault = createSyntheticReviewerVault({
      id: 'reviewer',
      label: 'Reviewer vault',
      flows: ['today'],
    });
    const resilience = buildResilienceDrillReport([
      {
        id: 'low-storage',
        kind: 'low_storage',
        status: 'blocked',
        automated: false,
        silentDataLossObserved: false,
        evidence: 'device drill pending',
      },
    ]);
    const beta = evaluateLocalOnlyPrivateBeta({
      documentLibrary,
      extractionReview,
      privacyCentre,
      exportPlan,
      threatModel,
      securityEvidence,
      masvs,
      dpia,
      accessibility,
      diagnostics,
      reviewerVault,
      resilience,
    });

    expect(beta.ready).toBe(false);
    expect(beta.releaseTrack).toBe('internal_dogfood');
    expect(beta.blockers).toContain('threat model review/signoff');
    expect(beta.blockers).toContain('security evidence gate');

    const coverage = buildPhase9CoverageRows({
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
      privateBeta: beta,
    });
    expect(coverage).toHaveLength(12);
    expect(coverage.find((row) => row.taskId === 'T122')).toMatchObject({ state: 'blocked' });
    expect(coverage.find((row) => row.taskId === 'T133')?.state).toBe('blocked');
  });
});
