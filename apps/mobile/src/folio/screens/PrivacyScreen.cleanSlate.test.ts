// "Clear to empty" clean-slate contract — the Privacy screen's only release reset
// (apps/mobile/src/folio/screens/PrivacyScreen.tsx, handleClearToEmpty → confirmReset → performReset).
//
// The screen offers one gated destructive action: resetToEmpty(). Demo seeding still exists as test
// infrastructure, but is deliberately absent from the customer-facing privacy surface. This test pins
// the load-bearing promise: all three tier-3 gates are required and the result is genuinely empty.
//
// Node-safe by design: the screen `.tsx` imports the react-native runtime and so cannot load under the
// Node test runner (the repo's vitest glob is `apps/**/*.test.ts`; .tsx is never collected). The
// handler's wipe path is a thin, deterministic wrapper over exactly these calls —
// `if (!canStartFresh(gate)) return; resetToEmpty(); nav.go('start');`. We exercise that exact
// contract directly: build the cleared gate, run the same gate-then-wipe sequence the
// handler runs, and assert the result. `nav.go` / `Alert.alert` are pure UI (no store effect) and are
// intentionally out of scope here, exactly as in VisualizerScreen.addAll.test.ts.

import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  addTransaction,
  getState,
  hasAnyUserData,
  resetAll,
  resetToEmpty,
  setPartial,
  setReaderCandidates,
} from '../store';
import { canStartFresh, type StartFreshState } from '../lib/undoPolicy';
import type { CandidateMoneyItem } from '../lib/importSheet';

// The exact gate the handler builds once all three confirm steps have cleared.
const CLEARED_GATE: StartFreshState = { typedConfirm: true, exportedAck: true, finalConfirm: true };

// The cleanSlate handler's pure store sequence (PrivacyScreen.performReset(resetToEmpty, ...)):
// vet the gate, then wipe to empty. A blocked gate is a no-op,
// matching `if (!canStartFresh(gate)) return;`.
function clearToEmpty(gate: StartFreshState): boolean {
  if (!canStartFresh(gate)) return false;
  resetToEmpty();
  return true;
}

beforeEach(() => {
  // Clean, known seed before every test (the demo set: 3 pots + seeded transactions + 2 cycles).
  resetAll();
});

describe('Privacy "Clear to empty" — gated tier-3 clean slate', () => {
  it('is blocked unless ALL three gates clear — a partial gate wipes nothing', () => {
    // Start from the seeded demo app.
    expect(hasAnyUserData(getState())).toBe(true);

    // Each single-missing-gate combination must refuse: the engine returns false, so the handler
    // returns early and the demo data is untouched.
    const partials: StartFreshState[] = [
      { typedConfirm: false, exportedAck: true, finalConfirm: true },
      { typedConfirm: true, exportedAck: false, finalConfirm: true },
      { typedConfirm: true, exportedAck: true, finalConfirm: false },
      { typedConfirm: false, exportedAck: false, finalConfirm: false },
    ];
    for (const gate of partials) {
      const cleared = clearToEmpty(gate);
      expect(cleared).toBe(false); // gate refused — no wipe
      expect(hasAnyUserData(getState())).toBe(true); // data still present
    }
  });

  it('wipes to a GENUINELY empty app once the gate clears (no demo reseed)', () => {
    // Add some real user data on top of the demo seed so we can see it all go.
    addTransaction({ merchant: 'Tesco', amount: -42.1, category: 'food', source: 'manual' });
    setPartial({
      subPaused: { Spotify: true },
      calendarEvents: [{ id: 'e1', date: '2026-07-01', kind: 'out', title: 'Rent', amount: -900 }],
    });
    expect(hasAnyUserData(getState())).toBe(true);

    const cleared = clearToEmpty(CLEARED_GATE);
    expect(cleared).toBe(true); // gate cleared → the wipe ran

    const s = getState();
    // Every user-data slot is genuinely empty — and CRUCIALLY nothing was reseeded.
    expect(s.transactions).toEqual([]);
    expect(s.pots).toEqual([]);
    expect(s.subs).toEqual([]);
    expect(s.subPaused).toEqual({});
    expect(s.cycles).toEqual([]);
    expect(s.calendarEvents).toEqual([]);
    expect(hasAnyUserData(s)).toBe(false); // the whole point — a blank app, not a demo one
    // The cleared user is NOT re-onboarded, and the balance is a chosen empty (not a sample source).
    expect(s.onboarding.done).toBe(true);
    expect(s.currentBalance.amount).toBe(0);
    expect(s.currentBalance.source).not.toBe('sample');
  });

  it('remains distinct from the internal test seed — clean slate never reseeds', () => {
    // "Clear to empty" → genuinely empty.
    clearToEmpty(CLEARED_GATE);
    expect(hasAnyUserData(getState())).toBe(false);
    expect(getState().pots.length).toBe(0);
    expect(getState().transactions.length).toBe(0);

    // resetAll remains internal test infrastructure and is not exposed by PrivacyScreen.
    resetAll();
    expect(hasAnyUserData(getState())).toBe(true);
    expect(getState().pots.length).toBe(3); // demo pots back
    expect(getState().transactions.length).toBeGreaterThan(0); // seeded transactions back
  });

  it('does not expose demo reseeding in the release privacy screen', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'apps/mobile/src/folio/screens/PrivacyScreen.tsx'),
      'utf8',
    );
    expect(source).not.toContain('resetAll');
    expect(source).not.toContain('Reset to the demo');
  });

  it('review-before-truth holds — clearing posts nothing and leaves the reader queue empty', () => {
    // Stage some statement-reader candidates (tentative, never auto-counted).
    const candidate: CandidateMoneyItem = {
      id: 'reader-1',
      source: 'csv',
      kind: 'spend',
      merchant: 'Octopus Energy',
      amount: -118.4,
      confidence: 'low',
    };
    setReaderCandidates([candidate]);

    const cleared = clearToEmpty(CLEARED_GATE);
    expect(cleared).toBe(true);

    const s = getState();
    // Clearing to empty never promotes a candidate into a posted transaction.
    expect(s.transactions).toEqual([]);
    // The transient review queue is empty (review-before-truth: an unreviewed candidate is dropped,
    // never silently kept across a wipe).
    expect(s.readerCandidates).toEqual([]);
  });
});
