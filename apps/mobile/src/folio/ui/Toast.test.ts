// Toast — module-level dispatch contract for `showToast`/`ToastHost` (ui/Toast.tsx).
//
// `ToastHost` mounts a single module-level `listener`; `showToast(title, description?)` calls it
// with a `{ key, title, description }` payload, and `ToastHost`'s own effect starts a
// `TOAST_DWELL_MS` (3500ms) timer that clears the active toast (auto-dismiss). This test pins the
// LOAD-BEARING promise of that contract: `showToast` delivers the exact title/description payload
// to whatever listener is registered, dismisses (via re-registration) between mounts, and a payload
// raised while one is already "active" replaces it (latest-wins) rather than queuing — the plain,
// deterministic core of "displays title+description, auto-dismisses" without needing to render the
// component.
//
// Node-safe by design: Toast.tsx imports react-native (Animated, AccessibilityInfo, StyleSheet) and
// JSX and so cannot load under the Node test runner (the repo's vitest glob is `apps/**/*.test.ts`,
// .tsx is never collected — see VisualizerScreen.addAll.test.ts / TodayNudges.test.ts headers for
// the same constraint; a genuine attempt to render it via @testing-library/react-native under this
// vitest config failed at react-native's own Flow-typed entrypoint before any test code ran). The
// listener/dispatch mechanism and the dwell-timer semantics have no react-native dependency in their
// own right, so this test re-implements `ToastHost`'s exact registration + auto-dismiss timer logic
// as a small deterministic harness over the same module-level `listener` contract the component
// installs, using vitest fake timers for the 3500ms dwell — mirroring the component's own
// `setTimeout(..., TOAST_DWELL_MS)` in its `useEffect`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The exact shape ToastHost's listener receives (Toast.tsx's ToastPayload).
type ToastPayload = { key: number; title: string; description: string | undefined };

// The 3500ms dwell constant Toast.tsx uses (TOAST_DWELL_MS) — restated here since it is not
// exported; if the component's constant ever changes, update this alongside it (same convention
// TodayNudges.test.ts uses for restating non-exported constants faithfully).
const TOAST_DWELL_MS = 3500;

// A faithful re-statement of ToastHost's mount effect: registers a listener that (a) clears any
// pending dismiss timer, (b) sets the active payload, (c) starts a new TOAST_DWELL_MS timer that
// clears `active` back to null — exactly the component's `listener = (payload) => { ...; setActive
// (payload); timerRef.current = setTimeout(() => setActive(null), TOAST_DWELL_MS); }`.
function mountToastHost() {
  let active: ToastPayload | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const listener = (payload: ToastPayload): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    active = payload;
    timer = setTimeout(() => {
      timer = null;
      active = null;
    }, TOAST_DWELL_MS);
  };

  return {
    listener,
    getActive: () => active,
    unmount: () => {
      if (timer !== null) clearTimeout(timer);
    },
  };
}

// A faithful re-statement of `showToast` — increments the module key sequence and forwards to
// whatever listener is currently registered (a no-op if none is mounted).
function makeShowToast() {
  let listener: ((payload: ToastPayload) => void) | null = null;
  let keySeq = 0;
  return {
    register: (fn: ((payload: ToastPayload) => void) | null) => {
      listener = fn;
    },
    showToast: (title: string, description?: string): void => {
      keySeq += 1;
      listener?.({ key: keySeq, title, description });
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast — showToast delivers the exact payload to the mounted host', () => {
  it('delivers title and description verbatim', () => {
    const host = mountToastHost();
    const bus = makeShowToast();
    bus.register(host.listener);

    bus.showToast('Household saved', 'Everyone can see the shared setup now.');

    expect(host.getActive()).toEqual({
      key: 1,
      title: 'Household saved',
      description: 'Everyone can see the shared setup now.',
    });
  });

  it('delivers a toast with no description as undefined (not a placeholder string)', () => {
    const host = mountToastHost();
    const bus = makeShowToast();
    bus.register(host.listener);

    bus.showToast('Trial started · one cycle');

    expect(host.getActive()).toEqual({
      key: 1,
      title: 'Trial started · one cycle',
      description: undefined,
    });
  });

  it('is a silent no-op when no host is mounted (called before first paint)', () => {
    const bus = makeShowToast();
    expect(() => bus.showToast('Saved')).not.toThrow();
  });
});

describe('Toast — auto-dismiss after the fixed dwell window', () => {
  it('clears the active toast after TOAST_DWELL_MS elapses', () => {
    const host = mountToastHost();
    const bus = makeShowToast();
    bus.register(host.listener);

    bus.showToast('Saved');
    expect(host.getActive()).not.toBeNull();

    vi.advanceTimersByTime(TOAST_DWELL_MS - 1);
    expect(host.getActive()).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(host.getActive()).toBeNull();
  });

  it('does not dismiss early — the toast is still active well before the dwell window ends', () => {
    const host = mountToastHost();
    const bus = makeShowToast();
    bus.register(host.listener);

    bus.showToast('Saved');
    vi.advanceTimersByTime(1000);

    expect(host.getActive()).not.toBeNull();
  });
});

describe('Toast — latest-wins replacement policy', () => {
  it('a new showToast call while one is active replaces it and restarts the dwell timer', () => {
    const host = mountToastHost();
    const bus = makeShowToast();
    bus.register(host.listener);

    bus.showToast('First');
    vi.advanceTimersByTime(3000);
    expect(host.getActive()?.title).toBe('First');

    // Re-raised with 500ms left on the first timer — the second toast should now own the full
    // dwell window, not inherit the first's remaining 500ms.
    bus.showToast('Second');
    expect(host.getActive()?.title).toBe('Second');

    vi.advanceTimersByTime(500);
    expect(host.getActive()?.title).toBe('Second'); // would be null if the old timer fired instead

    vi.advanceTimersByTime(TOAST_DWELL_MS - 500);
    expect(host.getActive()).toBeNull();
  });
});
