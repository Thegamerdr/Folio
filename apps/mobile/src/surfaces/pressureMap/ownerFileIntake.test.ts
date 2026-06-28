// Owner-real file intake guards.
//
// These lock the behaviour the owner needs to trust real files: a brought-in file never moves Today
// by itself, manual-from-file items are real and linked, removing a file never corrupts what was
// added, notes are reference-only, and the on-device extraction seam stays an honest "not available"
// (so PDF/image route to the manual workbench rather than faking a read). Plus source pins for the
// new editable visualizer, the manual-from-file workbench, and the image/camera intake module.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  addDocumentNote,
  addTransactionFromDocument,
  buildLocalRouteSummary,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  editImportDraft,
  removeDocumentStage,
  stageDocumentForManualReview,
  stageStatementImport,
} from '../../local/localLedger.js';

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8');
}

const DAY = '2026-06-24';

function stageFile(filename: string, mediaType: string) {
  const empty = createEmptyLocalLedgerState(DAY);
  return stageDocumentForManualReview(empty, {
    filename,
    mediaType,
    byteSize: 2048,
    storageState: 'copied_to_app_cache',
    uri: `file:///cache/${filename}`,
  });
}

describe('owner file intake — a brought-in file never moves Today on its own', () => {
  it('a saved (unreadable) PDF leaves Today unchanged until an item is added', () => {
    const empty = createEmptyLocalLedgerState(DAY);
    const before = buildLocalRouteSummary(empty);

    const { state: withFile, documentStage } = stageFile('Statement_June.pdf', 'application/pdf');
    const afterFileRoute = buildLocalRouteSummary(withFile);

    // The file is saved, but nothing counts.
    expect(withFile.documentStages.length).toBe(1);
    expect(afterFileRoute.availableNowMinor).toBe(before.availableNowMinor);
    expect(afterFileRoute.confirmedTransactionCount).toBe(0);
    expect(documentStage.extractionStatus).toBe('unreadable');
    expect(documentStage.uri).toBe('file:///cache/Statement_June.pdf');
  });

  it('a manual-from-file item is real, linked to the file, and moves Today', () => {
    const { state: withFile, documentStage } = stageFile('Statement_June.pdf', 'application/pdf');
    const added = addTransactionFromDocument(withFile, {
      documentId: documentStage.id,
      kind: 'bill',
      amountText: '118',
      title: 'Octopus Energy',
    });

    const route = buildLocalRouteSummary(added);
    expect(route.confirmedTransactionCount).toBeGreaterThan(0);
    // The added item is linked back to its source file.
    const doc = added.documentStages.find((stage) => stage.id === documentStage.id);
    expect(doc?.linkedTransactionIds?.length).toBe(1);
  });

  it('removing the file keeps the added item — no corruption', () => {
    const { state: withFile, documentStage } = stageFile('Statement_June.pdf', 'application/pdf');
    const added = addTransactionFromDocument(withFile, {
      documentId: documentStage.id,
      kind: 'income',
      amountText: '2180',
      title: 'Salary',
    });
    const addedCount = added.transactions.length;
    expect(addedCount).toBeGreaterThan(0);

    const removed = removeDocumentStage(added, documentStage.id);
    expect(removed.documentStages.length).toBe(0);
    // The added transaction survives the file removal untouched.
    expect(removed.transactions.length).toBe(addedCount);
    expect(buildLocalRouteSummary(removed).confirmedTransactionCount).toBeGreaterThan(0);
  });

  it('a note is reference-only — it never changes Today or the transactions', () => {
    const { state: withFile, documentStage } = stageFile('IMG_2643.jpg', 'image/jpeg');
    const before = buildLocalRouteSummary(withFile);
    const noted = addDocumentNote(withFile, documentStage.id, 'June statement, current account');

    const doc = noted.documentStages.find((stage) => stage.id === documentStage.id);
    expect(doc?.notes).toEqual(['June statement, current account']);
    expect(noted.transactions.length).toBe(withFile.transactions.length);
    expect(buildLocalRouteSummary(noted).availableNowMinor).toBe(before.availableNowMinor);
    // A note on a file that does not exist is a no-op.
    expect(addDocumentNote(withFile, 'no-such-doc', 'x')).toBe(withFile);
  });
});

describe('owner file intake — on-device reading stays honest', () => {
  // The extraction seam is a native module (expo-file-system + future ML Kit / PdfRenderer), so we
  // pin its honesty at the source rather than importing it into the node test env: until the native
  // reader lands it always resolves to { text: '', source: 'none' }, which routes PDFs and images to
  // the manual-from-file workbench instead of faking a read.
  const extraction = read('../../local/nativeTextExtraction.ts');

  it('the extraction seam is an honest "not available" (PDF/OCR not faked)', () => {
    expect(extraction).toContain(
      "const NOT_AVAILABLE: ExtractedText = { text: '', source: 'none' }",
    );
    expect(extraction).toContain('return NOT_AVAILABLE');
    // It must never throw — every failure resolves to the manual fallback.
    expect(extraction).toContain('Never throws');
  });
});

describe('owner file intake — paste / CSV parse and wait for review', () => {
  it('CSV text parses into found items that wait until added', () => {
    const empty = createEmptyLocalLedgerState(DAY);
    const staged = stageStatementImport(
      empty,
      'Date,Description,Amount\n2026-06-25,Salary,1200.00\n2026-06-26,Tesco,-42.00\n2026-06-27,Rent,-750.00',
    ).state;
    const stagedRoute = buildLocalRouteSummary(staged);

    expect(staged.importDrafts.length).toBeGreaterThanOrEqual(3);
    expect(stagedRoute.confirmedTransactionCount).toBe(0);
    expect(stagedRoute.pendingReviewCount).toBe(staged.importDrafts.length);

    // Ignored items never count.
    const first = staged.importDrafts[0]!;
    const second = staged.importDrafts[1]!;
    const addedOne = confirmImportDraft(
      editImportDraft(staged, first.rowId, {
        amountText: (first.amountMinor / 100).toFixed(2),
        date: first.date,
        interpretation: first.interpretation,
      }),
      first.rowId,
    );
    const addedRoute = buildLocalRouteSummary(addedOne);
    expect(addedRoute.confirmedTransactionCount).toBe(1);
    // The untouched second draft is still only waiting — never added on its own.
    expect(addedOne.importDrafts.some((d) => d.rowId === second.rowId)).toBe(true);
  });
});

describe('owner file intake — surface pins (editable visualizer, workbench, image/camera)', () => {
  const found = read('./foundItems.tsx');
  const workbench = read('./fileWorkbench.tsx');
  const imageIntake = read('../../local/nativeImageIntake.ts');

  it('the editable "Check what Folio found" visualizer exists and is a list, not a card', () => {
    // Headline carries the one italic accent word ("found"); the rendered line is "Check what Folio found."
    expect(found).toContain('lead="Check what Folio "');
    expect(found).toContain('accent="found"');
    expect(found).toContain('Nothing is added until you choose.');
    // Per-item edit / ignore / include + a global add-selected.
    expect(found).toContain('onApplyDraftEdit');
    expect(found).toContain('onDismissDraft');
    expect(found).toContain('onConfirmMany');
    expect(found).toMatch(/Add \$\{included\.length\} to my money|Add .* to my money/);
    expect(found).toContain('Leave for later');
  });

  it('the manual-from-file workbench uses the accepted copy and real actions', () => {
    expect(workbench).toContain('File saved. It has not changed your money picture.');
    expect(workbench).toContain('View file');
    expect(workbench).toContain('Add note');
    expect(workbench).toContain('Remove file');
    // The four add kinds.
    for (const label of ['Money in', 'Income', 'Bill', 'Debt payment']) {
      expect(workbench).toContain(label);
    }
    // Added items are shown as linked back to the file.
    expect(workbench).toContain('things added');
    expect(workbench).toContain('{file.filename}');
  });

  it('image + camera intake save locally and fall back to the manual workbench (OCR not faked)', () => {
    expect(imageIntake).toContain('pickStatementImage');
    expect(imageIntake).toContain('captureStatementPhoto');
    expect(imageIntake).toContain('launchImageLibraryAsync');
    expect(imageIntake).toContain('launchCameraAsync');
    expect(imageIntake).toContain('extractTextFromDocument');
    // When extraction yields nothing, the result is a saved file for manual entry, never a fake read.
    expect(imageIntake).toContain("kind: 'saved'");
  });
});
