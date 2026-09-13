import { describe, expect, it } from 'vitest';

import { readTextImport } from './textImportCandidates.js';

const rawRows = [
  '2026-06-24,ACME Payroll,+1840.00',
  '2026-06-25,Landlord rent,-875.00',
  '2026-06-26,Tesco Supermarket,-42.16',
].join('\n');

describe('shared text import reader', () => {
  it('reads the no-header Paste area rows with the same low-confidence line parser as clipboard', () => {
    const result = readTextImport(rawRows, 'paste', 'pasted transactions');
    const clipboard = readTextImport(
      [
        '2026-06-24 ACME Payroll +1840.00',
        '2026-06-25 Landlord rent -875.00',
        '2026-06-26 Tesco Supermarket -42.16',
      ].join('\n'),
      'paste',
      'pasted transactions',
    );

    expect(result.usedPlainTextFallback).toBe(true);
    expect(result.candidates).toEqual([
      expect.objectContaining({
        source: 'paste',
        merchant: 'ACME Payroll',
        amount: 1840,
        date: '2026-06-24',
        confidence: 'low',
      }),
      expect.objectContaining({
        source: 'paste',
        merchant: 'Landlord rent',
        amount: -875,
        date: '2026-06-25',
        confidence: 'low',
      }),
      expect.objectContaining({
        source: 'paste',
        merchant: 'Tesco Supermarket',
        amount: -42.16,
        date: '2026-06-26',
        confidence: 'low',
      }),
    ]);
    expect(result).not.toHaveProperty('accepted');
    expect(result).not.toHaveProperty('posted');
    expect(
      result.candidates.map(({ merchant, amount, date, confidence }) => ({
        merchant,
        amount,
        date,
        confidence,
      })),
    ).toEqual(
      clipboard.candidates.map(({ merchant, amount, date, confidence }) => ({
        merchant,
        amount,
        date,
        confidence,
      })),
    );
  });

  it('keeps valid line candidates while retaining a malformed-line boundary', () => {
    const result = readTextImport(
      [
        '2026-06-24,ACME Payroll,+1840.00',
        'unfinished row',
        '2026-06-25,Landlord rent,-875.00',
      ].join('\n'),
      'paste',
      'pasted transactions',
    );

    expect(result.usedPlainTextFallback).toBe(true);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((candidate) => candidate.confidence === 'low')).toBe(true);
    expect(result.candidates.map((candidate) => candidate.amount)).toEqual([1840, -875]);
  });

  it('preserves the strict sheet path for headed input', () => {
    const result = readTextImport(
      ['date,amount,merchant', '2026-06-24,+1840.00,ACME Payroll'].join('\n'),
      'paste',
      'pasted transactions',
    );

    expect(result.usedPlainTextFallback).toBe(false);
    expect(result.candidates).toEqual([
      expect.objectContaining({ source: 'paste', merchant: 'ACME Payroll', amount: 1840 }),
    ]);
  });

  it('fails closed for empty or wholly malformed text', () => {
    expect(readTextImport('', 'paste', 'pasted transactions')).toMatchObject({
      candidates: [],
      usedPlainTextFallback: false,
    });
    expect(
      readTextImport('Melo validation unfinished', 'paste', 'pasted transactions'),
    ).toMatchObject({
      candidates: [],
      usedPlainTextFallback: false,
    });
  });
});
