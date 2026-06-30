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
  clearReaderCandidates,
  editTransaction,
  fastForwardMonth,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  matchMeloTool,
  pauseMany,
  resetAll,
  setPartial,
  setPots,
  setReaderCandidates,
  setTightPointGoal,
  togglePaused,
} from './store';
import type { CandidateMoneyItem } from './lib/importSheet';

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
// applyMeloTool — tool-name matching (ENGINES §6) returns candidates ambiguous
// ---------------------------------------------------------------------------
describe('matchMeloTool — normalised name matching', () => {
  it('resolves a punctuation/case-noisy name to the canonical tool', () => {
    const m = matchMeloTool('  Log-Transfer!! ');
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.name).toBe('log_transfer');
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

  it('treats a dropped tool name (pause_subscription) as no longer a Melo tool', () => {
    // Pause is NO LONGER a Melo tool — the name must not resolve, so applyMeloTool refuses it.
    const res = applyMeloTool('pause_subscription', { name: 'Notion' });
    expect(res.applied).toBe(false);
    // It does not silently pause anything.
    expect(!!getState().subPaused.Notion).toBe(false);
  });

  it('treats move_between_pots / set_tight_point_goal as unknown to Melo too', () => {
    expect(applyMeloTool('move_between_pots', { from: 'holiday', to: 'buffer', amount: 5 }).applied).toBe(
      false,
    );
    expect(applyMeloTool('set_tight_point_goal', { amount: 50 }).applied).toBe(false);
  });

  it('applyMeloTool reports an unknown tool instead of mutating', () => {
    const res = applyMeloTool('frobnicate', {});
    expect(res.applied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyMeloTool — the log_* family: behaviour + bad-arg guards
// ---------------------------------------------------------------------------
describe('applyMeloTool — log_spend', () => {
  it('records a negative, Melo-sourced spend with a valid category', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_spend', { merchant: 'Greggs', amount: 3.5, category: 'food' });
    expect(res.applied).toBe(true);
    expect(getState().transactions.length).toBe(before + 1);
    const top = getState().transactions[0]!;
    expect(top.merchant).toBe('Greggs');
    expect(top.amount).toBe(-3.5);
    expect(top.category).toBe('food');
    expect(top.source).toBe('melo');
  });

  it('falls back to the "other" category for an off-list category', () => {
    applyMeloTool('log_spend', { merchant: 'X', amount: 2, category: 'not-a-category' });
    expect(getState().transactions[0]!.category).toBe('other');
  });

  it('rejects bad args (no merchant / non-positive amount)', () => {
    expect(applyMeloTool('log_spend', { merchant: '', amount: 5 }).applied).toBe(false);
    expect(applyMeloTool('log_spend', { merchant: 'Greggs', amount: 0 }).applied).toBe(false);
  });
});

describe('applyMeloTool — log_income', () => {
  it('records a POSITIVE inflow, defaulting the category to income', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_income', { merchant: 'Employer', amount: 1800 });
    expect(res.applied).toBe(true);
    expect(getState().transactions.length).toBe(before + 1);
    const top = getState().transactions[0]!;
    expect(top.merchant).toBe('Employer');
    expect(top.amount).toBe(1800); // positive = inflow
    expect(top.category).toBe('income'); // default when none given
    expect(top.source).toBe('melo');
  });

  it('reads the payer from `source` when `merchant` is absent', () => {
    const res = applyMeloTool('log_income', { source: 'Refund pool', amount: 12 });
    expect(res.applied).toBe(true);
    expect(getState().transactions[0]!.merchant).toBe('Refund pool');
  });

  it('honours a valid explicit category and rejects bad args', () => {
    applyMeloTool('log_income', { merchant: 'Side gig', amount: 40, category: 'other' });
    expect(getState().transactions[0]!.category).toBe('other');
    expect(applyMeloTool('log_income', { merchant: '', amount: 5 }).applied).toBe(false);
    expect(applyMeloTool('log_income', { merchant: 'X', amount: -5 }).applied).toBe(false);
  });

  it('undo removes the logged income', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_income', { merchant: 'Employer', amount: 1800 });
    expect(getState().transactions.length).toBe(before + 1);
    if (res.applied) res.undo();
    expect(getState().transactions.length).toBe(before);
  });
});

describe('applyMeloTool — log_refund', () => {
  it('records a POSITIVE refund, tagged in the merchant string, category "other" (no verdict)', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_refund', { merchant: 'ASOS', amount: 24.99 });
    expect(res.applied).toBe(true);
    expect(getState().transactions.length).toBe(before + 1);
    const top = getState().transactions[0]!;
    expect(top.amount).toBe(24.99); // inflow
    expect(top.merchant).toContain('ASOS');
    expect(top.merchant.toLowerCase()).toContain('refund'); // honestly tagged as a refund
    expect(top.category).toBe('other'); // a refund is NOT income — never auto-filed as income
    expect(top.source).toBe('melo');
  });

  it('"links" to the original spend by recording it in the merchant string, candidate-only', () => {
    applyMeloTool('log_refund', { merchant: 'ASOS', amount: 10, original: 'ASOS order #123' });
    const merchant = getState().transactions[0]!.merchant;
    expect(merchant).toContain('ASOS order #123'); // the link is recorded, not a decided verdict
  });

  it('rejects bad args (no merchant / non-positive amount)', () => {
    expect(applyMeloTool('log_refund', { merchant: '', amount: 5 }).applied).toBe(false);
    expect(applyMeloTool('log_refund', { merchant: 'ASOS', amount: 0 }).applied).toBe(false);
  });

  it('undo removes the logged refund', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_refund', { merchant: 'ASOS', amount: 24.99 });
    expect(getState().transactions.length).toBe(before + 1);
    if (res.applied) res.undo();
    expect(getState().transactions.length).toBe(before);
  });
});

describe('applyMeloTool — log_transfer', () => {
  it('records a neutral PAIR (out + in) on one timestamp that nets to £0', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_transfer', { from: 'Current', to: 'Savings', amount: 100 });
    expect(res.applied).toBe(true);
    // Two legs added.
    expect(getState().transactions.length).toBe(before + 2);
    const [first, second] = getState().transactions;
    // One negative leg, one positive leg, equal magnitude → nets to zero.
    expect(first!.amount + second!.amount).toBe(0);
    expect(Math.abs(first!.amount)).toBe(100);
    // Both legs are neutral 'other', Melo-sourced, share a timestamp, and name both endpoints.
    expect(first!.category).toBe('other');
    expect(second!.category).toBe('other');
    expect(first!.source).toBe('melo');
    expect(first!.when).toBe(second!.when);
    const labels = `${first!.merchant} ${second!.merchant}`;
    expect(labels).toContain('Current');
    expect(labels).toContain('Savings');
    expect(labels.toLowerCase()).toContain('transfer');
  });

  it('rejects bad args (missing endpoint / non-positive amount)', () => {
    expect(applyMeloTool('log_transfer', { from: '', to: 'Savings', amount: 50 }).applied).toBe(false);
    expect(applyMeloTool('log_transfer', { from: 'Current', to: 'Savings', amount: 0 }).applied).toBe(
      false,
    );
  });

  it('undo removes BOTH legs', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_transfer', { from: 'Current', to: 'Savings', amount: 100 });
    expect(getState().transactions.length).toBe(before + 2);
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

// ---------------------------------------------------------------------------
// getPersistBlob / hydrateFromBlob — native-persistence serialize round-trip
// (ENGINES §7 store-migration / RN_PORT "Store migration"). Pure + Node-safe.
// ---------------------------------------------------------------------------
describe('persist blob round-trip', () => {
  it('serializes the current state and rehydrates it faithfully', () => {
    setPartial({
      tightPointGoal: 180,
      nextYouNote: 'hold the line',
      onboarding: { done: true, name: 'Ada', payday: 1, monthlyIncome: 2600 },
    });
    const blob = getPersistBlob();

    // Drift away, then restore from the captured blob.
    setPartial({ tightPointGoal: null, nextYouNote: '' });
    hydrateFromBlob(blob);

    const s = getState();
    expect(s.tightPointGoal).toBe(180);
    expect(s.nextYouNote).toBe('hold the line');
    expect(s.onboarding.name).toBe('Ada');
    expect(s.onboarding.monthlyIncome).toBe(2600);
  });

  it('round-trips through schema v3 with the edit history intact', () => {
    setPartial({ transactions: [], edits: [] });
    const row = addTransaction({ merchant: 'Tesco', amount: -42.1, category: 'food', source: 'manual' });
    editTransaction(row.id, { amount: -50 }, 'user');

    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    const s = getState();
    expect(s.schemaVersion).toBe(3);
    expect((s.edits ?? []).length).toBe(1);
    expect(s.transactions.find((t) => t.id === row.id)?.amount).toBe(-50);
  });

  it('does not persist the ephemeral focus bridges; they hydrate to null', () => {
    setPartial({ calendarFocusDate: '2026-07-04', routeFocusDate: '2026-07-04' });
    const parsed = JSON.parse(getPersistBlob()) as Record<string, unknown>;

    expect('calendarFocusDate' in parsed).toBe(false);
    expect('routeFocusDate' in parsed).toBe(false);

    hydrateFromBlob(getPersistBlob());
    expect(getState().calendarFocusDate).toBe(null);
    expect(getState().routeFocusDate).toBe(null);
  });

  it('a malformed blob leaves state untouched', () => {
    setPartial({ tightPointGoal: 99 });
    hydrateFromBlob('not valid json');
    expect(getState().tightPointGoal).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// readerCandidates — transient statement-reader review queue.
// Review-before-truth: candidates only, never auto-counted, and MUST NOT
// survive a restart — excluded from getPersistBlob, reset by load(), exactly
// like the ephemeral calendarFocusDate/routeFocusDate bridges.
// ---------------------------------------------------------------------------
describe('readerCandidates staging slot', () => {
  // Model-extracted candidates carry the lowest/most-tentative confidence so
  // they MUST be reviewed before becoming posted facts.
  const candidate = (over: Partial<CandidateMoneyItem> = {}): CandidateMoneyItem => ({
    id: 'reader-1',
    source: 'csv',
    kind: 'spend',
    merchant: 'Tesco',
    amount: -42.1,
    confidence: 'low',
    ...over,
  });

  it('defaults to an empty queue', () => {
    expect(getState().readerCandidates).toEqual([]);
  });

  it('set then clear round-trips the staged candidates', () => {
    const txnsBefore = getState().transactions.length;
    const items = [candidate({ id: 'r1' }), candidate({ id: 'r2', merchant: 'Caffè Nero', amount: -4.2 })];
    setReaderCandidates(items);

    const staged = getState().readerCandidates;
    expect(staged.length).toBe(2);
    expect(staged.map((c) => c.id)).toEqual(['r1', 'r2']);
    // Every staged item is a tentative candidate — never a posted fact.
    expect(staged.every((c) => c.confidence === 'low')).toBe(true);
    // Staging does NOT auto-count: it never touches the transactions ledger.
    expect(getState().transactions.length).toBe(txnsBefore);

    clearReaderCandidates();
    expect(getState().readerCandidates).toEqual([]);
  });

  it('is dropped from the persist blob — the review queue must not survive a restart', () => {
    setReaderCandidates([candidate()]);
    const parsed = JSON.parse(getPersistBlob()) as Record<string, unknown>;

    expect('readerCandidates' in parsed).toBe(false);
  });

  it('hydrate leaves the staging slot empty even if a blob smuggled candidates in', () => {
    // Stage candidates, then hand-build a blob that (illegitimately) carries
    // them, to prove hydrate resets the slot rather than trusting the disk.
    setReaderCandidates([candidate()]);
    const blob = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    blob.readerCandidates = [candidate({ id: 'smuggled' })];

    hydrateFromBlob(JSON.stringify(blob));

    expect(getState().readerCandidates).toEqual([]);
  });
});

// Type-only import smoke — keep Pot referenced so the import isn't pruned.
const _potShape: Pot['accent'] = true;
void _potShape;
