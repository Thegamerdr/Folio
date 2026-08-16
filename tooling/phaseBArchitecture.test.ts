import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  trustedCoreResponsibilities,
  trustedCoreResponsibilityOwners,
} from '../packages/domain/src/index.js';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), 'utf8');
}

function collectFiles(rootRel: string): readonly string[] {
  const root = join(repoRoot, rootRel);
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        visit(path);
      } else if (/\.[cm]?[tj]sx?$/.test(entry)) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}

describe('Phase B architecture convergence guards', () => {
  it('has every required Phase B document in the versioned convergence packet', () => {
    const requiredDocs = [
      'MELO_ARCHITECTURE_AUTHORITY.md',
      'MELO_INFORMATION_ARCHITECTURE.md',
      'MELO_SCREEN_DISPOSITION.md',
      'MELO_DATA_MIGRATION_PLAN.md',
      'MELO_ENGINE_CONVERGENCE_PLAN.md',
      'MELO_NAVIGATION_TRANSITION.md',
      'MELO_PHASE_B_DECISIONS.md',
      'MELO_CONVERGENCE_DECISIONS.md',
    ];

    for (const doc of requiredDocs) {
      expect(existsSync(join(repoRoot, 'docs/convergence/2026-07-20', doc)), doc).toBe(true);
    }
  });

  it('keeps Trusted Core responsibility ownership executable, not only written in docs', () => {
    expect(Object.keys(trustedCoreResponsibilityOwners).sort()).toEqual(
      [...trustedCoreResponsibilities].sort(),
    );
    expect(trustedCoreResponsibilityOwners['safe-range-result']).toMatchObject({
      canonicalOwner: '@folio/domain',
      migrationPhase: 'phase_c',
      userVisibleBehaviourChangesInPhaseB: false,
    });
    expect(trustedCoreResponsibilityOwners['decision-ledger']).toMatchObject({
      canonicalOwner: '@folio/domain',
      migrationPhase: 'phase_d',
      userVisibleBehaviourChangesInPhaseB: false,
    });
  });

  it('marks legacy Safe Zone engines as compatibility inputs, not new product authority', () => {
    expect(read('apps/mobile/src/folio/lib/modes/safeZone.ts')).toContain(
      '@deprecated Trusted Core Phase B',
    );
    expect(read('packages/melo-engine/src/safeZone.ts')).toContain(
      '@deprecated Trusted Core Phase B',
    );
  });

  it('prevents app-local redefinition of canonical Trusted Safe Range and Decision Ledger types', () => {
    const offenders = collectFiles('apps/mobile/src')
      .filter((file) => !file.includes('.test.'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return (
          /\btype\s+(TrustedSafeRange|TrustedSafeRangeResult)\s*=/.test(source) ||
          /\binterface\s+(TrustedSafeRange|TrustedSafeRangeResult)\s*[<{]/.test(source) ||
          /\btype\s+(DecisionLedger|DecisionLedgerRecord)\s*=/.test(source) ||
          /\binterface\s+(DecisionLedger|DecisionLedgerRecord)\s*[<{]/.test(source)
        );
      })
      .map((file) => relative(repoRoot, file).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps the domain Trusted Core contract pure of app, native, provider and AI runtimes', () => {
    const source = read('packages/domain/src/trustedCore.ts');
    expect(source).not.toMatch(/from ['"]react/);
    expect(source).not.toMatch(/from ['"]react-native/);
    expect(source).not.toMatch(/from ['"]expo/);
    expect(source).not.toMatch(/from ['"]openai/);
    expect(source).not.toMatch(/from ['"]anthropic/);
    expect(source).not.toMatch(/from ['"].*apps\//);
    expect(source).not.toMatch(/from ['"].*services\//);
  });
});
