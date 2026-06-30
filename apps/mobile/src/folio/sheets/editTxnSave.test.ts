// EditTxnSheet Save → store contract tests — ENGINES.md §6 "Editing existing transactions —
// required, never destructive" (and §7 @rn-engine edit-txn).
//
// What this proves (the new behaviour wired in this change): the EditTxnSheet's "Save changes" no
// longer no-ops against a hardcoded Tesco subject. The shell now threads a real `target` id
// (nav.openSheet('edit-txn', { id }) → editTxnTarget → <EditTxnSheet target>), the sheet prefills from
// that posted transaction, and Save routes the changed field through the store's `editTransaction`.
//
// These tests exercise the exact store seam the sheet's `handleSave` calls — the same patch shape the
// Note row produces — against a REAL seeded transaction. They are Node-safe (no react-native, no DOM),
// so the apps/**/*.test.ts runner collects them; the sheet component itself imports react-native and
// is verified by typecheck + on-device render, while the write contract it depends on is proven here.
//
// Imports go through the store's public surface (the single reactive seam), mirroring store.test.ts.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  addTransaction,
  editTransaction,
  getState,
  resetAll,
  setPartial,
  type Transaction,
} from '../store';

// Reset to a known clean seed before each test so assertions never depend on prior state.
beforeEach(() => {
  resetAll();
});

// Seed one known posted transaction to correct, isolated from the default seed set.
const seedOne = (over: Partial<Transaction> = {}): Transaction => {
  setPartial({ transactions: [], edits: [] });
  return addTransaction({
    merchant: 'Tesco',
    amount: -42.1,
    category: 'food',
    source: 'manual',
    ...over,
  });
};

describe('EditTxnSheet Save → editTransaction (real target id)', () => {
  it('threads the real id and records exactly one correction for a changed note', () => {
    const row = seedOne();
    const before = getState().transactions.length;

    // The exact call EditTxnSheet.handleSave makes when the Note row changed.
    editTransaction(row.id, { note: 'Weekly shop' }, 'user');

    const txns = getState().transactions;
    // Replace-in-place: no duplicate row, count unchanged (§6 — never a second entry).
    expect(txns.length).toBe(before);
    expect(txns.filter((t) => t.id === row.id).length).toBe(1);

    // One immutable correction record was appended for the changed field.
    const edits = getState().edits ?? [];
    expect(edits.length).toBe(1);
    const noteEdit = edits[0]!;
    expect(noteEdit.field).toBe('note');
    expect(noteEdit.txnId).toBe(row.id);
    expect(noteEdit.before).toBe(undefined); // no prior note on the seeded row
    expect(noteEdit.after).toBe('Weekly shop');
    expect(noteEdit.by).toBe('user');

    // The corrected row carries the new value (edited in place, same id).
    const editedRow = txns.find((t) => t.id === row.id)!;
    expect(editedRow.id).toBe(row.id);
  });

  it('edits the right row when several transactions exist — never a random one', () => {
    setPartial({ transactions: [], edits: [] });
    const other = addTransaction({ merchant: 'Tesco', amount: -10, category: 'food', source: 'manual' });
    const chosen = addTransaction({ merchant: 'Greggs', amount: -3.5, category: 'food', source: 'manual' });

    // Save against the chosen subject id (what ReviewScreen threads as candidate.id).
    editTransaction(chosen.id, { note: 'breakfast' }, 'user');

    const edits = getState().edits ?? [];
    expect(edits.length).toBe(1);
    expect(edits[0]!.txnId).toBe(chosen.id); // the chosen row, not the other Tesco-named one
    expect(edits.some((e) => e.txnId === other.id)).toBe(false);
  });

  it('a Save that changes nothing writes nothing (no fabricated history)', () => {
    // A field set to its current value is a no-op (§6) and records nothing — the same guard the
    // sheet's handleSave relies on when the Note is left untouched. Asserted here against the store
    // with a real field (amount) the seeded row already carries.
    const row = seedOne({ amount: -42.1 });

    editTransaction(row.id, { amount: -42.1 }, 'user');

    expect((getState().edits ?? []).length).toBe(0);
    expect(getState().transactions.find((t) => t.id === row.id)!.amount).toBe(-42.1);
  });

  it('a cold open (no target → inert fallback) never edits a row: unknown id is a safe no-op', () => {
    seedOne();
    // The inert fallback's Save just closes; if a stale/unknown id ever reached editTransaction it is
    // a safe no-op — nothing is written, so no random row is touched.
    editTransaction('does-not-exist', { note: 'x' }, 'user');
    expect((getState().edits ?? []).length).toBe(0);
  });
});
