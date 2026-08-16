// Toast — the generic paper-style confirmation toast (web-parity host for `sonner` toasts).
//
// The web design surfaces its confirmations with the `sonner` `toast(title, { description })` call
// (e.g. SheetHouseholdSetup's "Household saved", ScreenPaywall's "Trial started · one cycle"). RN has
// no equivalent host, so this is a small imperative toast primitive that mirrors that shape: a title,
// an optional description line, auto-dismiss after a fixed window, and a paper card presentation (NOT
// the ink "knockout" bar UndoToast uses — this toast carries no action, so it reads as a quiet paper
// surface note rather than a system-level undo prompt). It is DISTINCT from UndoToast, which is a
// separate Tier-1 undo affordance (ENGINES §6) with its own action + progress bar; this component must
// not disturb it.
//
// Usage: mount <ToastHost /> once near the shell root, then call the module-level `showToast(title,
// description?)` from anywhere (mirrors the web's global `toast(...)` call — no provider/context
// plumbing needed at each call site).
//
// Reduced-motion aware: under reduce-motion the toast appears/disappears at rest (no slide/fade), only
// the fixed dwell time elapses, mirroring the kit Sheet's + UndoToast's reduced-motion convention.
// Composes only confirmed design-system tokens from '@/folio/theme' (gap, radius, useTheme, Palette) —
// no new colour/font/spacing/radius/shadow token is defined here.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { elevation, gap, type Palette, radius, useTheme } from '@/folio/theme';

// How long a toast rests on screen before auto-dismissing — matches the web's typical sonner
// `duration` (3500-4500ms across the ported call sites) at a single representative value.
const TOAST_DWELL_MS = 3500;
const ANIM_MS = 220;

type ToastPayload = {
  key: number;
  title: string;
  description: string | undefined;
};

// The single live listener the host registers. A module-level ref (not React state/context) so any
// call site can raise a toast with one plain function call, mirroring the web's global `toast(...)`.
let listener: ((payload: ToastPayload) => void) | null = null;
let keySeq = 0;

// Imperative entry point — call from anywhere (screen, sheet, handler) to raise a toast. No-ops
// harmlessly if the host is not mounted yet (e.g. called before first paint).
export function showToast(title: string, description?: string): void {
  keySeq += 1;
  listener?.({ key: keySeq, title, description });
}

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

// Mount once near the shell root (a sibling overlay, like UndoProvider's toast). Owns the dismiss
// timer; a new showToast() call while one is visible replaces it (latest wins), matching UndoToast's
// single-toast policy.
export function ToastHost() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReducedMotion();

  const [active, setActive] = useState<ToastPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    listener = (payload: ToastPayload) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActive(payload);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setActive(null);
      }, TOAST_DWELL_MS);
    };
    return () => {
      listener = null;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (active === null) return undefined;
    if (reduceMotion) {
      progress.setValue(1);
      return undefined;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress, reduceMotion]);

  if (active === null) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <View pointerEvents="none" style={layout.host}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[s.toast, { opacity: progress, transform: [{ translateY }] }]}
      >
        <Text numberOfLines={2} style={s.title}>
          {active.title}
        </Text>
        {active.description ? (
          <Text numberOfLines={3} style={s.description}>
            {active.description}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

// Colour-free layout — safe across light and dark.
const layout = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: gap.xl,
    // Sit above the bottom nav, clear of UndoToast's own reserved band, so the two never overlap
    // when both happen to be live (last-write-wins per-host; each renders in its own overlay).
    paddingBottom: gap.xxxl + gap.xxl,
    alignItems: 'stretch',
  },
});

// Colour-bearing styles, resolved against the active palette `t`.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    // A quiet paper surface card (not the ink knockout bar UndoToast uses) — reads as a calm system
    // note rather than an action prompt.
    toast: {
      backgroundColor: t.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      paddingVertical: gap.md,
      paddingHorizontal: gap.lg,
      ...elevation.card,
    },
    title: {
      color: t.ink,
      fontSize: 13.5,
      fontWeight: '500',
      lineHeight: 18,
    },
    description: {
      marginTop: 2,
      color: t.muted,
      fontSize: 12,
      lineHeight: 17,
    },
  });
}
