// Native statement-reading layer guards.
//
// The on-device reader (modules/folio-reader: ML Kit OCR for images, PdfRenderer + ML Kit for PDFs)
// is a native module, so we pin its wiring at the source (it cannot be imported into the node test
// runner) and prove the BEHAVIOUR that matters with the pure engine: free-text statement lines — the
// shape OCR / PDF extraction produces — parse into found items that wait for review and never move
// Today until the user adds them.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildLocalRouteSummary,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  editImportDraft,
  stageStatementImport,
} from './localLedger.js';

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8');
}

const DAY = '2026-06-24';

// What ML Kit / PdfRenderer hands back for a typical bank statement: free-text lines with a date,
// a description, and a signed amount (no CSV commas).
const EXTRACTED_STATEMENT_TEXT = [
  'FOLIO TEST - CURRENT ACCOUNT',
  '2026-06-25  SALARY ACME LTD  1200.00',
  '2026-06-26  TESCO STORES  -42.50',
  '2026-06-27  BRITISH GAS ENERGY  -88.00',
  '2026-07-01  RENT NORTHGATE  -750.00',
].join('\n');

describe('native reading — real-world statement formats parse', () => {
  const stage = (text: string) =>
    stageStatementImport(createEmptyLocalLedgerState(DAY), text, {
      byteSize: text.length,
      filename: 'x.pdf',
      mediaType: 'application/pdf',
      storageState: 'copied_to_app_cache',
    }).state;

  it('reads month-name dates ("25 Jun 2026"), normalising to a real date', () => {
    const s = stage('25 Jun 2026 TESCO STORES 42.50\n26 Jun 2026 SALARY ACME 1200.00');
    expect(s.importDrafts.length).toBe(2);
    // The month-name date is normalised so the engine gets a real date, not a label.
    expect(s.importDrafts[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reads a line with a reference number and a comma-grouped running-balance column', () => {
    // A bare reference ("99") must not be mistaken for the amount, and the comma in "1,157.50" is a
    // thousands separator, not a CSV delimiter.
    const s = stage('25 Jun 2026 DEBIT CARD TESCO 99 42.50 1,157.50');
    expect(s.importDrafts.length).toBe(1);
    expect(Math.abs(s.importDrafts[0]!.amountMinor)).toBe(4250);
  });
});

describe('native reading — extracted statement text becomes found items', () => {
  it('OCR/PDF-style free text parses into items that wait for review', () => {
    const empty = createEmptyLocalLedgerState(DAY);
    const before = buildLocalRouteSummary(empty);

    const staged = stageStatementImport(empty, EXTRACTED_STATEMENT_TEXT, {
      byteSize: EXTRACTED_STATEMENT_TEXT.length,
      filename: 'folio-test-statement.pdf',
      mediaType: 'application/pdf',
      storageState: 'copied_to_app_cache',
    }).state;
    const stagedRoute = buildLocalRouteSummary(staged);

    // The reader found several lines, but nothing counts yet.
    expect(staged.importDrafts.length).toBeGreaterThanOrEqual(3);
    expect(stagedRoute.confirmedTransactionCount).toBe(0);
    expect(stagedRoute.availableNowMinor).toBe(before.availableNowMinor);
    expect(stagedRoute.pendingReviewCount).toBe(staged.importDrafts.length);
  });

  it('only items the user adds change Today; ignored ones do not', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState(DAY),
      EXTRACTED_STATEMENT_TEXT,
      {
        byteSize: EXTRACTED_STATEMENT_TEXT.length,
        filename: 'statement.jpg',
        mediaType: 'image/jpeg',
        storageState: 'copied_to_app_cache',
      },
    ).state;

    const first = staged.importDrafts[0]!;
    const added = confirmImportDraft(
      editImportDraft(staged, first.rowId, {
        amountText: (first.amountMinor / 100).toFixed(2),
        date: first.date,
        interpretation: first.interpretation,
      }),
      first.rowId,
    );
    const addedRoute = buildLocalRouteSummary(added);
    expect(addedRoute.confirmedTransactionCount).toBe(1);
    // Every other extracted line is still only waiting — never added on its own.
    expect(addedRoute.pendingReviewCount).toBe(staged.importDrafts.length - 1);
  });
});

describe('native reading — wiring is real and on-device only', () => {
  const seam = read('./nativeTextExtraction.ts');
  const reader = read(
    '../../modules/folio-reader/android/src/main/java/expo/modules/folioreader/FolioReaderModule.kt',
  );
  const readerJs = read('../../modules/folio-reader/index.ts');
  const docImport = read('./nativeDocumentImport.ts');

  it('the seam hands off to the on-device reader, with the manual fallback intact', () => {
    expect(seam).toContain('readDocumentText');
    // The never-throws / NOT_AVAILABLE fallback is preserved.
    expect(seam).toContain("const NOT_AVAILABLE: ExtractedText = { text: '', source: 'none' }");
    expect(seam).toContain('return NOT_AVAILABLE');
  });

  it('the native module uses ML Kit + PdfRenderer locally and never throws across the bridge', () => {
    expect(reader).toContain('com.google.mlkit.vision.text.TextRecognition');
    expect(reader).toContain('android.graphics.pdf.PdfRenderer');
    expect(reader).toContain('InputImage');
    // A failure resolves to source "none" (manual fallback), never an exception.
    expect(reader).toContain('"source" to "none"');
    expect(reader).toContain('catch (e: Throwable)');
    // No cloud / network.
    expect(reader).not.toMatch(/https?:\/\//);
    // JS wrapper is lazy + guarded.
    expect(readerJs).toContain('requireNativeModule');
    expect(readerJs).toContain("source: 'none'");
  });

  it('PDFs and images picked as files route through extraction before falling back to manual', () => {
    expect(docImport).toContain('extractTextFromDocument(asset.uri, mediaType)');
    expect(docImport).toContain("kind: 'picked'");
    expect(docImport).toContain("kind: 'unsupported'");
  });
});
