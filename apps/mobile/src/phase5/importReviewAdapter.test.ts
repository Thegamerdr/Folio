import { describe, expect, it } from 'vitest';

import {
  buildImportReviewRow,
  buildImportReviewShellState,
  buildStatementCopyPlan,
  formatMoney,
  phase5GateMetadata,
  phase5ProofRows,
  phase5SampleReviewProposals,
  statementPathChoices,
} from './importReviewAdapter';

describe('phase 5 import review adapter', () => {
  it('exposes statement choices with CSV/TXT picker ready and OCR later', () => {
    expect(statementPathChoices.map((choice) => choice.id)).toEqual([
      'statement_file',
      'statement_photo_later',
      'manual_three_fact_fallback',
    ]);
    expect(statementPathChoices[0]?.availability).toBe('ready');
    expect(statementPathChoices[0]?.safeCopy).toContain('Android system picker');
    expect(statementPathChoices[1]?.safeCopy).toContain('OCR');
    expect(statementPathChoices[2]?.requiresNativeCapability).toBe(false);
    expect(statementPathChoices.every((choice) => choice.safeCopy.length > 0)).toBe(true);
  });

  it('blocks staging while no file is selected', () => {
    expect(buildStatementCopyPlan(null)).toEqual({
      state: 'blocked',
      sourceName: 'No file selected',
      blocker: {
        kind: 'no_file_selected',
        title: 'No statement selected',
        safeCopy: 'Choose a CSV/TXT file or paste text to stage rows for review.',
      },
    });
  });

  it('uses safe copy for encrypted statements', () => {
    const plan = buildStatementCopyPlan({
      uri: 'file:///statement.pdf',
      name: 'statement.pdf',
      kind: 'pdf',
      encrypted: true,
      providedByNativePicker: true,
    });

    expect(plan.state).toBe('blocked');
    expect(plan).toMatchObject({
      sourceName: 'statement.pdf',
      blocker: {
        kind: 'encrypted_file',
        safeCopy:
          'This file is password protected. Export an unlocked statement from your bank and try again.',
      },
    });
  });

  it('marks supported picker selections as ready for encrypted staging', () => {
    expect(
      buildStatementCopyPlan({
        uri: 'file:///statement.csv',
        name: 'statement.csv',
        kind: 'csv',
        providedByNativePicker: true,
      }),
    ).toEqual({
      state: 'ready_to_stage',
      sourceName: 'statement.csv',
      statementKind: 'csv',
      safeCopy: 'Statement text can be copied into encrypted local staging before review.',
    });
  });

  it('keeps PDF and image import blocked until extraction/OCR exists', () => {
    expect(
      buildStatementCopyPlan({
        uri: 'file:///statement.pdf',
        name: 'statement.pdf',
        kind: 'pdf',
        providedByNativePicker: true,
      }),
    ).toMatchObject({
      state: 'blocked',
      blocker: {
        kind: 'unsupported_statement_type',
        safeCopy:
          'Use a CSV, TSV or plain text statement in this APK. PDF, image and OCR import come later.',
      },
    });
  });

  it('builds screen-reader and large-text friendly row summaries', () => {
    const row = buildImportReviewRow({
      id: 'proposal_1',
      postedOn: '2026-06-18',
      description: 'Coffee shop',
      amountMinor: -425,
      currency: 'gbp',
      accountLabel: 'Current account',
      sourceQuality: 'source-clear',
    });

    expect(row).toMatchObject({
      id: 'proposal_1',
      title: 'Coffee shop',
      amountLabel: '-GBP 4.25',
      dateLabel: '2026-06-18',
      accountLabel: 'Current account',
      state: 'ready',
      badges: ['Looks clear'],
      largeTextSummary: '2026-06-18 | -GBP 4.25 | Coffee shop | ready to add',
    });
    expect(row.screenReaderSummary).toContain('Coffee shop. -GBP 4.25. on 2026-06-18');
  });

  it('promotes source-review duplicates to needs review', () => {
    const row = buildImportReviewRow({
      id: 'proposal_2',
      postedOn: '2026-06-17',
      description: 'Grocer',
      amountMinor: -3210,
      currency: 'GBP',
      sourceQuality: 'needs-review',
      duplicateOfId: 'transaction_existing',
    });

    expect(row.state).toBe('needs_review');
    expect(row.badges).toEqual([
      'Worth a quick look before adding.',
      'Might be a duplicate of one you already have.',
    ]);
    expect(row.screenReaderSummary).toContain('Might be a duplicate of one you already have.');
  });

  it('keeps rows blocked when required fields or source staging are blocked', () => {
    const state = buildImportReviewShellState({
      selection: {
        uri: 'file:///statement.xlsx',
        name: 'statement.xlsx',
        kind: 'unknown',
        providedByNativePicker: true,
      },
      proposals: [
        {
          id: 'proposal_missing',
          description: '',
          currency: 'GBP',
        },
      ],
    });

    expect(state.copyPlan.state).toBe('blocked');
    expect(state.rows[0]).toMatchObject({
      state: 'blocked',
      amountLabel: 'Amount missing',
      dateLabel: 'Date missing',
    });
    expect(state.totals).toEqual({
      totalRows: 1,
      readyRows: 0,
      needsReviewRows: 0,
      blockedRows: 1,
    });
  });

  it('exposes Phase 5 gate metadata for screen integration', () => {
    expect(phase5GateMetadata).toMatchObject({
      phase: 'phase5',
      slice: 'mobile-import-review-adapter',
      screenIntegration: true,
      nativeDependencies: true,
      filePicker: true,
      realPermissions: true,
    });
    expect(phase5GateMetadata.importEngineContract).toContain(
      'accepts reviewable transaction proposals from @folio/import-engine for CSV-like text files',
    );
    expect(phase5ProofRows.map((row) => row.state)).toEqual([
      'implemented',
      'implemented',
      'implemented',
    ]);
  });

  it('formats money with explicit currency codes', () => {
    expect(formatMoney(123456, 'gbp')).toBe('GBP 1,234.56');
    expect(formatMoney(-900, 'eur')).toBe('-EUR 9.00');
  });

  it('keeps sample proposal rows labelled for preview evidence', () => {
    const state = buildImportReviewShellState({
      selection: null,
      proposals: phase5SampleReviewProposals,
    });

    expect(state.rows).toHaveLength(3);
    expect(state.rows.every((row) => row.state === 'blocked')).toBe(true);
    expect(state.rows[1]?.badges).toContain('Might be a duplicate of one you already have.');
  });
});
