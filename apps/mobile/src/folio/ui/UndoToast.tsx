// UndoToast — the Tier-1 immediate-undo snackbar (ENGINES §6 "Undo windows").
//
// Per the canonical undo policy (apps/mobile/src/folio/lib/undoPolicy.ts), every NORMAL
// destructive action surfaces one undo window for exactly `UNDO_WINDOW_MS` (30s). This is the
// visible half of that contract: a calm bottom snackbar carrying the action label, a single
// "Undo" action, and a hairline-thin progress bar that drains over the window so the time left
// reads at a glance. When the bar empties the toast auto-dismisses; tapping Undo dismisses it
// immediately and runs the caller's restore.
//
// Presentation only — it owns no policy. The 30s timing lives in `useUndo` (which mounts this for
// UNDO_WINDOW_MS); this component is told `durationMs` and animates the bar across it. It never
// touches the store. It composes only confirmed design-system tokens from '@/folio/theme'
// (Palette via useTheme, gap, radius, elevation, pressed) — no new colour/font/spacing/radius/
// shadow token is defined here.
//
// Reduced-motion aware: with reduce-motion the progress bar does not animate (it rests full, then
// the window still elapses on the parent's timer), matching how the kit Sheet appears at rest
// instead of sliding. The only motion is the linear drain, on the compositor-friendly transform —
// no layout-bound property animates.

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { elevation, gap, type Palette, pressed, radius, useTheme } from '@/folio/theme';

// The undo affordance label — the one verb. Kept as a constant so the action reads identically
// wherever a toast is raised.
const UNDO_LABEL = 'Undo';

// The drained-bar width sentinel: the progress track shrinks from full to this over the window.
const BAR_EMPTY = 0;
const BAR_FULL = 1;

type UndoToastProps = {
  // The quiet line describing what just happened, e.g. "Cancelled Netflix". Frozen, caller-owned.
  label: string;
  // Runs when the user taps Undo. The toast dismisses first, then this fires.
  onUndo: () => void;
  // Dismiss without undoing — fired when the window elapses or the user taps the toast body away.
  onDismiss: () => void;
  // The window length the bar drains across — sourced from UNDO_WINDOW_MS by the provider.
  durationMs: number;
  // Skip the bar drain and rest the bar full (the window still elapses on the provider's timer).
  reduceMotion?: boolean | undefined;
};

export function UndoToast({ label, onUndo, onDismiss, durationMs, reduceMotion }: UndoToastProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  // The progress track drains from full to empty across the window. A ref so it survives
  // re-renders and can be driven imperatively, exactly as the kit Sheet drives its translateY.
  const progress = useRef(new Animated.Value(BAR_FULL)).current;

  useEffect(() => {
    if (reduceMotion) {
      // Reduced motion: no drain — the bar rests full. The window still elapses on the parent's
      // timer (useUndo), so the toast still auto-dismisses; only the animation is suppressed.
      progress.setValue(BAR_FULL);
      return undefined;
    }
    progress.setValue(BAR_FULL);
    const animation = Animated.timing(progress, {
      toValue: BAR_EMPTY,
      duration: durationMs,
      easing: Easing.linear,
      // The bar drains via scaleX (a transform) so it stays on the compositor — width is never
      // animated, per the kit's animation-property discipline.
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, durationMs, reduceMotion]);

  return (
    <View pointerEvents="box-none" style={layout.host}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.toast}>
        <View style={layout.body}>
          <Text numberOfLines={2} style={s.label}>
            {label}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${UNDO_LABEL} ${label}`}
          accessibilityHint="Restores what you just removed."
          hitSlop={12}
          onPress={onUndo}
          style={({ pressed: isPressed }) => [s.undoBtn, isPressed ? pressed : undefined]}
        >
          <Text style={s.undoLabel}>{UNDO_LABEL}</Text>
        </Pressable>

        {/* A hairline progress track draining left-to-right over the window. Pinned to the toast's
            bottom edge; the fill scales on the X axis (transform, not width) and is anchored left so
            it shrinks toward the start. Hidden from assistive tech — the live-region label carries
            the meaning. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={s.progressTrack}
        >
          <Animated.View style={[s.progressFill, { transform: [{ scaleX: progress }] }]} />
        </View>
      </View>

      {/* A tap on the surrounding host (outside the toast) dismisses without undoing — the calm
          "I've seen it, move on" gesture. box-none above lets taps fall through to the app
          everywhere except this thin catcher behind the toast. */}
      <Pressable
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="auto"
        onPress={onDismiss}
        style={layout.dismissCatcher}
      />
    </View>
  );
}

// Colour-free layout — safe across light and dark (the kit's DARK-MODE PATTERN: static layout vs
// colour-bearing makeStyles(t)).
const layout = StyleSheet.create({
  // Anchors the toast near the bottom, clear of the bottom nav. `box-none` so only the toast and
  // the dismiss catcher are interactive; the rest of the screen stays usable during the window.
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: gap.xl,
    // Sit above the bottom nav rather than under it.
    paddingBottom: gap.xxxl + gap.xxl,
    alignItems: 'stretch',
  },
  body: {
    flex: 1,
  },
  // A thin catcher sitting behind the toast so an outside tap can dismiss; zero-height visually,
  // it just gives the gesture somewhere to land without covering the app.
  dismissCatcher: {
    height: gap.none,
  },
});

// Colour-bearing styles, resolved against the active palette `t`.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    // The snackbar surface — an ink "knockout" bar (inverse text on ink) so it reads as a transient
    // system message distinct from the paper surfaces, lifted on the kit's card shadow. Rounded to
    // the kit's lg radius.
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: gap.md,
      backgroundColor: t.ink,
      borderRadius: radius.lg,
      paddingVertical: gap.md,
      paddingHorizontal: gap.lg,
      overflow: 'hidden',
      ...elevation.card,
    },
    label: {
      color: t.inverse,
      fontSize: 13,
      lineHeight: 18,
    },
    // The undo action — a calm-toned text affordance on the ink bar; a >=44px tap area via padding
    // + hitSlop. Calm (terracotta) is the one accent moment on the bar.
    undoBtn: {
      minHeight: 44,
      paddingHorizontal: gap.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    undoLabel: {
      color: t.calm,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    // The progress track — a hairline rail pinned to the toast's bottom edge.
    progressTrack: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: gap.xxs,
      backgroundColor: t.hairlineStrong,
    },
    // The draining fill — calm terracotta. A full-width bar whose scaleX is animated from 1 -> 0,
    // so the rail empties as the window elapses (the bar is hairline-thin, so the centre-anchored
    // scale still reads simply as "time draining away").
    progressFill: {
      height: '100%',
      width: '100%',
      backgroundColor: t.calm,
    },
  });
}
