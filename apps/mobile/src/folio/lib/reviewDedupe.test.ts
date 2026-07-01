// reviewDedupe tests — the Review-surface wiring over the pure `proposeMatches` engine
// (OPEN_BANKING_DEDUPE_RESEARCH.md §7). Proves the Review candidate ↔ existing-transaction matching
// that ReviewScreen renders as "This looks like something you already added." Node-safe (no RN/DOM),
// so the apps/**/*.test.ts runner collects it. Relative import of the modules under test.

import { describe, expect, it } from 'vitest';

import { reviewDateToIso, reviewMatch, reviewMatchSubline } from './reviewDedupe';
import type { Transaction } from '../store';

const txn = (
  over: Partial<Transaction> & Pick<Transaction, 'id' | 'merchant' | 'amount' | 'when'>,
): Transaction => ({
  category: 'other',
  source: 'manual',
  ...over,
});

describe('reviewDateToIso', () => {
  it('passes an ISO date through', () => {
    expect(reviewDateToIso('2026-06-26', 2026)).toBe('2026-06-26');
  });

  it('resolves a "26 June" display date against the year', () => {
    expect(reviewDateToIso('26 June', 2026)).toBe('2026-06-26');
    expect(reviewDateToIso('3 March', 2025)).toBe('2025-03-03');
  });

  it('returns null for something that is not a date (de-dupe then skips)', () => {
    expect(reviewDateToIso('sometime', 2026)).toBeNull();
    expect(reviewDateToIso('', 2026)).toBeNull();
    expect(reviewDateToIso('40 Smarch', 2026)).toBeNull();
  });
});

describe('reviewMatch — one candidate vs existing transactions', () => {
  it('proposes a link when the candidate matches an existing row (amount + payee + within window)', () => {
    const existing = [
      txn({ id: 't1', merchant: 'Tesco', amount: -12.0, when: '2026-06-20T10:00:00.000Z' }),
    ];
    const proposal = reviewMatch(
      { id: 'c1', amount: -12.0, dateIso: '2026-06-21', merchant: 'TESCO STORES 2913' },
      existing,
      '2026-06-25',
    );
    expect(proposal).not.toBeNull();
    expect(proposal?.kind).toBe('propose-link');
    expect(proposal?.existingId).toBe('t1');
    expect(proposal?.incomingId).toBe('c1');
  });

  it('proposes amount-changed for a hold-drift (posted higher, payee high)', () => {
    const existing = [
      txn({ id: 't2', merchant: 'Shell', amount: -40.0, when: '2026-06-18T10:00:00.000Z' }),
    ];
    const proposal = reviewMatch(
      { id: 'c2', amount: -46.5, dateIso: '2026-06-20', merchant: 'SHELL FUEL' },
      existing,
      '2026-06-25',
    );
    expect(proposal?.kind).toBe('propose-amount-changed');
    expect(proposal?.existingId).toBe('t2');
  });

  it('returns null when the payee does not match (never merge a look-alike amount)', () => {
    const existing = [
      txn({ id: 't3', merchant: 'Spotify', amount: -9.99, when: '2026-06-01T10:00:00.000Z' }),
    ];
    const proposal = reviewMatch(
      { id: 'c3', amount: -9.99, dateIso: '2026-06-01', merchant: 'Netflix' },
      existing,
      '2026-06-05',
    );
    expect(proposal).toBeNull();
  });

  it('returns null when the candidate is outside the date window', () => {
    const existing = [
      txn({ id: 't4', merchant: 'Tesco', amount: -12.0, when: '2026-06-10T10:00:00.000Z' }),
    ];
    const proposal = reviewMatch(
      { id: 'c4', amount: -12.0, dateIso: '2026-06-20', merchant: 'TESCO' },
      existing,
      '2026-06-22',
    );
    expect(proposal).toBeNull();
  });

  it('returns null when there are no existing transactions', () => {
    const proposal = reviewMatch(
      { id: 'c5', amount: -12.0, dateIso: '2026-06-20', merchant: 'Tesco' },
      [],
      '2026-06-22',
    );
    expect(proposal).toBeNull();
  });

  it('only ever PROPOSES — the kind is never a destructive/auto-merge verb (Link adds nothing)', () => {
    const existing = [
      txn({ id: 't6', merchant: 'Tesco', amount: -12.0, when: '2026-06-20T10:00:00.000Z' }),
    ];
    const proposal = reviewMatch(
      { id: 'c6', amount: -12.0, dateIso: '2026-06-21', merchant: 'Tesco' },
      existing,
      '2026-06-25',
    );
    // A proposal, referencing the existing row so "Link" targets it — but the surface, not this engine,
    // decides; "Link" adds no transaction (no double count) and "Keep both" is the only Add.
    expect(proposal).not.toBeNull();
    expect([
      'propose-link',
      'propose-amount-changed',
      'propose-transfer',
      'propose-refund',
    ]).toContain(proposal?.kind);
    expect(reviewMatchSubline(proposal!)).toMatch(
      /already added|same amount|amount changed|refund|accounts/i,
    );
  });
});
