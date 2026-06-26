import { describe, expect, it } from 'vitest';

import {
  buildPhase14StoreReleaseEvidence,
  defaultPhase14StoreReleaseEvidence,
  phase14ProofRows,
  phase14RowsByState,
} from './storeReleaseEvidence';

describe('Phase 14 store release evidence', () => {
  it('uses synthetic metadata without store submission, billing provider or production launch', () => {
    expect(defaultPhase14StoreReleaseEvidence.metadata).toMatchObject({
      phase: 'phase14',
      slice: 'store-billing-operations-release',
      sourceLabel: 'Synthetic release sample',
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
    });
  });

  it('keeps local core and export safe while native billing remains blocked', () => {
    const shell = defaultPhase14StoreReleaseEvidence;

    expect(shell.billing.coreDataNotTierBound).toBe(true);
    expect(shell.billing.exportNeverPaywalled).toBe(true);
    expect(shell.billing.offlineGraceValid).toBe(true);
    expect(shell.billing.releaseBlocked).toBe(true);
    expect(shell.billing.blockers).toEqual(
      expect.arrayContaining([
        'StoreKit 2 native proof is missing',
        'Google Play Billing native proof is missing',
      ]),
    );
  });

  it('blocks public store declarations until privacy, deletion, accessibility and legal evidence exists', () => {
    const shell = defaultPhase14StoreReleaseEvidence;

    expect(shell.storeDeclarations.localCoreNoAccount).toBe(true);
    expect(shell.storeDeclarations.declarationsMatchBinary).toBe(false);
    expect(shell.storeDeclarations.reviewerModeSafe).toBe(false);
    expect(shell.storeDeclarations.blockers).toEqual(
      expect.arrayContaining([
        'privacy policy is not current',
        'Google Data Safety form is incomplete',
        'legal review does not yet cover advice, privacy, banking and tax claims',
      ]),
    );
  });

  it('models operations runbooks but keeps tabletop and rotation gates visible', () => {
    const shell = defaultPhase14StoreReleaseEvidence;

    expect(shell.operations.coveredIncidentKinds).toHaveLength(7);
    expect(shell.operations.missingIncidentKinds).toHaveLength(0);
    expect(shell.operations.supportBoundarySafe).toBe(true);
    expect(shell.operations.blockers).toContain('tabletop exercise is not complete');
    expect(shell.operations.blockers).toContain('key/provider/model rotation drills are missing');
  });

  it('blocks final review, regression and limited launch readiness', () => {
    const shell = defaultPhase14StoreReleaseEvidence;

    expect(shell.finalReview.signedForPublicRelease).toBe(false);
    expect(shell.regression.releaseBuildsComplete).toBe(false);
    expect(shell.limitedLaunch.productionLaunchEnabled).toBe(false);
    expect(shell.releaseGate.readyForLimitedUkProduction).toBe(false);
    expect(shell.releaseGate.releaseBlockingCount).toBe(6);
  });

  it('allows privacy-safe outcome measurement while roadmap expansions stay blocked', () => {
    const shell = defaultPhase14StoreReleaseEvidence;

    expect(shell.outcomeResearch.releaseBlocked).toBe(false);
    expect(shell.outcomeResearch.privacySafe).toBe(true);
    expect(shell.roadmap.programCount).toBe(5);
    expect(shell.roadmap.blockedProgramCount).toBe(5);
    expect(shell.roadmap.unauthorisedImplementationCount).toBe(0);
  });

  it('exports stable Phase 14 proof rows for the gate panel', () => {
    expect(phase14ProofRows).toHaveLength(10);
    expect(phase14ProofRows.map((row) => row.label)).toEqual([
      'T183 Apple/Google declarations',
      'T184 Capability entitlements and store billing',
      'T185 Incident and support runbooks',
      'T186 Final penetration and privacy review',
      'T187 Full regression and golden-vector suite',
      'T188 Limited UK production launch',
      'T189 First-minute and confidence outcomes',
      'T190 Household collaboration roadmap',
      'T191 Direct HMRC MTD roadmap',
      'T192 Additional jurisdictions roadmap',
    ]);
    expect(
      phase14RowsByState(defaultPhase14StoreReleaseEvidence.coverageRows, 'blocked').map(
        (row) => row.taskId,
      ),
    ).toEqual(['T183', 'T184', 'T185', 'T186', 'T187', 'T188', 'T190', 'T191', 'T192']);
  });

  it('records Huashu critique as an operational anti-slop gate', () => {
    expect(defaultPhase14StoreReleaseEvidence.huashuReview.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Function', state: 'implemented' }),
        expect.objectContaining({ label: 'Remaining review', state: 'blocked' }),
      ]),
    );
    expect(defaultPhase14StoreReleaseEvidence.huashuReview.criticalIssuesFixed).toContain(
      'Kept local core and full export available outside billing capability checks.',
    );
  });

  it('is deterministic', () => {
    expect(buildPhase14StoreReleaseEvidence()).toEqual(defaultPhase14StoreReleaseEvidence);
  });
});
