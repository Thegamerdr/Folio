// Undo-policy engine tests — acceptance criteria for ENGINES.md §6
// "Undo windows — canonical policy" (and §7 @rn-engine undo-policy).
//
// Pure, deterministic, Node-safe: this exercises only string/number/object
// logic with `now` taken as input (no Date.now(), no react-native, no DOM, no
// I/O), so it is a plain `.test.ts` collected by the apps/**/*.test.ts runner.
// Relative import of the engine module like the sibling store.test.ts / payday
// .test.ts (the runner has no @ alias).
//
// Contract under test (three canonical tiers):
//   Tier 1 — UNDO_WINDOW_MS = 6000 (single immediate-undo window for all
//            normal destructive actions).
//   Tier 2 — 7-day recoverable soft-delete:
//     softDelete(item, atIso)            -> stamps removedAt (non-destructive)
//     isRecoverable(removedAtIso, nowIso)-> true within 7 days inclusive
//     sweepExpired(items, nowIso)        -> drops only items >7 days old
//   Tier 3 — start fresh guard (double-confirm + export-offered):
//     canStartFresh(state)               -> needs typedConfirm && exportedAck
//                                           && finalConfirm (all three).

import { describe, expect, it } from 'vitest';

import {
  RECOVERY_WINDOW_MS,
  UNDO_WINDOW_MS,
  canStartFresh,
  isRecoverable,
  softDelete,
  sweepExpired,
} from './undoPolicy';

// ---------------------------------------------------------------------------
// Tier 1 — immediate undo window is the canonical six seconds.
// ---------------------------------------------------------------------------
describe('Tier 1 — UNDO_WINDOW_MS', () => {
  it('is exactly 6000ms', () => {
    expect(UNDO_WINDOW_MS).toBe(6000);
  });
});

// ---------------------------------------------------------------------------
// Tier 2 — softDelete stamps removedAt without mutating the input
// ---------------------------------------------------------------------------
describe('Tier 2 — softDelete', () => {
  it('returns a new item carrying the removedAt timestamp', () => {
    const item = { id: 'sub-1', name: 'Disney+' };
    const removed = softDelete(item, '2026-06-29T12:00:00.000Z');

    expect(removed.removedAt).toBe('2026-06-29T12:00:00.000Z');
    expect(removed.id).toBe('sub-1');
    expect(removed.name).toBe('Disney+');
  });

  it('does not mutate the original item (immutable, no removedAt leaks back)', () => {
    const item = { id: 'sub-1', name: 'Disney+' };
    softDelete(item, '2026-06-29T12:00:00.000Z');

    expect((item as { removedAt?: string }).removedAt).toBeUndefined();
  });

  it('overwrites a prior removedAt when re-stamped (latest removal wins)', () => {
    const first = softDelete({ id: 'p1' }, '2026-06-20T00:00:00.000Z');
    const second = softDelete(first, '2026-06-29T00:00:00.000Z');

    expect(second.removedAt).toBe('2026-06-29T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Tier 2 — isRecoverable at the 6d / 7d / 8d boundaries
// ---------------------------------------------------------------------------
describe('Tier 2 — isRecoverable boundaries', () => {
  const removedAt = '2026-06-01T00:00:00.000Z';

  it('is recoverable 6 days after removal (inside the window)', () => {
    expect(isRecoverable(removedAt, '2026-06-07T00:00:00.000Z')).toBe(true);
  });

  it('is recoverable at exactly 7 days (boundary is inclusive)', () => {
    expect(isRecoverable(removedAt, '2026-06-08T00:00:00.000Z')).toBe(true);
  });

  it('is NOT recoverable 8 days after removal (past the window)', () => {
    expect(isRecoverable(removedAt, '2026-06-09T00:00:00.000Z')).toBe(false);
  });

  it('is recoverable at the instant of removal (0ms elapsed)', () => {
    expect(isRecoverable(removedAt, removedAt)).toBe(true);
  });

  it('treats a future-dated now (clock skew) as still recoverable, not expired', () => {
    // Negative elapsed time must never read as "older than 7 days".
    expect(isRecoverable(removedAt, '2026-05-30T00:00:00.000Z')).toBe(true);
  });

  it('is recoverable one millisecond before the 7-day edge, gone one ms after', () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const base = Date.parse(removedAt);
    const justInside = new Date(base + sevenDaysMs).toISOString();
    const justOutside = new Date(base + sevenDaysMs + 1).toISOString();

    expect(isRecoverable(removedAt, justInside)).toBe(true);
    expect(isRecoverable(removedAt, justOutside)).toBe(false);
  });

  it('exposes the recovery window as exactly 7 days in ms', () => {
    expect(RECOVERY_WINDOW_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// Tier 2 — sweepExpired drops ONLY items older than 7 days
// ---------------------------------------------------------------------------
describe('Tier 2 — sweepExpired', () => {
  const now = '2026-06-29T00:00:00.000Z';
  const fresh = { id: 'fresh', removedAt: '2026-06-25T00:00:00.000Z' }; // 4d
  const edge = { id: 'edge', removedAt: '2026-06-22T00:00:00.000Z' }; // exactly 7d
  const stale = { id: 'stale', removedAt: '2026-06-21T00:00:00.000Z' }; // 8d
  const active = { id: 'active' }; // never removed (no removedAt)

  it('keeps fresh, edge (=7d) and never-removed items', () => {
    const kept = sweepExpired([fresh, edge, stale, active], now);
    const ids = kept.map((i) => i.id);

    expect(ids).toContain('fresh');
    expect(ids).toContain('edge');
    expect(ids).toContain('active');
  });

  it('drops only items removed more than 7 days ago', () => {
    const kept = sweepExpired([fresh, edge, stale, active], now);

    expect(kept.map((i) => i.id)).not.toContain('stale');
    expect(kept.length).toBe(3);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = [fresh, stale];
    const kept = sweepExpired(input, now);

    expect(kept).not.toBe(input);
    expect(input.length).toBe(2); // original untouched
  });

  it('is a no-op when nothing has expired', () => {
    const kept = sweepExpired([fresh, edge, active], now);
    expect(kept.length).toBe(3);
  });

  it('treats an item with no removedAt as permanently safe (never swept)', () => {
    const kept = sweepExpired([active], now);
    expect(kept).toEqual([active]);
  });
});

// ---------------------------------------------------------------------------
// Tier 3 — start-fresh guard requires ALL THREE confirmations
// ---------------------------------------------------------------------------
describe('Tier 3 — canStartFresh', () => {
  const allTrue = { typedConfirm: true, exportedAck: true, finalConfirm: true };

  it('allows start-fresh only when all three flags are set', () => {
    expect(canStartFresh(allTrue)).toBe(true);
  });

  it('blocks when the typed confirmation is missing', () => {
    expect(canStartFresh({ ...allTrue, typedConfirm: false })).toBe(false);
  });

  it('blocks when the export has not been acknowledged', () => {
    expect(canStartFresh({ ...allTrue, exportedAck: false })).toBe(false);
  });

  it('blocks when the final confirm is missing', () => {
    expect(canStartFresh({ ...allTrue, finalConfirm: false })).toBe(false);
  });

  it('blocks on an all-false (one-tap) attempt', () => {
    expect(canStartFresh({ typedConfirm: false, exportedAck: false, finalConfirm: false })).toBe(
      false,
    );
  });

  it('blocks every two-of-three combination (no shortcut past any gate)', () => {
    expect(canStartFresh({ typedConfirm: true, exportedAck: true, finalConfirm: false })).toBe(
      false,
    );
    expect(canStartFresh({ typedConfirm: true, exportedAck: false, finalConfirm: true })).toBe(
      false,
    );
    expect(canStartFresh({ typedConfirm: false, exportedAck: true, finalConfirm: true })).toBe(
      false,
    );
  });
});
