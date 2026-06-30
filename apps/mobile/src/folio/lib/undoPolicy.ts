/**
 * Undo-policy engine — ENGINES.md §6 "Undo windows — canonical policy"
 * (and §7 @rn-engine undo-policy).
 *
 * The prototype shipped an inconsistent mix of undo timings (Melo 8s, sub-pause
 * 3.5s, hold 4.5s, cancel 5s, some with no real undo). This module is the single
 * source of truth for the three canonical tiers the user decided on:
 *
 *   Tier 1 — immediate undo (snackbar). One window, `UNDO_WINDOW_MS = 30000`,
 *            for every normal destructive action: log spend/income, pause sub,
 *            move between pots, edit txn, dismiss nudge, accept Melo move.
 *
 *   Tier 2 — 7-day recoverable soft-delete. Ignored review items and removed
 *            subs/bills/pots/manual events are not destroyed; they get a
 *            `removedAt` stamp (`softDelete`), stay restorable for 7 days
 *            (`isRecoverable`), and are hard-deleted on the next sweep once past
 *            the window (`sweepExpired`).
 *
 *   Tier 3 — start fresh (nuke). Never one-tap reachable: requires a typed
 *            confirmation, an explicit "I've exported my data" acknowledgement,
 *            and a final confirm (`canStartFresh`) — all three.
 *
 * Pure and deterministic by design: `now` is always passed in (never read from
 * the clock), every helper is side-effect-free and returns fresh values, and
 * there are NO react-native imports, NO UI, and NO file/network I/O. This module
 * returns strings/objects; a thin native wrapper performs the actual snackbar,
 * persistence, and file-wipe later. The only type dependency, if needed, comes
 * from the data spine `@/folio/store`, imported relatively as `../store` so the
 * pure-logic test runner (no `@` alias) resolves it.
 */

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_RECOVERY_WINDOW = 7;

/**
 * Tier 1 — the single canonical immediate-undo window, in milliseconds.
 *
 * Every normal destructive action surfaces an undo snackbar for exactly this
 * long. ENGINES.md §6 D3 / 27_DECISION_LOG fix the floor at **>= 30s**, so this
 * is 30s — replacing the prototype's inconsistent 3.5s / 4.5s / 5s / 8s timings,
 * all of which were below the decided minimum and are now folded into this one.
 */
export const UNDO_WINDOW_MS = 30 * MS_PER_SECOND;

/**
 * Tier 2 — the recoverable-history window, in milliseconds (7 days).
 *
 * A soft-deleted item is restorable until this much time has elapsed since its
 * `removedAt` stamp; after that the next sweep hard-deletes it.
 */
export const RECOVERY_WINDOW_MS =
  DAYS_PER_RECOVERY_WINDOW * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Anything carrying an optional soft-delete stamp. */
export type Removable = {
  /** ISO timestamp of when the item was soft-deleted; absent = still active. */
  removedAt?: string;
};

/** The three independent gates that must all be cleared to wipe the app. */
export type StartFreshState = {
  /** The user typed the required confirmation phrase. */
  typedConfirm: boolean;
  /** The user explicitly acknowledged "I've exported my data". */
  exportedAck: boolean;
  /** The user tapped the final confirm. */
  finalConfirm: boolean;
};

/**
 * Parse an ISO timestamp to epoch milliseconds, failing fast on garbage. This is
 * an engine boundary; a malformed timestamp must throw, not silently produce NaN
 * that then poisons every comparison downstream.
 */
function epochMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`undoPolicy: expected an ISO timestamp, got "${iso}"`);
  }
  return ms;
}

/**
 * Tier 2 — soft-delete an item by stamping `removedAt`.
 *
 * Pure and non-destructive: returns a new object with the timestamp applied; the
 * input is never mutated. Re-stamping an already-removed item overwrites the old
 * timestamp (the latest removal wins). The native layer persists the result.
 */
export function softDelete<T extends object>(item: T, atIso: string): T & { removedAt: string } {
  // Validate the timestamp at the boundary so a bad stamp can't slip into state.
  epochMs(atIso);
  return { ...item, removedAt: atIso };
}

/**
 * Tier 2 — is a soft-deleted item still inside the 7-day recovery window?
 *
 * The boundary is inclusive: exactly 7 days after removal is still recoverable;
 * 7 days plus one millisecond is not. Clock skew that puts `now` *before*
 * `removedAt` (negative elapsed time) reads as recoverable, never as expired —
 * a future-dated clock must not silently hard-delete a fresh item.
 */
export function isRecoverable(removedAtIso: string, nowIso: string): boolean {
  const elapsed = epochMs(nowIso) - epochMs(removedAtIso);
  return elapsed <= RECOVERY_WINDOW_MS;
}

/**
 * Tier 2 — the hard-delete sweep.
 *
 * Returns a new array containing only the items worth keeping: everything that
 * has no `removedAt` (still active), plus every soft-deleted item still inside
 * the recovery window. Items removed more than 7 days ago are dropped. Pure: the
 * input array and its items are never mutated.
 */
export function sweepExpired<T extends object>(items: readonly T[], nowIso: string): T[] {
  return items.filter((item) => {
    // `removedAt` is an optional member, not guaranteed on the generic `T`; read
    // it through the `Removable` view rather than widening the public signature.
    const removedAt = (item as Removable).removedAt;
    if (removedAt === undefined) return true; // never removed -> always safe
    return isRecoverable(removedAt, nowIso);
  });
}

/**
 * Tier 3 — the start-fresh guard.
 *
 * The destructive wipe is permitted only when all three gates are cleared: the
 * typed confirmation, the explicit export acknowledgement, and the final
 * confirm. Any single missing gate blocks it — there is no one-tap or
 * two-of-three shortcut to wiping the app.
 */
export function canStartFresh(state: StartFreshState): boolean {
  return state.typedConfirm && state.exportedAck && state.finalConfirm;
}
