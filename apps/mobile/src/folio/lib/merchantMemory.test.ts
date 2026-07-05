// merchantMemory — pure-logic coverage for recallCategory / applyMemoryToCandidates
// (lib/merchantMemory.ts). DATA_INTELLIGENCE.md phase ③.
//
// Node-safe: touches only the pure functions (no react-native, no DOM, no
// store mutation), so it is a plain `.test.ts` collected by the
// apps/**/*.test.ts runner — exactly like caughtIncome.test.ts.

import { describe, expect, it } from 'vitest';

import type { CandidateMoneyItem } from './importSheet';
import {
  applyMemoryToCandidates,
  recallCategory,
  type MerchantCategoryMap,
} from './merchantMemory';
import { normaliseMerchant } from './subSignals';

function candidate(over: Partial<CandidateMoneyItem> = {}): CandidateMoneyItem {
  return {
    id: 'c-1',
    source: 'pdf',
    kind: 'spend',
    merchant: 'Tesco',
    amount: -42.1,
    date: '2026-07-01',
    category: 'other',
    confidence: 'low',
    ...over,
  };
}

function memoryOf(merchant: string, category: string, correctedAt = '2026-07-01T00:00:00.000Z') {
  const map: MerchantCategoryMap = {};
  map[normaliseMerchant(merchant)] = { category, correctedAt, hits: 1 };
  return map;
}

// ---------------------------------------------------------------------------
// recallCategory
// ---------------------------------------------------------------------------
describe('recallCategory', () => {
  it('returns null when the map is undefined (fresh install / pre-migration blob)', () => {
    expect(recallCategory(undefined, 'Tesco')).toBeNull();
  });

  it('returns null when the merchant has no remembered correction', () => {
    const map = memoryOf('Sainsburys', 'food');
    expect(recallCategory(map, 'Tesco')).toBeNull();
  });

  it('returns the remembered category for an exact-name match', () => {
    const map = memoryOf('Tesco', 'food');
    expect(recallCategory(map, 'Tesco')).toBe('food');
  });

  it('matches case/whitespace/punctuation-insensitively (shared normaliseMerchant)', () => {
    const map = memoryOf('Tesco Stores Ltd.', 'food');
    expect(recallCategory(map, '  TESCO   STORES   LTD  ')).toBe('food');
    expect(recallCategory(map, 'tesco-stores-ltd')).toBe('food');
  });
});

// ---------------------------------------------------------------------------
// applyMemoryToCandidates
// ---------------------------------------------------------------------------
describe('applyMemoryToCandidates', () => {
  it('passes candidates through unchanged when the map is undefined', () => {
    const candidates = [candidate({ merchant: 'Tesco', category: 'other' })];
    const result = applyMemoryToCandidates(candidates, undefined);
    expect(result).toEqual(candidates);
    const [first] = result;
    expect(first?.rememberedCategory).toBeUndefined();
  });

  it('passes a candidate through unchanged when its merchant has no memory hit', () => {
    const candidates = [candidate({ merchant: 'Tesco', category: 'other' })];
    const map = memoryOf('Sainsburys', 'food');
    const result = applyMemoryToCandidates(candidates, map);
    const [first] = result;
    const [originalFirst] = candidates;
    expect(first).toEqual(originalFirst);
    expect(first?.rememberedCategory).toBeUndefined();
  });

  it('overrides category and flags rememberedCategory:true on a memory hit', () => {
    const candidates = [candidate({ merchant: 'Tesco', category: 'other', confidence: 'low' })];
    const map = memoryOf('Tesco', 'food');
    const result = applyMemoryToCandidates(candidates, map);
    const [first] = result;

    expect(first?.category).toBe('food');
    expect(first?.rememberedCategory).toBe(true);
  });

  it('never touches amount, date, kind, or any other field — category only', () => {
    const original = candidate({
      merchant: 'Tesco',
      category: 'other',
      amount: -55.5,
      date: '2026-06-15',
      kind: 'spend',
      source: 'csv',
      confidence: 'low',
      note: 'row 4',
    });
    const map = memoryOf('Tesco', 'food');
    const [result] = applyMemoryToCandidates([original], map);

    expect(result?.amount).toBe(original.amount);
    expect(result?.date).toBe(original.date);
    expect(result?.kind).toBe(original.kind);
    expect(result?.source).toBe(original.source);
    expect(result?.confidence).toBe(original.confidence);
    expect(result?.note).toBe(original.note);
    expect(result?.id).toBe(original.id);
  });

  it('handles a mixed batch — only memory-hit candidates are flagged/overridden', () => {
    const candidates = [
      candidate({ id: 'a', merchant: 'Tesco', category: 'other' }),
      candidate({ id: 'b', merchant: 'Unknown Merchant', category: 'other' }),
      candidate({ id: 'c', merchant: 'Netflix', category: 'other' }),
    ];
    const map: MerchantCategoryMap = {
      ...memoryOf('Tesco', 'food'),
      ...memoryOf('Netflix', 'bills'),
    };
    const result = applyMemoryToCandidates(candidates, map);

    expect(result.find((c) => c.id === 'a')?.category).toBe('food');
    expect(result.find((c) => c.id === 'a')?.rememberedCategory).toBe(true);

    expect(result.find((c) => c.id === 'b')?.category).toBe('other');
    expect(result.find((c) => c.id === 'b')?.rememberedCategory).toBeUndefined();

    expect(result.find((c) => c.id === 'c')?.category).toBe('bills');
    expect(result.find((c) => c.id === 'c')?.rememberedCategory).toBe(true);
  });

  it('is pure — never mutates the input candidates array or its entries', () => {
    const candidates = [candidate({ merchant: 'Tesco', category: 'other' })];
    const snapshot = JSON.parse(JSON.stringify(candidates));
    const map = memoryOf('Tesco', 'food');

    applyMemoryToCandidates(candidates, map);

    expect(candidates).toEqual(snapshot);
  });
});
