/**
 * EDIT-TXN correction-history engine — ENGINES.md §6 "Editing existing
 * transactions — required, never destructive" (and §7 @rn-engine edit-txn).
 *
 * The web prototype's `SheetEditTxn` is a stub: save just closes. The shipped
 * rule is the opposite of destructive — an edit must keep an auditable trail and
 * must never overwrite the original out of existence:
 *
 *   - An edit produces a NEW transaction carrying the changed field values. The
 *     input transaction is never mutated.
 *   - Per changed field, the engine appends ONE immutable `TxnEdit` record whose
 *     `before` holds the prior value and `after` the new one. The original value
 *     therefore always survives inside the edit chain — walk the chain's oldest
 *     `before` to recover it. Nothing is lost.
 *   - The edited transaction keeps its `id`, so a caller swaps it in place: the
 *     edit REPLACES the row, it never adds a second one. No duplicate counting.
 *   - Imported items (PDF, OCR, paste, CSV, future open banking) carry their
 *     original source payload (`originalSource`) through every edit byte-for-byte.
 *     Re-import de-dupe compares against that payload, not the user-edited
 *     surface, so an edited merchant name never breaks de-dupe.
 *   - A no-op edit (a field set to its current value) records nothing.
 *
 * Pure and deterministic: no react-native, no UI, no file/network I/O, no
 * `Date.now`, no `Math.random`. `at` and `by` are inputs; the record `id` is
 * derived deterministically from the txn id, field, and `at`. The module returns
 * plain strings/objects; a thin native wrapper performs the actual store write
 * and Tier-1 undo later. The `Transaction` type comes from the data spine
 * `@/folio/store`, imported relatively as `../store` so the pure-logic test
 * runner (no `@` alias) resolves it.
 */

import type { Transaction } from '../store';

/** The user-facing fields a correction may touch. `originalSource` is
 *  structural (de-dupe anchor), never an editable field — see §6. */
export type EditableField = 'merchant' | 'amount' | 'when' | 'category' | 'note';

/** One immutable correction record. The transaction row shows the latest
 *  values; the history (these records) is auditable from the txn detail.
 *  `before`/`after` are the field's own value type, kept loose here because a
 *  single record type spans string, number, and category-union fields. */
export type TxnEdit = {
  /** Deterministic, derived from `${txnId}:${field}:${at}`. */
  id: string;
  /** The transaction this correction belongs to. */
  txnId: string;
  field: EditableField;
  /** Prior value (the original lives here — never overwritten elsewhere). */
  before: string | number | undefined;
  /** New value written by this edit. */
  after: string | number | undefined;
  /** ISO timestamp — an INPUT, so the engine stays deterministic. */
  at: string;
  /** Who made the correction. */
  by: 'user' | 'melo';
};

/** The opaque source payload an imported item keeps intact across edits.
 *  Shape is deliberately permissive — each reader (PDF/OCR/CSV/paste/open
 *  banking) fills what it has. The engine only ever carries it through
 *  unchanged; it never reads or mutates it. */
export type OriginalSource = {
  /** Which reader produced this item. */
  kind: 'pdf' | 'image' | 'paste' | 'csv' | 'txt' | 'open-banking';
  /** Best-effort raw line/record as the reader saw it. */
  raw?: string;
  /** The reader's own parse of merchant/amount/date, pre-user-edit. */
  merchant?: string;
  amount?: number;
  date?: string;
  /** ISO timestamp the item was imported. */
  importedAt?: string;
};

/** The spine `Transaction` plus the optional correction-era fields the edit
 *  engine reads/writes that the store type does not yet model: a free-text
 *  `note` and the preserved import payload. `string | undefined` (not a bare
 *  optional) on each so callers under exactOptionalPropertyTypes may pass
 *  through an undefined that flowed in from a plain txn. */
export type EditableTransaction = Transaction & {
  note?: string | undefined;
  originalSource?: OriginalSource | undefined;
};

/** A transaction that originated from an importer. Same shape as
 *  `EditableTransaction`; named for intent at call sites that deal with
 *  imported items and their `originalSource` de-dupe anchor. */
export type ImportedTransaction = EditableTransaction;

/** The fields a patch may set. All optional; only the present, actually-changed
 *  ones produce edits. `originalSource` is intentionally absent — it is not
 *  user-editable. */
export type TxnEditPatch = {
  merchant?: string;
  amount?: number;
  when?: string;
  category?: Transaction['category'];
  note?: string | undefined;
};

/** Caller-supplied context. Kept as inputs so the engine is deterministic and
 *  testable without a clock. */
export type EditTxnContext = {
  /** ISO timestamp stamped on every record this call emits. */
  at: string;
  /** Who is making the edit. */
  by: 'user' | 'melo';
};

/** The editable fields, in a stable order so multi-field edits emit records
 *  deterministically. */
const EDITABLE_FIELDS: readonly EditableField[] = [
  'merchant',
  'amount',
  'when',
  'category',
  'note',
];

/** Read a field off either the txn or the patch without index-signature access
 *  (keeps noUncheckedIndexedAccess happy and avoids `any`). */
function readField(
  src: EditableTransaction | TxnEditPatch,
  field: EditableField,
): string | number | undefined {
  switch (field) {
    case 'merchant':
      return src.merchant;
    case 'amount':
      return src.amount;
    case 'when':
      return src.when;
    case 'category':
      return src.category;
    case 'note':
      return src.note;
    default:
      return undefined;
  }
}

/**
 * Apply a correction to a transaction.
 *
 * Returns a NEW transaction carrying every actually-changed field, plus one
 * `TxnEdit` per changed field. The input is never mutated; the original values
 * survive inside the returned edit records. Imported items keep their
 * `originalSource` payload byte-for-byte. A field set to its current value is a
 * no-op and produces no record.
 *
 * @param txn   The current transaction (may be an `ImportedTransaction`).
 * @param patch The fields to change. Absent fields are left as-is.
 * @param ctx   `at`/`by` inputs (keeps the engine deterministic).
 */
export function applyTxnEdit<T extends EditableTransaction>(
  txn: T,
  patch: TxnEditPatch,
  ctx: EditTxnContext,
): { txn: T & EditableTransaction; edits: TxnEdit[] } {
  const edits: TxnEdit[] = [];
  // Start from a shallow copy so the input is never mutated. originalSource (if
  // present on T) rides along on the spread, untouched.
  const next: T & EditableTransaction = { ...txn };

  for (const field of EDITABLE_FIELDS) {
    // Only consider fields the patch actually carries.
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;

    const before = readField(txn, field);
    const after = readField(patch, field);

    // No-op: a field set to its current value records nothing.
    if (before === after) continue;

    edits.push({
      id: `${txn.id}:${field}:${ctx.at}`,
      txnId: txn.id,
      field,
      before,
      after,
      at: ctx.at,
      by: ctx.by,
    });

    applyField(next, field, after);
  }

  return { txn: next, edits };
}

/** Write one changed field onto the working copy, narrowed per field so the
 *  union types stay honest (no `any`, no unchecked cast of the whole record). */
function applyField(
  target: EditableTransaction,
  field: EditableField,
  value: string | number | undefined,
): void {
  switch (field) {
    case 'merchant':
      target.merchant = value as string;
      return;
    case 'amount':
      target.amount = value as number;
      return;
    case 'when':
      target.when = value as string;
      return;
    case 'category':
      target.category = value as Transaction['category'];
      return;
    case 'note':
      target.note = value as string | undefined;
      return;
    default:
      return;
  }
}
