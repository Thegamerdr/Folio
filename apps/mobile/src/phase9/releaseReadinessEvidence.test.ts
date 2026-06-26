import { describe, expect, it } from 'vitest';

import {
  buildPhase9ReleaseReadinessEvidence,
  defaultPhase9ReleaseReadinessEvidence,
  phase9ProofRows,
  phase9RowsByState,
} from './releaseReadinessEvidence';

describe('Phase 9 release readiness evidence', () => {
  it('declares synthetic, local-only and model-off boundaries', () => {
    expect(defaultPhase9ReleaseReadinessEvidence.metadata).toMatchObject({
      phase: 'phase9',
      sourceLabel: 'Synthetic sample',
      modelRequired: false,
      networkRequired: false,
      cloudRequired: false,
      accountRequired: false,
      realData: false,
      directStorageWrite: false,
      nativeDocumentStore: false,
      independentSecurityReview: false,
      independentAccessibilityAudit: false,
      dpiaApproved: false,
      destructiveDrillsPassed: false,
      localOnlyPrivateBetaReady: false,
    });
  });

  it('keeps document library acceptance blocked until native encrypted file storage exists', () => {
    expect(defaultPhase9ReleaseReadinessEvidence.documentLibrary).toMatchObject({
      documentCount: 3,
      encryptedCount: 3,
      locallyEncryptedAndAccessible: false,
    });
    expect(defaultPhase9ReleaseReadinessEvidence.documentLibrary.blockers).toEqual(
      expect.arrayContaining(['native encrypted document store', 'workspace document subkeys']),
    );
    expect(
      defaultPhase9ReleaseReadinessEvidence.coverageRows.find((row) => row.taskId === 'T122'),
    ).toMatchObject({ state: 'blocked' });
  });

  it('prevents low-confidence or unreviewed extraction commits', () => {
    expect(defaultPhase9ReleaseReadinessEvidence.extractionReview).toMatchObject({
      lowConfidenceCount: 1,
      unreviewedCount: 1,
      commitAllowed: false,
    });
    expect(
      phase9RowsByState(defaultPhase9ReleaseReadinessEvidence.extractionReview.rows, 'blocked'),
    ).toHaveLength(1);
    expect(
      defaultPhase9ReleaseReadinessEvidence.coverageRows.find((row) => row.taskId === 'T123'),
    ).toMatchObject({ state: 'implemented' });
  });

  it('models privacy controls and export without cloud or subscription gates', () => {
    expect(defaultPhase9ReleaseReadinessEvidence.privacyCentre).toMatchObject({
      defaultCloudOff: true,
      allRoutesControllable: true,
      memoryResetAvailable: true,
    });
    expect(defaultPhase9ReleaseReadinessEvidence.exportPlan).toMatchObject({
      completeAndPortable: true,
      noCloudRequirement: true,
      noSubscriptionGate: true,
    });
    expect(defaultPhase9ReleaseReadinessEvidence.exportPlan.portableFormats).toEqual([
      'csv',
      'json',
      'pdf_summary',
    ]);
  });

  it('keeps security, MASVS, DPIA and accessibility gates blocked pending independent review', () => {
    expect(defaultPhase9ReleaseReadinessEvidence.threatModel.releaseBlocked).toBe(true);
    expect(defaultPhase9ReleaseReadinessEvidence.masvs.highOrCriticalOpen).toBeGreaterThan(0);
    expect(defaultPhase9ReleaseReadinessEvidence.dpia.publicBetaBlocked).toBe(true);
    expect(defaultPhase9ReleaseReadinessEvidence.accessibility.releaseBlocked).toBe(true);

    expect(defaultPhase9ReleaseReadinessEvidence.coverageRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'T126', state: 'blocked' }),
        expect.objectContaining({ taskId: 'T127', state: 'blocked' }),
        expect.objectContaining({ taskId: 'T128', state: 'blocked' }),
        expect.objectContaining({ taskId: 'T129', state: 'blocked' }),
      ]),
    );
  });

  it('allows a sanitised diagnostic export without financial content', () => {
    expect(defaultPhase9ReleaseReadinessEvidence.diagnostics.sanitisedExportAllowed).toBe(true);
    expect(
      defaultPhase9ReleaseReadinessEvidence.diagnostics.rows.every(
        (row) => !row.value.toLowerCase().includes('merchant'),
      ),
    ).toBe(true);
    expect(
      defaultPhase9ReleaseReadinessEvidence.coverageRows.find((row) => row.taskId === 'T130'),
    ).toMatchObject({ state: 'implemented' });
  });

  it('creates an isolated labelled reviewer vault with no account requirement', () => {
    expect(defaultPhase9ReleaseReadinessEvidence.reviewerVault).toMatchObject({
      realData: false,
      isolatedFromUserVault: true,
      accountRequired: false,
    });
    expect(defaultPhase9ReleaseReadinessEvidence.reviewerVault.warningLabel).toContain(
      'Synthetic reviewer vault',
    );
  });

  it('keeps private beta blocked until destructive drills and external gates pass', () => {
    expect(defaultPhase9ReleaseReadinessEvidence.resilience.releaseBlocked).toBe(true);
    expect(defaultPhase9ReleaseReadinessEvidence.resilience.silentDataLossObserved).toBe(false);
    expect(defaultPhase9ReleaseReadinessEvidence.privateBeta.ready).toBe(false);
    expect(defaultPhase9ReleaseReadinessEvidence.privateBeta.releaseTrack).toBe('internal_dogfood');
    expect(defaultPhase9ReleaseReadinessEvidence.privateBeta.blockers).toEqual(
      expect.arrayContaining([
        'document library native encryption/accessibility',
        'threat model review/signoff',
        'MASVS high/critical or blocked checks',
        'DPIA/processor approval',
        'independent accessibility audit',
        'migration/corruption/low-storage drills',
      ]),
    );
  });

  it('exports stable Phase 9 proof rows', () => {
    expect(phase9ProofRows).toHaveLength(12);
    expect(phase9ProofRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'T122 Document library', state: 'blocked' }),
        expect.objectContaining({ label: 'T125 Human export', state: 'passed' }),
        expect.objectContaining({ label: 'T133 Private beta', state: 'blocked' }),
      ]),
    );
  });

  it('is deterministic when rebuilt', () => {
    expect(buildPhase9ReleaseReadinessEvidence()).toEqual(defaultPhase9ReleaseReadinessEvidence);
  });
});
