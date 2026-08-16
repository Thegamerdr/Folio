import { describe, expect, it } from 'vitest';

import { detectAccountName } from './detectAccountName';
import type { CandidateMoneyItem } from './importSheet';

function candidate(overrides: Partial<CandidateMoneyItem> = {}): CandidateMoneyItem {
  return {
    id: overrides.id ?? `c-${Math.random()}`,
    source: overrides.source ?? 'pdf',
    kind: overrides.kind ?? 'spend',
    merchant: overrides.merchant ?? 'Tesco',
    amount: overrides.amount ?? -10,
    confidence: overrides.confidence ?? 'low',
    ...(overrides.date !== undefined ? { date: overrides.date } : {}),
    ...(overrides.category !== undefined ? { category: overrides.category } : {}),
    ...(overrides.note !== undefined ? { note: overrides.note } : {}),
  };
}

describe('detectAccountName', () => {
  it('defaults to bank with no name when nothing hints otherwise', () => {
    const result = detectAccountName([
      candidate({ merchant: 'Tesco' }),
      candidate({ merchant: 'Salary — Whitstone Ltd', kind: 'income', amount: 2000 }),
    ]);
    expect(result).toEqual({ name: null, kind: 'bank', kindDetected: false });
  });

  it('never fabricates a name from candidate merchants alone', () => {
    const result = detectAccountName([candidate({ merchant: 'Monzo Top-up' })]);
    expect(result.name).toBeNull();
  });

  it('detects credit-card kind from a merchant hint', () => {
    const result = detectAccountName([candidate({ merchant: 'Amex Payment Received' })]);
    expect(result.kind).toBe('credit-card');
    expect(result.kindDetected).toBe(true);
  });

  it('detects credit-card kind from a category hint', () => {
    const result = detectAccountName([
      candidate({ merchant: 'Something', category: 'Minimum payment due' }),
    ]);
    expect(result.kind).toBe('credit-card');
    expect(result.kindDetected).toBe(true);
  });

  it('detects credit-card kind from a note hint', () => {
    const result = detectAccountName([
      candidate({ merchant: 'Something', note: 'Credit card statement line' }),
    ]);
    expect(result.kind).toBe('credit-card');
    expect(result.kindDetected).toBe(true);
  });

  it('is case-insensitive and matches partial words safely (no false positive on unrelated text)', () => {
    const result = detectAccountName([candidate({ merchant: 'Cardiff Bus Company' })]);
    expect(result.kind).toBe('bank');
    expect(result.kindDetected).toBe(false);
  });

  it('returns a header-derived name when headerText is supplied (future reader wiring)', () => {
    const result = detectAccountName(
      [candidate({ merchant: 'Tesco' })],
      'Monzo Current Account\nStatement for May 2022',
    );
    expect(result.name).toBe('Monzo Current Account');
  });

  it('truncates an overly long header line rather than passing it through verbatim', () => {
    const longLine = 'A'.repeat(80);
    const result = detectAccountName([], longLine);
    expect(result.name).not.toBeNull();
    expect(result.name!.length).toBeLessThanOrEqual(41);
    expect(result.name!.endsWith('…')).toBe(true);
  });

  it('detects credit-card kind from header hint even when candidates look bank-like', () => {
    const result = detectAccountName(
      [candidate({ merchant: 'Tesco' })],
      'American Express Gold Card Statement',
    );
    expect(result.kind).toBe('credit-card');
    expect(result.kindDetected).toBe(true);
  });

  it('handles an empty candidates array without throwing', () => {
    const result = detectAccountName([]);
    expect(result).toEqual({ name: null, kind: 'bank', kindDetected: false });
  });

  it('zero false positives against real cached Monzo bank statement candidates', () => {
    // Regression pin — mirrors the live check run against the cached real statement
    // (monzo-133-candidates.json): a real bank statement's 2523 candidates must never flip kind to
    // 'credit-card'. Restated here as a small representative sample rather than loading the full
    // fixture, since the pattern list itself is what's under test.
    const bankLikeCandidates = [
      candidate({ merchant: 'Transfer to Pot', category: 'Transfer' }),
      candidate({ merchant: 'DISPENSA EMILIA VERONA ITA', category: 'Shopping' }),
      candidate({ merchant: 'SITA SPA VERONA ITA', category: 'Travel' }),
      candidate({ merchant: 'Chitter Chatter Feltham GBR', kind: 'income', amount: 0.1 }),
      candidate({ merchant: 'FPS, Andrea Nsiah, Andrea Nsiah', kind: 'income', amount: 453 }),
    ];
    const result = detectAccountName(bankLikeCandidates);
    expect(result.kind).toBe('bank');
    expect(result.kindDetected).toBe(false);
  });
});
