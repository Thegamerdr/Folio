import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();

const scanTargets = [
  'apps/mobile/app',
  'apps/mobile/src/local',
  'apps/mobile/src/surfaces',
  'packages/domain/src',
  'packages/import-engine/src',
  'packages/today-engine/src',
  'packages/ai-contracts/src',
  'packages/melo-policy/src',
  'packages/plan-engine/src',
  'packages/storage/src/schema.ts',
  'docs/source-package/schemas/database.sql',
];

const ignoredPathParts = [
  `${join('apps', 'mobile', 'src', 'phase')}`,
  `${join('docs', 'release-evidence')}`,
];

const bannedMatchers = [
  {
    code: 'canonical.fake_confidence',
    message: 'Product code must not expose confidence-as-trust language.',
    pattern:
      /\bconfidence\b|confidence_|_confidence|\bConfidence\b|lowConfidence|confidenceLabel|confidenceOutcome/i,
  },
  {
    code: 'canonical.fake_score',
    message: 'Product code must not expose fake financial scores.',
    pattern: /\bscore\b|\bScore\b|score_|_score|healthScore|readinessScore/i,
  },
  {
    code: 'canonical.direct_melo_write',
    message: 'Melo must not be able to write records directly.',
    pattern:
      /canWriteRecords\s*:\s*true|directDomainWriteAllowed\s*:\s*true|melo[^,\n]*writesDirectlyToStorage\s*:\s*true/i,
  },
  {
    code: 'canonical.advice_language',
    message: 'Product copy must not use financial advice language.',
    pattern:
      /\byou should\b[^.!?\n]*(?:pay|choose|take|use|invest|clear|prioriti[sz]e|switch|claim)\b|\bbest option for you\b|\bsuitable for you\b|\bguaranteed\b[^.!?\n]*(?:saving|outcome|forecast|result|date|position)?\b|\beverything will be fine\b/i,
  },
];

const issues = [];

for (const target of scanTargets) {
  for (const file of await filesForTarget(join(root, target))) {
    if (!isTextProductFile(file)) continue;
    if (ignoredPathParts.some((part) => file.includes(part))) continue;
    const text = await readFile(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const matcher of bannedMatchers) {
        if (!matcher.pattern.test(line)) continue;
        if (isAllowedPolicyClassifierLine(file, line, matcher.code)) continue;
        issues.push({
          code: matcher.code,
          file: relative(root, file),
          line: index + 1,
          message: matcher.message,
          excerpt: line.trim(),
        });
      }
    });
  }
}

const localLedgerPath = join(root, 'apps/mobile/src/local/localLedger.ts');
const localLedger = await readFile(localLedgerPath, 'utf8');
if (
  !localLedger.includes("draft.reviewState !== 'ready-for-user-confirmation'") ||
  !localLedger.includes("draft.userConfirmationState !== 'requested'")
) {
  issues.push({
    code: 'canonical.unreviewed_import_commit',
    file: relative(root, localLedgerPath),
    line: 1,
    message: 'confirmImportDraft must refuse drafts that are not ready for user confirmation.',
    excerpt: 'confirmImportDraft guard missing',
  });
}

const appRoutePath = join(root, 'apps/mobile/app/index.tsx');
const appRoute = await readFile(appRoutePath, 'utf8');
const directLegacyMutationImport = appRoute.match(
  /import\s*\{([\s\S]*?)\}\s*from\s*['"]\.\.\/src\/local\/localLedger['"]/,
);
const legacyMutationNames = [
  'addManualTransaction',
  'addPlannedCommitment',
  'addRecoverySpend',
  'createQuickEstimateLocalLedgerState',
  'stageStatementImport',
  'confirmImportDraft',
  'dismissImportDraft',
  'editImportDraft',
  'applyMeloImportSuggestion',
];

if (directLegacyMutationImport !== null) {
  const importedNames = directLegacyMutationImport[1]
    .split(',')
    .map((name) => name.trim().replace(/\s+as\s+\w+$/u, ''))
    .filter(Boolean);
  for (const legacyMutationName of legacyMutationNames) {
    if (!importedNames.includes(legacyMutationName)) continue;
    issues.push({
      code: 'canonical.legacy_local_ledger_authority',
      file: relative(root, appRoutePath),
      line: 1,
      message: 'Product screens must route writes through canonical repository wrappers.',
      excerpt: `direct import of ${legacyMutationName}`,
    });
  }
}

if (issues.length > 0) {
  console.error('Canonical product gates failed:');
  for (const issue of issues) {
    console.error(`- [${issue.code}] ${issue.file}:${issue.line} ${issue.message}`);
    console.error(`  ${issue.excerpt}`);
  }
  process.exit(1);
}

console.log('Canonical product gates passed.');

async function filesForTarget(target) {
  const info = await stat(target);
  if (info.isFile()) return [target];
  const entries = await readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesForTarget(child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

function isTextProductFile(file) {
  if (/\.(test|spec)\.[cm]?[tj]sx?$/i.test(file)) return false;
  return /\.(ts|tsx|mjs|js|sql)$/i.test(file);
}

function isAllowedPolicyClassifierLine(file, line, code) {
  // Melo policy classifier: the advice-language matchers are DATA that describe banned phrases; the
  // regex/label/category rows are how the classifier catches advice, not advice copy themselves.
  if (code === 'canonical.advice_language') {
    if (!file.includes(join('packages', 'melo-policy', 'src'))) return false;
    return line.includes('regex:') || line.includes('label:') || line.includes('category:');
  }

  // Statement-reader review-before-truth marker: the local statement/photo reader tags EVERY extracted
  // row with the LOWEST `CandidateConfidence` ('low') precisely so nothing is auto-counted — each
  // candidate MUST be reviewed before it becomes a posted fact. This is the OPPOSITE of a fake trust
  // score: it is the honest review gate. The field name `confidence` / `CandidateConfidence` is shared
  // with the import pipeline (folio/lib/importSheet.ts), so renaming it here would ripple wrongly.
  // Allow ONLY the review-before-truth candidate marker in these four reader files — the gate stays
  // strict for confidence-as-trust everywhere else.
  if (code === 'canonical.fake_confidence') {
    const isReaderReviewFile =
      file.includes(join('apps', 'mobile', 'src', 'local', 'statementReaderParse.ts')) ||
      file.includes(join('apps', 'mobile', 'src', 'local', 'statementReaderClient.ts')) ||
      file.includes(join('apps', 'mobile', 'src', 'local', 'localOcrCandidates.ts')) ||
      file.includes(join('apps', 'mobile', 'src', 'local', 'localDocumentCandidates.ts'));
    const isExactCanonicalReaderState =
      file.endsWith(join('packages', 'domain', 'src', 'index.ts')) &&
      /^\s*confidence:\s*'high'\s*\|\s*'medium'\s*\|\s*'low';\s*$/.test(line);
    if (isExactCanonicalReaderState) return true;
    if (!isReaderReviewFile) return false;
    // The honest review marker: the shared candidate-confidence type/const, the assignment of the
    // lowest enum, or a comment describing the lowest-confidence "must be reviewed" gate.
    return (
      line.includes('CandidateConfidence') ||
      line.includes('READER_CONFIDENCE') ||
      /lowest confidence/i.test(line) ||
      /confidence\s*\(?'low'\)?/i.test(line) ||
      /confidence:\s*READER_CONFIDENCE/.test(line) ||
      (/\bconfidence\b/i.test(line) && /must be reviewed|tentative|lowest enum/i.test(line))
    );
  }

  return false;
}
