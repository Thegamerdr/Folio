// Tests for the PURE chunk-boundary de-dupe helper (statementReaderDedup.ts). No expo/react-native
// imports — runs in plain Node.

import { describe, expect, it } from 'vitest';

// Relative type import — mirrors statementReaderClient.test.ts / statementReaderParse.ts (this
// runner has no `@` alias).
import type { CandidateMoneyItem } from '../folio/lib/importSheet';

import { mergeChunkCandidates } from './statementReaderDedup';

function candidate(overrides: Partial<CandidateMoneyItem> & { id: string }): CandidateMoneyItem {
  return {
    source: 'pdf',
    kind: 'spend',
    merchant: 'Tesco',
    amount: -10,
    confidence: 'low',
    ...overrides,
  };
}

describe('mergeChunkCandidates', () => {
  it('keeps all candidates when there is no overlap across chunks', () => {
    const chunk1 = [candidate({ id: 'a', merchant: 'Tesco', amount: -10, date: '2026-01-01' })];
    const chunk2 = [candidate({ id: 'b', merchant: 'Amazon', amount: -20, date: '2026-01-02' })];
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('drops only the same deterministic row ID repeated across chunks', () => {
    const chunk1 = [candidate({ id: 'first', merchant: 'Tesco', amount: -10, date: '2026-01-01' })];
    const chunk2 = [candidate({ id: 'first', merchant: 'Tesco', amount: -10, date: '2026-01-01' })];
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('first');
  });

  it('keeps same-key rows with different IDs in one chunk', () => {
    const merged = mergeChunkCandidates([
      [
        candidate({ id: 'fare-row-1', merchant: 'Rail', amount: -4.2, date: '2026-01-01' }),
        candidate({ id: 'fare-row-2', merchant: 'Rail', amount: -4.2, date: '2026-01-01' }),
      ],
    ]);
    expect(merged.map((row) => row.id)).toEqual(['fare-row-1', 'fare-row-2']);
  });

  it('keeps same-key rows with different IDs across chunks', () => {
    const chunk1 = [
      candidate({ id: 'fare-row-1', merchant: 'Rail', amount: -4.2, date: '2026-01-01' }),
    ];
    const chunk2 = [
      candidate({ id: 'fare-row-2', merchant: 'Rail', amount: -4.2, date: '2026-01-01' }),
    ];
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged.map((row) => row.id)).toEqual(['fare-row-1', 'fare-row-2']);
  });

  it('keeps two rows that differ only by amount (not a real duplicate)', () => {
    const chunk1 = [candidate({ id: 'a', merchant: 'Tesco', amount: -10, date: '2026-01-01' })];
    const chunk2 = [candidate({ id: 'b', merchant: 'Tesco', amount: -10.01, date: '2026-01-01' })];
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged).toHaveLength(2);
  });

  it('keeps two rows that differ only by date (not a real duplicate)', () => {
    const chunk1 = [candidate({ id: 'a', merchant: 'Tesco', amount: -10, date: '2026-01-01' })];
    const chunk2 = [candidate({ id: 'b', merchant: 'Tesco', amount: -10, date: '2026-01-02' })];
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged).toHaveLength(2);
  });

  it('keeps identical missing-date amounts when row IDs differ', () => {
    const chunk1 = [candidate({ id: 'a', merchant: 'Cash', amount: -5 })]; // no date
    const chunk2 = [candidate({ id: 'b', merchant: 'Cash', amount: -5 })]; // no date, same rest
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('preserves chunk order and within-chunk order in the merged output', () => {
    const chunk1 = [
      candidate({ id: 'a1', merchant: 'A', amount: -1, date: '2026-01-01' }),
      candidate({ id: 'a2', merchant: 'B', amount: -2, date: '2026-01-02' }),
    ];
    const chunk2 = [candidate({ id: 'b1', merchant: 'C', amount: -3, date: '2026-01-03' })];
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged.map((c) => c.id)).toEqual(['a1', 'a2', 'b1']);
  });

  it('returns [] for no chunks and for chunks that are all empty', () => {
    expect(mergeChunkCandidates([])).toEqual([]);
    expect(mergeChunkCandidates([[], []])).toEqual([]);
  });

  it('handles the same row ID spanning more than two chunks without randomness', () => {
    const first = candidate({ id: 'keep', merchant: 'Netflix', amount: -9.99, date: '2026-02-01' });
    const duplicate = candidate({
      id: 'keep',
      merchant: 'Netflix',
      amount: -9.99,
      date: '2026-02-01',
    });
    const merged = mergeChunkCandidates([[first], [duplicate], [duplicate]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('keep');
  });
});
