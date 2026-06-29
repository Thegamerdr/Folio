// Folio data-spine tests — pure-logic coverage for the RN store port
// (apps/mobile/src/folio/store.ts).
//
// The store is a module-level singleton (in-memory persisted blob, no DOM),
// so each test starts from a known clean seed via `resetAll()` in beforeEach.
// We assert only the deterministic logic: ordering + caps, pause toggles,
// reset semantics, Melo tool matching/guards/undo, fastForwardMonth
// determinism, transaction cap, and that seeding happens only on empty.
//
// Node-safe: touches only the store module (no react-native runtime, no DOM),
// so it is a plain `.test.ts` collected by the apps/**/*.test.ts runner.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  type CycleRecord,
  type Pot,
  type Transaction,
  addCycle,
  addTransaction,
  applyMeloTool,
  editTransaction,
  fastForwardMonth,
  getState,
  matchMeloTool,
  pauseMany,
  resetAll,
  setPartial,
  setPots,
  setTightPointGoal,
  togglePaused,
} from './store';

beforeEach(() => {
  // Clean, known seed before every test (defaults + seeded transactions).
  resetAll();
});

// ---------------------------------------------------------------------------
// addCycle — newest-first ordering + 24-cap
// ---------------------------------------------------------------------------
describe('addCycle', () => {
  const cyc = (label: string): CycleRecord => ({
    closedAt: `2026-07-${label.padStart(2, '0')}`,
    label,
    spare: 100,
    tightPoint: 40,
    setAside: 50,
    note: `note ${label}`,
  });

  it('prepends the new cycle so history is newest-first', () => {
    const before = getState().cycles.length;
    addCycle(cyc('1'));
    const cycles = getState().cycles;

    expect(cycles.length).toBe(before + 1);
    expect(cycles[0]!.label).toBe('1');
  });

  it('caps history at 24 cycles, dropping the oldest', () => {
    // Seed starts with 2 cycles; add 30 more → must clamp to 24, newest kept.
    for (let i = 1; i <= 30; i++) addCycle(cyc(String(i)));
    const cycles = getState().cycles;

    expect(cycles.length).toBe(24);
    expect(cycles[0]!.label).toBe('30'); // most recent at the head
  });

  it('clears nextYouNote when a cycle closes', () => {
    setPartial({ nextYouNote: 'past-you wrote this' });
    addCycle(cyc('1'));

    expect(getState().nextYouNote).toBe('');
  });
});

// ---------------------------------------------------------------------------
// pauseMany / togglePaused
// ---------------------------------------------------------------------------
describe('pauseMany / togglePaused', () => {
  it('pauseMany sets the given subs to the requested value', () => {
    pauseMany(['Spotify', 'Netflix'], true);
    const paused = getState().subPaused;

    expect(paused.Spotify).toBe(true);
    expect(paused.Netflix).toBe(true);
  });

  it('pauseMany can un-pause a batch', () => {
    pauseMany(['Spotify', 'Netflix'], true);
    pauseMany(['Spotify', 'Netflix'], false);
    const paused = getState().subPaused;

    expect(paused.Spotify).toBe(false);
    expect(paused.Netflix).toBe(false);
  });

  it('togglePaused flips when no explicit value is given', () => {
    expect(!!getState().subPaused.Notion).toBe(false);
    togglePaused('Notion');
    expect(getState().subPaused.Notion).toBe(true);
    togglePaused('Notion');
    expect(getState().subPaused.Notion).toBe(false);
  });

  it('togglePaused honours an explicit value', () => {
    togglePaused('iCloud', true);
    expect(getState().subPaused.iCloud).toBe(true);
    togglePaused('iCloud', true); // idempotent at the same value
    expect(getState().subPaused.iCloud).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetAll — clears tightPointGoal (and other state) back to defaults
// ---------------------------------------------------------------------------
describe('resetAll', () => {
  it('clears tightPointGoal back to null', () => {
    setTightPointGoal(150);
    expect(getState().tightPointGoal).toBe(150);

    resetAll();
    expect(getState().tightPointGoal).toBe(null);
  });

  it('restores the default pots and re-seeds transactions', () => {
    setPots([]);
    expect(getState().pots.length).toBe(0);

    resetAll();
    expect(getState().pots.length).toBe(3);
    expect(getState().transactions.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// applyMeloTool — pot match is case-insensitive substring
// ---------------------------------------------------------------------------
describe('applyMeloTool — pot matching', () => {
  it('matches a pot by case-insensitive substring of its name', () => {
    // Default pots include "Holiday · September" and "Buffer".
    const res = applyMeloTool('move_between_pots', { from: 'HOLIDAY', to: 'buff', amount: 20 });

    expect(res.applied).toBe(true);
    if (res.applied) {
      // summary uses the first word of each matched pot's name.
      expect(res.summary).toContain('Holiday');
      expect(res.summary).toContain('Buffer');
    }
  });

  it('move applies the transfer to pot balances', () => {
    const beforeHoliday = getState().pots.find((p) => p.id === 'holiday')!.saved;
    const beforeBuffer = getState().pots.find((p) => p.id === 'buffer')!.saved;

    applyMeloTool('move_between_pots', { from: 'holiday', to: 'buffer', amount: 20 });

    const afterHoliday = getState().pots.find((p) => p.id === 'holiday')!.saved;
    const afterBuffer = getState().pots.find((p) => p.id === 'buffer')!.saved;
    expect(afterHoliday).toBe(beforeHoliday - 20);
    expect(afterBuffer).toBe(beforeBuffer + 20);
  });
});

// ---------------------------------------------------------------------------
// applyMeloTool — tool-name matching (ENGINES §6) returns candidates ambiguous
// ---------------------------------------------------------------------------
describe('matchMeloTool — normalised name matching', () => {
  it('resolves a punctuation/case-noisy name to the canonical tool', () => {
    const m = matchMeloTool('  Pause-Subscription!! ');
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.name).toBe('pause_subscription');
  });

  it('resolves an unambiguous substring', () => {
    const m = matchMeloTool('log spend');
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.name).toBe('log_spend');
  });

  it('hands back candidates (or none) when the name does not resolve', () => {
    const m = matchMeloTool('totally unknown verb');
    expect(m.ok).toBe(false);
    if (!m.ok) expect(Array.isArray(m.candidates)).toBe(true);
  });

  it('applyMeloTool reports an unknown tool instead of mutating', () => {
    const res = applyMeloTool('frobnicate', {});
    expect(res.applied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyMeloTool — move_between_pots insufficient-funds guard
// ---------------------------------------------------------------------------
describe('applyMeloTool — move_between_pots guard', () => {
  it('refuses a move that exceeds the source balance and leaves state untouched', () => {
    const beforeHoliday = getState().pots.find((p) => p.id === 'holiday')!.saved;
    const beforeBuffer = getState().pots.find((p) => p.id === 'buffer')!.saved;

    const res = applyMeloTool('move_between_pots', { from: 'holiday', to: 'buffer', amount: 999_999 });

    expect(res.applied).toBe(false);
    if (!res.applied) expect(res.reason).toBe('insufficient funds');
    // No balances moved.
    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(beforeHoliday);
    expect(getState().pots.find((p) => p.id === 'buffer')!.saved).toBe(beforeBuffer);
  });

  it('rejects bad args (missing pot / non-positive amount)', () => {
    expect(applyMeloTool('move_between_pots', { from: 'nope', to: 'buffer', amount: 10 }).applied).toBe(false);
    expect(applyMeloTool('move_between_pots', { from: 'holiday', to: 'buffer', amount: 0 }).applied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// undo reversibility — all four Melo tools
// ---------------------------------------------------------------------------
describe('applyMeloTool — undo reversibility', () => {
  it('pause_subscription undo restores prior paused state', () => {
    // Notion starts un-paused.
    const res = applyMeloTool('pause_subscription', { name: 'Notion' });
    expect(res.applied).toBe(true);
    expect(getState().subPaused.Notion).toBe(true);

    if (res.applied) res.undo();
    expect(!!getState().subPaused.Notion).toBe(false);
  });

  it('move_between_pots undo restores both pot balances', () => {
    const beforeHoliday = getState().pots.find((p) => p.id === 'holiday')!.saved;
    const beforeBuffer = getState().pots.find((p) => p.id === 'buffer')!.saved;

    const res = applyMeloTool('move_between_pots', { from: 'holiday', to: 'buffer', amount: 35 });
    expect(res.applied).toBe(true);
    if (res.applied) res.undo();

    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(beforeHoliday);
    expect(getState().pots.find((p) => p.id === 'buffer')!.saved).toBe(beforeBuffer);
  });

  it('set_tight_point_goal undo restores the prior goal', () => {
    setTightPointGoal(200);
    const res = applyMeloTool('set_tight_point_goal', { amount: 50 });
    expect(res.applied).toBe(true);
    expect(getState().tightPointGoal).toBe(50);

    if (res.applied) res.undo();
    expect(getState().tightPointGoal).toBe(200);
  });

  it('log_spend undo removes the logged transaction', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_spend', { merchant: 'Greggs', amount: 3.5, category: 'food' });
    expect(res.applied).toBe(true);
    expect(getState().transactions.length).toBe(before + 1);
    // Logged as a negative spend, Melo-sourced.
    expect(getState().transactions[0]!.merchant).toBe('Greggs');
    expect(getState().transactions[0]!.amount).toBe(-3.5);
    expect(getState().transactions[0]!.source).toBe('melo');

    if (res.applied) res.undo();
    expect(getState().transactions.length).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// fastForwardMonth — determinism (the parts that do not use Math.random)
// ---------------------------------------------------------------------------
describe('fastForwardMonth', () => {
  it('rolls subs forward: nextRenewalDaysAway<=0 → 30, lastUsedDaysAgo +30', () => {
    // Force one sub to a non-positive renewal so the <=0 branch is exercised.
    setPartial({
      subs: [
        { name: 'Due', cost: 5, nextRenewalDaysAway: 0, lastUsedDaysAgo: 1, usesPerMonth: 4 },
        { name: 'Later', cost: 5, nextRenewalDaysAway: 12, lastUsedDaysAgo: 3, usesPerMonth: 4 },
      ],
    });

    fastForwardMonth();
    const subs = getState().subs;
    const due = subs.find((s) => s.name === 'Due')!;
    const later = subs.find((s) => s.name === 'Later')!;

    expect(due.nextRenewalDaysAway).toBe(30); // <=0 rolled to 30
    expect(due.lastUsedDaysAgo).toBe(31); // +30
    expect(later.nextRenewalDaysAway).toBe(12); // positive renewal unchanged
    expect(later.lastUsedDaysAgo).toBe(33); // +30
  });

  it('prepends a synthetic cycle and keeps the 24-cap', () => {
    const before = getState().cycles.length;
    fastForwardMonth();
    const cycles = getState().cycles;

    expect(cycles.length).toBe(before + 1);
    expect(cycles[0]!.note).toBe('Auto-closed via fast-forward.');
  });

  it('ages existing cycles backwards by ~30 days', () => {
    // Use a unique note (not a month label) to identify the original — the
    // synthetic head's label is the *current* month and could otherwise collide.
    setPartial({
      cycles: [{ closedAt: '2026-06-30', label: 'Original', spare: 1, tightPoint: 1, setAside: 1, note: 'orig-marker' }],
    });
    fastForwardMonth();
    // The aged original sits behind the new synthetic head.
    const aged = getState().cycles.find((c) => c.note === 'orig-marker')!;
    expect(aged.closedAt).toBe('2026-05-31'); // 2026-06-30 minus 30 days (UTC)
  });
});

// ---------------------------------------------------------------------------
// transactions — 200-cap, newest-first
// ---------------------------------------------------------------------------
describe('transactions cap', () => {
  it('keeps at most 200, newest first', () => {
    // Add 250 melo-logged spends; the head should be the most recent.
    for (let i = 0; i < 250; i++) {
      applyMeloTool('log_spend', { merchant: `M${i}`, amount: 1, category: 'other' });
    }
    const txns = getState().transactions;

    expect(txns.length).toBe(200);
    expect(txns[0]!.merchant).toBe('M249'); // last added is at the head
  });
});

// ---------------------------------------------------------------------------
// editTransaction — non-destructive correction history (ENGINES §6)
// ---------------------------------------------------------------------------
describe('editTransaction', () => {
  // Seed a single known manual row to correct, so assertions don't depend on
  // the default seed set.
  const seedOne = (over: Partial<Transaction> = {}): Transaction =>
    addTransaction({ merchant: 'Tesco', amount: -42.1, category: 'food', source: 'manual', ...over });

  it('replaces the row in place — same id, no duplicate, count unchanged', () => {
    setPartial({ transactions: [], edits: [] });
    const row = seedOne();
    const before = getState().transactions.length;

    editTransaction(row.id, { amount: -50 }, 'user');

    const txns = getState().transactions;
    expect(txns.length).toBe(before); // no double count
    const matches = txns.filter((t) => t.id === row.id);
    expect(matches.length).toBe(1); // exactly one row with that id
    expect(matches[0]!.amount).toBe(-50); // row carries the new value
    // The edit was recorded — the row update and the history grew together.
    expect((getState().edits ?? []).length).toBe(1);
  });

  it('appends one correction record per changed field, leaving the original recoverable', () => {
    setPartial({ transactions: [], edits: [] });
    const row = seedOne({ amount: -42.1, merchant: 'Tesco' });

    editTransaction(row.id, { amount: -50, merchant: 'Tesco Extra' }, 'user');

    const edits = getState().edits ?? [];
    // Two changed fields -> two records.
    expect(edits.length).toBe(2);
    const amountEdit = edits.find((e) => e.field === 'amount')!;
    const merchantEdit = edits.find((e) => e.field === 'merchant')!;
    // The original value survives inside `before` — nothing was overwritten away.
    expect(amountEdit.before).toBe(-42.1);
    expect(amountEdit.after).toBe(-50);
    expect(merchantEdit.before).toBe('Tesco');
    expect(merchantEdit.after).toBe('Tesco Extra');
    // Every record is attributed and stamped.
    expect(amountEdit.txnId).toBe(row.id);
    expect(amountEdit.by).toBe('user');
    expect(typeof amountEdit.at).toBe('string');
    expect(amountEdit.at.length).toBeGreaterThan(0);
  });

  it('records who made the edit (melo)', () => {
    setPartial({ transactions: [], edits: [] });
    const row = seedOne();
    editTransaction(row.id, { merchant: 'Greggs' }, 'melo');
    expect((getState().edits ?? [])[0]!.by).toBe('melo');
  });

  it('a no-op edit (field set to its current value) writes nothing', () => {
    setPartial({ transactions: [], edits: [] });
    const row = seedOne({ amount: -42.1 });

    editTransaction(row.id, { amount: -42.1 }, 'user');

    expect((getState().edits ?? []).length).toBe(0); // no record
    expect(getState().transactions.find((t) => t.id === row.id)!.amount).toBe(-42.1);
  });

  it('an unknown txn id is a safe no-op', () => {
    setPartial({ transactions: [], edits: [] });
    seedOne();
    editTransaction('does-not-exist', { amount: -1 }, 'user');
    expect((getState().edits ?? []).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// schema migration — v2 → v3 defaults the `edits` correction history
// ---------------------------------------------------------------------------
describe('schema migration v3', () => {
  it('defaults DEFAULTS/state to schemaVersion 3 with an empty edit history', () => {
    resetAll();
    expect(getState().schemaVersion).toBe(3);
    expect(getState().edits).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// seed only on empty — resetAll re-seeds; an explicit non-empty set survives
// ---------------------------------------------------------------------------
describe('seeding', () => {
  it('resetAll seeds transactions (fresh non-empty history)', () => {
    resetAll();
    expect(getState().transactions.length).toBeGreaterThan(0);
    // Seeded rows are labelled source:"seed".
    expect(getState().transactions.every((t) => t.source === 'seed')).toBe(true);
  });

  it('a user-set transaction list is not overwritten by a seed', () => {
    setPartial({
      transactions: [
        { id: 'only', when: new Date().toISOString(), merchant: 'Mine', amount: -1, category: 'other', source: 'manual' },
      ],
    });
    // No re-seed happens on a plain partial write.
    expect(getState().transactions.length).toBe(1);
    expect(getState().transactions[0]!.merchant).toBe('Mine');
  });
});

// Type-only import smoke — keep Pot referenced so the import isn't pruned.
const _potShape: Pot['accent'] = true;
void _potShape;
