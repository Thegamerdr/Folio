// useUndo — the Tier-1 undo provider (ENGINES §6 "Undo windows").
//
// This is the runtime that mounts an UndoToast for exactly `UNDO_WINDOW_MS` (the canonical 6s
// immediate-undo window from apps/mobile/src/folio/lib/undoPolicy.ts) and hands every screen a
// single call: `showUndo(label, onUndo)`. A destructive action does its store write, then raises
// `showUndo("Cancelled Netflix", restore)`; the toast appears, and if the user taps Undo inside the
// window the `restore` runs — otherwise the window lapses and the toast dismisses.
//
// It owns the TIMING half of the contract (the toast itself is presentation only). The window
// length is read from the policy engine (UNDO_WINDOW_MS), never hard-coded here, so the visible
// undo timing stays governed by the single source of truth.
//
// Single-toast policy (latest wins): a new showUndo while one is already showing replaces it. The
// outgoing toast is dismissed WITHOUT running its onUndo (the user moved on to a new action), then
// the new one mounts with a fresh window. This matches the prototype's one-snackbar-at-a-time feel.
//
// Reduced-motion is read once from the OS (AccessibilityInfo) and threaded into the toast so the
// progress bar rests instead of draining, mirroring how the kit Sheet appears at rest under
// reduce-motion. The window timer is unaffected — the 6s still elapses.
//
// No store, no engine, no native I/O beyond the OS reduce-motion read. It composes only the toast
// and the policy constant.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo } from 'react-native';

import { UNDO_WINDOW_MS } from '@/folio/lib/undoPolicy';
import { UndoToast } from '@/folio/ui/UndoToast';

// What a single live undo affordance carries. `key` lets React fully remount the toast (and so
// restart its progress animation) when a new action replaces a still-showing one.
type ActiveUndo = {
  key: number;
  label: string;
  onUndo: () => void;
};

// The one method every screen needs: raise an undo window for a just-completed destructive action.
type UndoApi = {
  showUndo: (label: string, onUndo: () => void) => void;
};

const UndoContext = createContext<UndoApi | null>(null);

// Reduced-motion preference (final state). Read once from the OS and kept live, mirroring the
// FolioShell's own useReducedMotion so the toast appears at rest when the user has asked for it.
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value: boolean) => setReduced(value),
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  const [active, setActive] = useState<ActiveUndo | null>(null);

  // The auto-dismiss timer for the current window, and a monotonic key source for remounts. Refs so
  // they survive re-renders without churning identity.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Tear the live toast down. The window timer is always cleared; the toast is unmounted.
  const dismiss = useCallback(() => {
    clearTimer();
    setActive(null);
  }, [clearTimer]);

  const showUndo = useCallback(
    (label: string, onUndo: () => void) => {
      // Latest wins: a new action supersedes any in-flight window. The outgoing one is dropped
      // (its onUndo is NOT run — the user chose a new action over undoing the old one) by simply
      // clearing the old timer before arming the new one.
      clearTimer();
      keyRef.current += 1;
      setActive({ key: keyRef.current, label, onUndo });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setActive(null);
      }, UNDO_WINDOW_MS);
    },
    [clearTimer],
  );

  // Tapping Undo: dismiss first, then run the caller's restore. Reading `active` at call time keeps
  // the closure honest even if a render is in flight.
  const handleUndo = useCallback(() => {
    const current = active;
    dismiss();
    current?.onUndo();
  }, [active, dismiss]);

  // Clear any pending timer on unmount so a backgrounded provider never fires into a dead tree.
  useEffect(() => clearTimer, [clearTimer]);

  const api = useMemo<UndoApi>(() => ({ showUndo }), [showUndo]);

  return (
    <UndoContext.Provider value={api}>
      {children}
      {active !== null ? (
        <UndoToast
          key={active.key}
          label={active.label}
          onUndo={handleUndo}
          onDismiss={dismiss}
          durationMs={UNDO_WINDOW_MS}
          reduceMotion={reduceMotion}
        />
      ) : null}
    </UndoContext.Provider>
  );
}

// The screen-facing hook. Throws if used outside the provider — a wiring bug should fail loudly,
// not silently swallow the undo affordance.
export function useUndo(): UndoApi {
  const ctx = useContext(UndoContext);
  if (ctx === null) {
    throw new Error('useUndo must be used within an <UndoProvider>.');
  }
  return ctx;
}
