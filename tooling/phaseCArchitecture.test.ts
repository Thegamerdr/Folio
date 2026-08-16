import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), 'utf8');
}

describe('Phase C Trusted Safe Range architecture guards', () => {
  it('has every required Phase C document in the versioned convergence packet', () => {
    const requiredDocs = [
      'MELO_PHASE_C_SAFE_RANGE_IMPLEMENTATION.md',
      'MELO_SAFE_RANGE_RULES.md',
      'MELO_SAFE_RANGE_CONFIDENCE.md',
      'MELO_SAFE_RANGE_MIGRATION.md',
      'MELO_SAFE_RANGE_COMPARISON.md',
      'MELO_SAFE_RANGE_UI_STATES.md',
      'MELO_PHASE_C_EVIDENCE.md',
      'adrs/ADR-009-personal-safe-range-adapter.md',
      'adrs/ADR-010-blocked-safe-range-suppresses-range.md',
      'adrs/ADR-011-safe-range-uncertainty-is-explicit.md',
    ];

    for (const doc of requiredDocs) {
      expect(existsSync(join(repoRoot, 'docs/convergence/2026-07-20', doc)), doc).toBe(true);
    }
  });

  it('keeps the Trusted Safe Range adapter pure of React, native runtime and ambient clocks', () => {
    const source = read('apps/mobile/src/folio/lib/trustedSafeRange.ts');
    expect(source).toContain('@folio/domain');
    expect(source).toContain('@folio/finance-engine');
    expect(source).not.toMatch(/from ['"]react/);
    expect(source).not.toMatch(/from ['"]react-native/);
    expect(source).not.toMatch(/from ['"]expo/);
    expect(source).not.toContain('useAppStore');
    expect(source).not.toContain('getState');
    expect(source).not.toMatch(/new Date\(\)/);
    expect(source).not.toMatch(/Date\.now\(/);
  });

  it('keeps Today on the Trusted Safe Range contract instead of local display semantics only', () => {
    const today = read('apps/mobile/src/folio/screens/TodayScreen.tsx');
    expect(today).toContain('buildTrustedSafeRangeFromAppState');
    expect(today).toContain('TrustedSafeRangeCard');
    expect(today).toContain('trustedSafeRangeHeadline');
    expect(today).toContain('trustedSafeRangeSummaryLine');
  });
});
