import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const evidencePrefix = 'release-blocker-foundation-';

const requiredRootDocuments = [
  'RELEASE_BLOCKER_REGISTER.md',
  'FOLIO_RELEASE_READINESS_MATRIX.md',
  'SECURITY_AND_KEY_PROOF_CHECKLIST.md',
  'PRIVACY_AND_LEGAL_COPY_FOUNDATION.md',
  'ACCESSIBILITY_AUDIT_FOUNDATION.md',
  'STORE_DECLARATION_PREP.md',
];

const requiredEvidenceDocuments = [
  'README.md',
  ...requiredRootDocuments,
  'CI_OUTPUT_SUMMARY.md',
  'KNOWN_LIMITATIONS.md',
];

const requiredReadinessAreas = [
  'Android emulator',
  'Physical Android',
  'iOS simulator',
  'iOS physical device',
  'local-first storage',
  'encryption/key handling',
  'data export',
  'data clear/delete',
  'import/review safety',
  'rejected evidence safety',
  'advice boundary',
  'Melo policy',
  'accessibility',
  'privacy copy',
  'security review',
  'crash/error handling',
  'diagnostics',
  'billing',
  'store declarations',
  'legal disclaimers',
  'release notes',
  'support/contact path',
];

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bghp_[0-9A-Za-z]{20,}\b/,
  /\bgithub_pat_[0-9A-Za-z_]{20,}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
];

const sourceRootsForLogScan = [
  'apps/mobile/src/local',
  'apps/mobile/src/surfaces',
  'packages/storage/src',
];

const issues = [];
const warnings = [];

for (const documentPath of requiredRootDocuments) {
  requireFile(documentPath);
}

const register = readRequired('RELEASE_BLOCKER_REGISTER.md');
const matrix = readRequired('FOLIO_RELEASE_READINESS_MATRIX.md');
const security = readRequired('SECURITY_AND_KEY_PROOF_CHECKLIST.md');
const privacy = readRequired('PRIVACY_AND_LEGAL_COPY_FOUNDATION.md');
const accessibility = readRequired('ACCESSIBILITY_AUDIT_FOUNDATION.md');
const store = readRequired('STORE_DECLARATION_PREP.md');
const packageJson = readRequired('package.json');

requireIncludes('RELEASE_BLOCKER_REGISTER.md', register, [
  '## Owner Dogfood Blockers',
  '## External Beta Blockers',
  '## Public Release Blockers',
  'Windows?',
  'Android device?',
  'macOS/Xcode?',
  'Legal/business?',
  'not blocked by public-release gates',
]);
requireIncludes('FOLIO_RELEASE_READINESS_MATRIX.md', matrix, [
  'Owner dogfood required?',
  'External beta required?',
  'Public release required?',
  ...requiredReadinessAreas,
]);
requireIncludes('SECURITY_AND_KEY_PROOF_CHECKLIST.md', security, [
  'nativeLocalSecurity.ts',
  'SQLCipher',
  'expo-secure-store',
  'not a claim that security is complete',
  'No obvious upload path',
  'Diagnostic export redaction',
  'Sample/dogfood data synthetic marking',
]);
requireIncludes('PRIVACY_AND_LEGAL_COPY_FOUNDATION.md', privacy, [
  'not legal advice',
  'Folio is not financial advice',
  'Folio does not make decisions for the user',
  'Local data stays local unless the user chooses otherwise',
  'Imports are reviewed before becoming financial reality',
  'Rejected evidence does not affect financial reality',
]);
requireIncludes('ACCESSIBILITY_AUDIT_FOUNDATION.md', accessibility, [
  'not a claim of full accessibility compliance',
  'TalkBack',
  'VoiceOver',
  'large text',
  'Important buttons have accessible labels',
  'Clear/reset/export actions use clear wording',
]);
requireIncludes('STORE_DECLARATION_PREP.md', store, [
  'ready',
  'not ready',
  'not applicable yet',
  'decision needed',
  'requires legal review',
  'Do not submit',
]);
requireIncludes('package.json', packageJson, [
  'check:release-foundation',
  'check:release-blockers && pnpm check:release-foundation',
]);

for (const forbiddenClaim of [
  /^\s*public release:\s*ready\s*$/im,
  /^\s*ready for public release:\s*true\s*$/im,
  /^\s*status:\s*public-release-ready\s*$/im,
]) {
  for (const documentPath of requiredRootDocuments) {
    const text = readRequired(documentPath);
    if (forbiddenClaim.test(text)) {
      issues.push(`${documentPath} appears to claim public release readiness.`);
    }
  }
}

const evidenceFolder = findLatestEvidenceFolder();
if (evidenceFolder === undefined) {
  issues.push(`apps/mobile/evidence/${evidencePrefix}YYYY-MM-DD folder is missing.`);
} else {
  for (const evidenceFile of requiredEvidenceDocuments) {
    requireFile(path.join(evidenceFolder, evidenceFile));
  }
}

const dogfoodSource = readRequired('apps/mobile/src/local/dogfoodMode.ts');
const dogfoodTest = readRequired('apps/mobile/src/local/dogfoodMode.test.ts');
const nativeDiagnosticSource = readRequired(
  'apps/mobile/src/local/nativeDogfoodDiagnosticExport.ts',
);
const nativeSecuritySource = readRequired('apps/mobile/src/local/nativeLocalSecurity.ts');

requireIncludes('apps/mobile/src/local/dogfoodMode.ts', dogfoodSource, [
  'uploadAllowed: false',
  'syntheticSeedsOnly: true',
  'rawFinancialRowsIncluded: false',
  'rawSourceTextIncluded: false',
]);
requireIncludes('apps/mobile/src/local/dogfoodMode.test.ts', dogfoodTest, [
  'does not add an upload path',
  'exports redacted diagnostics by default',
  'synthetic',
]);
requireIncludes('apps/mobile/src/local/nativeDogfoodDiagnosticExport.ts', nativeDiagnosticSource, [
  'FileSystem.writeAsStringAsync',
]);
requireIncludes('apps/mobile/src/local/nativeLocalSecurity.ts', nativeSecuritySource, [
  'SecureStore',
  'Crypto.getRandomBytesAsync',
]);

scanForObviousSecrets([
  'apps/mobile/src/local/dogfoodMode.ts',
  'apps/mobile/src/local/nativeDogfoodDiagnosticExport.ts',
  'apps/mobile/src/local/nativeLocalSecurity.ts',
  'apps/mobile/app.config.ts',
  'package.json',
  'apps/mobile/package.json',
]);
scanForRuntimeLogging(sourceRootsForLogScan);

if (issues.length > 0) {
  console.error('Release foundation gate: FAILED');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Release foundation gate: OK');
  console.log(`Root documents: ${requiredRootDocuments.length}`);
  console.log(`Evidence folder: ${evidenceFolder}`);
  console.log(
    'Dogfood blockers, beta blockers and public release blockers are documented separately.',
  );
  console.log(
    'Public-release blockers remain visible but do not mark owner dogfood as public-ready.',
  );
  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.length}`);
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    issues.push(`${relativePath} is missing.`);
  }
}

function readRequired(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return '';
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireIncludes(relativePath, text, expectedFragments) {
  for (const fragment of expectedFragments) {
    if (!text.includes(fragment)) {
      issues.push(`${relativePath} is missing required content: ${fragment}`);
    }
  }
}

function findLatestEvidenceFolder() {
  const evidenceRoot = path.join(root, 'apps', 'mobile', 'evidence');
  if (!fs.existsSync(evidenceRoot)) return undefined;
  const folder = fs
    .readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('apps', 'mobile', 'evidence', entry.name))
    .filter((relativePath) => path.basename(relativePath).startsWith(evidencePrefix))
    .sort()
    .at(-1);

  return folder;
}

function scanForObviousSecrets(relativePaths) {
  for (const relativePath of relativePaths) {
    const text = readRequired(relativePath);
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) {
        issues.push(`${relativePath} appears to contain an obvious secret pattern: ${pattern}`);
      }
    }
  }
}

function scanForRuntimeLogging(relativeRoots) {
  for (const relativeRoot of relativeRoots) {
    const absoluteRoot = path.join(root, relativeRoot);
    if (!fs.existsSync(absoluteRoot)) {
      warnings.push(`Log scan skipped missing path: ${relativeRoot}`);
      continue;
    }

    for (const filePath of walk(absoluteRoot)) {
      if (!/\.[cm]?tsx?$/.test(filePath)) continue;
      const text = fs.readFileSync(filePath, 'utf8');
      if (/\bconsole\.(?:debug|error|info|log|warn)\s*\(/.test(text)) {
        issues.push(`${path.relative(root, filePath)} contains runtime console logging.`);
      }
    }
  }
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolutePath);
    return [absolutePath];
  });
}
