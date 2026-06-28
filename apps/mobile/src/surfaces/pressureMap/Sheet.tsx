// Shared bottom-sheet primitive — the RN port of the web folio Sheet.
//
// Faithful to the web design (src/components/folio/sheets/Sheet.tsx): an ink/40 scrim
// that closes on tap, a paper panel with 28px top corners that slides up from the bottom
// on a calm ~450ms ease (cubic-bezier(.16,1,.3,1)), an upward "lifting off the paper"
// shadow (kit elevation.sheet), a centered grab handle, and a max-height so tall content
// scrolls inside instead of pushing the sheet off-screen.
//
// Presentation only — it never talks to the engine. It composes the kit's paper tokens,
// the kit's spacing rhythm and the kit's sheet elevation so there's no styling drift with
// the rest of the pressure-map surface. The Modal + Animated + safe-area approach mirrors
// the existing RN sheets in this repo (PointExplanation, WhatIfSheet, SourceSheet).

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, gap, useTheme, type Palette } from './kit';

// The web sheet rounds its top to 28px (rounded-t-[28px]). The kit's radius.xxl (32) is a
// touch too round for the sheet lip, so the sheet keeps its own constant to match the web.
const SHEET_RADIUS = 28;

// The grab handle — ~40x4 rounded pill, matching the web's w-10 h-1 rounded-full.
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;

// The sheet rises through no more than ~85% of the window so the children never push the
// scrim entirely off the top; anything beyond that scrolls inside the panel.
const MAX_HEIGHT_FRACTION = 0.85;

// sheet-in: ~450ms on the web's editorial ease. The scrim fades a touch faster so the
// panel arrives onto an already-dimmed ground rather than racing it.
const SHEET_IN_MS = 450;
const SHEET_OUT_MS = 260;
const SCRIM_IN_MS = 300;
const SHEET_EASE = Easing.bezier(0.16, 1, 0.3, 1);

// The ink/40 scrim from the web (bg-[var(--ink)]/40). Driven through an animated opacity
// so the literal panel colour stays paper.ink and only the alpha animates.
const SCRIM_OPACITY = 0.4;

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // Skip the rise/fade and appear instantly. Source this from the same mechanism the
  // container uses (AccessibilityInfo.isReduceMotionEnabled — see useReducedMotionPreference
  // in mobileShell). Defaults to motion on.
  reduceMotion?: boolean | undefined;
};

export function Sheet({ visible, onClose, children, reduceMotion }: SheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const maxHeight = Math.round(height * MAX_HEIGHT_FRACTION);

  // translateY animates the panel up from below; scrimOpacity fades the ink ground in.
  // Both are refs so they survive re-renders and we can drive them imperatively.
  const translateY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (reduceMotion) {
      // Reduced motion: no slide, no fade — appear at rest immediately.
      translateY.setValue(0);
      scrimOpacity.setValue(SCRIM_OPACITY);
      return;
    }
    // Start below the fold and fully transparent, then rise + dim together.
    translateY.setValue(height);
    scrimOpacity.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: SHEET_IN_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: SCRIM_OPACITY,
        duration: SCRIM_IN_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [visible, reduceMotion, height, translateY, scrimOpacity]);

  // Animate the panel back down, then tell the parent to unmount. With reduced motion we
  // close instantly. The Modal stays mounted (visible) for the duration of the slide-out
  // so the panel is still on screen while it animates away.
  const handleClose = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height,
        duration: SHEET_OUT_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: SHEET_OUT_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  };

  return (
    <Modal
      // We animate the sheet ourselves, so the Modal itself does not animate.
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={layout.root}>
        <AnimatedPressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={handleClose}
          style={[s.scrim, { opacity: scrimOpacity }]}
        />
        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="none"
          style={[
            s.panel,
            { maxHeight, paddingBottom: insets.bottom + gap.xxxl },
            { transform: [{ translateY }] },
          ]}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={s.handle}
          />
          <ScrollView
            bounces={false}
            contentContainerStyle={layout.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Colour-free styles — safe to share across light and dark.
const layout = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrollContent: {
    // The panel already pads the bottom (safe-area + xxxl); the scroll content only needs
    // a little breathing room under the last child.
    paddingBottom: gap.sm,
  },
});

// Colour-bearing styles, resolved against the active palette `t`.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    scrim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: t.ink,
    },
    panel: {
      backgroundColor: t.surface,
      borderTopLeftRadius: SHEET_RADIUS,
      borderTopRightRadius: SHEET_RADIUS,
      paddingHorizontal: gap.xl,
      paddingTop: gap.md,
      // The soft UPWARD shadow — the sheet reads as lifting off the paper from below.
      ...elevation.sheet,
    },
    handle: {
      alignSelf: 'center',
      width: HANDLE_WIDTH,
      height: HANDLE_HEIGHT,
      borderRadius: HANDLE_HEIGHT / 2,
      backgroundColor: t.hairlineStrong,
      marginBottom: gap.lg,
    },
  });
}
