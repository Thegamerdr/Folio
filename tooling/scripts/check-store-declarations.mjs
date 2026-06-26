import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const configPath = path.join(root, 'tooling', 'config', 'store-declarations.json');
const args = new Set(process.argv.slice(2));
const requireReady = args.has('--require-ready');
const jsonOutput = args.has('--json');
const requiredDeclarationIds = [
  'apple-app-privacy',
  'apple-account-deletion',
  'google-data-safety',
  'google-account-deletion',
  'google-financial-features',
  'sdk-permission-inventory',
  'reviewer-notes',
];

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const validation = validate(config);
const blockers = collectBlockers(config);
const preparedCount = config.declarations.filter((declaration) => declaration.prepared).length;
const consoleSubmittedCount = config.declarations.filter(
  (declaration) => declaration.consoleSubmitted,
).length;
const binaryMatchedCount = config.declarations.filter(
  (declaration) => declaration.binaryMatched,
).length;
const ready = validation.valid && blockers.length === 0;
const summary = {
  releaseName: config.releaseName,
  updatedOn: config.updatedOn,
  ready,
  validation,
  preparedCount,
  declarationCount: config.declarations.length,
  consoleSubmittedCount,
  binaryMatchedCount,
  reviewAgainstSubmittedBinaryComplete: config.reviewAgainstSubmittedBinaryComplete,
  storeConsoleReviewComplete: config.storeConsoleReviewComplete,
  privacyPolicyCurrent: config.privacyPolicyCurrent,
  processorListCurrent: config.processorListCurrent,
  sdkInventoryCurrent: config.sdkInventoryCurrent,
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
  if (!Array.isArray(candidate.officialReferences) || candidate.officialReferences.length === 0) {
    issues.push({ message: 'officialReferences must be non-empty' });
  } else {
    for (const reference of candidate.officialReferences) {
      if (!/^https:\/\/(developer\.apple\.com|support\.google\.com)\//.test(reference)) {
        issues.push({ message: `official reference must be Apple or Google: ${reference}` });
      }
    }
  }
  if (!Array.isArray(candidate.declarations)) {
    issues.push({ message: 'declarations must be an array' });
    return { valid: issues.length === 0, issues };
  }

  const seenIds = new Set();
  for (const declaration of candidate.declarations) {
    if (seenIds.has(declaration.id)) {
      issues.push({ id: declaration.id, message: 'duplicate declaration id' });
    }
    seenIds.add(declaration.id);
    if (!hasText(declaration.title)) {
      issues.push({ id: declaration.id, message: 'declaration title is required' });
    }
    if (!['apple', 'google', 'both'].includes(declaration.store)) {
      issues.push({
        id: declaration.id,
        message: 'declaration store must be apple, google or both',
      });
    }
    if (!hasText(declaration.blocker)) {
      issues.push({ id: declaration.id, message: 'declaration blocker is required' });
    }
    validatePath(declaration.evidencePath, issues, declaration.id);
  }

  for (const requiredId of requiredDeclarationIds) {
    if (!seenIds.has(requiredId)) {
      issues.push({ id: requiredId, message: 'required declaration is missing' });
    }
  }

  return { valid: issues.length === 0, issues };
}

function collectBlockers(candidate) {
  const blockers = [];
  if (!candidate.reviewAgainstSubmittedBinaryComplete) {
    blockers.push('store declarations are not reviewed against a submitted binary');
  }
  if (!candidate.storeConsoleReviewComplete) {
    blockers.push('store-console review is not complete');
  }
  if (!candidate.privacyPolicyCurrent || !hasText(candidate.privacyPolicyUrl ?? '')) {
    blockers.push('privacy policy URL is not current');
  }
  if (!candidate.processorListCurrent) blockers.push('processor list is not current');
  if (!candidate.sdkInventoryCurrent) blockers.push('SDK inventory is not current');
  if (!hasText(candidate.submittedBinarySha256 ?? '')) {
    blockers.push('submitted binary hash is not recorded');
  }
  for (const declaration of candidate.declarations) {
    if (!declaration.prepared || !declaration.consoleSubmitted || !declaration.binaryMatched) {
      blockers.push(declaration.blocker);
    }
  }
  return blockers;
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
  console.log(`Prepared declarations: ${summary.preparedCount}/${summary.declarationCount}`);
  console.log(`Console submitted: ${summary.consoleSubmittedCount}/${summary.declarationCount}`);
  console.log(`Binary matched: ${summary.binaryMatchedCount}/${summary.declarationCount}`);
  console.log(
    `Submitted-binary review: ${summary.reviewAgainstSubmittedBinaryComplete ? 'yes' : 'no'}`,
  );
  console.log(`Store-console review: ${summary.storeConsoleReviewComplete ? 'yes' : 'no'}`);
  console.log(`Privacy policy current: ${summary.privacyPolicyCurrent ? 'yes' : 'no'}`);
  console.log(`Processor list current: ${summary.processorListCurrent ? 'yes' : 'no'}`);
  console.log(`SDK inventory current: ${summary.sdkInventoryCurrent ? 'yes' : 'no'}`);
  console.log(`Store declaration blockers: ${summary.blockers.length}`);

  if (!summary.validation.valid) {
    console.log(`Validation issues: ${summary.validation.issues.length}`);
    for (const issue of summary.validation.issues) {
      console.log(`- ${issue.id ? `${issue.id}: ` : ''}${issue.message}`);
    }
  }
  for (const blocker of summary.blockers.slice(0, 12)) {
    console.log(`- ${blocker}`);
  }
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
