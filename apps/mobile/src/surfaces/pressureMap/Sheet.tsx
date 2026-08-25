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

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion as useSystemReducedMotion } from 'react-native-reanimated';

import { elevation, gap, useTheme, type Palette } from './kit';
import { announceSurfaceRepaint } from './sheetRepaint';

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

type SheetPortalApi = {
  upsert: (id: string, layer: ReactNode) => void;
  remove: (id: string) => void;
};

const SheetPortalContext = createContext<SheetPortalApi | null>(null);

/**
 * Keeps Android sheets in the app's primary native window while still letting screen-owned sheets
 * paint above the shell and bottom navigation. React Native transparent Modal windows are omitted
 * by the Android 15 emulator's display capture/compositor on the new architecture; the same window
 * boundary can present as missing or black tiles on affected GPUs. A tiny in-tree portal avoids
 * that boundary without changing any sheet's content, state, layout, or iOS presentation.
 */
export function SheetPortalProvider({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<ReadonlyMap<string, ReactNode>>(() => new Map());

  const upsert = useCallback((id: string, layer: ReactNode) => {
    setLayers((current) => {
      const next = new Map(current);
      next.set(id, layer);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setLayers((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }, []);

  const api = useMemo(() => ({ upsert, remove }), [remove, upsert]);
  const hasLayer = layers.size > 0;

  return (
    <SheetPortalContext.Provider value={api}>
      <View style={layout.portalProvider}>
        <View
          accessibilityElementsHidden={hasLayer}
          importantForAccessibility={hasLayer ? 'no-hide-descendants' : 'auto'}
          style={layout.portalBase}
        >
          {children}
        </View>
        {hasLayer ? (
          <View pointerEvents="box-none" style={layout.portalHost}>
            {Array.from(layers.entries()).map(([id, layer]) => (
              <Fragment key={id}>{layer}</Fragment>
            ))}
          </View>
        ) : null}
      </View>
    </SheetPortalContext.Provider>
  );
}

export function Sheet({ visible, onClose, children, reduceMotion }: SheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const maxHeight = Math.round(height * MAX_HEIGHT_FRACTION);
  const portal = useContext(SheetPortalContext);
  const portalId = useId();
  const usesAndroidPortal = Platform.OS === 'android' && portal !== null;
  // Self-hosting sheets discover AccessibilityInfo asynchronously after mounting. Reanimated keeps
  // the same Android system preference synchronously, which prevents even one unwanted animated
  // frame when Remove animations is already on.
  const systemReduceMotion = useSystemReducedMotion();
  // Capture APKs are deterministic evidence artifacts, so they must paint the requested sheet at
  // rest on the first committed frame. Besides removing timing variance from a 124-frame batch,
  // this avoids Android/Fabric retaining the portal layer's initial off-screen transform when a
  // deep link replaces one capture surface with another in the same activity. Ordinary builds keep
  // the product animation unless the user has requested reduced motion.
  const captureMode = process.env.EXPO_PUBLIC_MELO_PARITY_CAPTURE === 'true';
  const shouldReduceMotion = captureMode || reduceMotion === true || systemReduceMotion;

  // translateY animates the panel up from below; scrimOpacity fades the ink ground in.
  // Both are refs so they survive re-renders and we can drive them imperatively.
  const translateY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const wasVisible = useRef(visible);
  const repaintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleUnderlyingRepaint = useCallback(() => {
    if (repaintTimer.current !== null) return;
    repaintTimer.current = setTimeout(() => {
      repaintTimer.current = null;
      announceSurfaceRepaint();
    }, 50);
  }, []);

  // Some sheet-owned actions close by changing `visible` directly instead of calling handleClose.
  // Detect that transition as well so every dismissal path repaints the underlying Android surface.
  useEffect(() => {
    if (wasVisible.current && !visible) scheduleUnderlyingRepaint();
    wasVisible.current = visible;
  }, [scheduleUnderlyingRepaint, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (shouldReduceMotion) {
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
        // The Android in-tree portal avoids a secondary Modal window, but the native animation
        // driver can stall at the initial value when the device animator scale is zero. That leaves
        // an autofocused input below the viewport with only the keyboard visible. The short JS-
        // driven transform is stable in the primary window; iOS/Modal keeps the native driver.
        useNativeDriver: !usesAndroidPortal,
      }),
      Animated.timing(scrimOpacity, {
        toValue: SCRIM_OPACITY,
        duration: SCRIM_IN_MS,
        easing: SHEET_EASE,
        useNativeDriver: !usesAndroidPortal,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [visible, shouldReduceMotion, height, translateY, scrimOpacity, usesAndroidPortal]);

  // Animate the panel back down, then tell the parent to unmount. With reduced motion we
  // close instantly. The Modal stays mounted (visible) for the duration of the slide-out
  // so the panel is still on screen while it animates away.
  const finishClose = useCallback(() => {
    onClose();
    // Let the Modal unmount commit, then ask persistent chrome to repaint. This is paint-only state;
    // it does not reset the current route or reopen/close any sheet.
    scheduleUnderlyingRepaint();
  }, [onClose, scheduleUnderlyingRepaint]);

  const handleClose = useCallback(() => {
    if (shouldReduceMotion) {
      finishClose();
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height,
        duration: SHEET_OUT_MS,
        easing: SHEET_EASE,
        useNativeDriver: !usesAndroidPortal,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: SHEET_OUT_MS,
        easing: SHEET_EASE,
        useNativeDriver: !usesAndroidPortal,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        finishClose();
      }
    });
  }, [finishClose, height, shouldReduceMotion, scrimOpacity, translateY, usesAndroidPortal]);

  const sheetLayer = useMemo(
    () =>
      visible ? (
        <View style={[layout.root, usesAndroidPortal ? layout.portalLayer : undefined]}>
          <AnimatedPressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={handleClose}
            style={[s.scrim, { opacity: scrimOpacity }]}
          />
          <KeyboardAvoidingView
            // Edge-to-edge Android no longer guarantees that adjustResize will lift an absolute
            // sheet. Constrain the avoider height there so focused inputs stay above the IME, and
            // reserve the top safe area so a tall keyboard-lifted form never sits under the status
            // bar. iOS keeps its padding behaviour.
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            pointerEvents="box-none"
            style={[layout.avoider, { paddingTop: insets.top }]}
          >
            <Animated.View
              accessibilityViewIsModal
              accessibilityRole="none"
              importantForAccessibility="yes"
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
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      ) : null,
    [
      children,
      handleClose,
      insets.bottom,
      insets.top,
      maxHeight,
      s,
      scrimOpacity,
      translateY,
      usesAndroidPortal,
      visible,
    ],
  );

  useEffect(() => {
    if (!usesAndroidPortal || portal === null) return undefined;
    if (sheetLayer === null) {
      portal.remove(portalId);
      return undefined;
    }
    portal.upsert(portalId, sheetLayer);
    return () => portal.remove(portalId);
  }, [portal, portalId, sheetLayer, usesAndroidPortal]);

  if (usesAndroidPortal) return null;

  return (
    <Modal
      // We animate the sheet ourselves, so the Modal itself does not animate.
      animationType="none"
      // Android otherwise gives this transparent secondary window a software surface. Under the
      // new architecture that surface can invalidate as black tiles after an animated parent
      // transition (reproduced on both SwiftShader and host-GPU AVDs). One shared flag fixes every
      // sheet without changing layout, motion, or iOS behavior.
      hardwareAccelerated={Platform.OS === 'android'}
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      {sheetLayer}
    </Modal>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Colour-free styles — safe to share across light and dark.
const layout = StyleSheet.create({
  portalProvider: { flex: 1 },
  portalBase: { flex: 1 },
  portalHost: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 100,
  },
  portalLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // The keyboard avoider overlays the same flex-end column as root, so the panel still sits at the
  // bottom; when the keyboard shows on iOS the avoider's padding pushes the panel up above it.
  avoider: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
