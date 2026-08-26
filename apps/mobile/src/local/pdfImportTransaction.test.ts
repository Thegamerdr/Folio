import { describe, expect, it } from 'vitest';

import {
  beginPdfImportTransaction,
  classifyPdfImportOutcome,
  createInitialPdfImportTransaction,
  markPdfImportCommitted,
  resetPdfImportTransaction,
  settlePdfImportTransaction,
  type PdfImportTransactionState,
} from './pdfImportTransaction';
import { parseLocalDocumentCandidates } from './localDocumentCandidates';

function begin(state: PdfImportTransactionState) {
  const result = beginPdfImportTransaction(state);
  if (result.attempt === null) throw new Error('Expected an import attempt.');
  return result;
}

describe('PDF import terminal authority', () => {
  it('classifies every terminal parser outcome exactly once', () => {
    expect(classifyPdfImportOutcome({ kind: 'parsed', reviewItemCount: 2 })).toBe(
      'parsed-with-review-items',
    );
    expect(classifyPdfImportOutcome({ kind: 'parsed', reviewItemCount: 0 })).toBe(
      'parsed-no-review-needed',
    );
    expect(classifyPdfImportOutcome({ kind: 'unreadable/manual-fallback' })).toBe(
      'unreadable/manual-fallback',
    );
    expect(classifyPdfImportOutcome({ kind: 'unsupported' })).toBe('unsupported');
    expect(classifyPdfImportOutcome({ kind: 'failed-recoverably' })).toBe('failed-recoverably');
    expect(classifyPdfImportOutcome({ kind: 'cancelled' })).toBe('cancelled');
  });

  it('rejects a duplicate invocation while the first read is in flight', () => {
    const first = begin(createInitialPdfImportTransaction());
    const duplicate = beginPdfImportTransaction(first.state);

    expect(duplicate.attempt).toBeNull();
    expect(duplicate.state).toEqual(first.state);
  });

  it('keeps a successful parsed result when a late empty parser result arrives', () => {
    const first = begin(createInitialPdfImportTransaction());
    const won = settlePdfImportTransaction(first.state, first.attempt!, {
      kind: 'parsed',
      reviewItemCount: 3,
    });
    const late = settlePdfImportTransaction(won.state, first.attempt!, {
      kind: 'parsed',
      reviewItemCount: 0,
    });

    expect(won.settlement).toEqual({ accepted: true, classification: 'parsed-with-review-items' });
    expect(late.settlement).toEqual({ accepted: false, classification: 'parsed-no-review-needed' });
    expect(late.state.terminalClassification).toBe('parsed-with-review-items');
  });

  it('ignores a stale parser result from an older attempt', () => {
    const first = begin(createInitialPdfImportTransaction());
    const oldTerminal = settlePdfImportTransaction(first.state, first.attempt!, {
      kind: 'failed-recoverably',
    }).state;
    // A caller can explicitly start a new intake session after the old one is abandoned.
    const second = begin(resetPdfImportTransaction(oldTerminal));
    const stale = settlePdfImportTransaction(second.state, first.attempt!, {
      kind: 'parsed',
      reviewItemCount: 1,
    });

    expect(stale.settlement.accepted).toBe(false);
    expect(stale.state.phase).toBe('reading');
    expect(stale.state.terminalClassification).toBeUndefined();
  });

  it('records commit without changing the terminal classification', () => {
    const first = begin(createInitialPdfImportTransaction());
    const settled = settlePdfImportTransaction(first.state, first.attempt!, {
      kind: 'parsed',
      reviewItemCount: 1,
    });
    const committed = markPdfImportCommitted(settled.state, first.attempt!);

    expect(committed.committed).toBe(true);
    expect(committed.terminalClassification).toBe('parsed-with-review-items');
    expect(markPdfImportCommitted(committed, first.attempt!)).toBe(committed);
  });

  it('classifies representative PDF-extracted statement text as reviewable without posting it', () => {
    const extracted = parseLocalDocumentCandidates({
      source: 'pdf',
      filename: 'june-statement.pdf',
      text: [
        'FOLIO TEST - CURRENT ACCOUNT',
        '2026-06-25 SALARY ACME LTD 1200.00',
        '2026-06-26 TESCO STORES -42.50',
        '2026-06-27 BRITISH GAS ENERGY -88.00',
      ].join('\n'),
    });

    expect(extracted.candidates).toHaveLength(3);
    expect(extracted.candidates[1]).toMatchObject({ merchant: 'TESCO STORES', amount: -42.5 });
    expect(
      classifyPdfImportOutcome({ kind: 'parsed', reviewItemCount: extracted.candidates.length }),
    ).toBe('parsed-with-review-items');
  });
});
