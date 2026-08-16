import { describe, expect, it } from 'vitest';

import type { CandidateMoneyItem, CandidateSource } from './importSheet';
import { statementPreviewPresentation } from './statementPreview';

function candidates(source: CandidateSource, count = 2): CandidateMoneyItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${source}-${index}`,
    source,
    kind: 'spend',
    merchant: `Row ${index + 1}`,
    amount: -(index + 1),
    confidence: 'high',
  }));
}

describe('statement preview source presentation', () => {
  it('shows the retained CSV filename and rows without inventing PDF pages', () => {
    expect(
      statementPreviewPresentation(candidates('csv', 5), 'android-import-interruption.csv'),
    ).toEqual({
      headerLabel: 'CSV',
      fileName: 'android-import-interruption.csv',
      fileDetail: '5 rows read on this device',
      reviewSource: 'csv',
    });
  });

  it('distinguishes TXT and TSV files carried by the delimited parser', () => {
    expect(statementPreviewPresentation(candidates('csv', 1), 'bank.txt')).toMatchObject({
      headerLabel: 'TXT',
      fileDetail: '1 row read on this device',
      reviewSource: 'txt',
    });
    expect(statementPreviewPresentation(candidates('csv'), 'bank.tsv')).toMatchObject({
      headerLabel: 'TSV',
      reviewSource: 'csv',
    });
  });

  it('labels paste, image and PDF paths by their real source', () => {
    expect(statementPreviewPresentation(candidates('paste', 1))).toEqual({
      headerLabel: 'PASTE',
      fileName: 'Pasted transactions',
      fileDetail: '1 row ready to review',
      reviewSource: 'paste',
    });
    expect(statementPreviewPresentation(candidates('photo'), 'receipt.jpg')).toMatchObject({
      headerLabel: 'IMAGE',
      fileName: 'receipt.jpg',
      reviewSource: 'image',
    });
    expect(statementPreviewPresentation(candidates('pdf'), 'statement.pdf')).toMatchObject({
      headerLabel: 'PDF',
      fileName: 'statement.pdf',
      reviewSource: 'pdf',
    });
  });
});
