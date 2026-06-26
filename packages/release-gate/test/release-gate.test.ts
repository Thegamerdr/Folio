import { describe, expect, it } from 'vitest';

import {
  evaluateReleaseTracks,
  evaluateReleaseGate,
  formatReleaseGateSummary,
  releaseBlockersByImpact,
  releaseBlockersByKind,
  releaseGateBoundary,
  validateReleaseBlockerRegister,
  type ReleaseBlocker,
  type ReleaseBlockerRegister,
} from '../src/index.js';

const releaseBlockers: readonly ReleaseBlocker[] = [
  {
    id: 'RB-T183-STORE-DECLARATIONS',
    phase: 'phase14',
    taskIds: ['T183'],
    category: 'store',
    title: 'Apple and Google declarations match binary and data flows',
    kind: 'external_signoff',
    impact: 'release_blocking',
    status: 'blocked',
    owner: 'release-lead',
    machineCheckable: false,
    source: 'STATUS.md#open-risks',
    evidenceRequired: ['store_console', 'privacy', 'legal'],
    unblockCondition: 'Submitted binary, SDK inventory and store forms are reviewed together.',
  },
  {
    id: 'RB-T184-BILLING',
    phase: 'phase14',
    taskIds: ['T184'],
    category: 'billing',
    title: 'Native StoreKit and Play Billing evidence',
    kind: 'external_credentials',
    impact: 'release_blocking',
    status: 'blocked',
    owner: 'billing-lead',
    machineCheckable: false,
    source: 'STATUS.md#open-risks',
    evidenceRequired: ['credential', 'artifact'],
    unblockCondition: 'StoreKit 2, Play Billing, backend verification and restore pass.',
  },
  {
    id: 'RB-T185-OPERATIONS',
    phase: 'phase14',
    taskIds: ['T185'],
    category: 'operations',
    title: 'Incident tabletop and support rotation evidence',
    kind: 'local_docs_evidence',
    impact: 'release_blocking',
    status: 'needs_evidence',
    owner: 'support-lead',
    machineCheckable: true,
    source: 'STATUS.md#open-risks',
    evidenceRequired: ['operations'],
    unblockCondition: 'Tabletop, rotation drills and disclosure channel evidence are recorded.',
  },
  {
    id: 'RB-T186-FINAL-REVIEWS',
    phase: 'phase14',
    taskIds: ['T186'],
    category: 'security_privacy_legal',
    title: 'Final pen test, DPIA, processor, legal, privacy and accessibility signoff',
    kind: 'external_signoff',
    impact: 'release_blocking',
    status: 'blocked',
    owner: 'security-privacy-lead',
    machineCheckable: false,
    source: 'STATUS.md#open-risks',
    evidenceRequired: ['security', 'privacy', 'legal', 'accessibility'],
    unblockCondition: 'Independent reviews close with no high or critical findings open.',
  },
  {
    id: 'RB-T187-REGRESSION-BUILDS',
    phase: 'phase14',
    taskIds: ['T187'],
    category: 'quality',
    title: 'Full regression, offline E2E, account deletion E2E and store builds',
    kind: 'local_machine_check',
    impact: 'release_blocking',
    status: 'needs_evidence',
    owner: 'quality-lead',
    machineCheckable: true,
    source: 'STATUS.md#open-risks',
    evidenceRequired: ['command', 'artifact'],
    unblockCondition: 'Release build, offline E2E and deletion E2E logs pass on iOS and Android.',
  },
  {
    id: 'RB-T188-LIMITED-LAUNCH',
    phase: 'phase14',
    taskIds: ['T188'],
    category: 'launch',
    title: 'Limited UK launch operations and rollback readiness',
    kind: 'external_service',
    impact: 'release_blocking',
    status: 'blocked',
    owner: 'launch-lead',
    machineCheckable: false,
    source: 'STATUS.md#open-risks',
    evidenceRequired: ['operations', 'artifact'],
    unblockCondition: 'Billing, monitoring, support, rollback and thresholds are stable.',
  },
  {
    id: 'RB-T190-ROADMAP-HOUSEHOLD',
    phase: 'phase14',
    taskIds: ['T190'],
    category: 'roadmap',
    title: 'Household collaboration remains a separate programme',
    kind: 'roadmap_program',
    impact: 'roadmap_blocking',
    status: 'blocked',
    owner: 'product-lead',
    machineCheckable: true,
    source: 'STATUS.md#open-risks',
    evidenceRequired: ['privacy', 'security', 'legal'],
    unblockCondition: 'A separate privacy, threat, permissions and go/no-go package is approved.',
  },
];

const register: ReleaseBlockerRegister = {
  schemaVersion: '1.0',
  releaseName: 'Folio V2 public release gate',
  updatedOn: '2026-06-21',
  policy: {
    publicReleaseAllowed: false,
    allowSyntheticEvidenceForPublicRelease: false,
    requireExternalSignoffForStoreRelease: true,
    requireNoOpenHighCriticalFindings: true,
  },
  currentEvidence: releaseBlockers.map((blocker) => ({
    blockerId: blocker.id,
    paths: ['STATUS.md'],
    note: 'Current blocker source is indexed until closure evidence is available.',
  })),
  blockers: releaseBlockers,
};

describe('release gate contracts', () => {
  it('stays pure and cannot perform release side effects', () => {
    expect(releaseGateBoundary).toMatchObject({
      packageName: '@folio/release-gate',
      publicReleaseAllowedByDefault: false,
      storeSubmissionEnabled: false,
      billingProviderRuntime: 'none',
      importsNativeModules: false,
      networkRequiredForContracts: false,
      changesUserData: false,
    });
  });

  it('validates required Phase 14 public release tasks in the blocker register', () => {
    const validation = validateReleaseBlockerRegister(register);

    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('keeps public release blocked while release blockers remain open', () => {
    const summary = evaluateReleaseGate(register);

    expect(summary.readyForPublicRelease).toBe(false);
    expect(summary.releaseBlockingOpen).toBe(6);
    expect(summary.externalOpen).toBe(4);
    expect(summary.localMachineCheckOpen).toBe(1);
    expect(summary.localDocsEvidenceOpen).toBe(1);
    expect(summary.currentEvidenceRows).toBe(7);
    expect(summary.blockersMissingCurrentEvidence).toBe(0);
  });

  it('separates roadmap programmes from public release blockers', () => {
    expect(releaseBlockersByImpact(register.blockers, 'roadmap_blocking')).toHaveLength(1);
    expect(releaseBlockersByKind(register.blockers, 'roadmap_program')).toHaveLength(1);
  });

  it('separates owner dogfood, external beta and public release readiness tracks', () => {
    const tracks = evaluateReleaseTracks(register);
    const dogfood = tracks.find((track) => track.track === 'owner_dogfood');
    const beta = tracks.find((track) => track.track === 'external_beta');
    const publicRelease = tracks.find((track) => track.track === 'public_release');

    expect(dogfood).toMatchObject({
      ready: true,
      blockerCount: 0,
      note: 'Public-release blockers do not automatically block private owner dogfood.',
    });
    expect(beta).toMatchObject({ ready: false, blockerCount: 0 });
    expect(publicRelease).toMatchObject({ ready: false, blockerCount: 6 });
  });

  it('formats a human-readable release status report', () => {
    const lines = formatReleaseGateSummary(register);

    expect(lines[0]).toBe('Folio V2 public release gate: BLOCKED');
    expect(lines).toContain('Dogfood blockers: 0');
    expect(lines).toContain('Beta blockers: 0');
    expect(lines).toContain('Public release blockers: 6');
    expect(lines).toContain('Release-blocking: 6');
    expect(lines.some((line) => line.startsWith('RB-T183-STORE-DECLARATIONS'))).toBe(true);
  });

  it('rejects a register that claims synthetic evidence is enough for public release', () => {
    const validation = validateReleaseBlockerRegister({
      ...register,
      policy: {
        ...register.policy,
        allowSyntheticEvidenceForPublicRelease: true,
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.issues[0]?.message).toContain('synthetic evidence');
  });

  it('rejects blockers without current evidence rows', () => {
    const validation = validateReleaseBlockerRegister({
      ...register,
      currentEvidence: register.currentEvidence.filter(
        (evidence) => evidence.blockerId !== 'RB-T188-LIMITED-LAUNCH',
      ),
    });

    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.message.includes('current evidence row'))).toBe(
      true,
    );
  });

  it('rejects closed external blockers when evidence is local-only', () => {
    const validation = validateReleaseBlockerRegister({
      ...register,
      blockers: register.blockers.map((blocker) =>
        blocker.id === 'RB-T186-FINAL-REVIEWS' ? { ...blocker, status: 'closed' } : blocker,
      ),
      currentEvidence: register.currentEvidence.map((evidence) =>
        evidence.blockerId === 'RB-T186-FINAL-REVIEWS'
          ? {
              ...evidence,
              kind: 'security',
              independent: false,
              note: 'Local notes cannot close this external signoff blocker.',
            }
          : evidence,
      ),
    });

    expect(validation.valid).toBe(false);
    expect(
      validation.issues.some((issue) =>
        issue.message.includes('independent external signoff evidence'),
      ),
    ).toBe(true);
  });

  it('accepts closed external blockers only with independent reviewer evidence', () => {
    const validation = validateReleaseBlockerRegister({
      ...register,
      blockers: register.blockers.map((blocker) =>
        blocker.id === 'RB-T186-FINAL-REVIEWS' ? { ...blocker, status: 'closed' } : blocker,
      ),
      currentEvidence: register.currentEvidence.map((evidence) =>
        evidence.blockerId === 'RB-T186-FINAL-REVIEWS'
          ? {
              ...evidence,
              kind: 'security',
              independent: true,
              externalReviewer: 'Independent security reviewer',
              reviewedOn: '2026-06-21',
              containsSyntheticData: false,
              note: 'Independent security, privacy, legal and accessibility review package recorded.',
            }
          : evidence,
      ),
    });

    expect(validation.valid).toBe(true);
  });
});
