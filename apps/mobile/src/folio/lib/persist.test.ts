// Native-persistence PURE-helper tests.
//
// `persist.ts` itself imports `expo-file-system` and resolves the `@/` alias,
// so it is NOT Node-safe and is NOT imported here (vitest runs in Node with no
// alias resolution and no RN/expo runtime). This file covers only the genuinely
// pure, Node-safe pieces of the persistence path:
//
//   1. The serialize ⇄ deserialize round-trip via the store's pure
//      `getPersistBlob()` / `hydrateFromBlob()` — the contract the native
//      adapter writes/reads on disk. Imported from the store directly (relative
//      path, no alias, no expo).
//   2. A self-contained copy of the pure `makeDebounced` helper, exercised with
//      vitest fake timers. (A copy, not an import, precisely because importing
//      persist.ts would pull expo into Node.)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPersistBlob, getState, hydrateFromBlob, resetAll, setPartial } from '../store';

// Mirror of persist.ts `makeDebounced` — kept in lockstep with the original.
// Pure (global timers only); copied so this test imports no expo.
function makeDebounced(
  fn: () => void,
  ms: number,
): { run: () => void; cancel: () => void } {
  let handle: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (handle !== null) {
      clearTimeout(handle);
      handle = null;
    }
  };
  const run = () => {
    cancel();
    handle = setTimeout(() => {
      handle = null;
      fn();
    }, ms);
  };
  return { run, cancel };
}

beforeEach(() => {
  resetAll();
});

// ---------------------------------------------------------------------------
// blob round-trip — getPersistBlob() → hydrateFromBlob() restores the state
// ---------------------------------------------------------------------------
describe('persist blob round-trip', () => {
  it('serializes then rehydrates user state faithfully', () => {
    // Put the store into a distinctive, non-default shape.
    setPartial({
      tightPointGoal: 250,
      nextYouNote: 'past-you wrote this',
      onboarding: { done: true, name: 'Sam', payday: 28, monthlyIncome: 3100 },
    });
    const blob = getPersistBlob();

    // Mutate away from that shape, then rehydrate from the captured blob.
    setPartial({ tightPointGoal: null, nextYouNote: '' });
    hydrateFromBlob(blob);

    const s = getState();
    expect(s.tightPointGoal).toBe(250);
    expect(s.nextYouNote).toBe('past-you wrote this');
    expect(s.onboarding.name).toBe('Sam');
    expect(s.onboarding.monthlyIncome).toBe(3100);
  });

  it('preserves transactions and pots across the round-trip', () => {
    setPartial({
      transactions: [
        { id: 'rt-1', when: '2026-06-01T00:00:00.000Z', merchant: 'Round Trip', amount: -9.99, category: 'fun', source: 'manual' },
      ],
    });
    const blob = getPersistBlob();
    const potsBefore = getState().pots.length;

    resetAll(); // back to seeded defaults
    hydrateFromBlob(blob);

    const s = getState();
    expect(s.transactions.find((t) => t.id === 'rt-1')?.merchant).toBe('Round Trip');
    expect(s.pots.length).toBe(potsBefore);
  });

  it('drops the ephemeral focus bridges (never persisted)', () => {
    setPartial({ calendarFocusDate: '2026-07-04', routeFocusDate: '2026-07-04' });
    const blob = getPersistBlob();
    const parsed = JSON.parse(blob) as Record<string, unknown>;

    expect('calendarFocusDate' in parsed).toBe(false);
    expect('routeFocusDate' in parsed).toBe(false);

    // And hydrating always lands them back at null (load() resets them).
    hydrateFromBlob(blob);
    expect(getState().calendarFocusDate).toBe(null);
    expect(getState().routeFocusDate).toBe(null);
  });

  it('a malformed blob is a safe no-op (state untouched)', () => {
    setPartial({ tightPointGoal: 77 });
    hydrateFromBlob('}{ not json');
    expect(getState().tightPointGoal).toBe(77);
  });
});

// ---------------------------------------------------------------------------
// makeDebounced — pure timer coalescing
// ---------------------------------------------------------------------------
describe('makeDebounced', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once after the quiet window, not per call', () => {
    const fn = vi.fn();
    const d = makeDebounced(fn, 400);

    d.run();
    d.run();
    d.run();
    expect(fn).not.toHaveBeenCalled(); // nothing before the window elapses

    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(1); // burst coalesced into one call
  });

  it('cancel() drops a pending call', () => {
    const fn = vi.fn();
    const d = makeDebounced(fn, 400);

    d.run();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('a later run after the window fires again', () => {
    const fn = vi.fn();
    const d = makeDebounced(fn, 400);

    d.run();
    vi.advanceTimersByTime(400);
    d.run();
    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
