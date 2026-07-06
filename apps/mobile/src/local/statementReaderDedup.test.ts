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

  it('drops a later duplicate with the same date+amount+merchant, keeping the earlier chunk’s row', () => {
    const chunk1 = [candidate({ id: 'first', merchant: 'Tesco', amount: -10, date: '2026-01-01' })];
    // Same transaction re-read at the top of the next chunk (boundary re-read).
    const chunk2 = [candidate({ id: 'dup', merchant: 'Tesco', amount: -10, date: '2026-01-01' })];
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('first');
  });

  it('treats merchant matching as case/whitespace tolerant for the dedupe key', () => {
    const chunk1 = [
      candidate({ id: 'first', merchant: 'Tesco  ', amount: -10, date: '2026-01-01' }),
    ];
    const chunk2 = [candidate({ id: 'dup', merchant: '  tesco', amount: -10, date: '2026-01-01' })];
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged).toHaveLength(1);
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

  it('treats a missing date as its own bucket (no-date rows can still collide with each other)', () => {
    const chunk1 = [candidate({ id: 'a', merchant: 'Cash', amount: -5 })]; // no date
    const chunk2 = [candidate({ id: 'b', merchant: 'Cash', amount: -5 })]; // no date, same rest
    const merged = mergeChunkCandidates([chunk1, chunk2]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('a');
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

  it('handles duplicates spanning more than two chunks (keeps only the first)', () => {
    const row = () =>
      candidate({
        id: `x-${Math.random()}`,
        merchant: 'Netflix',
        amount: -9.99,
        date: '2026-02-01',
      });
    const first = candidate({ id: 'keep', merchant: 'Netflix', amount: -9.99, date: '2026-02-01' });
    const merged = mergeChunkCandidates([[first], [row()], [row()]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('keep');
  });
});
