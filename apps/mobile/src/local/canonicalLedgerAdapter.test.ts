import { describe, expect, it } from 'vitest';

import {
  addManualTransaction,
  addPlannedCommitment,
  addRecoverySpend,
  applyMeloImportSuggestion,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  createInitialLocalLedgerState,
  dismissImportDraft,
  editImportDraft,
  stageStatementImport,
} from './localLedger.js';
import {
  canonicalMobileLedgerRowCount,
  canonicalMobileLedgerSchema,
  createCanonicalMobileLedgerSnapshot,
} from './canonicalLedgerAdapter.js';

describe('canonical mobile ledger adapter', () => {
  it('projects the local shell into canonical personal workspace objects', () => {
    const snapshot = createCanonicalMobileLedgerSnapshot(
      createInitialLocalLedgerState('2026-06-22'),
    );

    expect(snapshot.schema).toBe(canonicalMobileLedgerSchema);
    expect(snapshot.validation).toEqual({ valid: true, issues: [] });
    expect(snapshot.workspace.kind).toBe('personal');
    expect(snapshot.accounts).toHaveLength(1);
    expect(snapshot.sourceRecords.length).toBeGreaterThanOrEqual(
      snapshot.transactions.length + snapshot.importDrafts.length,
    );
    expect(snapshot.provenance.length).toBeGreaterThanOrEqual(snapshot.sourceRecords.length);
    expect(snapshot.importDrafts).toHaveLength(2);
    expect(
      snapshot.importDrafts.every((draft) => draft.userConfirmationState === 'requested'),
    ).toBe(true);
    expect(snapshot.importDrafts.every((draft) => draft.reviewState === 'needs-review')).toBe(true);
    expect(canonicalMobileLedgerRowCount(snapshot, 'importDrafts')).toBe(2);
  });

  it('keeps future assumptions out of transaction facts', () => {
    const state = addPlannedCommitment(createEmptyLocalLedgerState('2026-06-22'), {
      amountText: '25.00',
      date: '2026-06-24',
      title: 'Dentist',
    });
    const snapshot = createCanonicalMobileLedgerSnapshot(state);

    expect(snapshot.validation.valid).toBe(true);
    expect(snapshot.transactions).toEqual([]);
    expect(snapshot.expectations).toHaveLength(1);
    expect(snapshot.commitments).toHaveLength(1);
    expect(snapshot.plans).toEqual([
      expect.objectContaining({
        commitmentIds: [snapshot.commitments[0]?.id],
        status: 'active',
        title: 'Protect Dentist',
      }),
    ]);
    expect(snapshot.forecastSnapshots).toHaveLength(1);
    expect(snapshot.calendarItems.map((item) => item.title)).toContain('Dentist');
    expect(snapshot.timelineEntries).toEqual([
      expect.objectContaining({
        authorityState: 'user-confirmed',
        kind: 'expectation',
        title: 'Dentist',
      }),
    ]);
  });

  it('keeps same-day user records as facts with source record and provenance links', () => {
    const state = addManualTransaction(createEmptyLocalLedgerState('2026-06-22'), {
      amountText: '8.50',
      kind: 'spend',
      title: 'Lunch',
    });
    const snapshot = createCanonicalMobileLedgerSnapshot(state);
    const transaction = snapshot.transactions[0];

    expect(snapshot.validation.valid).toBe(true);
    expect(transaction).toMatchObject({
      authorityState: 'user-confirmed',
      description: 'Lunch',
      localDate: '2026-06-22',
      reviewStatus: 'accepted',
      sourceKind: 'manual',
      status: 'posted',
    });
    expect(transaction?.sourceRecordId).toBeDefined();
    expect(transaction?.provenanceId).toBeDefined();
    expect(snapshot.events[0]).toMatchObject({
      authorityState: 'user-confirmed',
      kind: 'payment',
      title: 'Lunch',
      transactionIds: [transaction?.id],
    });
    expect(snapshot.timelineEntries[0]).toMatchObject({
      kind: 'fact',
      subjectId: transaction?.id,
    });
  });

  it('models import review as source records, import drafts and planner work before commit', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Cfee,-3.25',
    ).state;
    const snapshot = createCanonicalMobileLedgerSnapshot(staged);
    const draft = snapshot.importDrafts[0];

    expect(snapshot.validation.valid).toBe(true);
    expect(snapshot.transactions).toEqual([]);
    expect(snapshot.parsedRows).toHaveLength(1);
    expect(snapshot.importedClaims).toHaveLength(1);
    expect(snapshot.importedClaims[0]).toMatchObject({
      originalText: '2026-06-22 / Cfee / -3.25',
      state: 'needs-review',
      sourceQuality: 'needs-review',
    });
    expect(draft).toMatchObject({
      authorityState: 'estimated',
      reviewState: 'needs-review',
      userConfirmationState: 'requested',
    });
    expect(draft?.parsedRowId).toBe(snapshot.parsedRows[0]?.id);
    expect(draft?.importedClaimId).toBe(snapshot.importedClaims[0]?.id);
    expect(draft?.parserIssues.length).toBeGreaterThan(0);
    expect(snapshot.plannerItems[0]).toMatchObject({
      kind: 'review',
      status: 'open',
    });
  });

  it('records explicit import corrections as decisions without using score language', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-21,Cfee,-3.25',
    ).state;
    const edited = editImportDraft(staged, staged.importDrafts[0]?.rowId ?? '', {
      amountText: '-4.50',
      date: '2026-06-22',
      interpretation: 'Coffee corrected',
    });
    const snapshot = createCanonicalMobileLedgerSnapshot(edited);
    const serializedRows = JSON.stringify(snapshot.rows);

    expect(snapshot.validation.valid).toBe(true);
    expect(snapshot.decisionRecords).toContainEqual(
      expect.objectContaining({
        actor: 'user',
        kind: 'correct-record',
      }),
    );
    expect(snapshot.userCorrections).toContainEqual(
      expect.objectContaining({
        kind: 'import-row-edit',
        reviewState: 'user-confirmed',
      }),
    );
    expect(serializedRows).not.toMatch(/\bconfidence\b|confidence_|_confidence|\bscore\b/i);
  });

  it('keeps accepted imports as facts while preserving parsed claim evidence', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const edited = editImportDraft(staged, staged.importDrafts[0]?.rowId ?? '', {
      amountText: '-3.25',
      date: '2026-06-22',
      interpretation: 'Coffee',
    });
    const confirmed = confirmImportDraft(edited, edited.importDrafts[0]?.rowId ?? '');
    const snapshot = createCanonicalMobileLedgerSnapshot(confirmed);

    expect(snapshot.validation.valid).toBe(true);
    expect(snapshot.importDrafts).toEqual([]);
    expect(snapshot.transactions).toHaveLength(1);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.importedClaims).toEqual([
      expect.objectContaining({
        acceptedTransactionId: snapshot.transactions[0]?.id,
        eventId: snapshot.events[0]?.id,
        originalText: '2026-06-22 / Coffee / -3.25',
        reviewState: 'user-confirmed',
        state: 'accepted',
        userConfirmationState: 'confirmed',
      }),
    ]);
    expect(snapshot.decisionRecords).toContainEqual(
      expect.objectContaining({
        actor: 'user',
        kind: 'confirm-import',
      }),
    );
    expect(snapshot.auditLog).toContainEqual(
      expect.objectContaining({
        action: 'import_confirmed',
        actor: 'import',
      }),
    );
  });

  it('keeps rejected imports as non-financial evidence without creating reality', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const rejected = dismissImportDraft(staged, staged.importDrafts[0]?.rowId ?? '', {
      reason: 'duplicate',
    });
    const snapshot = createCanonicalMobileLedgerSnapshot(rejected);

    expect(snapshot.validation.valid).toBe(true);
    expect(snapshot.transactions).toEqual([]);
    expect(snapshot.events).toEqual([]);
    expect(snapshot.plans).toEqual([]);
    expect(snapshot.commitments).toEqual([]);
    expect(snapshot.expectations).toEqual([]);
    expect(snapshot.plannerItems).toEqual([]);
    expect(snapshot.importDrafts).toEqual([
      expect.objectContaining({
        nonFinancial: true,
        rejectionReason: 'duplicate',
        reviewState: 'dismissed',
        userConfirmationState: 'rejected',
      }),
    ]);
    expect(snapshot.sourceRecords).toContainEqual(
      expect.objectContaining({
        nonFinancial: true,
        rejectionReason: 'duplicate',
        reviewState: 'dismissed',
      }),
    );
    expect(snapshot.parsedRows).toEqual([
      expect.objectContaining({
        nonFinancial: true,
        rejectionReason: 'duplicate',
        reviewState: 'dismissed',
      }),
    ]);
    expect(snapshot.importedClaims).toEqual([
      expect.objectContaining({
        nonFinancial: true,
        rejectionReason: 'duplicate',
        reviewState: 'dismissed',
        state: 'rejected',
        userConfirmationState: 'rejected',
      }),
    ]);
    expect(snapshot.decisionRecords).toContainEqual(
      expect.objectContaining({
        actor: 'user',
        kind: 'dismiss-proposal',
      }),
    );
    expect(snapshot.auditLog).toContainEqual(
      expect.objectContaining({
        action: 'import_dismissed',
        actor: 'import',
      }),
    );
    expect(JSON.stringify(snapshot.rows)).not.toMatch(
      /\bconfidence\b|confidence_|_confidence|\bscore\b/i,
    );
  });

  it('persists staged documents as source-linked attachments', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
      {
        byteSize: 64,
        filename: 'statement.csv',
        mediaType: 'text/csv',
        storageState: 'pasted_text',
      },
    ).state;
    const snapshot = createCanonicalMobileLedgerSnapshot(staged);

    expect(snapshot.validation.valid).toBe(true);
    expect(snapshot.documents).toEqual([
      expect.objectContaining({
        filename: 'statement.csv',
        reviewState: 'needs-review',
        sourceRecordId: expect.any(String),
      }),
    ]);
    expect(snapshot.documentAttachments).toEqual([
      expect.objectContaining({
        documentId: snapshot.documents[0]?.id,
        targetKind: 'source-record',
        targetId: snapshot.documents[0]?.sourceRecordId,
      }),
    ]);
  });

  it('records accepted recovery previews as decision and audit rows', () => {
    const recovered = addRecoverySpend(createEmptyLocalLedgerState('2026-06-22'), {
      amountText: '80.00',
      kind: 'spend',
      title: 'Repair',
    });
    const snapshot = createCanonicalMobileLedgerSnapshot(recovered);

    expect(snapshot.validation.valid).toBe(true);
    expect(snapshot.decisionRecords).toContainEqual(
      expect.objectContaining({
        actor: 'user',
        kind: 'accept-scenario',
        summary: 'Repair recorded from recovery preview. Route rebuilt from confirmed records.',
      }),
    );
    expect(snapshot.auditLog).toContainEqual(
      expect.objectContaining({
        action: 'recovery_recorded',
        actor: 'user',
        reversible: true,
      }),
    );
    expect(snapshot.timelineEntries).toContainEqual(
      expect.objectContaining({
        kind: 'decision',
        title: 'Repair recorded from recovery preview. Route rebuilt from confirmed records.',
      }),
    );
    expect(snapshot.scenarios).toContainEqual(
      expect.objectContaining({
        status: 'accepted',
        title: 'Repair recorded from recovery preview. Route rebuilt from confirmed records.',
      }),
    );
  });

  it('models Melo suggestions as reviewable memory and proposal objects', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Cfee,-3.25',
    ).state;
    const suggested = applyMeloImportSuggestion(staged, staged.importDrafts[0]?.rowId ?? '');
    const snapshot = createCanonicalMobileLedgerSnapshot(suggested);

    expect(snapshot.validation.valid).toBe(true);
    expect(snapshot.meloProposals).toEqual([
      expect.objectContaining({
        authorityState: 'inferred',
        canWriteDirectly: false,
        proposedCommand: 'ClassifyTransaction',
        status: 'needs-review',
      }),
    ]);
    expect(snapshot.meloMemories).toEqual([
      expect.objectContaining({
        authorityState: 'inferred',
        reviewState: 'needs-review',
        value: expect.stringContaining('Confirm before saving.'),
      }),
    ]);
    expect(snapshot.rows.meloProposals[0]).toMatchObject({
      can_write_directly: 0,
      status: 'needs-review',
    });
  });
});
