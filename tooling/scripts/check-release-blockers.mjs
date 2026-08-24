import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const registerPath = path.join(root, 'tooling', 'config', 'release-blockers.json');
const args = new Set(process.argv.slice(2));
const requireReady = args.has('--require-ready');
const jsonOutput = args.has('--json');

const register = JSON.parse(fs.readFileSync(registerPath, 'utf8'));
const allowedClassifications = new Set(['CLOSED', 'BLOCKED EXTERNAL', 'BLOCKED OWNER DECISION']);
const validation = validate(register);
const currentEvidenceRows = Array.isArray(register.currentEvidence)
  ? register.currentEvidence.length
  : 0;
const missingEvidenceFiles = collectMissingEvidenceFiles(register);
const openBlockers = register.blockers.filter((blocker) => blocker.status !== 'closed');
const releaseBlockers = openBlockers.filter((blocker) => blocker.impact === 'release_blocking');
const betaBlockers = openBlockers.filter((blocker) => blocker.impact === 'beta_blocking');
const roadmapBlockers = openBlockers.filter((blocker) => blocker.impact === 'roadmap_blocking');
const externalBlockers = openBlockers.filter((blocker) =>
  ['external_device', 'external_credentials', 'external_signoff', 'external_service'].includes(
    blocker.kind,
  ),
);
const localMachineChecks = openBlockers.filter((blocker) => blocker.kind === 'local_machine_check');
const localDocsEvidence = openBlockers.filter((blocker) => blocker.kind === 'local_docs_evidence');
const readyForPublicRelease =
  validation.valid && register.policy.publicReleaseAllowed && releaseBlockers.length === 0;

const summary = {
  releaseName: register.releaseName,
  updatedOn: register.updatedOn,
  readyForPublicRelease,
  publicReleaseAllowedFlag: register.policy.publicReleaseAllowed,
  validation,
  totalBlockers: register.blockers.length,
  openBlockers: openBlockers.length,
  releaseBlockingOpen: releaseBlockers.length,
  betaBlockingOpen: betaBlockers.length,
  roadmapBlockingOpen: roadmapBlockers.length,
  externalOpen: externalBlockers.length,
  localMachineCheckOpen: localMachineChecks.length,
  localDocsEvidenceOpen: localDocsEvidence.length,
  currentEvidenceRows,
  missingEvidenceFiles,
  firstReleaseBlockers: releaseBlockers.slice(0, 10).map((blocker) => ({
    id: blocker.id,
    title: blocker.title,
    classification: register.blockerDispositions?.[blocker.id]?.classification ?? 'UNCLASSIFIED',
    unblockCondition: blocker.unblockCondition,
  })),
};

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printSummary(summary);
}

if (!validation.valid) {
  process.exitCode = 1;
} else if (requireReady && !readyForPublicRelease) {
  process.exitCode = 1;
}

function validate(candidate) {
  const issues = [];
  if (candidate.schemaVersion !== '1.0') {
    issues.push({ message: 'schemaVersion must be 1.0' });
  }
  if (!hasText(candidate.releaseName)) {
    issues.push({ message: 'releaseName is required' });
  }
  if (!hasText(candidate.updatedOn)) {
    issues.push({ message: 'updatedOn is required' });
  }
  if (candidate.policy?.allowSyntheticEvidenceForPublicRelease) {
    issues.push({ message: 'synthetic evidence cannot allow public release' });
  }
  if (!Array.isArray(candidate.currentEvidence) || candidate.currentEvidence.length === 0) {
    issues.push({ message: 'currentEvidence must be a non-empty array' });
  }
  if (!Array.isArray(candidate.blockers) || candidate.blockers.length === 0) {
    issues.push({ message: 'blockers must be a non-empty array' });
    return { valid: issues.length === 0, issues };
  }

  const ids = new Set();
  for (const blocker of candidate.blockers) {
    if (ids.has(blocker.id)) {
      issues.push({ id: blocker.id, message: 'duplicate blocker id' });
    }
    ids.add(blocker.id);

    for (const key of [
      'id',
      'phase',
      'category',
      'title',
      'kind',
      'impact',
      'status',
      'owner',
      'source',
      'unblockCondition',
    ]) {
      if (!hasText(blocker[key])) {
        issues.push({ id: blocker.id, message: `${key} is required` });
      }
    }
    if (!Array.isArray(blocker.taskIds) || blocker.taskIds.length === 0) {
      issues.push({ id: blocker.id, message: 'taskIds must be non-empty' });
    }
    if (!Array.isArray(blocker.evidenceRequired) || blocker.evidenceRequired.length === 0) {
      issues.push({ id: blocker.id, message: 'evidenceRequired must be non-empty' });
    }
    const disposition = candidate.blockerDispositions?.[blocker.id];
    if (!allowedClassifications.has(disposition?.classification)) {
      issues.push({
        id: blocker.id,
        message: `disposition classification must be one of: ${[...allowedClassifications].join(', ')}`,
      });
    }
    if (!hasText(disposition?.action)) {
      issues.push({ id: blocker.id, message: 'disposition action is required' });
    }
    if (typeof blocker.machineCheckable !== 'boolean') {
      issues.push({ id: blocker.id, message: 'machineCheckable must be boolean' });
    }
    const sourcePath = blocker.source.split('#')[0];
    if (!isUrl(sourcePath) && !fs.existsSync(path.join(root, sourcePath))) {
      issues.push({ id: blocker.id, message: `source path does not exist: ${sourcePath}` });
    }
  }

  const blockerIds = new Set(candidate.blockers.map((blocker) => blocker.id));
  const blockersById = new Map(candidate.blockers.map((blocker) => [blocker.id, blocker]));
  const evidenceIds = new Set();
  for (const evidence of candidate.currentEvidence ?? []) {
    if (!hasText(evidence.blockerId)) {
      issues.push({ message: 'current evidence blockerId is required' });
    }
    if (evidenceIds.has(evidence.blockerId)) {
      issues.push({ id: evidence.blockerId, message: 'duplicate current evidence row' });
    }
    evidenceIds.add(evidence.blockerId);

    if (!blockerIds.has(evidence.blockerId)) {
      issues.push({
        id: evidence.blockerId,
        message: 'current evidence references unknown blocker',
      });
    }
    const blocker = blockersById.get(evidence.blockerId);
    if (blocker?.status === 'closed') {
      if (!hasText(evidence.kind)) {
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
      if (evidence.containsSyntheticData === true && blocker.impact === 'release_blocking') {
        issues.push({
          id: evidence.blockerId,
          message: 'synthetic data cannot close a release-blocking blocker',
        });
      }
    }
    if (evidence.independent === true && !hasText(evidence.externalReviewer)) {
      issues.push({
        id: evidence.blockerId,
        message: 'independent evidence must name the external reviewer',
      });
    }
    if (!Array.isArray(evidence.paths) || evidence.paths.length === 0) {
      issues.push({ id: evidence.blockerId, message: 'current evidence paths must be non-empty' });
    }
    if (!hasText(evidence.note)) {
      issues.push({ id: evidence.blockerId, message: 'current evidence note is required' });
    }
    for (const evidencePath of evidence.paths ?? []) {
      if (!hasText(evidencePath)) {
        issues.push({ id: evidence.blockerId, message: 'current evidence path is required' });
      } else if (!isUrl(evidencePath) && !fs.existsSync(path.join(root, evidencePath))) {
        issues.push({
          id: evidence.blockerId,
          message: `evidence path does not exist: ${evidencePath}`,
        });
      }
    }
  }

  for (const blocker of candidate.blockers) {
    if (!evidenceIds.has(blocker.id)) {
      issues.push({ id: blocker.id, message: 'blocker is missing a current evidence row' });
    }
    if (
      blocker.status === 'closed' &&
      isExternalBlocker(blocker) &&
      candidate.policy?.requireExternalSignoffForStoreRelease
    ) {
      const externalEvidence = (candidate.currentEvidence ?? [])
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

  for (const taskId of ['T183', 'T184', 'T185', 'T186', 'T187', 'T188']) {
    const taskCovered = candidate.blockers.some((blocker) => blocker.taskIds.includes(taskId));
    if (!taskCovered) {
      issues.push({ id: taskId, message: 'public release task is missing' });
    }
  }

  return { valid: issues.length === 0, issues };
}

function printSummary(summary) {
  console.log(`${summary.releaseName}: ${summary.readyForPublicRelease ? 'READY' : 'BLOCKED'}`);
  console.log(`Updated: ${summary.updatedOn}`);
  console.log(`Public release flag: ${summary.publicReleaseAllowedFlag ? 'enabled' : 'disabled'}`);
  console.log(`Open blockers: ${summary.openBlockers}/${summary.totalBlockers}`);
  console.log(`Release-blocking: ${summary.releaseBlockingOpen}`);
  console.log(`Beta-blocking: ${summary.betaBlockingOpen}`);
  console.log(`Roadmap-blocking: ${summary.roadmapBlockingOpen}`);
  console.log(`External blockers: ${summary.externalOpen}`);
  console.log(`Local machine-check blockers: ${summary.localMachineCheckOpen}`);
  console.log(`Local docs/evidence blockers: ${summary.localDocsEvidenceOpen}`);
  console.log(`Current evidence rows: ${summary.currentEvidenceRows}`);
  console.log(`Missing current evidence files: ${summary.missingEvidenceFiles.length}`);

  if (!summary.validation.valid) {
    console.log(`Validation issues: ${summary.validation.issues.length}`);
    for (const issue of summary.validation.issues) {
      console.log(`- ${issue.id ? `${issue.id}: ` : ''}${issue.message}`);
    }
  }

  if (summary.firstReleaseBlockers.length > 0) {
    console.log('First release blockers:');
    for (const blocker of summary.firstReleaseBlockers) {
      console.log(`- ${blocker.id}: ${blocker.title}`);
      console.log(`  classification: ${blocker.classification}`);
      console.log(`  unblock: ${blocker.unblockCondition}`);
    }
  }
}

function collectMissingEvidenceFiles(candidate) {
  if (!Array.isArray(candidate.currentEvidence)) return [];

  return candidate.currentEvidence.flatMap((evidence) =>
    (evidence.paths ?? [])
      .filter((evidencePath) => hasText(evidencePath))
      .filter((evidencePath) => !isUrl(evidencePath))
      .filter((evidencePath) => !fs.existsSync(path.join(root, evidencePath)))
      .map((evidencePath) => ({ blockerId: evidence.blockerId, path: evidencePath })),
  );
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isExternalBlocker(blocker) {
  return [
    'external_device',
    'external_credentials',
    'external_signoff',
    'external_service',
  ].includes(blocker.kind);
}

function isIndependentExternalEvidence(evidence) {
  return (
    evidence.independent === true &&
    hasText(evidence.externalReviewer) &&
    evidence.containsSyntheticData !== true
  );
}

function isUrl(value) {
  return /^https?:\/\//.test(value);
}
