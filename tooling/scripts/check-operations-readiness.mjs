import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const configPath = path.join(root, 'tooling', 'config', 'operations-readiness.json');
const args = new Set(process.argv.slice(2));
const requireReady = args.has('--require-ready');
const jsonOutput = args.has('--json');
const requiredIncidentKinds = [
  'calculation',
  'sync',
  'provider',
  'ai',
  'tax',
  'security',
  'store_removal',
];

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const validation = validate(config);
const coveredIncidentKinds = requiredIncidentKinds.filter((kind) =>
  config.runbooks.some((runbook) => runbook.kind === kind),
);
const incompleteRunbooks = config.runbooks.filter(
  (runbook) =>
    !runbook.severityModelled ||
    !runbook.userNoticeTemplateReady ||
    !runbook.rollbackOrCorrectionReady ||
    !runbook.noSilentHistoryRewrite,
);
const supportBoundarySafe =
  config.support.secureDiagnosticsReady && config.support.supportCannotRequestRecoverySecret;
const blockers = [
  ...requiredIncidentKinds
    .filter((kind) => !coveredIncidentKinds.includes(kind))
    .map((kind) => `missing incident runbook: ${kind}`),
  ...incompleteRunbooks.map((runbook) => `incomplete incident runbook: ${runbook.kind}`),
];

if (!config.tabletopExercise.complete) blockers.push(config.tabletopExercise.blocker);
if (!supportBoundarySafe) blockers.push('secure support diagnostic boundary is not proven');
if (!config.support.breachNotificationOwnerAssigned) {
  blockers.push('breach notification owner is not assigned');
}
if (!config.rotationDrills.complete) blockers.push(config.rotationDrills.blocker);
if (!config.vulnerabilityDisclosure.ready) blockers.push(config.vulnerabilityDisclosure.blocker);

const ready = validation.valid && blockers.length === 0;
const summary = {
  releaseName: config.releaseName,
  updatedOn: config.updatedOn,
  ready,
  validation,
  incidentRunbooksCovered: coveredIncidentKinds.length,
  incidentRunbooksRequired: requiredIncidentKinds.length,
  supportBoundarySafe,
  tabletopComplete: config.tabletopExercise.complete,
  rotationDrillsComplete: config.rotationDrills.complete,
  vulnerabilityDisclosureReady: config.vulnerabilityDisclosure.ready,
  blockers,
};

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printSummary(summary);
}

if (!validation.valid) {
  process.exitCode = 1;
} else if (requireReady && !ready) {
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
  if (!Array.isArray(candidate.runbooks)) {
    issues.push({ message: 'runbooks must be an array' });
    return { valid: issues.length === 0, issues };
  }

  for (const evidencePath of [
    candidate.tabletopExercise?.evidencePath,
    candidate.support?.boundaryPath,
    candidate.rotationDrills?.evidencePath,
    candidate.vulnerabilityDisclosure?.evidencePath,
  ]) {
    validatePath(evidencePath, issues);
  }

  const seenKinds = new Set();
  for (const runbook of candidate.runbooks) {
    if (!requiredIncidentKinds.includes(runbook.kind)) {
      issues.push({ id: runbook.kind, message: 'unknown incident kind' });
    }
    if (seenKinds.has(runbook.kind)) {
      issues.push({ id: runbook.kind, message: 'duplicate incident runbook' });
    }
    seenKinds.add(runbook.kind);
    if (!hasText(runbook.owner)) {
      issues.push({ id: runbook.kind, message: 'runbook owner is required' });
    }
    validatePath(runbook.evidencePath, issues, runbook.kind);
  }

  for (const requiredKind of requiredIncidentKinds) {
    if (!seenKinds.has(requiredKind)) {
      issues.push({ id: requiredKind, message: 'required incident runbook missing' });
    }
  }

  return { valid: issues.length === 0, issues };
}

function validatePath(candidatePath, issues, id) {
  if (!hasText(candidatePath)) {
    issues.push({ id, message: 'evidence path is required' });
    return;
  }
  if (!fs.existsSync(path.join(root, candidatePath))) {
    issues.push({ id, message: `evidence path does not exist: ${candidatePath}` });
  }
}

function printSummary(summary) {
  console.log(`${summary.releaseName}: ${summary.ready ? 'READY' : 'BLOCKED'}`);
  console.log(`Updated: ${summary.updatedOn}`);
  console.log(
    `Incident runbooks: ${summary.incidentRunbooksCovered}/${summary.incidentRunbooksRequired}`,
  );
  console.log(`Support boundary safe: ${summary.supportBoundarySafe ? 'yes' : 'no'}`);
  console.log(`Tabletop complete: ${summary.tabletopComplete ? 'yes' : 'no'}`);
  console.log(`Rotation drills complete: ${summary.rotationDrillsComplete ? 'yes' : 'no'}`);
  console.log(
    `Vulnerability disclosure ready: ${summary.vulnerabilityDisclosureReady ? 'yes' : 'no'}`,
  );
  console.log(`Operations blockers: ${summary.blockers.length}`);

  if (!summary.validation.valid) {
    console.log(`Validation issues: ${summary.validation.issues.length}`);
    for (const issue of summary.validation.issues) {
      console.log(`- ${issue.id ? `${issue.id}: ` : ''}${issue.message}`);
    }
  }
  for (const blocker of summary.blockers) {
    console.log(`- ${blocker}`);
  }
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
