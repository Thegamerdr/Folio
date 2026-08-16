import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { decisionLedgerStatuses, materialDecisionKinds } from '../packages/domain/src/index.js';

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

describe('Phase D Decision Ledger architecture guards', () => {
  it('has every required Phase D document in the versioned convergence packet', () => {
    const requiredDocs = [
      'MELO_PHASE_D_DECISION_LEDGER_IMPLEMENTATION.md',
      'MELO_DECISION_MATERIALITY_RULES.md',
      'MELO_DECISION_LEDGER_STORAGE.md',
      'MELO_DECISION_OUTCOMES.md',
      'MELO_FORECAST_EVALUATION.md',
      'MELO_DECISION_PRIVACY.md',
      'MELO_DECISION_UI_STATES.md',
      'MELO_PHASE_D_MIGRATION.md',
      'MELO_PHASE_D_EVIDENCE.md',
      'adrs/ADR-012-decision-ledger-command-boundary.md',
      'adrs/ADR-013-decision-ledger-materiality-thresholds.md',
      'adrs/ADR-014-decision-ledger-privacy-and-retention.md',
    ];

    for (const doc of requiredDocs) {
      expect(existsSync(join(repoRoot, 'docs/convergence/2026-07-20', doc)), doc).toBe(true);
    }
  });

  it('keeps the bounded Phase D decision type set in @folio/domain', () => {
    expect(materialDecisionKinds).toEqual([
      'purchase-affordability',
      'recurring-commitment-change',
      'debt-payment',
      'pot-contribution',
      'pot-borrow',
      'spending-hold',
      'recovery-plan',
      'payday-plan',
      'income-assumption',
      'bill-date-change',
      'scenario-choice',
      'manual-financial-adjustment',
      'melo-confirmed-action',
    ]);
    expect(decisionLedgerStatuses).toEqual([
      'draft',
      'presented',
      'chosen',
      'declined',
      'awaiting-outcome',
      'resolved',
      'corrected',
      'cancelled',
      'expired',
      'deleted',
    ]);
  });

  it('keeps app writes behind the canonical Decision Ledger service/store boundary', () => {
    const offenders = collectFiles('apps/mobile/src')
      .filter((file) => !file.includes('.test.'))
      .filter((file) => {
        const rel = relative(repoRoot, file).replaceAll('\\', '/');
        if (rel === 'apps/mobile/src/folio/store.ts') return false;
        if (rel === 'apps/mobile/src/folio/lib/decisionLedger.ts') return false;
        if (rel === 'apps/mobile/src/folio/lib/appStateAuthorityManifest.ts') return false;
        const source = readFileSync(file, 'utf8');
        return /\bdecisionLedger\s*:/.test(source) || /\bDecisionLedgerEntry\s*=\s*/.test(source);
      })
      .map((file) => relative(repoRoot, file).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps Decision Ledger service deterministic and out of semantic AI', () => {
    const service = read('apps/mobile/src/folio/lib/decisionLedger.ts');
    expect(service).toContain('DECISION_LEDGER_MATERIALITY_THRESHOLDS');
    expect(service).toContain('PHASE_D_BUSINESS_LEDGER_ENABLED = false');
    expect(service).not.toMatch(/from ['"]react/);
    expect(service).not.toMatch(/from ['"]react-native/);
    expect(service).not.toMatch(/from ['"]openai/);
    expect(service).not.toMatch(/embedding|vector|semantic|chain of thought/i);
  });

  it('keeps Melo chat from directly writing or silently learning from the ledger', () => {
    const sheet = read('apps/mobile/src/folio/sheets/MeloChatSheet.tsx');
    expect(sheet).not.toContain('decisionLedger');
    expect(sheet).not.toContain('recordMaterialDecision');
  });

  it('declares the normalised storage direction without cutting over SQL authority in Phase D', () => {
    const schema = read('packages/storage/src/canonical-sqlite-schema.ts');
    for (const table of [
      'decision_ledger_entries',
      'decision_ledger_scenarios',
      'decision_ledger_outcomes',
      'decision_ledger_corrections',
      'decision_ledger_audit_events',
      'forecast_evaluations',
    ]) {
      expect(schema).toContain(table);
    }
    expect(read('docs/convergence/2026-07-20/MELO_DECISION_LEDGER_STORAGE.md')).toContain(
      'AppState remains compatibility and rollback authority during Phase D',
    );
  });
});
