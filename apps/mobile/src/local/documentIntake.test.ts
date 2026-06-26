import { describe, expect, it } from 'vitest';

import {
  addTransactionFromDocument,
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  removeDocumentStage,
  stageDocumentForManualReview,
} from './localLedger.js';

const pdfSource = {
  filename: 'June statement.pdf',
  mediaType: 'application/pdf',
  byteSize: 24000,
  storageState: 'copied_to_app_cache' as const,
};

describe('manual-from-file intake (owner real-file path)', () => {
  it('saves an unreadable file without changing the money picture', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const before = buildLocalRouteSummary(empty);
    const { state, documentStage } = stageDocumentForManualReview(empty, pdfSource);
    const after = buildLocalRouteSummary(state);

    expect(state.documentStages).toHaveLength(1);
    expect(documentStage.sourceType).toBe('pdf');
    expect(documentStage.extractionStatus).toBe('unreadable');
    expect(state.transactions).toHaveLength(0);
    expect(after.availableNowMinor).toBe(before.availableNowMinor);
    expect(after.confirmedTransactionCount).toBe(0);
  });

  it('adds a linked item only when the user adds it; the link survives file removal', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const staged = stageDocumentForManualReview(empty, pdfSource).state;
    const docId = staged.documentStages[0]!.id;

    const withItem = addTransactionFromDocument(staged, {
      documentId: docId,
      kind: 'bill',
      amountText: '750',
      title: 'Rent',
    });
    const route = buildLocalRouteSummary(withItem);
    const tx = withItem.transactions[0]!;

    expect(withItem.transactions).toHaveLength(1);
    expect(tx.amountMinor).toBe(-75000);
    expect(tx.sourceDocumentId).toBe(docId);
    expect(tx.sourceLabel).toBe('June statement.pdf');
    expect(withItem.documentStages[0]!.linkedTransactionIds).toContain(tx.id);
    expect(route.confirmedTransactionCount).toBe(1);

    // Removing the file keeps the added item; it just no longer points at a present file.
    const removed = removeDocumentStage(withItem, docId);
    expect(removed.documentStages).toHaveLength(0);
    expect(removed.transactions).toHaveLength(1);
    expect(removed.transactions[0]!.sourceDocumentId).toBe(docId);
    expect(buildLocalRouteSummary(removed).confirmedTransactionCount).toBe(1);
  });

  it('money/income add as money in; bill/debt as money out', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const staged = stageDocumentForManualReview(empty, pdfSource).state;
    const docId = staged.documentStages[0]!.id;

    const income = addTransactionFromDocument(staged, {
      documentId: docId,
      kind: 'income',
      amountText: '1200',
      title: 'Salary',
    });
    expect(income.transactions[0]!.amountMinor).toBe(120000);

    const debt = addTransactionFromDocument(staged, {
      documentId: docId,
      kind: 'debt',
      amountText: '100',
      title: 'Card',
    });
    expect(debt.transactions[0]!.amountMinor).toBe(-10000);
  });
});
