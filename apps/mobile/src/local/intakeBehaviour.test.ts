import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  addTransactionFromDocument,
  buildLocalRouteSummary,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  dismissImportDraft,
  editImportDraft,
  removeDocumentStage,
  stageDocumentForManualReview,
  stageStatementImport,
  type LocalImportDraft,
  type LocalLedgerState,
} from './localLedger.js';
import { buildLocalTodayModel } from './localTodayAdapter.js';

const fixtureRoot = fileURLToPath(new URL('../../fixtures/bank-inputs/', import.meta.url).href);

function fixture(name: string): string {
  return readFileSync(`${fixtureRoot}${name}`, 'utf8');
}

const pdfSource = {
  filename: 'June statement.pdf',
  mediaType: 'application/pdf',
  byteSize: 31000,
  storageState: 'copied_to_app_cache' as const,
};

// Promote a waiting draft to a saved transaction the way the user does it: edit it ready, then
// confirm it. A bare confirm on a needs-review draft is a no-op by design (see localLedger).
function reviewAndConfirm(
  state: LocalLedgerState,
  draft: LocalImportDraft,
  edit: { amountText: string; date: string; interpretation: string },
): LocalLedgerState {
  const reviewed = editImportDraft(state, draft.rowId, {
    amountText: edit.amountText,
    date: edit.date,
    interpretation: edit.interpretation,
  });
  return confirmImportDraft(reviewed, draft.rowId);
}

describe('§14 intake behaviour', () => {
  describe('readable text → waiting rows, nothing counted yet', () => {
    it('parses a CSV statement to waiting rows without touching Today or the route', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const beforeRoute = buildLocalRouteSummary(empty);
      const staged = stageStatementImport(empty, fixture('semicolon.csv'), {
        filename: 'semicolon.csv',
        mediaType: 'text/csv',
        byteSize: fixture('semicolon.csv').length,
        storageState: 'copied_to_app_cache',
      }).state;
      const afterRoute = buildLocalRouteSummary(staged);
      const today = buildLocalTodayModel(staged, afterRoute);

      expect(staged.importDrafts.length).toBeGreaterThan(0);
      expect(staged.transactions).toHaveLength(0);
      expect(afterRoute.availableNowMinor).toBe(beforeRoute.availableNowMinor);
      expect(afterRoute.confirmedTransactionCount).toBe(0);
      expect(today.position.actualNetMinor).toBe(0);
      expect(today.reviewCopy).toContain('waiting for review');
    });

    it('parses pasted text to waiting rows without touching Today or the route', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const beforeRoute = buildLocalRouteSummary(empty);
      const staged = stageStatementImport(empty, fixture('pasted-statement.txt'), {
        filename: 'pasted-statement.txt',
        mediaType: 'text/plain',
        byteSize: fixture('pasted-statement.txt').length,
        storageState: 'pasted_text',
      }).state;
      const afterRoute = buildLocalRouteSummary(staged);
      const today = buildLocalTodayModel(staged, afterRoute);

      expect(staged.importDrafts.length).toBeGreaterThan(0);
      expect(staged.transactions).toHaveLength(0);
      expect(afterRoute.availableNowMinor).toBe(beforeRoute.availableNowMinor);
      expect(today.position.actualNetMinor).toBe(0);
      expect(staged.documentStages[0]?.sourceType).toBe('paste');
    });

    it('moves a row into Today only once it is reviewed and confirmed', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const staged = stageStatementImport(empty, fixture('income.csv')).state;
      const draft = staged.importDrafts.find((candidate) =>
        /salary/i.test(candidate.interpretation),
      );
      if (draft === undefined) {
        throw new Error('Expected a salary row from income.csv.');
      }

      // Before confirm: nothing counted.
      expect(buildLocalRouteSummary(staged).confirmedTransactionCount).toBe(0);

      const confirmed = reviewAndConfirm(staged, draft, {
        amountText: '1850.00',
        date: '2026-06-26',
        interpretation: 'Salary - Marlowe Studios',
      });
      const route = buildLocalRouteSummary(confirmed);
      const today = buildLocalTodayModel(confirmed, route);

      expect(confirmed.transactions).toHaveLength(1);
      expect(route.confirmedTransactionCount).toBe(1);
      expect(today.position.actualNetMinor).toBe(185_000);
    });
  });

  describe('unreadable file → document, zero drafts', () => {
    it('stages an unreadable PDF as a document with no drafts and no route change', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const before = buildLocalRouteSummary(empty);
      const { state, documentStage } = stageDocumentForManualReview(empty, pdfSource);
      const after = buildLocalRouteSummary(state);

      expect(state.documentStages).toHaveLength(1);
      expect(documentStage.sourceType).toBe('pdf');
      expect(documentStage.extractionStatus).toBe('unreadable');
      expect(state.importDrafts).toHaveLength(0);
      expect(state.transactions).toHaveLength(0);
      expect(after.availableNowMinor).toBe(before.availableNowMinor);
      expect(after.confirmedTransactionCount).toBe(0);
    });
  });

  describe('manual-from-file (typed off a saved document)', () => {
    it('links the added item to the document and counts it only after the add', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const staged = stageDocumentForManualReview(empty, pdfSource).state;
      const docId = staged.documentStages[0]!.id;

      // Staging the doc alone changes nothing in the money picture.
      expect(buildLocalRouteSummary(staged).confirmedTransactionCount).toBe(0);
      expect(buildLocalTodayModel(staged).position.actualNetMinor).toBe(0);

      const withItem = addTransactionFromDocument(staged, {
        documentId: docId,
        kind: 'bill',
        amountText: '750',
        title: 'Rent',
      });
      const tx = withItem.transactions[0]!;
      const route = buildLocalRouteSummary(withItem);
      const today = buildLocalTodayModel(withItem, route);

      expect(withItem.transactions).toHaveLength(1);
      expect(tx.sourceDocumentId).toBe(docId);
      expect(tx.sourceLabel).toBe('June statement.pdf');
      expect(withItem.documentStages[0]!.linkedTransactionIds).toContain(tx.id);
      expect(route.confirmedTransactionCount).toBe(1);
      expect(today.position.actualNetMinor).toBe(-75_000);
    });

    it('keeps the linked item when the source document is removed', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const staged = stageDocumentForManualReview(empty, pdfSource).state;
      const docId = staged.documentStages[0]!.id;
      const withItem = addTransactionFromDocument(staged, {
        documentId: docId,
        kind: 'income',
        amountText: '1200',
        title: 'Salary',
      });

      const removed = removeDocumentStage(withItem, docId);

      expect(removed.documentStages).toHaveLength(0);
      expect(removed.transactions).toHaveLength(1);
      expect(removed.transactions[0]!.sourceDocumentId).toBe(docId);
      expect(buildLocalRouteSummary(removed).confirmedTransactionCount).toBe(1);
    });

    it('adds money/income as money in and bill/debt as money out', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const staged = stageDocumentForManualReview(empty, pdfSource).state;
      const docId = staged.documentStages[0]!.id;

      const money = addTransactionFromDocument(staged, {
        documentId: docId,
        kind: 'money',
        amountText: '500',
        title: 'Cash found',
      });
      expect(money.transactions[0]!.amountMinor).toBe(50_000);

      const income = addTransactionFromDocument(staged, {
        documentId: docId,
        kind: 'income',
        amountText: '1200',
        title: 'Salary',
      });
      expect(income.transactions[0]!.amountMinor).toBe(120_000);

      const bill = addTransactionFromDocument(staged, {
        documentId: docId,
        kind: 'bill',
        amountText: '90',
        title: 'Energy',
      });
      expect(bill.transactions[0]!.amountMinor).toBe(-9_000);

      const debt = addTransactionFromDocument(staged, {
        documentId: docId,
        kind: 'debt',
        amountText: '100',
        title: 'Card',
      });
      expect(debt.transactions[0]!.amountMinor).toBe(-10_000);
    });

    it('lowers the route only after a bill is added from the file', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const staged = stageDocumentForManualReview(empty, pdfSource).state;
      const docId = staged.documentStages[0]!.id;
      const before = buildLocalRouteSummary(staged);

      const withBill = addTransactionFromDocument(staged, {
        documentId: docId,
        kind: 'bill',
        amountText: '750',
        title: 'Rent',
      });
      const after = buildLocalRouteSummary(withBill);

      expect(before.availableNowMinor).toBe(0);
      expect(after.availableNowMinor).toBe(-75_000);
    });
  });

  describe('ignored / rejected rows do not move the money picture', () => {
    it('dismissing a waiting row leaves Today and the route unchanged', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const staged = stageStatementImport(empty, fixture('income.csv')).state;
      const beforeRoute = buildLocalRouteSummary(staged);
      const target = staged.importDrafts[0];
      if (target === undefined) {
        throw new Error('Expected at least one waiting row from income.csv.');
      }

      const dismissed = dismissImportDraft(staged, target.rowId, { reason: 'not-mine' });
      const afterRoute = buildLocalRouteSummary(dismissed);
      const today = buildLocalTodayModel(dismissed, afterRoute);

      expect(dismissed.rejectedImports).toHaveLength(1);
      expect(dismissed.importDrafts).toHaveLength(staged.importDrafts.length - 1);
      expect(dismissed.transactions).toHaveLength(0);
      expect(afterRoute.confirmedTransactionCount).toBe(0);
      expect(afterRoute.availableNowMinor).toBe(beforeRoute.availableNowMinor);
      expect(today.position.actualNetMinor).toBe(0);
    });
  });

  describe('duplicates and transfers do not distort the picture', () => {
    it('does not double-count when only one of two identical rows is confirmed', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const staged = stageStatementImport(empty, fixture('duplicate-row.csv')).state;
      const energyDrafts = staged.importDrafts.filter((draft) =>
        /brightline energy/i.test(`${draft.original} ${draft.interpretation}`),
      );
      expect(energyDrafts.length).toBeGreaterThanOrEqual(1);

      const first = energyDrafts[0]!;
      const confirmed = reviewAndConfirm(staged, first, {
        amountText: '-72.40',
        date: '2026-06-26',
        interpretation: 'Brightline Energy Direct Debit',
      });
      // Dismiss the duplicate as a duplicate so it is never counted.
      const second = energyDrafts[1];
      const settled =
        second === undefined
          ? confirmed
          : dismissImportDraft(confirmed, second.rowId, { reason: 'duplicate' });
      const route = buildLocalRouteSummary(settled);
      const today = buildLocalTodayModel(settled, route);

      const energyTransactions = settled.transactions.filter((transaction) =>
        /brightline/i.test(transaction.title),
      );
      expect(energyTransactions).toHaveLength(1);
      expect(route.confirmedTransactionCount).toBe(1);
      expect(today.position.actualNetMinor).toBe(-7_240);
    });

    it('treats an internal transfer as neither income nor spending', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const staged = stageStatementImport(empty, fixture('transfer.csv')).state;
      const transferDraft = staged.importDrafts.find((draft) =>
        /transfer/i.test(`${draft.original} ${draft.interpretation}`),
      );
      if (transferDraft === undefined) {
        throw new Error('Expected a transfer row from transfer.csv.');
      }

      const settled = dismissImportDraft(staged, transferDraft.rowId, {
        reason: 'transfer-internal',
      });
      const route = buildLocalRouteSummary(settled);
      const today = buildLocalTodayModel(settled, route);

      expect(settled.rejectedImports.map((row) => row.rejectionReason)).toContain(
        'transfer-internal',
      );
      // A dismissed transfer never became a transaction, so it changes neither side of the picture.
      expect(settled.transactions.some((transaction) => /transfer/i.test(transaction.title))).toBe(
        false,
      );
      expect(route.confirmedTransactionCount).toBe(0);
      expect(today.position.actualNetMinor).toBe(0);
    });
  });

  describe('expected income stays in the future', () => {
    it('does not add future income to money-available-now before its date', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const staged = stageDocumentForManualReview(empty, pdfSource).state;
      const docId = staged.documentStages[0]!.id;

      const withFutureIncome = addTransactionFromDocument(staged, {
        documentId: docId,
        kind: 'income',
        amountText: '1840',
        title: 'Payday',
        date: '2026-07-03',
      });
      const route = buildLocalRouteSummary(withFutureIncome);
      const today = buildLocalTodayModel(withFutureIncome, route);

      expect(withFutureIncome.transactions).toHaveLength(1);
      // The money exists in the route, but not in what is available right now.
      expect(route.availableNowMinor).toBe(0);
      expect(today.position.actualNetMinor).toBe(0);
      expect(today.position.expectedNetMinor).toBe(184_000);
    });
  });

  describe('start fresh', () => {
    it('resets to an empty picture with createEmptyLocalLedgerState', () => {
      const empty = createEmptyLocalLedgerState('2026-06-26');
      const docId = stageDocumentForManualReview(empty, pdfSource).state.documentStages[0]!.id;
      const busy = addTransactionFromDocument(
        stageStatementImport(
          stageDocumentForManualReview(empty, pdfSource).state,
          fixture('income.csv'),
        ).state,
        { documentId: docId, kind: 'bill', amountText: '750', title: 'Rent' },
      );
      expect(
        busy.transactions.length + busy.importDrafts.length + busy.documentStages.length,
      ).toBeGreaterThan(0);

      const fresh = createEmptyLocalLedgerState('2026-06-26');
      const route = buildLocalRouteSummary(fresh);

      expect(fresh.transactions).toHaveLength(0);
      expect(fresh.importDrafts).toHaveLength(0);
      expect(fresh.documentStages).toHaveLength(0);
      expect(fresh.rejectedImports).toHaveLength(0);
      expect(fresh.history).toHaveLength(0);
      expect(route.confirmedTransactionCount).toBe(0);
      expect(route.availableNowMinor).toBe(0);
    });
  });
});
