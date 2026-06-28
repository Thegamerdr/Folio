import { describe, expect, it } from 'vitest';

import { isImageStatement, toStagedTransactions } from './statementIntakeRouting.js';
import type { ExtractedStatementTxn } from './statementExtraction.js';

describe('statementIntake — image-vs-text routing decision', () => {
  it('routes images (by MIME) to the vision path', () => {
    expect(isImageStatement('image/jpeg', 'file:///cache/photo')).toBe(true);
    expect(isImageStatement('image/png', 'file:///cache/shot')).toBe(true);
    expect(isImageStatement('image/heic', 'file:///cache/x')).toBe(true);
  });

  it('routes images (by extension when MIME is generic) to the vision path', () => {
    expect(isImageStatement('application/octet-stream', 'file:///cache/scan.JPG')).toBe(true);
    expect(isImageStatement('application/octet-stream', 'file:///cache/scan.png')).toBe(true);
    expect(isImageStatement('application/octet-stream', 'file:///cache/scan.webp')).toBe(true);
    expect(isImageStatement('application/octet-stream', 'file:///cache/scan.heif')).toBe(true);
  });

  it('routes PDFs and other files to the text path (not vision)', () => {
    expect(isImageStatement('application/pdf', 'file:///cache/june.pdf')).toBe(false);
    expect(isImageStatement('text/csv', 'file:///cache/statement.csv')).toBe(false);
    expect(isImageStatement('text/plain', 'file:///cache/notes.txt')).toBe(false);
    expect(isImageStatement('application/octet-stream', 'file:///cache/unknown')).toBe(false);
  });
});

describe('statementIntake — structured-transaction → staged shape mapping', () => {
  it('copies the reader fields 1:1 (already integer pence + direction, no re-derivation)', () => {
    const read: readonly ExtractedStatementTxn[] = [
      { dateIso: '2026-06-24', merchant: 'Tesco', amountMinor: 4_250, direction: 'spend' },
      { dateIso: '2026-06-25', merchant: 'Payroll', amountMinor: 185_000, direction: 'income' },
    ];
    const staged = toStagedTransactions(read);

    expect(staged).toHaveLength(2);
    expect(staged[0]).toEqual({
      dateIso: '2026-06-24',
      merchant: 'Tesco',
      amountMinor: 4_250,
      direction: 'spend',
    });
    expect(staged[1]?.direction).toBe('income');
    expect(staged[1]?.amountMinor).toBe(185_000);
  });

  it('maps an empty list to an empty list', () => {
    expect(toStagedTransactions([])).toHaveLength(0);
  });
});
