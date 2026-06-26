export const releaseGateBoundary = {
  packageName: '@folio/release-gate',
  publicReleaseAllowedByDefault: false,
  storeSubmissionEnabled: false,
  billingProviderRuntime: 'none',
  importsNativeModules: false,
  networkRequiredForContracts: false,
  changesUserData: false,
} as const;

export type ReleaseBlockerKind =
  | 'local_machine_check'
  | 'local_docs_evidence'
  | 'external_device'
  | 'external_credentials'
  | 'external_signoff'
  | 'external_service'
  | 'roadmap_program';

export type ReleaseBlockerImpact =
  | 'release_blocking'
  | 'beta_blocking'
  | 'roadmap_blocking'
  | 'governance_tracking';

export type ReleaseBlockerStatus = 'open' | 'blocked' | 'needs_evidence' | 'closed';

export type ReleaseEvidenceKind =
  | 'command'
  | 'artifact'
  | 'device'
  | 'credential'
  | 'store_console'
  | 'legal'
  | 'security'
  | 'privacy'
  | 'accessibility'
  | 'provider'
  | 'research'
  | 'operations';

export type ReleaseBlocker = Readonly<{
  id: string;
  phase: string;
  taskIds: readonly string[];
  category: string;
  title: string;
  kind: ReleaseBlockerKind;
  impact: ReleaseBlockerImpact;
  status: ReleaseBlockerStatus;
  owner: string;
  machineCheckable: boolean;
  source: string;
  evidenceRequired: readonly ReleaseEvidenceKind[];
  unblockCondition: string;
}>;

export type ReleaseEvidenceArtifact = Readonly<{
  blockerId: string;
  paths: readonly string[];
  note: string;
  kind?: ReleaseEvidenceKind;
  independent?: boolean;
  externalReviewer?: string;
  reviewedOn?: string;
  containsSyntheticData?: boolean;
}>;

export type ReleaseGatePolicy = Readonly<{
  publicReleaseAllowed: boolean;
  allowSyntheticEvidenceForPublicRelease: boolean;
  requireExternalSignoffForStoreRelease: boolean;
  requireNoOpenHighCriticalFindings: boolean;
}>;

export type ReleaseBlockerRegister = Readonly<{
  schemaVersion: '1.0';
  releaseName: string;
  updatedOn: string;
  policy: ReleaseGatePolicy;
  currentEvidence: readonly ReleaseEvidenceArtifact[];
  blockers: readonly ReleaseBlocker[];
}>;

export type ReleaseGateValidationIssue = Readonly<{
  id?: string;
  message: string;
}>;

export type ReleaseGateValidation = Readonly<{
  valid: boolean;
  issues: readonly ReleaseGateValidationIssue[];
}>;

export type ReleaseGateSummary = Readonly<{
  readyForPublicRelease: boolean;
  publicReleaseAllowedFlag: boolean;
  totalBlockers: number;
  openBlockers: number;
  releaseBlockingOpen: number;
  betaBlockingOpen: number;
  roadmapBlockingOpen: number;
  localMachineCheckOpen: number;
  localDocsEvidenceOpen: number;
  externalOpen: number;
  currentEvidenceRows: number;
  blockersMissingCurrentEvidence: number;
  validation: ReleaseGateValidation;
  releaseBlockers: readonly ReleaseBlocker[];
}>;

export type ReleaseReadinessTrack = 'owner_dogfood' | 'external_beta' | 'public_release';

export type ReleaseTrackSummary = Readonly<{
  track: ReleaseReadinessTrack;
  label: string;
  ready: boolean;
  blockerCount: number;
  blockerIds: readonly string[];
  note: string;
}>;

export const requiredPublicReleaseTaskIds = [
  'T183',
  'T184',
  'T185',
  'T186',
  'T187',
  'T188',
] as const;

export function validateReleaseBlockerRegister(
  register: ReleaseBlockerRegister,
): ReleaseGateValidation {
  const issues: ReleaseGateValidationIssue[] = [];

  if (register.schemaVersion !== '1.0') {
    issues.push({ message: 'release blocker register schemaVersion must be 1.0' });
  }
  if (!hasText(register.releaseName)) {
    issues.push({ message: 'release blocker register releaseName is required' });
  }
  if (!hasText(register.updatedOn)) {
    issues.push({ message: 'release blocker register updatedOn is required' });
  }
  if (register.policy.allowSyntheticEvidenceForPublicRelease) {
    issues.push({ message: 'synthetic evidence cannot allow public release' });
  }
  if (register.currentEvidence.length === 0) {
    issues.push({ message: 'release blocker register currentEvidence must be non-empty' });
  }

  const ids = new Set<string>();
  const blockersById = new Map<string, ReleaseBlocker>();
  for (const blocker of register.blockers) {
    if (ids.has(blocker.id)) {
      issues.push({ id: blocker.id, message: 'duplicate blocker id' });
    }
    ids.add(blocker.id);
    blockersById.set(blocker.id, blocker);

    if (!hasText(blocker.id)) {
      issues.push({ message: 'blocker id is required' });
    }
    if (!hasText(blocker.phase)) {
      issues.push({ id: blocker.id, message: 'blocker phase is required' });
    }
    if (blocker.taskIds.length === 0) {
      issues.push({ id: blocker.id, message: 'blocker must reference at least one task id' });
    }
    if (!hasText(blocker.title)) {
      issues.push({ id: blocker.id, message: 'blocker title is required' });
    }
    if (!hasText(blocker.owner)) {
      issues.push({ id: blocker.id, message: 'blocker owner is required' });
    }
    if (!hasText(blocker.source)) {
      issues.push({ id: blocker.id, message: 'blocker source is required' });
    }
    if (blocker.status !== 'closed' && !hasText(blocker.unblockCondition)) {
      issues.push({
        id: blocker.id,
        message: 'open blocker must state an exact unblock condition',
      });
    }
    if (blocker.status === 'closed' && blocker.evidenceRequired.length === 0) {
      issues.push({ id: blocker.id, message: 'closed blocker must keep evidence required type' });
    }
  }

  const evidenceIds = new Set<string>();
  for (const evidence of register.currentEvidence) {
    if (!hasText(evidence.blockerId)) {
      issues.push({ message: 'current evidence blockerId is required' });
    }
    if (evidenceIds.has(evidence.blockerId)) {
      issues.push({ id: evidence.blockerId, message: 'duplicate current evidence row' });
    }
    evidenceIds.add(evidence.blockerId);

    if (!ids.has(evidence.blockerId)) {
      issues.push({
        id: evidence.blockerId,
        message: 'current evidence references unknown blocker',
      });
    }
    const blocker = blockersById.get(evidence.blockerId);
    if (blocker !== undefined && blocker.status === 'closed') {
      if (evidence.kind === undefined) {
        issues.push({
          id: evidence.blockerId,
          message: 'closed blocker evidence must state an evidence kind',
        });
      } else if (!blocker.evidenceRequired.includes(evidence.kind)) {
        issues.push({
          id: evidence.blockerId,
          message: 'closed blocker evidence kind does not match evidenceRequired',
        });
      }
      if (evidence.containsSyntheticData && blocker.impact === 'release_blocking') {
        issues.push({
          id: evidence.blockerId,
          message: 'synthetic data cannot close a release-blocking blocker',
        });
      }
    }
    if (evidence.independent && !hasText(evidence.externalReviewer ?? '')) {
      issues.push({
        id: evidence.blockerId,
        message: 'independent evidence must name the external reviewer',
      });
    }
    if (evidence.paths.length === 0) {
      issues.push({
        id: evidence.blockerId,
        message: 'current evidence must list at least one path',
      });
    }
    if (!hasText(evidence.note)) {
      issues.push({ id: evidence.blockerId, message: 'current evidence note is required' });
    }
    for (const evidencePath of evidence.paths) {
      if (!hasText(evidencePath)) {
        issues.push({ id: evidence.blockerId, message: 'current evidence path is required' });
      }
    }
  }

  for (const blocker of register.blockers) {
    if (!evidenceIds.has(blocker.id)) {
      issues.push({ id: blocker.id, message: 'blocker is missing a current evidence row' });
    }
    if (
      blocker.status === 'closed' &&
      isExternalBlocker(blocker) &&
      register.policy.requireExternalSignoffForStoreRelease
    ) {
      const externalEvidence = register.currentEvidence
        .filter((evidence) => evidence.blockerId === blocker.id)
        .some(isIndependentExternalEvidence);
      if (!externalEvidence) {
        issues.push({
          id: blocker.id,
          message: 'closed external blocker requires independent external signoff evidence',
        });
      }
    }
  }

  for (const taskId of requiredPublicReleaseTaskIds) {
    const taskCovered = register.blockers.some((blocker) => blocker.taskIds.includes(taskId));
    if (!taskCovered) {
      issues.push({ id: taskId, message: 'public release task is missing from blocker register' });
    }
  }

  return { valid: issues.length === 0, issues };
}

export function evaluateReleaseGate(register: ReleaseBlockerRegister): ReleaseGateSummary {
  const validation = validateReleaseBlockerRegister(register);
  const openBlockers = register.blockers.filter(isOpenBlocker);
  const releaseBlockers = openBlockers.filter((blocker) => blocker.impact === 'release_blocking');
  const betaBlockers = openBlockers.filter((blocker) => blocker.impact === 'beta_blocking');
  const roadmapBlockers = openBlockers.filter((blocker) => blocker.impact === 'roadmap_blocking');
  const localMachineChecks = openBlockers.filter(
    (blocker) => blocker.kind === 'local_machine_check',
  );
  const localDocsEvidence = openBlockers.filter(
    (blocker) => blocker.kind === 'local_docs_evidence',
  );
  const externalOpen = openBlockers.filter(isExternalBlocker);
  const currentEvidenceIds = new Set(
    register.currentEvidence.map((evidence) => evidence.blockerId),
  );
  const blockersMissingCurrentEvidence = register.blockers.filter(
    (blocker) => !currentEvidenceIds.has(blocker.id),
  ).length;

  return {
    readyForPublicRelease:
      validation.valid && register.policy.publicReleaseAllowed && releaseBlockers.length === 0,
    publicReleaseAllowedFlag: register.policy.publicReleaseAllowed,
    totalBlockers: register.blockers.length,
    openBlockers: openBlockers.length,
    releaseBlockingOpen: releaseBlockers.length,
    betaBlockingOpen: betaBlockers.length,
    roadmapBlockingOpen: roadmapBlockers.length,
    localMachineCheckOpen: localMachineChecks.length,
    localDocsEvidenceOpen: localDocsEvidence.length,
    externalOpen: externalOpen.length,
    currentEvidenceRows: register.currentEvidence.length,
    blockersMissingCurrentEvidence,
    validation,
    releaseBlockers,
  };
}

export function formatReleaseGateSummary(register: ReleaseBlockerRegister): readonly string[] {
  const summary = evaluateReleaseGate(register);
  const tracks = evaluateReleaseTracks(register);
  const ownerDogfood = tracks.find((track) => track.track === 'owner_dogfood');
  const externalBeta = tracks.find((track) => track.track === 'external_beta');
  const publicRelease = tracks.find((track) => track.track === 'public_release');
  const verdict = summary.readyForPublicRelease ? 'READY' : 'BLOCKED';
  const lines = [
    `${register.releaseName}: ${verdict}`,
    `Public release flag: ${summary.publicReleaseAllowedFlag ? 'enabled' : 'disabled'}`,
    `Open blockers: ${summary.openBlockers}/${summary.totalBlockers}`,
    `Dogfood blockers: ${ownerDogfood?.blockerCount ?? 0}`,
    `Beta blockers: ${externalBeta?.blockerCount ?? 0}`,
    `Public release blockers: ${publicRelease?.blockerCount ?? 0}`,
    `Release-blocking: ${summary.releaseBlockingOpen}`,
    `External blockers: ${summary.externalOpen}`,
    `Local machine-check blockers: ${summary.localMachineCheckOpen}`,
    `Local docs/evidence blockers: ${summary.localDocsEvidenceOpen}`,
    `Current evidence rows: ${summary.currentEvidenceRows}`,
  ];

  if (!summary.validation.valid) {
    lines.push(`Validation issues: ${summary.validation.issues.length}`);
  }

  for (const blocker of summary.releaseBlockers.slice(0, 8)) {
    lines.push(`${blocker.id}: ${blocker.title} -> ${blocker.unblockCondition}`);
  }

  return lines;
}

export function evaluateReleaseTracks(
  register: ReleaseBlockerRegister,
): readonly ReleaseTrackSummary[] {
  const openBlockers = register.blockers.filter(isOpenBlocker);
  const ownerDogfoodBlockers = openBlockers.filter(
    (blocker) => blocker.impact === 'governance_tracking',
  );
  const externalBetaBlockers = openBlockers.filter((blocker) => blocker.impact === 'beta_blocking');
  const publicReleaseBlockers = openBlockers.filter(
    (blocker) => blocker.impact === 'release_blocking',
  );

  return [
    {
      track: 'owner_dogfood',
      label: 'Owner dogfood',
      ready: ownerDogfoodBlockers.length === 0,
      blockerCount: ownerDogfoodBlockers.length,
      blockerIds: ownerDogfoodBlockers.map((blocker) => blocker.id),
      note: 'Public-release blockers do not automatically block private owner dogfood.',
    },
    {
      track: 'external_beta',
      label: 'External beta',
      ready: externalBetaBlockers.length === 0 && publicReleaseBlockers.length === 0,
      blockerCount: externalBetaBlockers.length,
      blockerIds: externalBetaBlockers.map((blocker) => blocker.id),
      note: 'Beta blockers are tracked separately; public-release blockers remain visible.',
    },
    {
      track: 'public_release',
      label: 'Public release',
      ready:
        validateReleaseBlockerRegister(register).valid &&
        register.policy.publicReleaseAllowed &&
        publicReleaseBlockers.length === 0,
      blockerCount: publicReleaseBlockers.length,
      blockerIds: publicReleaseBlockers.map((blocker) => blocker.id),
      note: 'Public release requires the explicit policy flag and no open release blockers.',
    },
  ];
}

export function releaseBlockersByKind(
  blockers: readonly ReleaseBlocker[],
  kind: ReleaseBlockerKind,
): readonly ReleaseBlocker[] {
  return blockers.filter((blocker) => blocker.kind === kind);
}

export function releaseBlockersByImpact(
  blockers: readonly ReleaseBlocker[],
  impact: ReleaseBlockerImpact,
): readonly ReleaseBlocker[] {
  return blockers.filter((blocker) => blocker.impact === impact);
}

function isOpenBlocker(blocker: ReleaseBlocker): boolean {
  return blocker.status !== 'closed';
}

function isExternalBlocker(blocker: ReleaseBlocker): boolean {
  return (
    blocker.kind === 'external_device' ||
    blocker.kind === 'external_credentials' ||
    blocker.kind === 'external_signoff' ||
    blocker.kind === 'external_service'
  );
}

function isIndependentExternalEvidence(evidence: ReleaseEvidenceArtifact): boolean {
  return (
    evidence.independent === true &&
    hasText(evidence.externalReviewer ?? '') &&
    evidence.containsSyntheticData !== true
  );
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}
