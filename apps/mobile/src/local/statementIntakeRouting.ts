// Pure routing + mapping helpers for automatic statement intake.
//
// These two decisions are the testable core of the intake flow and have NO native / expo / RN
// dependency, so they live here on their own. statementIntake.ts (which DOES pull in expo-file-system
// and the on-device reader) re-exports them, so callers and tests can import either: tests import this
// pure module directly to stay off the React Native import chain.

import type { ExtractedStatementTxn } from './statementExtraction';
import type { StagedStatementTransaction } from './localLedger';

/** Decide whether a statement should take the image (vision) path or the text (OCR/PDF) path. Images
 *  go to vision so the multimodal model reads the picture directly; everything else (PDF, CSV, txt)
 *  goes to the on-device text path. MIME first, with a filename-extension fallback because pickers
 *  sometimes report a generic type. */
export function isImageStatement(mimeType: string, uri: string): boolean {
  const type = mimeType.toLowerCase();
  const lowerUri = uri.toLowerCase();
  if (type.startsWith('image/')) return true;
  return (
    lowerUri.endsWith('.jpg') ||
    lowerUri.endsWith('.jpeg') ||
    lowerUri.endsWith('.png') ||
    lowerUri.endsWith('.webp') ||
    lowerUri.endsWith('.heic') ||
    lowerUri.endsWith('.heif')
  );
}

/** Map the AI reader's transactions to the ledger's staged-transaction shape (a 1:1 field copy; both
 *  already use integer pence and a 'spend' | 'income' direction, so nothing is re-derived). */
export function toStagedTransactions(
  transactions: readonly ExtractedStatementTxn[],
): readonly StagedStatementTransaction[] {
  return transactions.map((txn) => ({
    dateIso: txn.dateIso,
    merchant: txn.merchant,
    amountMinor: txn.amountMinor,
    direction: txn.direction,
  }));
}
