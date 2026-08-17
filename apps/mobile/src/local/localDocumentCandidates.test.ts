import { describe, expect, it } from 'vitest';

import { classifyLocalDocument, parseLocalDocumentCandidates } from './localDocumentCandidates.js';

describe('local document candidates', () => {
  it('classifies and reads a receipt total without mistaking cash tendered for spend', () => {
    const result = parseLocalDocumentCandidates({
      text: [
        'GREENFERN CAFE',
        '14/07/2026 12:41',
        'Flat white 3.40',
        'Toast 4.10',
        'SUBTOTAL 7.50',
        'VAT 1.25',
        'TOTAL 7.50',
        'CASH TENDERED 10.00',
        'CHANGE 2.50',
      ].join('\n'),
      source: 'photo',
      filename: 'receipt.jpg',
    });

    expect(result.documentKind).toBe('receipt');
    expect(result.candidates).toEqual([
      expect.objectContaining({
        merchant: 'Greenfern Cafe',
        amount: -7.5,
        date: '2026-07-14',
        confidence: 'low',
      }),
    ]);
  });

  it('recognises an unpaid invoice but does not turn it into a completed transaction', () => {
    const result = parseLocalDocumentCandidates({
      text: [
        'Marlowe Studios',
        'INVOICE',
        'Invoice number M-1042',
        'Due date 30/07/2026',
        'Amount due Â£850.00',
      ].join('\n'),
      source: 'pdf',
      filename: 'invoice.pdf',
    });

    expect(result.documentKind).toBe('invoice');
    expect(result.candidates).toHaveLength(0);
  });

  it('keeps statements on the row-and-reconciliation parser', () => {
    const lines = [
      'Statement Period 01 Jun 2026 - 30 Jun 2026',
      'Opening balance 1000.00',
      '03 Jun Salary 500.00',
      '05 Jun Rent -300.00',
      'Closing balance 1200.00',
    ];
    expect(classifyLocalDocument(lines)).toBe('statement');
    const result = parseLocalDocumentCandidates({
      text: lines.join('\n'),
      source: 'pdf',
      filename: 'statement.pdf',
    });
    expect(result.candidates).toHaveLength(2);
    expect(result.reconciliationState).toBe('exact_match');
  });

  it('refuses a euro receipt instead of reading its total as pounds', () => {
    const result = parseLocalDocumentCandidates({
      text: ['CAFE EUROPA', 'RECEIPT', '14/07/2026', 'TOTAL €12.50'].join('\n'),
      source: 'photo',
      filename: 'euro-receipt.jpg',
    });

    expect(result.candidates).toEqual([]);
    expect(result.unsupportedCurrency).toBe('EUR');
  });

  it('refuses an explicitly non-GBP statement', () => {
    const result = parseLocalDocumentCandidates({
      text: [
        'Statement currency: USD',
        'Statement Period 01 Jun 2026 - 30 Jun 2026',
        '03 Jun Salary 500.00',
        '05 Jun Rent -300.00',
      ].join('\n'),
      source: 'pdf',
      filename: 'usd-statement.pdf',
    });

    expect(result.candidates).toEqual([]);
    expect(result.unsupportedCurrency).toBe('USD');
  });
});
