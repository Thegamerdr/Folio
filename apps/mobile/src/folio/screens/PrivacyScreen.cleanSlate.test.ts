// "Clear to empty" clean-slate contract — the Privacy screen's distinct second reset
// (apps/mobile/src/folio/screens/PrivacyScreen.tsx, handleClearToEmpty → confirmReset → performReset).
//
// The screen offers TWO gated destructive resets over the SAME confirm chain + Undo shell:
//   • "Reset to the demo"  → resetAll()      — wipes the user's data and RESEEDS the sample/demo set.
//   • "Clear to empty"     → resetToEmpty()  — wipes to a GENUINELY empty app, no demo reseed.
// This test pins the load-bearing promise of the NEW "Clear to empty" path: gated behind the same
// tier-3 `canStartFresh` chain that "Reset to the demo" uses, it leaves a genuinely empty store (NOT
// the reseeded demo), and its Undo restores exactly what was there before.
//
// Node-safe by design: the screen `.tsx` imports the react-native runtime and so cannot load under the
// Node test runner (the repo's vitest glob is `apps/**/*.test.ts`; .tsx is never collected). The
// handler's wipe path is a thin, deterministic wrapper over exactly these calls —
// `if (!canStartFresh(gate)) return; const snapshot = { ...getState() }; resetToEmpty(); nav.go('start');`
// with an Undo of `setPartial(snapshot)` — none of which touches react-native. We exercise that exact
// contract directly: build the cleared gate, run the same gate-then-snapshot-then-wipe sequence the
// handler runs, and assert the result. `nav.go` / `Alert.alert` are pure UI (no store effect) and are
// intentionally out of scope here, exactly as in VisualizerScreen.addAll.test.ts.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  type AppState,
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

// The exact gate the handler builds once all three confirm steps have cleared. Reused by BOTH
// destructive resets, so "Clear to empty" can never be weaker than "Reset to the demo".
const CLEARED_GATE: StartFreshState = { typedConfirm: true, exportedAck: true, finalConfirm: true };

// The cleanSlate handler's pure store sequence (PrivacyScreen.performReset(resetToEmpty, ...)):
// vet the gate, snapshot for Undo, wipe to empty. Returns the snapshot so a test can assert Undo
// restores it. A blocked gate is a no-op that returns null (nothing snapshotted, nothing wiped),
// matching `if (!canStartFresh(gate)) return;`.
function clearToEmpty(gate: StartFreshState): AppState | null {
  if (!canStartFresh(gate)) return null;
  const snapshot = { ...getState() };
  resetToEmpty();
  return snapshot;
}

// The Undo branch — Alert.alert's "Undo" action restores the captured snapshot via setPartial.
function undo(snapshot: AppState): void {
  setPartial(snapshot);
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
      const snapshot = clearToEmpty(gate);
      expect(snapshot).toBeNull(); // gate refused — no snapshot, no wipe
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

    const snapshot = clearToEmpty(CLEARED_GATE);
    expect(snapshot).not.toBeNull(); // gate cleared → the wipe ran

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

  it('is DISTINCT from "Reset to the demo" — clean slate leaves empty, demo reset reseeds', () => {
    // "Clear to empty" → genuinely empty.
    clearToEmpty(CLEARED_GATE);
    expect(hasAnyUserData(getState())).toBe(false);
    expect(getState().pots.length).toBe(0);
    expect(getState().transactions.length).toBe(0);

    // "Reset to the demo" (resetAll) on the SAME app → reseeds the sample/demo set.
    resetAll();
    expect(hasAnyUserData(getState())).toBe(true);
    expect(getState().pots.length).toBe(3); // demo pots back
    expect(getState().transactions.length).toBeGreaterThan(0); // seeded transactions back
  });

  it('Undo restores exactly what was there before the clear', () => {
    addTransaction({ merchant: 'Greggs', amount: -3.5, category: 'food', source: 'manual' });
    const potsBefore = getState().pots.length;
    const txnsBefore = getState().transactions.length;

    const snapshot = clearToEmpty(CLEARED_GATE);
    expect(snapshot).not.toBeNull();
    // After the wipe the app is empty.
    expect(hasAnyUserData(getState())).toBe(false);

    // The user taps Undo on the snackbar → the pre-wipe state is restored verbatim.
    undo(snapshot as AppState);
    const s = getState();
    expect(hasAnyUserData(s)).toBe(true);
    expect(s.pots.length).toBe(potsBefore);
    expect(s.transactions.length).toBe(txnsBefore);
    expect(s.transactions.some((t) => t.merchant === 'Greggs')).toBe(true);
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

    const snapshot = clearToEmpty(CLEARED_GATE);
    expect(snapshot).not.toBeNull();

    const s = getState();
    // Clearing to empty never promotes a candidate into a posted transaction.
    expect(s.transactions).toEqual([]);
    // The transient review queue is empty (review-before-truth: an unreviewed candidate is dropped,
    // never silently kept across a wipe).
    expect(s.readerCandidates).toEqual([]);
  });
});
