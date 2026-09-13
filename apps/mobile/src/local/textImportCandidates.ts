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
    // Keep normalization on this parse copy only: the visible draft remains byte-for-byte as
    // entered, while signed Unicode dash variants reach the same sheet parser as ASCII minus.
    const positional = parseSheet(normalizeSignedAmountForSheet(text), {
      source,
      hasHeader: false,
      columnMapping: { date: 0, merchant: 1, amount: 2 },
    });
    const positionalIssues = addUnparsedPasteRowIssues(
      positional.issues,
      positional.candidates,
      text,
    );
    const plainRows = positional.candidates
      .filter((candidate) => candidate.date !== undefined)
      .map((candidate) => `${candidate.date} ${candidate.merchant} ${candidate.amount.toFixed(2)}`)
      .join('\n');
    if (plainRows.length > 0) {
      const positionalFallback = parseLocalOcrCandidates({ text: plainRows, source, filename });
      if (positionalFallback.candidates.length > 0) {
        return {
          candidates: positionalFallback.candidates,
          issues: positionalIssues,
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

/** Normalize only dash glyphs immediately before a numeric amount for parseSheet. */
function normalizeSignedAmountForSheet(text: string): string {
  return text.replace(/[−–—](?=\s*[0-9OoIlL])/gu, '-');
}

function addUnparsedPasteRowIssues(
  issues: ColumnIssue[],
  candidates: CandidateMoneyItem[],
  text: string,
): ColumnIssue[] {
  const issueRows = new Set(
    issues
      .map((issue) => issue.row)
      .filter((row): row is number => row !== undefined),
  );
  // parseSheet's deterministic candidate id carries its 1-based data row. This lets the
  // headerless Paste adapter report a nonblank row that the sheet parser skipped as padding.
  const candidateRows = new Set(
    candidates
      .map((candidate) => /^sheet-(\d+)-/u.exec(candidate.id)?.[1])
      .filter((row): row is string => row !== undefined)
      .map(Number),
  );
  const rows = text
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '');
  const augmented = [...issues];
  rows.forEach((line, index) => {
    const row = index + 1;
    if (line.trim() !== '' && !candidateRows.has(row) && !issueRows.has(row)) {
      augmented.push({
        code: 'bad-amount',
        message: `Row ${row} could not be read — we left it out rather than guess.`,
        row,
      });
    }
  });
  return augmented;
}
