// Automatic statement intake — the seam that turns "the user added a statement" into clean,
// structured transactions ready for the "check what Folio found" review screen.
//
// WHY THIS EXISTS. Adding a statement must JUST WORK, automatically, with no toggle and no per-use
// prompt. The flow is: user adds a photo/screenshot/PDF/file -> Folio reads it -> the user sees a
// short list of what Folio found and confirms it at a glance. Reading is the hard part: a real photo
// of a statement, or a bank PDF, yields messy or no text from on-device OCR alone, so the user ends
// up typing everything. This module hands the statement to the multimodal AI reader
// (extractStatementTransactions, Gemini via Folio's keyless gateway) and gets back clean transactions.
//
// ROUTING. An image (photo/screenshot) goes down the VISION path: we read the file as base64 and let
// the model look at the picture directly — that reads a photographed statement far better than OCR.
// A PDF or other file goes down the TEXT path: we run the existing on-device reader
// (extractTextFromDocument: PdfRenderer + ML Kit) to get text, then hand that text to the same model.
//
// NEVER A DEAD END. If the gateway isn't configured ('no-provider'), the request errors, or the model
// finds nothing, this returns a 'text' result carrying whatever on-device text we have (possibly
// empty) so the caller falls back to the EXISTING parseImportFile -> drafts -> manual-from-file chain.
// The user always lands somewhere useful. This module never throws for those expected failures.
//
// HONEST DESIGN. The AI-read transactions are NEVER auto-committed. They become waiting review drafts
// (via stageStatementTransactions) that the user confirms. Reading AI-read money is the honest design;
// the confirm is a glance, not data entry.

import * as FileSystem from 'expo-file-system/legacy';

import { extractTextFromDocument } from './nativeTextExtraction';
import { extractStatementTransactions } from './statementExtraction';
import { isImageStatement, toStagedTransactions } from './statementIntakeRouting';
import type { StagedStatementTransaction } from './localLedger';

// The pure routing + mapping decisions live in statementIntakeRouting.ts (no native deps, so they are
// unit-testable off the RN import chain). Re-exported here so callers have a single intake entry point.
export { isImageStatement, toStagedTransactions } from './statementIntakeRouting';

/** The outcome of reading a freshly-added statement, as a discriminated union the caller branches on. */
export type StatementIntakeResult =
  // The AI reader returned clean structured transactions — stage them straight as review drafts.
  | Readonly<{ kind: 'ai-transactions'; transactions: readonly StagedStatementTransaction[] }>
  // No AI transactions (no provider, error, or nothing found). `text` is whatever on-device text we
  // have for the existing text-parse fallback — may be empty, in which case the caller saves the file
  // for manual entry. Never a dead end either way.
  | Readonly<{ kind: 'text'; text: string }>;

export type StatementIntakeInput = Readonly<{
  /** On-device file URI of the added statement (from the picker / camera). */
  uri: string;
  /** MIME type reported by the picker (e.g. 'image/jpeg', 'application/pdf'). */
  mimeType: string;
}>;

export type StatementIntakeOptions = Readonly<{
  signal?: AbortSignal;
}>;

/**
 * Read an added statement automatically into clean transactions, or fall back to on-device text.
 *
 * Contract:
 * - Never throws for the expected failure modes. Any read/network/parse failure resolves to a
 *   `{ kind: 'text', text }` result so the caller can use the existing fallback chain.
 * - Image input takes the vision path; everything else takes the on-device text path first and only
 *   hands that text to the model.
 */
export async function readAddedStatement(
  input: StatementIntakeInput,
  opts?: StatementIntakeOptions,
): Promise<StatementIntakeResult> {
  try {
    if (isImageStatement(input.mimeType, input.uri)) {
      return await readImageStatement(input, opts);
    }
    return await readDocumentStatement(input, opts);
  } catch {
    // Absolutely never propagate — degrade to an empty text fallback so intake still lands somewhere.
    return { kind: 'text', text: '' };
  }
}

// Vision path: read the image as base64 and let the multimodal model look at it. On any non-ok
// result (no provider / error / nothing found) fall back to on-device OCR text so the existing
// text-parse chain still gets a chance.
async function readImageStatement(
  input: StatementIntakeInput,
  opts?: StatementIntakeOptions,
): Promise<StatementIntakeResult> {
  let imageBase64: string | undefined;
  try {
    imageBase64 = await FileSystem.readAsStringAsync(input.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    imageBase64 = undefined;
  }

  if (imageBase64 !== undefined && imageBase64.length > 0) {
    const result = await extractStatementTransactions(
      { imageBase64, imageMimeType: input.mimeType },
      opts,
    );
    if (result.status === 'ok' && result.transactions.length > 0) {
      return { kind: 'ai-transactions', transactions: toStagedTransactions(result.transactions) };
    }
  }

  // Vision didn't land. Try on-device OCR text as a last automatic attempt, then hand back text for
  // the parse/manual fallback (empty text is fine — the caller saves the file for manual entry).
  const extracted = await extractTextFromDocument(input.uri, input.mimeType);
  return { kind: 'text', text: extracted.text };
}

// Text path (PDF and other files): run the on-device reader, then hand its text to the model. If the
// model returns clean transactions, use them; otherwise pass the same text back for the existing
// parseImportFile fallback.
async function readDocumentStatement(
  input: StatementIntakeInput,
  opts?: StatementIntakeOptions,
): Promise<StatementIntakeResult> {
  const extracted = await extractTextFromDocument(input.uri, input.mimeType);
  const text = extracted.text;

  if (text.trim().length > 0) {
    const result = await extractStatementTransactions({ text }, opts);
    if (result.status === 'ok' && result.transactions.length > 0) {
      return { kind: 'ai-transactions', transactions: toStagedTransactions(result.transactions) };
    }
  }

  return { kind: 'text', text };
}
