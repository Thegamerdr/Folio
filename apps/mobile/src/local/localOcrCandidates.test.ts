import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { normalizeOcrStatementText, parseLocalOcrCandidates } from './localOcrCandidates.js';

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../fixtures/bank-inputs/${name}`, import.meta.url).href),
    'utf8',
  );
}

describe('local OCR candidate adapter', () => {
  it('repairs OCR substitutions only in date/money tokens and stages statement rows', () => {
    const result = parseLocalOcrCandidates({
      text: fixture('camera-ocr.txt'),
      source: 'photo',
      filename: 'camera.jpg',
      now: new Date('2026-07-14T12:00:00.000Z'),
    });

    expect(result.candidates).toHaveLength(5);
    expect(result.candidates[0]).toMatchObject({
      source: 'photo',
      merchant: 'Greenfern Cafe',
      amount: -4.85,
      date: '2026-06-01',
      confidence: 'low',
    });
    expect(result.candidates[1]).toMatchObject({
      merchant: 'Salary - Marl0we Stud1os',
      amount: 1850,
    });
    expect(result.candidates.every((candidate) => candidate.note?.includes('on this device'))).toBe(
      true,
    );
  });

  it('turns ordinary pasted bank lines into low-confidence review candidates', () => {
    const result = parseLocalOcrCandidates({
      text: ['25 Jun Tesco -42.00', '26 Jun Salary 1200.00', '27 Jun Rent -750.00'].join('\n'),
      source: 'paste',
      filename: 'pasted transactions',
      now: new Date('2026-07-16T12:00:00.000Z'),
    });

    expect(result.candidates).toHaveLength(3);
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'paste',
          merchant: 'Tesco',
          amount: -42,
          date: '2026-06-25',
          confidence: 'low',
        }),
        expect.objectContaining({
          source: 'paste',
          merchant: 'Salary',
          amount: 1200,
          date: '2026-06-26',
          confidence: 'low',
        }),
      ]),
    );
  });

  it('uses mobile screenshot date sections without changing merchant text', () => {
    const result = parseLocalOcrCandidates({
      text: fixture('screenshot-ocr.txt'),
      source: 'photo',
      filename: 'screenshot.png',
      now: new Date(2026, 5, 10, 12),
    });

    expect(result.candidates).toHaveLength(6);
    expect(result.candidates[0]).toMatchObject({ merchant: 'Greenfern Cafe', date: '2026-06-10' });
    expect(result.candidates[2]).toMatchObject({
      merchant: 'Salary Marlowe Studios',
      amount: 1850,
      date: '2026-06-09',
    });
    expect(result.candidates[4]).toMatchObject({
      merchant: 'Riverside Pharmacy',
      date: '2026-06-08',
    });
  });

  it('does not rewrite OCR-like letters in merchant descriptions', () => {
    const normalized = normalizeOcrStatementText(
      'Statement Period 01 Jun 2026 - 30 Jun 2026\n03 Jun Marlowe Stud1os 185O.00',
      new Date('2026-07-14T12:00:00.000Z'),
    );
    expect(normalized).toContain('03 Jun 2026 Marlowe Stud1os 1850.00');
  });

  it('rejoins table cells that ML Kit returns as adjacent visual lines', () => {
    const result = parseLocalOcrCandidates({
      text: [
        'Statement Period 01 Jun 2026 - 30 Jun 2026',
        '01Jun',
        'Greenfern Cafe',
        '− 4.85',
        '1279.70',
        '03 Jun Salary Marlowe Studios',
        '1850.00',
      ].join('\n'),
      source: 'photo',
      filename: 'split-table.png',
      now: new Date('2026-07-14T12:00:00.000Z'),
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({ merchant: 'Greenfern Cafe', amount: -4.85 });
    expect(result.candidates[1]).toMatchObject({
      merchant: 'Salary Marlowe Studios',
      amount: 1850,
    });
  });

  it('retains explicit statement balances and their source date for reconciliation', () => {
    const result = parseLocalOcrCandidates({
      text: [
        'Statement Period 01 Jun 2026 - 30 Jun 2026',
        'Opening balance 1000.00',
        '03 Jun Salary 500.00',
        '05 Jun Rent -300.00',
        'Closing balance 1200.00',
      ].join('\n'),
      source: 'pdf',
      filename: 'statement.pdf',
      now: new Date('2026-07-16T12:00:00.000Z'),
    });

    expect(result.reconciliationState).toBe('exact_match');
    expect(result.closingBalance).toEqual({
      amount: 1200,
      asOfISO: '2026-06-30',
      openingAmount: 1000,
    });
  });

  it('does not turn an undated OCR balance into a dated money fact', () => {
    const result = parseLocalOcrCandidates({
      text: [
        'Opening balance 1000.00',
        '03 Jun 2026 Salary 500.00',
        'Closing balance 1500.00',
      ].join('\n'),
      source: 'pdf',
      filename: 'undated-statement.pdf',
      now: new Date('2026-07-16T12:00:00.000Z'),
    });

    expect(result.reconciliationState).toBe('exact_match');
    expect(result.closingBalance).toBeNull();
  });
});
