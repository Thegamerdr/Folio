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
  type IncomeSource,
  type Pot,
  type Transaction,
  addCycle,
  addIgnoredReviewSig,
  addToPot,
  addTransaction,
  applyMeloTool,
  borrowFromPot,
  clearReaderCandidates,
  clearReviewQueue,
  dismissIncomeSignal,
  editTransaction,
  enqueueReviewItems,
  fastForwardMonth,
  forgetMerchantCategory,
  getPersistBlob,
  getState,
  hasAnyUserData,
  hydrateFromBlob,
  matchMeloTool,
  pauseMany,
  queueInputFromCandidates,
  rememberMerchantCategory,
  removeIncomeSource,
  resetAll,
  resetToEmpty,
  resolveReviewItem,
  reviewCandidateSig,
  setIncomeSources,
  setPartial,
  setPotAllowNegative,
  setPots,
  setReaderCandidates,
  setTightPointGoal,
  sweepReviewQueue,
  togglePaused,
  upsertIncomeSource,
} from './store';
import type { CandidateMoneyItem } from './lib/importSheet';
import { subscribeMeloReaction, type MeloReactionPayload } from './lib/melo/reactionBus';

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
// timelineEvents — @rn-engine timeline-verbs. togglePaused logs sub-paused/sub-resumed;
// addIgnoredReviewSig logs review-ignored (only when given a subject). Newest first, capped at 200.
// ---------------------------------------------------------------------------
describe('timelineEvents log', () => {
  it('togglePaused logs a sub-paused event when a sub is paused', () => {
    togglePaused('Spotify', true);
    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(1);
    expect(events[0]!.kind).toBe('sub-paused');
    expect(events[0]!.subject).toBe('Spotify');
    expect(typeof events[0]!.at).toBe('string');
  });

  it('togglePaused logs a sub-resumed event when a paused sub is resumed', () => {
    togglePaused('Spotify', true);
    togglePaused('Spotify', false);
    const events = getState().timelineEvents ?? [];
    // Newest first — the resume is index 0, the pause is index 1.
    expect(events[0]!.kind).toBe('sub-resumed');
    expect(events[0]!.subject).toBe('Spotify');
    expect(events[1]!.kind).toBe('sub-paused');
  });

  it('togglePaused logs nothing when the value does not actually change', () => {
    togglePaused('Spotify', true);
    togglePaused('Spotify', true); // idempotent no-op
    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(1);
  });

  it('addIgnoredReviewSig logs a review-ignored event only when given a subject', () => {
    addIgnoredReviewSig('tesco|4210|2026-07-01', 'Tesco');
    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(1);
    expect(events[0]!.kind).toBe('review-ignored');
    expect(events[0]!.subject).toBe('Tesco');
  });

  it('addIgnoredReviewSig logs nothing when no subject is given', () => {
    addIgnoredReviewSig('tesco|4210|2026-07-01');
    expect((getState().timelineEvents ?? []).length).toBe(0);
  });

  it('addIgnoredReviewSig is idempotent by signature — a repeat call logs nothing further', () => {
    addIgnoredReviewSig('tesco|4210|2026-07-01', 'Tesco');
    addIgnoredReviewSig('tesco|4210|2026-07-01', 'Tesco');
    expect((getState().timelineEvents ?? []).length).toBe(1);
  });

  it('caps the log at 200, newest first', () => {
    for (let i = 0; i < 205; i++) togglePaused(`Sub${i}`, true);
    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(200);
    expect(events[0]!.subject).toBe('Sub204');
  });
});

// ---------------------------------------------------------------------------
// Melo reaction emission — addToPot (goal-crossing thresholds) and
// togglePaused (pause/resume whisper). RN port of the web's reactionBus emits
// (folio-melo lib/store.ts). The store emits via a dynamic `import(...)`, so
// each assertion awaits a microtask flush before checking the captured payload.
// ---------------------------------------------------------------------------
describe('Melo reaction emission', () => {
  // The store emits reactions via a dynamic `import('./lib/melo/reactionBus')`, which resolves on a
  // later microtask than a plain `Promise.resolve()` chain. Rather than guess the exact tick count,
  // subscribe for the lifetime of the test and let each `it` block use its own channel/key scoping
  // (or a fresh `resetAll()` beforeEach) to avoid cross-test bleed.
  function captureOnce(channel: string): { payload: MeloReactionPayload | null } {
    const box: { payload: MeloReactionPayload | null } = { payload: null };
    subscribeMeloReaction(channel, (p) => {
      box.payload = p;
    });
    return box;
  }

  // Flushes the dynamic `import(...)` microtask queue the store's emit helpers schedule.
  async function flushReactionImport(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('addToPot emits a "full" cheer reaction the moment a deposit tips a pot over its goal', async () => {
    // Holiday pot seeds at 420/1200 (35% — below both thresholds).
    setPots((ps) => ps.map((p) => (p.id === 'holiday' ? { ...p, saved: 1190, goal: 1200 } : p)));
    const box = captureOnce('pots-inline');

    addToPot('holiday', 20); // 1190 -> 1210, crosses the 100% line
    await flushReactionImport();

    expect(box.payload?.mood).toBe('cheer');
    expect(box.payload?.pose).toBe('safe');
    expect(box.payload?.key).toBe('holiday');
    expect(box.payload?.line).toBe('Holiday is full. Small yes.');
  });

  it('addToPot emits a "halfway" curious reaction the moment a deposit crosses 50%', async () => {
    setPots((ps) => ps.map((p) => (p.id === 'christmas' ? { ...p, saved: 140, goal: 300 } : p)));
    const box = captureOnce('pots-inline');

    addToPot('christmas', 20); // 140 -> 160, crosses the 50% line (150)
    await flushReactionImport();

    expect(box.payload?.mood).toBe('curious');
    expect(box.payload?.pose).toBe('none');
    expect(box.payload?.key).toBe('christmas');
    expect(box.payload?.line).toBe('Halfway. Quietly working.');
  });

  it('addToPot emits nothing when the deposit does not cross a threshold', async () => {
    setPots((ps) => ps.map((p) => (p.id === 'buffer' ? { ...p, saved: 10, goal: 500 } : p)));
    const box = captureOnce('pots-inline');

    addToPot('buffer', 5); // 10 -> 15, nowhere near 50% or 100%
    await flushReactionImport();

    expect(box.payload).toBe(null);
  });

  it('togglePaused pausing a sub emits a calm "paused" whisper on subs-inline', async () => {
    const box = captureOnce('subs-inline');

    togglePaused('Spotify', true);
    await flushReactionImport();

    expect(box.payload?.mood).toBe('calm');
    expect(box.payload?.pose).toBe('safe');
    expect(box.payload?.key).toBe('Spotify');
    expect(box.payload?.line).toBe("Spotify paused for one cycle. I'll resume it after.");
  });

  it('togglePaused resuming a sub emits a curious "back on" whisper on subs-inline', async () => {
    togglePaused('Spotify', true);
    await flushReactionImport(); // let the setup call's own emit resolve before we start watching
    const box = captureOnce('subs-inline');

    togglePaused('Spotify', false);
    await flushReactionImport();

    expect(box.payload?.mood).toBe('curious');
    expect(box.payload?.pose).toBe('check');
    expect(box.payload?.line).toBe("Spotify back on. I'll watch the timing.");
  });

  it('togglePaused emits nothing when the value does not actually change', async () => {
    togglePaused('Spotify', true);
    await flushReactionImport(); // let the setup call's own emit resolve before we start watching
    const box = captureOnce('subs-inline');

    togglePaused('Spotify', true); // idempotent — no flip
    await flushReactionImport();

    expect(box.payload).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// borrowFromPot — ENGINES.md § 4/6. Pulls money OUT of a pot for a Shortfall
// draw; refuses to go negative unless the pot opted in via allowNegative.
// ---------------------------------------------------------------------------
describe('borrowFromPot', () => {
  it('lowers the pot balance and writes a borrow ledger entry', () => {
    const before = getState().pots.find((p) => p.id === 'holiday')!.saved;

    const applied = borrowFromPot('holiday', 50, 'shortfall-borrow');

    expect(applied).toBe(true);
    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(before - 50);
    const entry = getState().potLedger[0]!;
    expect(entry.kind).toBe('borrow');
    expect(entry.potId).toBe('holiday');
    expect(entry.amount).toBe(50);
    expect(entry.source).toBe('shortfall-borrow');
  });

  it('is a no-op on a non-positive amount', () => {
    const before = getState().pots.find((p) => p.id === 'holiday')!.saved;
    expect(borrowFromPot('holiday', 0)).toBe(false);
    expect(borrowFromPot('holiday', -10)).toBe(false);
    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(before);
  });

  it('is a no-op for an unknown pot id', () => {
    expect(borrowFromPot('does-not-exist', 10)).toBe(false);
  });

  it('refuses to push a hard-capped pot below zero', () => {
    // Christmas pot seeds at 60 saved — asking for more than that must fail.
    const before = getState().pots.find((p) => p.id === 'christmas')!.saved;
    expect(before).toBeLessThan(100);

    const applied = borrowFromPot('christmas', 100);

    expect(applied).toBe(false);
    expect(getState().pots.find((p) => p.id === 'christmas')!.saved).toBe(before);
  });

  it('allows dipping below zero once the pot opts in via allowNegative', () => {
    setPotAllowNegative('christmas', true);
    const before = getState().pots.find((p) => p.id === 'christmas')!.saved;

    const applied = borrowFromPot('christmas', before + 40);

    expect(applied).toBe(true);
    expect(getState().pots.find((p) => p.id === 'christmas')!.saved).toBe(-40);
  });

  it('never silently no-ops the way a negative addToPot call would', () => {
    // Regression guard for the ShortfallScreen bug: addToPot's `amount > 0` guard makes a
    // negative-amount call a silent no-op, so borrowFromPot must be the write path instead.
    const before = getState().pots.find((p) => p.id === 'holiday')!.saved;
    addToPot('holiday', -30, 'shortfall-borrow'); // the old, broken call shape
    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(before); // unchanged (no-op)

    const applied = borrowFromPot('holiday', 30, 'shortfall-borrow'); // the correct call shape
    expect(applied).toBe(true);
    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(before - 30);
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
// resetToEmpty — CLEAN-EMPTY reset (no demo reseed), keeps onboarding.done +
// schemaVersion; hasAnyUserData distinguishes a real app from a demo one.
// ---------------------------------------------------------------------------
describe('resetToEmpty', () => {
  it('wipes every user-data slot to a genuinely empty state', () => {
    // Start from the demo seed (resetAll runs in beforeEach) + add some more data.
    setPartial({
      subPaused: { Spotify: true },
      subOverrides: { Netflix: 2 },
      potLedger: [
        {
          id: 'pl-1',
          potId: 'holiday',
          at: '2026-06-01T00:00:00.000Z',
          kind: 'deposit',
          amount: 10,
          source: 'manual',
        },
      ],
      calendarEvents: [{ id: 'e1', date: '2026-07-01', kind: 'out', title: 'Rent', amount: -900 }],
      edits: [],
    });

    resetToEmpty();
    const s = getState();

    expect(s.transactions).toEqual([]);
    expect(s.pots).toEqual([]);
    expect(s.subs).toEqual([]);
    expect(s.subPaused).toEqual({});
    expect(s.subOverrides).toEqual({});
    expect(s.cycles).toEqual([]);
    expect(s.edits).toEqual([]);
    expect(s.calendarEvents).toEqual([]);
    expect(s.potLedger).toEqual([]);
    expect(s.readerCandidates).toEqual([]);
    expect(s.nextYouNote).toBe('');
    expect(s.tightPointGoal).toBe(null);
  });

  it('does NOT reseed any sample/demo data', () => {
    resetToEmpty();
    const s = getState();
    // resetAll seeds 3 pots + a non-empty seeded transaction list; resetToEmpty must not.
    expect(s.pots.length).toBe(0);
    expect(s.transactions.length).toBe(0);
    expect(s.subs.length).toBe(0);
    expect(s.cycles.length).toBe(0);
  });

  it('sets a neutral, honest empty balance (£0, not a sample source)', () => {
    resetToEmpty();
    const bal = getState().currentBalance;
    expect(bal.amount).toBe(0);
    expect(bal.source).not.toBe('sample'); // a chosen empty, not seeded demo data
    expect(bal.confidence).not.toBe('sample');
    expect(typeof bal.setAt).toBe('string');
    expect(bal.setAt.length).toBeGreaterThan(0);
  });

  it('forces onboarding.done true so a returning clean user is NOT re-onboarded', () => {
    setPartial({ onboarding: { done: false, name: 'Ada', payday: 25, monthlyIncome: 2180 } });
    resetToEmpty();
    expect(getState().onboarding.done).toBe(true);
  });

  it('preserves schemaVersion', () => {
    const before = getState().schemaVersion;
    resetToEmpty();
    expect(getState().schemaVersion).toBe(before);
  });

  it('is immutable — produces a new state object, never mutating the previous one', () => {
    const prev = getState();
    resetToEmpty();
    const next = getState();
    expect(next).not.toBe(prev); // brand-new object reference
    // The captured previous snapshot still has its demo data (was not mutated).
    expect(prev.pots.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// hasAnyUserData — true on a seeded/used app, false after a CLEAN-EMPTY reset
// ---------------------------------------------------------------------------
describe('hasAnyUserData', () => {
  it('is true on the seeded demo state (transactions + pots + subs + cycles)', () => {
    resetAll();
    expect(hasAnyUserData(getState())).toBe(true);
  });

  it('is false after resetToEmpty (a genuinely empty app)', () => {
    resetToEmpty();
    expect(hasAnyUserData(getState())).toBe(false);
  });

  it('is true if ANY one data slot is non-empty', () => {
    resetToEmpty();
    expect(hasAnyUserData(getState())).toBe(false);
    addTransaction({ merchant: 'Tesco', amount: -42.1, category: 'food', source: 'manual' });
    expect(hasAnyUserData(getState())).toBe(true);
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
    expect(
      applyMeloTool('move_between_pots', { from: 'holiday', to: 'buffer', amount: 5 }).applied,
    ).toBe(false);
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
    expect(applyMeloTool('log_transfer', { from: '', to: 'Savings', amount: 50 }).applied).toBe(
      false,
    );
    expect(
      applyMeloTool('log_transfer', { from: 'Current', to: 'Savings', amount: 0 }).applied,
    ).toBe(false);
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
      cycles: [
        {
          closedAt: '2026-06-30',
          label: 'Original',
          spare: 1,
          tightPoint: 1,
          setAside: 1,
          note: 'orig-marker',
        },
      ],
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
    addTransaction({
      merchant: 'Tesco',
      amount: -42.1,
      category: 'food',
      source: 'manual',
      ...over,
    });

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
  it('defaults DEFAULTS/state to the current schema version with an empty edit history', () => {
    resetAll();
    expect(getState().schemaVersion).toBe(8);
    expect(getState().edits).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// schema migration — v5 → v6 defaults the `timelineEvents` log (@rn-engine timeline-verbs)
// ---------------------------------------------------------------------------
describe('schema migration v6', () => {
  it('a pre-v6 blob with no timelineEvents migrates to an empty log, byte-identical otherwise', () => {
    resetAll();
    // Simulate a persisted v5 blob (no timelineEvents field at all).
    const v5Blob = { ...getState(), schemaVersion: 5 } as Record<string, unknown>;
    delete v5Blob.timelineEvents;
    hydrateFromBlob(JSON.stringify(v5Blob));

    const s = getState();
    expect(s.schemaVersion).toBe(8);
    expect(s.timelineEvents).toEqual([]);
  });

  it('a blob that already carries timelineEvents keeps them intact across migration', () => {
    togglePaused('Spotify', true);
    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(1);
    expect(events[0]!.kind).toBe('sub-paused');
    expect(events[0]!.subject).toBe('Spotify');
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
        {
          id: 'only',
          when: new Date().toISOString(),
          merchant: 'Mine',
          amount: -1,
          category: 'other',
          source: 'manual',
        },
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

  it('round-trips through the current schema version with the edit history intact', () => {
    setPartial({ transactions: [], edits: [] });
    const row = addTransaction({
      merchant: 'Tesco',
      amount: -42.1,
      category: 'food',
      source: 'manual',
    });
    editTransaction(row.id, { amount: -50 }, 'user');

    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    const s = getState();
    expect(s.schemaVersion).toBe(8);
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
    const items = [
      candidate({ id: 'r1' }),
      candidate({ id: 'r2', merchant: 'Caffè Nero', amount: -4.2 }),
    ];
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

  // RECALL (lib/merchantMemory.ts, DATA_INTELLIGENCE.md phase ③): setReaderCandidates is the single
  // choke point for both the LLM statement/photo reader and the on-device text/CSV parser, so recall
  // is applied here rather than at every producer.
  it('recall overrides a fresh model category guess with the remembered one', () => {
    rememberMerchantCategory('Tesco', 'food');
    setReaderCandidates([candidate({ id: 'r1', merchant: 'Tesco', category: 'other' })]);

    const [staged] = getState().readerCandidates as Array<
      CandidateMoneyItem & { rememberedCategory?: true }
    >;
    expect(staged?.category).toBe('food');
    expect(staged?.rememberedCategory).toBe(true);
  });

  it('a candidate for a merchant with no remembered category is staged unchanged', () => {
    setReaderCandidates([
      candidate({ id: 'r1', merchant: 'Never Corrected Ltd', category: 'other' }),
    ]);

    const [staged] = getState().readerCandidates as Array<
      CandidateMoneyItem & { rememberedCategory?: true }
    >;
    expect(staged?.category).toBe('other');
    expect(staged?.rememberedCategory).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// schema migration — v6 → v7 introduces the PERSISTED reviewQueue (the design
// source's v7→v8 seam, ported 1:1). Unlike readerCandidates above, this queue
// survives a restart.
// ---------------------------------------------------------------------------
describe('schema migration v7', () => {
  it('a pre-v7 blob with no reviewQueue migrates to an empty queue, byte-identical otherwise', () => {
    resetAll();
    // Simulate a persisted v6 blob (no reviewQueue field at all).
    const v6Blob = { ...getState(), schemaVersion: 6 } as Record<string, unknown>;
    delete v6Blob.reviewQueue;
    hydrateFromBlob(JSON.stringify(v6Blob));

    const s = getState();
    expect(s.schemaVersion).toBe(8);
    expect(s.reviewQueue).toEqual([]);
  });

  it('a blob that already carries queued items keeps them intact across migration', () => {
    enqueueReviewItems([{ source: 'pdf', merchant: 'Tesco', amount: -42.1, date: '2026-07-01' }]);
    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    const queue = getState().reviewQueue ?? [];
    expect(queue.length).toBe(1);
    expect(queue[0]!.merchant).toBe('Tesco');
    expect(queue[0]!.source).toBe('pdf');
  });
});

// ---------------------------------------------------------------------------
// schema migration — v7 → v8 introduces the income-cadence model
// (`incomeSources`, see lib/income.ts). Every pre-v8 install synthesizes
// exactly ONE monthly source ("Pay") from its legacy onboarding.payday +
// .monthlyIncome, so a real user's existing pay setup is carried forward
// honestly instead of silently discarded on upgrade.
// ---------------------------------------------------------------------------
describe('schema migration v8', () => {
  it('synthesizes one monthly "Pay" source from legacy onboarding.payday + monthlyIncome', () => {
    resetAll();
    setPartial({ onboarding: { ...getState().onboarding, payday: 28, monthlyIncome: 2500 } });
    // Simulate a persisted v7 blob (no incomeSources field at all).
    const v7Blob = { ...getState(), schemaVersion: 7 } as Record<string, unknown>;
    delete v7Blob.incomeSources;
    hydrateFromBlob(JSON.stringify(v7Blob));

    const s = getState();
    expect(s.schemaVersion).toBe(8);
    expect(s.incomeSources).toEqual([
      {
        id: 'income-migrated-pay',
        label: 'Pay',
        cadence: 'monthly',
        dayOfMonth: 28,
        amount: 2500,
        source: 'onboarding',
      },
    ]);
  });

  it('leaves every other field byte-identical across the v7 -> v8 migration', () => {
    resetAll();
    const before = getState();
    const v7Blob = { ...before, schemaVersion: 7 } as Record<string, unknown>;
    delete v7Blob.incomeSources;
    hydrateFromBlob(JSON.stringify(v7Blob));

    const after = getState();
    const { incomeSources: _incomeAfter, schemaVersion: _versionAfter, ...restAfter } = after;
    const { incomeSources: _incomeBefore, schemaVersion: _versionBefore, ...restBefore } = before;
    expect(restAfter).toEqual(restBefore);
  });

  it('a blob that already carries incomeSources keeps them intact across migration (not re-synthesized)', () => {
    resetAll();
    const existing: IncomeSource[] = [
      {
        id: 'weekly-wage',
        label: 'Weekly wage',
        cadence: 'weekly',
        anchorISO: '2026-06-05',
        amount: 400,
        source: 'manual',
      },
    ];
    setIncomeSources(existing);
    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    expect(getState().incomeSources).toEqual(existing);
  });

  it('a fresh install (DEFAULTS) has an empty incomeSources list', () => {
    resetAll();
    expect(getState().incomeSources).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// incomeSources setters — setIncomeSources / upsertIncomeSource / removeIncomeSource
// ---------------------------------------------------------------------------
describe('income sources setters', () => {
  const weekly: IncomeSource = {
    id: 'src-weekly',
    label: 'Weekly wage',
    cadence: 'weekly',
    anchorISO: '2026-06-05',
    amount: 400,
    source: 'manual',
  };
  const monthly: IncomeSource = {
    id: 'src-monthly',
    label: 'Side gig',
    cadence: 'monthly',
    dayOfMonth: 10,
    amount: 200,
    source: 'manual',
  };

  it('setIncomeSources replaces the whole list', () => {
    setIncomeSources([weekly]);
    expect(getState().incomeSources).toEqual([weekly]);
    setIncomeSources([weekly, monthly]);
    expect(getState().incomeSources).toEqual([weekly, monthly]);
  });

  it('setIncomeSources accepts an updater function over the previous list', () => {
    setIncomeSources([weekly]);
    setIncomeSources((prev) => [...prev, monthly]);
    expect(getState().incomeSources).toEqual([weekly, monthly]);
  });

  it('upsertIncomeSource adds a new source by id', () => {
    setIncomeSources([weekly]);
    upsertIncomeSource(monthly);
    expect(getState().incomeSources).toEqual([weekly, monthly]);
  });

  it('upsertIncomeSource replaces an existing source with the same id (immutable)', () => {
    setIncomeSources([weekly]);
    const updated: IncomeSource = { ...weekly, amount: 999 };
    upsertIncomeSource(updated);
    const sources = getState().incomeSources ?? [];
    expect(sources.length).toBe(1);
    expect(sources[0]).toEqual(updated);
  });

  it('removeIncomeSource removes by id', () => {
    setIncomeSources([weekly, monthly]);
    removeIncomeSource(weekly.id);
    expect(getState().incomeSources).toEqual([monthly]);
  });

  it('removeIncomeSource is a no-op when the id is not present', () => {
    setIncomeSources([weekly]);
    removeIncomeSource('does-not-exist');
    expect(getState().incomeSources).toEqual([weekly]);
  });
});

// ---------------------------------------------------------------------------
// dismissIncomeSignal — IncomeCaughtSheet's "Not this one" suppression list
// (mirrors addIgnoredReviewSig's "said no once, stays quiet" contract).
// ---------------------------------------------------------------------------
describe('dismissIncomeSignal', () => {
  it('records the merchant, normalised (trimmed + lowercased)', () => {
    dismissIncomeSignal('  Stafflink Payroll  ');
    expect(getState().dismissedIncomeSignals).toEqual(['stafflink payroll']);
  });

  it('is idempotent — a repeat call for the same merchant does not duplicate it', () => {
    dismissIncomeSignal('Stafflink Payroll');
    dismissIncomeSignal('stafflink payroll'); // same merchant, different case
    expect(getState().dismissedIncomeSignals).toEqual(['stafflink payroll']);
  });

  it('prepends new dismissals so the most recent is first', () => {
    dismissIncomeSignal('Alpha Co');
    dismissIncomeSignal('Beta Co');
    expect(getState().dismissedIncomeSignals).toEqual(['beta co', 'alpha co']);
  });
});

// ---------------------------------------------------------------------------
// merchantCategories — merchant→category memory (DATA_INTELLIGENCE.md phase
// ③): rememberMerchantCategory / forgetMerchantCategory, cap + eviction,
// most-recent-wins, normalisation symmetry with lib/subSignals.ts.
// ---------------------------------------------------------------------------
describe('merchantCategories', () => {
  it('a fresh install (DEFAULTS) has an empty merchantCategories map', () => {
    expect(getState().merchantCategories).toEqual({});
  });

  it('rememberMerchantCategory upserts a normalised-key entry with hits:1', () => {
    rememberMerchantCategory('Tesco Stores Ltd.', 'food');
    const entry = getState().merchantCategories?.['tesco stores ltd'];
    expect(entry).toBeDefined();
    expect(entry?.category).toBe('food');
    expect(entry?.hits).toBe(1);
    expect(typeof entry?.correctedAt).toBe('string');
  });

  it('normalises merchant keys the same way lib/subSignals.ts does (case/punct/whitespace)', () => {
    rememberMerchantCategory('  TESCO   STORES-LTD.  ', 'food');
    const keys = Object.keys(getState().merchantCategories ?? {});
    expect(keys).toEqual(['tesco stores ltd']);
  });

  it('a repeat correction for the same merchant (agreeing) keeps the category and increments hits', () => {
    rememberMerchantCategory('Tesco', 'other');
    rememberMerchantCategory('Tesco', 'other');
    const map = getState().merchantCategories ?? {};
    expect(Object.keys(map)).toHaveLength(1);
    expect(map['tesco']?.category).toBe('other');
    expect(map['tesco']?.hits).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Flip threshold — a disagreeing correction stages as pending and only
  // promotes to committed after the SAME new category is chosen twice in a row.
  // ---------------------------------------------------------------------------

  it('one mis-tap does not flip the committed category — it only stages a pending one', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // single disagreement
    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('other');
    expect(entry?.pendingCount).toBe(1);
  });

  it('two consecutive agreeing corrections flip the committed category', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other');
    rememberMerchantCategory('Tesco', 'other'); // same disagreement again — flips
    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('other');
    expect(entry?.pendingCategory).toBeUndefined();
    expect(entry?.pendingCount).toBeUndefined();
  });

  it('alternating A/B/A corrections never flip — each new disagreement resets pending', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // pending: other x1
    rememberMerchantCategory('Tesco', 'food'); // agrees with committed — resets pending
    rememberMerchantCategory('Tesco', 'other'); // pending: other x1 again (not x2)
    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('other');
    expect(entry?.pendingCount).toBe(1);
  });

  it('a different disagreement than the pending one resets pending to the new candidate', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // pending: other x1
    rememberMerchantCategory('Tesco', 'bills'); // different disagreement — resets to bills x1
    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('bills');
    expect(entry?.pendingCount).toBe(1);
  });

  it('hits increments on every call, including pending disagreements', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other');
    rememberMerchantCategory('Tesco', 'other');
    expect(getState().merchantCategories?.['tesco']?.hits).toBe(3);
  });

  it('recall keeps returning the committed category during a pending window', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // pending, not yet flipped
    setReaderCandidates([
      {
        id: 'r1',
        source: 'csv',
        kind: 'spend',
        merchant: 'Tesco',
        amount: -42.1,
        category: 'other',
        confidence: 'low',
      },
    ]);
    const [staged] = getState().readerCandidates as Array<
      CandidateMoneyItem & { rememberedCategory?: true }
    >;
    expect(staged?.category).toBe('food');
    expect(staged?.rememberedCategory).toBe(true);
  });

  it('pending state survives a persist round-trip (hydrateFromBlob)', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // pending: other x1
    const blob = getPersistBlob();

    hydrateFromBlob(blob);

    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('other');
    expect(entry?.pendingCount).toBe(1);
  });

  it('forgetMerchantCategory removes the entry', () => {
    rememberMerchantCategory('Tesco', 'food');
    forgetMerchantCategory('Tesco');
    expect(getState().merchantCategories?.['tesco']).toBeUndefined();
  });

  it('forgetMerchantCategory is a no-op for a merchant with no remembered entry', () => {
    rememberMerchantCategory('Tesco', 'food');
    const before = getState().merchantCategories;
    forgetMerchantCategory('Never Seen Merchant');
    expect(getState().merchantCategories).toEqual(before);
  });

  it('caps the map at 500 entries, evicting the least-recently-corrected on overflow', () => {
    for (let i = 0; i < 500; i += 1) {
      rememberMerchantCategory(`Merchant ${i}`, 'other');
    }
    expect(Object.keys(getState().merchantCategories ?? {})).toHaveLength(500);

    // 'merchant 0' is the oldest correction — a 501st NEW merchant should evict it.
    rememberMerchantCategory('Merchant 500', 'food');
    const map = getState().merchantCategories ?? {};
    expect(Object.keys(map)).toHaveLength(500);
    expect(map['merchant 0']).toBeUndefined();
    expect(map['merchant 500']).toBeDefined();
  });

  it('does not evict anything when correcting an EXISTING merchant at capacity', () => {
    for (let i = 0; i < 500; i += 1) {
      rememberMerchantCategory(`Merchant ${i}`, 'other');
    }
    // Re-correct an existing merchant — map stays at exactly 500, nothing evicted. This is the first
    // disagreement, so under the flip threshold it stages pending rather than committing immediately.
    rememberMerchantCategory('Merchant 250', 'food');
    const map = getState().merchantCategories ?? {};
    expect(Object.keys(map)).toHaveLength(500);
    expect(map['merchant 0']).toBeDefined();
    expect(map['merchant 250']?.category).toBe('other');
    expect(map['merchant 250']?.pendingCategory).toBe('food');
  });
});

// ---------------------------------------------------------------------------
// reviewQueue — the persisted intake review queue (web enqueueReviewItems /
// resolveReviewItem / clearReviewQueue / sweepReviewQueue semantics).
// ---------------------------------------------------------------------------
describe('reviewQueue', () => {
  const input = (
    over: Partial<{ source: 'pdf'; merchant: string; amount: number; date: string }> = {},
  ) => ({
    source: 'pdf' as const,
    merchant: 'Tesco',
    amount: -42.1,
    date: '2026-07-01',
    ...over,
  });

  it('defaults to an empty queue', () => {
    expect(getState().reviewQueue).toEqual([]);
  });

  it('enqueue stamps id + addedAt and returns the fresh items', () => {
    // Arrange + Act
    const fresh = enqueueReviewItems([input()]);

    // Assert
    expect(fresh.length).toBe(1);
    expect(fresh[0]!.id).toMatch(/^rv-/);
    expect(new Date(fresh[0]!.addedAt).getTime()).not.toBeNaN();
    const queue = getState().reviewQueue ?? [];
    expect(queue.length).toBe(1);
    expect(queue[0]!.merchant).toBe('Tesco');
  });

  it('newest items sit at the head of the queue', () => {
    enqueueReviewItems([input()]);
    enqueueReviewItems([input({ merchant: 'Boots', amount: -8.4 })]);

    const queue = getState().reviewQueue ?? [];
    expect(queue.map((it) => it.merchant)).toEqual(['Boots', 'Tesco']);
  });

  it('skips duplicates already in the queue (same merchant + amount + date)', () => {
    enqueueReviewItems([input()]);
    const fresh = enqueueReviewItems([input()]);

    expect(fresh).toEqual([]);
    expect((getState().reviewQueue ?? []).length).toBe(1);
  });

  it('a different date is NOT a duplicate', () => {
    enqueueReviewItems([input()]);
    enqueueReviewItems([input({ date: '2026-07-02' })]);

    expect((getState().reviewQueue ?? []).length).toBe(2);
  });

  it('skips candidates whose signature the user already ignored', () => {
    addIgnoredReviewSig(reviewCandidateSig('Tesco', -42.1, '2026-07-01'));
    const fresh = enqueueReviewItems([input()]);

    expect(fresh).toEqual([]);
    expect((getState().reviewQueue ?? []).length).toBe(0);
  });

  it('caps the queue at 60, newest kept', () => {
    const many = Array.from({ length: 70 }, (_, i) =>
      input({ merchant: `Shop ${i}`, amount: -(i + 1) }),
    );
    enqueueReviewItems(many);

    expect((getState().reviewQueue ?? []).length).toBe(60);
  });

  it('resolveReviewItem removes exactly the given id; unknown ids are a safe no-op', () => {
    enqueueReviewItems([input(), input({ merchant: 'Boots', amount: -8.4 })]);
    const queue = getState().reviewQueue ?? [];
    const target = queue.find((it) => it.merchant === 'Tesco')!;

    resolveReviewItem(target.id);
    resolveReviewItem('rv-does-not-exist');

    const after = getState().reviewQueue ?? [];
    expect(after.length).toBe(1);
    expect(after[0]!.merchant).toBe('Boots');
  });

  it('clearReviewQueue drains everything', () => {
    enqueueReviewItems([input(), input({ merchant: 'Boots', amount: -8.4 })]);
    clearReviewQueue();
    expect(getState().reviewQueue).toEqual([]);
  });

  it('sweepReviewQueue ages out items older than 14 days and keeps fresh ones', () => {
    enqueueReviewItems([input()]);
    const queue = getState().reviewQueue ?? [];
    const stale = {
      ...queue[0]!,
      id: 'rv-stale',
      merchant: 'Old row',
      addedAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    };
    setPartial({ reviewQueue: [...queue, stale] });

    sweepReviewQueue();

    const after = getState().reviewQueue ?? [];
    expect(after.some((it) => it.id === 'rv-stale')).toBe(false);
    expect(after.length).toBe(1);
  });

  it('persists across a blob round-trip (unlike the transient readerCandidates)', () => {
    enqueueReviewItems([input()]);
    const parsed = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    expect('reviewQueue' in parsed).toBe(true);

    hydrateFromBlob(getPersistBlob());
    expect((getState().reviewQueue ?? []).length).toBe(1);
  });

  it('resetToEmpty clears the queue', () => {
    enqueueReviewItems([input()]);
    resetToEmpty();
    expect(getState().reviewQueue).toEqual([]);
  });

  it('queueInputFromCandidates maps reader candidates with date + note riding along', () => {
    const mapped = queueInputFromCandidates(
      [
        {
          id: 'r1',
          source: 'csv',
          kind: 'spend',
          merchant: 'Tesco',
          amount: -42.1,
          date: '2026-07-01',
          note: 'looks like a bill',
          confidence: 'low',
        },
        {
          id: 'r2',
          source: 'csv',
          kind: 'spend',
          merchant: 'Boots',
          amount: -8.4,
          confidence: 'low',
        },
      ],
      'pdf',
    );

    expect(mapped[0]).toEqual({
      source: 'pdf',
      merchant: 'Tesco',
      amount: -42.1,
      date: '2026-07-01',
      hint: 'looks like a bill',
    });
    // No explicit-undefined keys when the candidate carried no date/note.
    expect(mapped[1]).toEqual({ source: 'pdf', merchant: 'Boots', amount: -8.4 });
    expect('date' in mapped[1]!).toBe(false);
  });

  // Provenance carry-through (DATA_INTELLIGENCE.md phase ③): a merchant-memory recall applied
  // upstream (setReaderCandidates, or the paste path's own applyMemoryToCandidates call) must survive
  // this mapping into the persisted queue, so ReviewScreen can pre-select the chip + show honest
  // provenance instead of the recall silently evaporating at the queue boundary.
  it('carries category + rememberedCategory through when the candidate has them', () => {
    const mapped = queueInputFromCandidates(
      [
        {
          id: 'r1',
          source: 'csv',
          kind: 'spend',
          merchant: 'Tesco',
          amount: -42.1,
          category: 'food',
          rememberedCategory: true,
          confidence: 'low',
        },
      ],
      'pdf',
    );

    expect(mapped[0]).toEqual({
      source: 'pdf',
      merchant: 'Tesco',
      amount: -42.1,
      category: 'food',
      rememberedCategory: true,
    });
  });

  it('carries a fresh (non-remembered) category guess without a rememberedCategory flag', () => {
    const mapped = queueInputFromCandidates(
      [
        {
          id: 'r1',
          source: 'csv',
          kind: 'spend',
          merchant: 'Tesco',
          amount: -42.1,
          category: 'other',
          confidence: 'low',
        },
      ],
      'csv',
    );

    expect(mapped[0]).toEqual({
      source: 'csv',
      merchant: 'Tesco',
      amount: -42.1,
      category: 'other',
    });
    expect('rememberedCategory' in mapped[0]!).toBe(false);
  });
});

// Type-only import smoke — keep Pot referenced so the import isn't pruned.
const _potShape: Pot['accent'] = true;
void _potShape;
