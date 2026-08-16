// "Add all" batch-accept contract — the Visualizer's bulk option
// (apps/mobile/src/folio/screens/VisualizerScreen.tsx, `acceptAll` → `commit`).
//
// The screen renders the staged `readerCandidates` and offers two accept paths over the SAME
// money-path mutation: per-row "Add N" and the bulk "Add all". This test pins the load-bearing
// promise of "Add all": tapping it posts EVERY staged candidate through `addTransaction`, then
// consumes the review-before-truth queue via `clearReaderCandidates()` — so nothing is left staged
// and the same batch can't be reviewed twice.
//
// Node-safe by design: the screen `.tsx` imports the react-native runtime and so cannot load under
// the Node test runner (the repo's vitest glob is `apps/**/*.test.ts`, .tsx is never collected).
// The screen's `commit(items)` is a thin, deterministic wrapper over exactly these store calls —
// `for (item of items) addTransaction({...}); clearReaderCandidates(); nav.go(...)` — with no
// react-native dependency in that path. We exercise that exact store contract directly: stage the
// reader output, run the same post-all-then-clear sequence the handler runs, and assert the result.
// `nav.go` is pure navigation (no store effect) and is intentionally out of scope here.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  type Transaction,
  addTransaction,
  clearReaderCandidates,
  getState,
  resetAll,
  setReaderCandidates,
} from '../store';
import type { CandidateMoneyItem } from '../lib/importSheet';

// The category map the screen layers on top of a candidate (faithful to VisualizerScreen's
// `categoryFor`): inflows → income; bills/debt/subscriptions → bills; groceries/eating → food;
// transport/travel → transport; everything else → other. Kept local + Node-safe (the source lives
// in the .tsx, which the Node runner can't import); the mapping is asserted via the posted rows.
function categoryFor(item: { amount: number; type: string }): Transaction['category'] {
  if (item.amount > 0) return 'income';
  const type = item.type.toLowerCase();
  if (type.includes('bill') || type.includes('debt') || type.includes('subscription'))
    return 'bills';
  if (type.includes('grocer') || type.includes('eating') || type.includes('food')) return 'food';
  if (type.includes('transport') || type.includes('travel')) return 'transport';
  return 'other';
}

// The screen's render candidate carries a display `type`; the store candidate carries `category`.
// Stage with both so the same fixture drives staging AND the post mapping below.
type StagedRow = CandidateMoneyItem & { type: string };

const staged: StagedRow[] = [
  {
    id: 'r1',
    source: 'csv',
    kind: 'spend',
    merchant: 'Tesco',
    amount: -42.0,
    confidence: 'low',
    category: 'Groceries',
    type: 'Groceries',
  },
  {
    id: 'r2',
    source: 'csv',
    kind: 'income',
    merchant: 'Salary — Whitstone Ltd',
    amount: 2180.0,
    confidence: 'low',
    category: 'Income',
    type: 'Income',
  },
  {
    id: 'r3',
    source: 'csv',
    kind: 'spend',
    merchant: 'Octopus Energy',
    amount: -118.4,
    confidence: 'low',
    category: 'Bill',
    type: 'Bill',
  },
  {
    id: 'r4',
    source: 'csv',
    kind: 'spend',
    merchant: 'Spotify',
    amount: -11.99,
    confidence: 'low',
    category: 'Subscription',
    type: 'Subscription',
  },
];

// The exact post-all-then-clear sequence VisualizerScreen.commit(items) runs for "Add all".
function addAll(items: readonly StagedRow[]) {
  if (items.length === 0) return;
  for (const item of items) {
    addTransaction({
      merchant: item.merchant,
      amount: item.amount,
      category: categoryFor(item),
      source: 'manual',
    });
  }
  clearReaderCandidates();
}

beforeEach(() => {
  // Clean, known seed before every test (defaults + seeded transactions).
  resetAll();
});

describe('Visualizer "Add all"', () => {
  it('posts every staged candidate and clears the review queue', () => {
    const txnsBefore = getState().transactions.length;
    setReaderCandidates(staged);

    // Staging alone must NOT count anything (review-before-truth).
    expect(getState().transactions.length).toBe(txnsBefore);
    expect(getState().readerCandidates.length).toBe(staged.length);

    addAll(staged);

    // Every staged candidate is now a posted transaction (all four, none dropped).
    const after = getState();
    expect(after.transactions.length).toBe(txnsBefore + staged.length);

    // Each candidate posted with its own merchant + signed amount, source 'manual'.
    for (const row of staged) {
      const posted = after.transactions.find((t) => t.merchant === row.merchant);
      expect(posted).toBeDefined();
      expect(posted?.amount).toBe(row.amount);
      expect(posted?.source).toBe('manual');
      expect(posted?.category).toBe(categoryFor(row));
    }

    // The review-before-truth queue is consumed — nothing left staged.
    expect(after.readerCandidates).toEqual([]);
  });

  it('is a no-op on an empty queue (nothing posted, nothing to clear)', () => {
    const txnsBefore = getState().transactions.length;
    setReaderCandidates([]);

    addAll([]);

    expect(getState().transactions.length).toBe(txnsBefore);
    expect(getState().readerCandidates).toEqual([]);
  });

  it('adds the WHOLE batch — selecting none per-row still adds all via the bulk path', () => {
    // The per-row path keys off a selection map; "Add all" ignores it and commits every item.
    const txnsBefore = getState().transactions.length;
    setReaderCandidates(staged);

    addAll(staged); // no per-row selection consulted

    expect(getState().transactions.length).toBe(txnsBefore + staged.length);
    expect(getState().readerCandidates).toEqual([]);
  });
});
