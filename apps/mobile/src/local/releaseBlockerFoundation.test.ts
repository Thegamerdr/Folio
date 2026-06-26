import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url).href);

function read(relativePath: string): string {
  return readFileSync(`${repoRoot}${relativePath}`, 'utf8');
}

describe('release blocker foundation evidence', () => {
  it('ships the required root documents and dated evidence pack', () => {
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

    for (const documentPath of requiredRootDocuments) {
      expect(read(documentPath).length).toBeGreaterThan(200);
    }
    for (const documentPath of requiredEvidenceDocuments) {
      expect(
        read(`apps/mobile/evidence/release-blocker-foundation-2026-06-23/${documentPath}`).length,
      ).toBeGreaterThan(80);
    }
  });

  it('keeps owner dogfood separate from beta and public-release blockers', () => {
    const register = read('RELEASE_BLOCKER_REGISTER.md');
    const matrix = read('FOLIO_RELEASE_READINESS_MATRIX.md');
    const packageJson = read('package.json');

    expect(register).toContain('## Owner Dogfood Blockers');
    expect(register).toContain('## External Beta Blockers');
    expect(register).toContain('## Public Release Blockers');
    expect(register).toContain('not blocked by public-release gates');
    expect(matrix).toContain('Owner dogfood required?');
    expect(matrix).toContain('External beta required?');
    expect(matrix).toContain('Public release required?');
    expect(packageJson).toContain('check:release-foundation');
    expect(packageJson).toContain('check:release-blockers && pnpm check:release-foundation');
  });

  it('documents practical security, privacy, accessibility and store checks without overclaiming', () => {
    const security = read('SECURITY_AND_KEY_PROOF_CHECKLIST.md');
    const privacy = read('PRIVACY_AND_LEGAL_COPY_FOUNDATION.md');
    const accessibility = read('ACCESSIBILITY_AUDIT_FOUNDATION.md');
    const store = read('STORE_DECLARATION_PREP.md');

    expect(security).toContain('not a claim that security is complete');
    expect(security).toContain('No obvious upload path');
    expect(security).toContain('Diagnostic export redaction');
    expect(privacy).toContain('This is not legal advice');
    expect(privacy).toContain('Folio is not financial advice');
    expect(accessibility).toContain('not a claim of full accessibility compliance');
    expect(accessibility).toContain('TalkBack');
    expect(accessibility).toContain('VoiceOver');
    expect(store).toContain('Do not submit');
    expect(store).toContain('requires legal review');
  });

  it('keeps dogfood diagnostics local, redacted and synthetic-only by static source check', () => {
    const dogfood = read('apps/mobile/src/local/dogfoodMode.ts');
    const diagnostic = read('apps/mobile/src/local/nativeDogfoodDiagnosticExport.ts');
    const dogfoodTest = read('apps/mobile/src/local/dogfoodMode.test.ts');
    const sources = `${dogfood}\n${diagnostic}`;

    expect(dogfood).toContain('uploadAllowed: false');
    expect(dogfood).toContain('syntheticSeedsOnly: true');
    expect(dogfood).toContain('rawFinancialRowsIncluded: false');
    expect(dogfood).toContain('rawSourceTextIncluded: false');
    expect(diagnostic).toContain('FileSystem.writeAsStringAsync');
    expect(sources).not.toMatch(/\b(fetch|XMLHttpRequest|axios|uploadAsync|FormData)\b/);
    expect(dogfoodTest).toContain('exports redacted diagnostics by default');
    expect(dogfoodTest).toContain('does not add an upload path');
  });
});
