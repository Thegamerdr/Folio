import type { CandidateMoneyItem, CandidateSource } from './importSheet';

export type StatementPreviewPresentation = {
  headerLabel: 'CSV' | 'FILE' | 'IMAGE' | 'PASTE' | 'PDF' | 'TSV' | 'TXT';
  fileName: string;
  fileDetail: string;
  reviewSource: 'csv' | 'image' | 'paste' | 'pdf' | 'txt';
};

function rowLabel(count: number, noun: 'item' | 'row'): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function delimitedLabel(filename: string | undefined): 'CSV' | 'FILE' | 'TSV' | 'TXT' {
  if (/\.csv$/i.test(filename ?? '')) return 'CSV';
  if (/\.tsv$/i.test(filename ?? '')) return 'TSV';
  if (/\.txt$/i.test(filename ?? '')) return 'TXT';
  return 'FILE';
}

function candidateSource(candidates: readonly CandidateMoneyItem[]): CandidateSource {
  return candidates[0]?.source ?? 'pdf';
}

/** Honest source metadata for the shared successful-read screen. The screen historically labelled
 * every successful intake as a one-page PDF, even for CSV/TXT/paste/photo paths. This helper keeps
 * the existing composition while naming the source the user actually selected and never inventing
 * a PDF page count that the local reader does not expose. */
export function statementPreviewPresentation(
  candidates: readonly CandidateMoneyItem[],
  evidenceFilename?: string,
): StatementPreviewPresentation {
  const count = candidates.length;
  switch (candidateSource(candidates)) {
    case 'csv': {
      const headerLabel = delimitedLabel(evidenceFilename);
      return {
        headerLabel,
        fileName: evidenceFilename?.trim() || `${headerLabel} statement`,
        fileDetail: `${rowLabel(count, 'row')} read on this device`,
        reviewSource: headerLabel === 'TXT' ? 'txt' : 'csv',
      };
    }
    case 'paste':
      return {
        headerLabel: 'PASTE',
        fileName: 'Pasted transactions',
        fileDetail: `${rowLabel(count, 'row')} ready to review`,
        reviewSource: 'paste',
      };
    case 'photo':
      return {
        headerLabel: 'IMAGE',
        fileName: evidenceFilename?.trim() || 'Statement image',
        fileDetail: `${rowLabel(count, 'item')} read on this device`,
        reviewSource: 'image',
      };
    case 'pdf':
      return {
        headerLabel: 'PDF',
        fileName: evidenceFilename?.trim() || 'Your statement',
        fileDetail: `${rowLabel(count, 'item')} read on this device`,
        reviewSource: 'pdf',
      };
  }
}
