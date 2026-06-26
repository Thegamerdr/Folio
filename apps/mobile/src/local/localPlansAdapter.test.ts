import { describe, expect, it } from 'vitest';

import {
  addPlannedCommitment,
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  createInitialLocalLedgerState,
  dismissImportDraft,
  stageStatementImport,
} from './localLedger.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { buildLocalPlansModel } from './localPlansAdapter.js';

describe('local canonical plans adapter', () => {
  it('builds repository-backed plan rows from canonical plan objects through the plan engine', () => {
    const ledger = createInitialLocalLedgerState('2026-06-22');
    const plans = buildLocalPlansModel(ledger, buildLocalRouteSummary(ledger), {
      privateExampleMode: true,
    });

    expect(plans.sourceLabel).toBe('Private example');
    expect(plans.contractState).toBe('repository-backed');
    expect(plans.planRows.length).toBeGreaterThan(0);
    expect(plans.planRows.map((row) => row.title)).toEqual(
      expect.arrayContaining(['Protect Food allowance', 'Protect Rent']),
    );
    expect(plans.planRows.every((row) => row.stateLabel === 'active')).toBe(true);
    expect(plans.accessibilitySummary).toContain('plan object');
  });

  it('keeps staged imports as plan review tasks instead of committed plans', () => {
    const ledger = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Cfee,-3.25',
    ).state;
    const plans = buildLocalPlansModel(ledger, buildLocalRouteSummary(ledger));
    const serialized = JSON.stringify(plans);

    expect(plans.planRows).toEqual([]);
    expect(plans.reviewRows).toEqual([
      expect.objectContaining({
        dueDate: '2026-06-22',
        stateLabel: 'open',
        title: 'Review Cfee',
        tone: 'attention',
      }),
    ]);
    expect(serialized).not.toMatch(/\bconfidence\b|confidence_|_confidence|\bscore\b/i);
  });

  it('excludes rejected import evidence from plan impacts and review rows', () => {
    const planned = addPlannedCommitment(
      {
        ...createEmptyLocalLedgerState('2026-06-22'),
        cashOnHandMinor: 20_000,
      },
      {
        amountText: '25.00',
        date: '2026-06-24',
        title: 'Dentist',
      },
    );
    const staged = stageStatementImport(
      planned,
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const rejected = dismissImportDraft(staged, staged.importDrafts[0]?.rowId ?? '', {
      reason: 'duplicate',
    });
    const snapshot = createCanonicalRepositoryForLocalLedgerState(rejected).snapshot();
    const plans = buildLocalPlansModel(rejected, buildLocalRouteSummary(rejected));
    const serializedImpacts = JSON.stringify(snapshot.collections.planImpacts);

    expect(snapshot.collections.importedClaims).toContainEqual(
      expect.objectContaining({
        nonFinancial: true,
        state: 'rejected',
      }),
    );
    expect(snapshot.collections.transactions).toEqual([]);
    expect(snapshot.collections.events.map((event) => event.title)).not.toContain('Coffee');
    expect(snapshot.collections.plannerItems).toEqual([]);
    expect(plans.reviewRows).toEqual([]);
    expect(plans.planRows).toHaveLength(1);
    expect(serializedImpacts).not.toContain('Coffee');
    expect(serializedImpacts).not.toContain('rejected_');
  });

  it('adds a recovery briefing when current commitments push the route below zero', () => {
    const ledger = addPlannedCommitment(
      {
        ...createEmptyLocalLedgerState('2026-06-22'),
        cashOnHandMinor: 5_000,
      },
      {
        amountText: '100.00',
        date: '2026-06-24',
        title: 'Repair',
      },
    );
    const plans = buildLocalPlansModel(ledger, buildLocalRouteSummary(ledger));

    expect(plans.planRows[0]).toMatchObject({
      covered: '\u00a30',
      target: '\u00a3100',
      title: 'Protect Repair',
      impactSummary: expect.stringContaining('current canonical position'),
      protectedLabel: '\u00a3100 remains protected',
      reviewRequired: true,
      tone: 'attention',
    });
    expect(plans.recoveryBriefing).toMatchObject({
      forbiddenFailedVerdictPresent: false,
      title: 'Plan needs review',
    });
    expect(plans.recoveryBriefing?.choices.every((choice) => !choice.writesImmediately)).toBe(true);
  });
});
