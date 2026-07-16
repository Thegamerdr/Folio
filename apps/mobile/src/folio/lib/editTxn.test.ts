// EDIT-TXN correction-history engine tests — ENGINES.md §6 "Editing existing
// transactions — required, never destructive" (and §7 @rn-engine edit-txn).
//
// The acceptance criteria, encoded as tests FIRST (TDD RED -> GREEN):
//   - edit amount -> NEW txn carries the new amount, plus a TxnEdit whose
//     before/after are correct.
//   - the original value is recoverable purely from the edit chain (the engine
//     never overwrites it anywhere else).
//   - a multi-field edit emits exactly one TxnEdit record per changed field.
//   - a no-op edit (same value) emits no record and returns the same shape.
//   - an imported item's original source payload survives every edit unchanged.
//
// Pure-logic, Node-safe: this engine has no react-native, no DOM, no I/O, so it
// is a plain `.test.ts` collected by the apps/**/*.test.ts runner. Imports are
// RELATIVE (the runner has no `@` alias), mirroring store.test.ts.

import { describe, expect, it } from 'vitest';

import type { Transaction } from '../store';
import {
  type EditTxnContext,
  type ImportedTransaction,
  applyTxnEdit,
  previewTxnEdit,
} from './editTxn';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const baseTxn = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1',
  when: '2026-06-20T10:00:00.000Z',
  merchant: 'Tesco',
  amount: -42.1,
  category: 'food',
  source: 'manual',
  ...over,
});

const ctx = (over: Partial<EditTxnContext> = {}): EditTxnContext => ({
  at: '2026-06-29T12:00:00.000Z',
  by: 'user',
  ...over,
});

// ---------------------------------------------------------------------------
// edit amount -> new txn + a correct TxnEdit record
// ---------------------------------------------------------------------------
describe('applyTxnEdit — single amount edit', () => {
  it('returns a NEW transaction object with the changed amount', () => {
    const original = baseTxn();
    const { txn } = applyTxnEdit(original, { amount: -50 }, ctx());

    expect(txn).not.toBe(original); // new object, never mutated in place
    expect(txn.amount).toBe(-50);
    expect(original.amount).toBe(-42.1); // input untouched
    // unchanged fields carry through
    expect(txn.merchant).toBe('Tesco');
    expect(txn.id).toBe('txn-1');
  });

  it('appends exactly one TxnEdit with correct before/after for the amount field', () => {
    const { edits } = applyTxnEdit(baseTxn(), { amount: -50 }, ctx());

    expect(edits.length).toBe(1);
    const edit = edits[0]!;
    expect(edit.field).toBe('amount');
    expect(edit.before).toBe(-42.1);
    expect(edit.after).toBe(-50);
    expect(edit.txnId).toBe('txn-1');
    expect(edit.at).toBe('2026-06-29T12:00:00.000Z');
    expect(edit.by).toBe('user');
    expect(typeof edit.id).toBe('string');
    expect(edit.id.length).toBeGreaterThan(0);
  });

  it('records who made the edit — "melo" is carried through', () => {
    const { edits } = applyTxnEdit(baseTxn(), { merchant: 'Greggs' }, ctx({ by: 'melo' }));
    expect(edits[0]!.by).toBe('melo');
  });
});

describe('previewTxnEdit — review before commit', () => {
  it('returns the same changed fields and before/after values the edit engine will record', () => {
    const original = baseTxn();
    const patch = { amount: -50, when: '2026-06-25', merchant: 'Tesco' } as const;

    expect(previewTxnEdit(original, patch)).toEqual([
      { field: 'amount', before: -42.1, after: -50 },
      { field: 'when', before: '2026-06-20T10:00:00.000Z', after: '2026-06-25' },
    ]);
    expect(
      applyTxnEdit(original, patch, ctx()).edits.map(({ field, before, after }) => ({
        field,
        before,
        after,
      })),
    ).toEqual(previewTxnEdit(original, patch));
  });

  it('is read-only and returns no rows for a no-op patch', () => {
    const original = baseTxn();
    expect(previewTxnEdit(original, { merchant: 'Tesco', amount: -42.1 })).toEqual([]);
    expect(previewTxnEdit(original, { note: undefined })).toEqual([]);
    expect(original).toEqual(baseTxn());
  });
});

// ---------------------------------------------------------------------------
// original recoverable from the edit chain (never destroyed)
// ---------------------------------------------------------------------------
describe('applyTxnEdit — original is recoverable, never destroyed', () => {
  it('keeps the original amount inside the edit record after the edit', () => {
    const { txn, edits } = applyTxnEdit(baseTxn(), { amount: -50 }, ctx());

    // The edited row shows the new value...
    expect(txn.amount).toBe(-50);
    // ...but the original lives on in the edit chain's `before`.
    const amountEdit = edits.find((e) => e.field === 'amount')!;
    expect(amountEdit.before).toBe(-42.1);
  });

  it('the original is reconstructable by walking the chain backwards', () => {
    // Two sequential edits to the same field; the FIRST edit's `before` is the
    // true original, recoverable by replaying from the end.
    const r1 = applyTxnEdit(baseTxn(), { amount: -50 }, ctx({ at: '2026-06-29T12:00:00.000Z' }));
    const r2 = applyTxnEdit(r1.txn, { amount: -55 }, ctx({ at: '2026-06-30T12:00:00.000Z' }));

    const chain = [...r1.edits, ...r2.edits].filter((e) => e.field === 'amount');
    // Replay the oldest `before` to recover the true original.
    const oldestBefore = chain[0]!.before;
    expect(oldestBefore).toBe(-42.1);
    expect(r2.txn.amount).toBe(-55);
  });
});

// ---------------------------------------------------------------------------
// multi-field edit -> one record per changed field
// ---------------------------------------------------------------------------
describe('applyTxnEdit — multi-field edit', () => {
  it('emits exactly one TxnEdit per changed field', () => {
    const { txn, edits } = applyTxnEdit(
      baseTxn(),
      { amount: -50, merchant: 'Greggs', category: 'fun' },
      ctx(),
    );

    expect(edits.length).toBe(3);
    const fields = edits.map((e) => e.field).sort();
    expect(fields).toEqual(['amount', 'category', 'merchant']);

    // Every record points at the same txn and timestamp.
    expect(edits.every((e) => e.txnId === 'txn-1')).toBe(true);
    expect(edits.every((e) => e.at === '2026-06-29T12:00:00.000Z')).toBe(true);

    // Resulting txn carries all three changes.
    expect(txn.amount).toBe(-50);
    expect(txn.merchant).toBe('Greggs');
    expect(txn.category).toBe('fun');
  });

  it('each record carries the right before/after for its own field', () => {
    const { edits } = applyTxnEdit(
      baseTxn(),
      { merchant: 'Greggs', when: '2026-06-25T09:00:00.000Z' },
      ctx(),
    );

    const byField = new Map(edits.map((e) => [e.field, e] as const));
    expect(byField.get('merchant')!.before).toBe('Tesco');
    expect(byField.get('merchant')!.after).toBe('Greggs');
    expect(byField.get('when')!.before).toBe('2026-06-20T10:00:00.000Z');
    expect(byField.get('when')!.after).toBe('2026-06-25T09:00:00.000Z');
  });

  it('edits a note field (added where there was none)', () => {
    const { txn, edits } = applyTxnEdit(baseTxn(), { note: 'refund pending' }, ctx());

    expect(txn.note).toBe('refund pending');
    expect(edits.length).toBe(1);
    expect(edits[0]!.field).toBe('note');
    expect(edits[0]!.before).toBe(undefined); // no prior note
    expect(edits[0]!.after).toBe('refund pending');
  });
});

// ---------------------------------------------------------------------------
// no-op edit (same value) -> no record
// ---------------------------------------------------------------------------
describe('applyTxnEdit — no-op edits emit no record', () => {
  it('a patch that matches current values produces zero edits', () => {
    const original = baseTxn();
    const { txn, edits } = applyTxnEdit(
      original,
      { amount: -42.1, merchant: 'Tesco', category: 'food' },
      ctx(),
    );

    expect(edits.length).toBe(0);
    // Nothing changed -> returns an equal txn (still a fresh object, no mutation).
    expect(txn).toEqual(original);
  });

  it('a mixed patch records only the fields that actually changed', () => {
    const { edits } = applyTxnEdit(
      baseTxn(),
      { amount: -42.1 /* same */, merchant: 'Greggs' /* changed */ },
      ctx(),
    );

    expect(edits.length).toBe(1);
    expect(edits[0]!.field).toBe('merchant');
  });

  it('an empty patch produces zero edits and an equal txn', () => {
    const original = baseTxn();
    const { txn, edits } = applyTxnEdit(original, {}, ctx());
    expect(edits.length).toBe(0);
    expect(txn).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// no duplicate counting — the edited txn replaces, never adds
// ---------------------------------------------------------------------------
describe('applyTxnEdit — replaces, never duplicates', () => {
  it('keeps the same id so the row is a replacement, not a second entry', () => {
    const { txn } = applyTxnEdit(baseTxn({ id: 'stable-id' }), { amount: -9 }, ctx());
    expect(txn.id).toBe('stable-id'); // same id -> caller swaps in place, no new row
  });
});

// ---------------------------------------------------------------------------
// imported items keep their original source payload intact across edits
// ---------------------------------------------------------------------------
describe('applyTxnEdit — imported source payload preserved', () => {
  const imported = (over: Partial<ImportedTransaction> = {}): ImportedTransaction => ({
    ...baseTxn({ source: 'manual' }),
    originalSource: {
      kind: 'pdf',
      raw: 'TESCO STORES 3829   42.10',
      merchant: 'TESCO STORES 3829',
      amount: -42.1,
      importedAt: '2026-06-20T08:00:00.000Z',
    },
    ...over,
  });

  it('carries originalSource through unchanged when an editable field changes', () => {
    const original = imported();
    const { txn } = applyTxnEdit(original, { merchant: 'Tesco' }, ctx());

    // The user-facing merchant is now clean...
    expect(txn.merchant).toBe('Tesco');
    // ...but the raw imported payload is byte-identical, so re-import de-dupe
    // still compares against the source, not the edited surface.
    expect(txn.originalSource).toEqual(original.originalSource);
    expect(txn.originalSource).toBe(original.originalSource); // same reference, untouched
  });

  it('survives a multi-field edit, including amount, unchanged', () => {
    const original = imported();
    const { txn } = applyTxnEdit(original, { merchant: 'Tesco', amount: -40 }, ctx());

    expect(txn.amount).toBe(-40);
    expect(txn.originalSource?.amount).toBe(-42.1); // payload's amount untouched
    expect(txn.originalSource?.raw).toBe('TESCO STORES 3829   42.10');
  });

  it('does not invent an originalSource for a plain (non-imported) txn', () => {
    const { txn } = applyTxnEdit(baseTxn(), { merchant: 'Greggs' }, ctx());
    // A manual txn has no source payload; the engine must not fabricate one.
    expect((txn as ImportedTransaction).originalSource).toBe(undefined);
  });

  it('never writes originalSource as an editable field (it is structural, not user-facing)', () => {
    const original = imported();
    // Even a full patch of editable fields leaves the payload alone.
    const { edits } = applyTxnEdit(
      original,
      { amount: -1, merchant: 'X', when: '2026-07-01T00:00:00.000Z', category: 'other', note: 'n' },
      ctx(),
    );
    expect(edits.some((e) => (e.field as string) === 'originalSource')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// determinism — at/by are inputs, never read from the clock
// ---------------------------------------------------------------------------
describe('applyTxnEdit — pure & deterministic', () => {
  it('produces identical edits for identical inputs (no Date.now, no Math.random in record bodies)', () => {
    const a = applyTxnEdit(baseTxn(), { amount: -7 }, ctx());
    const b = applyTxnEdit(baseTxn(), { amount: -7 }, ctx());

    // Records are field-for-field identical except for the unique id.
    const stripId = (e: { id: string }): unknown => {
      const { id: _id, ...rest } = e;
      return rest;
    };
    expect(a.edits.map(stripId)).toEqual(b.edits.map(stripId));
    expect(a.txn).toEqual(b.txn);
  });
});
