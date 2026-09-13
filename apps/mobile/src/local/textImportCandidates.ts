import {
  parseSheet,
  type CandidateMoneyItem,
  type CandidateSource,
  type ColumnIssue,
} from '../folio/lib/importSheet';
import { parseLocalOcrCandidates } from './localOcrCandidates';

export type TextImportReadResult = Readonly<{
  candidates: CandidateMoneyItem[];
  issues: ColumnIssue[];
  usedPlainTextFallback: boolean;
}>;

/**
 * Read a text-shaped input through the spreadsheet parser first, then the shared line parser when
 * the input has no usable header mapping. Both Intake clipboard/file reads and the raw Paste area
 * use this seam so they cannot disagree about ordinary date, description, amount lines.
 *
 * The fallback remains review-only: `parseLocalOcrCandidates` returns low-confidence candidates
 * and this helper performs no queue or ledger write.
 */
export function readTextImport(
  text: string,
  source: Extract<CandidateSource, 'csv' | 'paste'>,
  filename: string,
): TextImportReadResult {
  const parsed = parseSheet(text, { source });
  const hasHardIssue = parsed.issues.some(
    (issue) =>
      issue.code === 'missing-amount' ||
      issue.code === 'missing-merchant' ||
      issue.code === 'empty-input',
  );
  if (parsed.candidates.length > 0 && !hasHardIssue) {
    return {
      candidates: parsed.candidates,
      issues: parsed.issues,
      usedPlainTextFallback: false,
    };
  }

  // The raw Paste area also accepts the common three-column, headerless shape
  // `date,merchant,amount`. Parse that shape only when the explicit paste source requested it,
  // then pass the validated fields through the same low-confidence line parser used by clipboard
  // text. This keeps the editor and clipboard routes equivalent without guessing a file's layout.
  if (source === 'paste') {
    const positional = parseSheet(text, {
      source,
      hasHeader: false,
      columnMapping: { date: 0, merchant: 1, amount: 2 },
    });
    const plainRows = positional.candidates
      .filter((candidate) => candidate.date !== undefined)
      .map((candidate) => `${candidate.date} ${candidate.merchant} ${candidate.amount.toFixed(2)}`)
      .join('\n');
    if (plainRows.length > 0) {
      const positionalFallback = parseLocalOcrCandidates({ text: plainRows, source, filename });
      if (positionalFallback.candidates.length > 0) {
        return {
          candidates: positionalFallback.candidates,
          issues: positional.issues,
          usedPlainTextFallback: true,
        };
      }
    }
  }

  // Bank clipboard/TXT exports are often line-oriented rather than sheets (for example
  // `25 Jun Tesco -42.00`). Reuse the existing local parser; its output remains low-confidence.
  const fallback = parseLocalOcrCandidates({ text, source, filename });
  if (fallback.candidates.length > 0) {
    return {
      candidates: fallback.candidates,
      issues: [],
      usedPlainTextFallback: true,
    };
  }

  return {
    candidates: [],
    issues: parsed.issues,
    usedPlainTextFallback: false,
  };
}
