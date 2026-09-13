import { describe, expect, it } from 'vitest';

import { readTextImport } from './textImportCandidates';
import { insertClipboardAtSelection, resolvePasteBackAction } from './pasteInputState';
import {
  beginPdfImportTransaction,
  createInitialPdfImportTransaction,
  settlePdfImportTransaction,
} from './pdfImportTransaction';

describe('paste editor input flow', () => {
  it('dismisses the keyboard before applying the draft Back contract', () => {
    expect(resolvePasteBackAction({ draftNonEmpty: true, keyboardVisible: true })).toBe('dismiss-keyboard');
    expect(resolvePasteBackAction({ draftNonEmpty: false, keyboardVisible: false })).toBe('go-to-intake');
    expect(resolvePasteBackAction({ draftNonEmpty: true, keyboardVisible: false })).toBe('confirm-discard');
  });

  it('inserts clipboard text at the current selection and leaves the caret after it', () => {
    expect(insertClipboardAtSelection('date,merchant,amount', '2026-09-01,Shop,-4', { start: 0, end: 0 })).toEqual({
      text: '2026-09-01,Shop,-4date,merchant,amount',
      selection: { start: 18, end: 18 },
    });
    expect(insertClipboardAtSelection('alpha omega', 'middle', { start: 6, end: 11 })).toEqual({
      text: 'alpha middle',
      selection: { start: 12, end: 12 },
    });
  });

  it('keeps a malformed preview recoverable so a corrected retry can produce candidates', () => {
    const failed = readTextImport('not a transaction', 'paste', 'pasted transactions');
    expect(failed.candidates).toHaveLength(0);
    expect(failed.issues.length).toBeGreaterThan(0);

    const retried = readTextImport('2026-09-01,Shop,-4.20', 'paste', 'pasted transactions');
    expect(retried.candidates).toHaveLength(1);
    expect(retried.candidates[0]).toMatchObject({ merchant: 'Shop', amount: -4.2 });
  });

  it('rejects a late reader result after cancellation', () => {
    const begun = beginPdfImportTransaction(createInitialPdfImportTransaction());
    const cancelled = settlePdfImportTransaction(begun.state, begun.attempt!, { kind: 'cancelled' });
    const late = settlePdfImportTransaction(cancelled.state, begun.attempt!, {
      kind: 'parsed',
      reviewItemCount: 1,
    });
    expect(cancelled.settlement.accepted).toBe(true);
    expect(cancelled.settlement.classification).toBe('cancelled');
    expect(late.settlement.accepted).toBe(false);
    expect(late.state.terminalClassification).toBe('cancelled');
  });
});
