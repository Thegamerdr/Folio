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
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion as useSystemReducedMotion } from 'react-native-reanimated';

import { elevation, gap, useTheme, type Palette } from './kit';
import { announceSurfaceRepaint } from './sheetRepaint';
import { dismissTopSheet, registerSheetBack } from './sheetBack';
import {
  measureSheetFrame,
  resolveSheetBottomOffset,
  resolveSheetFocusedScroll,
  resolveSheetKeyboardFrame,
  resolveSheetNavigationOffset,
  resolveSheetViewport,
  type SheetWindowFrame,
} from './sheetGeometry';

// The web sheet rounds its top to 28px (rounded-t-[28px]). The kit's radius.xxl (32) is a
// touch too round for the sheet lip, so the sheet keeps its own constant to match the web.
const SHEET_RADIUS = 28;

// The pinned sheet grip is w-9 h-[3px]. Together with the panel's 12px top inset and the 12px
// post-grip rhythm below, this leaves the same 27px before sheet content as the source shell
// (pt-3 + 3px grip + pb-1 + content pt-2). Keeping that geometry here fixes every sheet family at
// once instead of compensating inside individual forms and settings surfaces.
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 3;

// The pinned sheet rises through no more than 92% of the window so the children never push the
// scrim entirely off the top; anything beyond that scrolls inside the panel.
const MAX_HEIGHT_FRACTION = 0.92;

// sheet-in: ~450ms on the web's editorial ease. The scrim fades a touch faster so the
// panel arrives onto an already-dimmed ground rather than racing it.
const SHEET_IN_MS = 450;
const SHEET_OUT_MS = 260;
const SCRIM_IN_MS = 300;
const SHEET_EASE = Easing.bezier(0.16, 1, 0.3, 1);

// The ink/45 scrim from the pinned web shell. Driven through an animated opacity
// so the literal panel colour stays paper.ink and only the alpha animates.
const SCRIM_OPACITY = 0.45;

type SheetProps = {
  visible: boolean;
  dismissible?: boolean;
  onClose: () => void;
  children: ReactNode;
  // Skip the rise/fade and appear instantly. Source this from the same mechanism the
  // container uses (AccessibilityInfo.isReduceMotionEnabled — see useReducedMotionPreference
  // in mobileShell). Defaults to motion on.
  reduceMotion?: boolean | undefined;
  /** Let a self-hosting surface keep fixed chrome visible while its own child scrolls. */
  scrollable?: boolean;
  /** Workflow actions stay above the keyboard while only the form body scrolls. */
  footer?: ReactNode;
  /** Title or workflow context that remains visible while the body scrolls. */
  header?: ReactNode;
  /** A new step starts at its heading without discarding the caller's draft. */
  scrollKey?: string | number;
  scrollRef?: RefObject<ScrollView | null>;
  /** Keep a field's label visible when native focus scrolls its input to the top. */
  focusContextBefore?: number;
  /** Keep dependent shortcuts/results visible after a focused field, as space allows. */
  focusContextAfter?: number;
  /** Authored line-box breathing room around a long form's scroll content. */
  bodyContentInset?: number;
};

type SheetPortalApi = {
  upsert: (id: string, layer: ReactNode) => void;
  remove: (id: string) => void;
  insets: { top: number; right: number; bottom: number; left: number };
};

const SheetPortalContext = createContext<SheetPortalApi | null>(null);
const SheetOverlayContext = createContext(false);
export const useSheetOverlayActive = () => useContext(SheetOverlayContext);

function useSheetKeyboardMetrics(visible: boolean, reduceMotion: boolean) {
  const [metrics, setMetrics] = useState(() => Keyboard.metrics());
  useEffect(() => {
    if (!visible) return;
    setMetrics(Keyboard.metrics());
    const show = (event: KeyboardEvent) => {
      if (Platform.OS === 'ios' && !reduceMotion) Keyboard.scheduleLayoutAnimation(event);
      setMetrics(event.endCoordinates);
    };
    const hide = (event: KeyboardEvent) => {
      if (Platform.OS === 'ios' && !reduceMotion) Keyboard.scheduleLayoutAnimation(event);
      setMetrics(undefined);
    };
    const subscriptions = [
      Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
        show,
      ),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [visible, reduceMotion]);
  return metrics;
}

/** The same measured IME intersection for a full-page form with fixed controls below its scroller. */
export function KeyboardSafeView({
  children,
  style,
  reduceMotion = false,
  enabled = true,
  scrollRef,
  scrollOffset,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  reduceMotion?: boolean;
  enabled?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  scrollOffset?: { current: number };
}) {
  const { width, height } = useWindowDimensions();
  const localInsets = useSafeAreaInsets();
  const portal = useContext(SheetPortalContext);
  const insets = portal?.insets ?? localInsets;
  const rootRef = useRef<View>(null);
  const [frame, setFrame] = useState<SheetWindowFrame>({ x: 0, y: 0, width, height });
  const metrics = useSheetKeyboardMetrics(enabled, reduceMotion);
  const focusTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const keepFieldVisible = useCallback(() => {
    const body = scrollRef?.current;
    const focused = TextInput.State.currentlyFocusedInput();
    if (!body || !focused || !scrollOffset) return;
    body.getNativeScrollRef()?.measureInWindow((_x, bodyTop, _width, bodyHeight) => {
      focused.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
        if (TextInput.State.currentlyFocusedInput() !== focused) return;
        const y = resolveSheetFocusedScroll({
          scrollY: scrollOffset.current,
          inputTop,
          inputHeight,
          bodyTop,
          bodyHeight,
          contextBefore: 24,
          contextAfter: 12,
        });
        if (Math.abs(y - scrollOffset.current) > 1) {
          scrollOffset.current = y;
          body.scrollTo({ y, animated: false });
        }
      });
    });
  }, [scrollRef, scrollOffset]);
  const settleField = useCallback(() => {
    focusTimers.current.forEach(clearTimeout);
    keepFieldVisible();
    focusTimers.current = [100, 300].map((delay) => setTimeout(keepFieldVisible, delay));
  }, [keepFieldVisible]);
  useEffect(() => {
    if (metrics) settleField();
    return () => focusTimers.current.forEach(clearTimeout);
  }, [metrics, settleField]);
  const keyboard = resolveSheetKeyboardFrame(
    enabled ? metrics : undefined,
    Platform.OS === 'android' ? Number(Platform.Version) : null,
    Dimensions.get('screen').height,
    insets.bottom,
  );
  const viewport = resolveSheetViewport({
    frame,
    keyboard,
    topInset: 0,
    bottomOffset: 0,
    maxHeightFraction: 1,
  });
  const measure = useCallback(() => {
    measureSheetFrame(rootRef.current, Platform.OS === 'android', (next) => {
      setFrame((current) =>
        current.x === next.x &&
        current.y === next.y &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      );
    });
  }, []);
  useLayoutEffect(measure, [width, height, metrics, measure]);
  return (
    <View
      ref={rootRef}
      collapsable={false}
      onLayout={measure}
      onFocus={settleField}
      style={[style, { paddingBottom: viewport.bottom }]}
    >
      {children}
    </View>
  );
}

/**
 * Keeps Android sheets in the app's primary native window while still letting screen-owned sheets
 * paint above the shell and bottom navigation. React Native transparent Modal windows are omitted
 * by the Android 15 emulator's display capture/compositor on the new architecture; the same window
 * boundary can present as missing or black tiles on affected GPUs. A tiny in-tree portal avoids
 * that boundary without changing any sheet's content, state, layout, or iOS presentation.
 */
export function SheetPortalProvider({
  children,
  onOverlayChange,
}: {
  children: ReactNode;
  onOverlayChange?: (open: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
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

  const api = useMemo(() => ({ upsert, remove, insets }), [remove, upsert, insets]);
  const hasLayer = layers.size > 0;
  useEffect(() => {
    onOverlayChange?.(hasLayer);
  }, [hasLayer, onOverlayChange]);

  return (
    <SheetPortalContext.Provider value={api}>
      <SheetOverlayContext.Provider value={hasLayer}>
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
              {Array.from(layers.entries()).map(([id, layer], index) => {
                const covered = index < layers.size - 1;
                return (
                  <View
                    key={id}
                    pointerEvents={covered ? 'none' : 'box-none'}
                    accessibilityElementsHidden={covered}
                    importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
                    style={[StyleSheet.absoluteFill, covered ? { opacity: 0 } : undefined]}
                  >
                    {layer}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </SheetOverlayContext.Provider>
    </SheetPortalContext.Provider>
  );
}

export function Sheet({
  visible,
  dismissible = true,
  onClose,
  children,
  reduceMotion,
  scrollable = true,
  footer,
  header,
  scrollKey,
  scrollRef,
  focusContextBefore = 0,
  focusContextAfter = 0,
  bodyContentInset = 0,
}: SheetProps) {
  const { height, width } = useWindowDimensions();
  const localInsets = useSafeAreaInsets();
  const portal = useContext(SheetPortalContext);
  // Screen content receives a zero-inset viewport from FolioShell. Portalled sheets still own
  // the whole app window, so retain the provider's original system insets.
  const insets = portal?.insets ?? localInsets;
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  // Reanimated reads the system preference synchronously, including the first sheet frame.
  const systemReduceMotion = useSystemReducedMotion();
  // Capture builds paint at rest; normal builds retain the user's motion preference.
  const captureMode = process.env.EXPO_PUBLIC_MELO_PARITY_CAPTURE === 'true';
  // Alert geometry diagnostics reuse this Sheet's numeric telemetry without enabling parity
  // fixtures, forced theme, reduced motion, or any other capture-build behavior.
  const alertGeometryDiagnostics =
    process.env.EXPO_PUBLIC_MELO_ALERT_GEOMETRY_DIAGNOSTIC === 'true';
  const geometryLogging =
    (captureMode || alertGeometryDiagnostics) &&
    scrollKey !== undefined &&
    (captureMode || scrollKey === 'melo-alert');
  const shouldReduceMotion = captureMode || reduceMotion === true || systemReduceMotion;
  const rootRef = useRef<View>(null);
  const [windowFrame, setWindowFrame] = useState<SheetWindowFrame>({ x: 0, y: 0, width, height });
  const keyboardMetrics = useSheetKeyboardMetrics(visible, shouldReduceMotion);
  const screenHeight = Dimensions.get('screen').height;
  // Android portal sheets already live inside the shell's safe product viewport. Applying the
  // full-window navigation inset again made the panel materially taller than the pinned sheet.
  // iOS Modal sheets still own the full window and retain their native safe-area contribution.
  const restingPanelBottomPadding =
    Platform.OS === 'ios' ? insets.bottom + gap.xl : gap.xl + gap.sm;
  const portalId = useId();
  const usesAndroidPortal = Platform.OS === 'android' && portal !== null;
  const restingBottomOffset = usesAndroidPortal
    ? resolveSheetNavigationOffset(windowFrame, screenHeight, insets.bottom)
    : resolveSheetBottomOffset({
        platform: Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'other',
        usesAndroidPortal,
        bottomInset: insets.bottom,
      });
  const keyboardFrame = resolveSheetKeyboardFrame(
    keyboardMetrics,
    Platform.OS === 'android' ? Number(Platform.Version) : null,
    screenHeight,
    insets.bottom,
  );
  const viewport = resolveSheetViewport({
    frame: windowFrame,
    keyboard: keyboardFrame,
    topInset: insets.top,
    bottomOffset: restingBottomOffset,
    maxHeightFraction: MAX_HEIGHT_FRACTION,
  });
  const maxHeight = viewport.maxHeight;
  const panelBottomOffset = viewport.bottom;
  const panelBottomPadding = viewport.keyboardOccludesBottom ? gap.md : restingPanelBottomPadding;
  // translateY animates the panel up from below; scrimOpacity fades the ink ground in.
  // Both are refs so they survive re-renders and we can drive them imperatively.
  const translateY = useRef(new Animated.Value(height)).current;
  const entryHeight = useRef(height);
  const internalScrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const bodyScrollRef = scrollRef ?? internalScrollRef;
  const scrollY = useRef(0);
  const focusFrame = useRef<number | null>(null);
  const focusMeasurement = useRef(0);
  const keepFocusedInputVisible = useCallback(() => {
    const generation = ++focusMeasurement.current;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      const focused = TextInput.State.currentlyFocusedInput();
      const body = bodyScrollRef.current;
      if (geometryLogging) {
        console.info(
          'MeloSheetGeometry',
          JSON.stringify({
            event: 'focus-check',
            step: scrollKey,
            focused: !!focused,
            body: !!body,
            visible,
            scrollY: scrollY.current,
          }),
        );
      }
      if (!visible || !scrollable || !focused || !body) return;
      const bodyNative = body.getNativeScrollRef();
      const content = contentRef.current;
      if (!bodyNative || !content) return;
      bodyNative.measureInWindow((_bodyX, bodyTop, _bodyWidth, bodyHeight) => {
        focused.measureLayout(
          content,
          (_inputX, inputContentTop, _inputWidth, inputHeight) => {
            // Focus can change while native measurements are in flight.
            if (
              generation !== focusMeasurement.current ||
              TextInput.State.currentlyFocusedInput() !== focused
            )
              return;
            // Content-relative geometry stays fixed while Android is still applying
            // a previous scrollTo. Mixing a new requested offset with an old window
            // measurement doubled the first correction on the S9 (83 -> 166dp).
            const inputTop = bodyTop + inputContentTop - scrollY.current;
            const nextY = resolveSheetFocusedScroll({
              scrollY: scrollY.current,
              inputTop,
              inputHeight,
              bodyTop,
              bodyHeight,
              padding: Math.max(
                8,
                Math.min(bodyContentInset, Math.max(8, (bodyHeight - inputHeight) / 2)),
              ),
              contextBefore: focusContextBefore,
              contextAfter: focusContextAfter,
            });
            if (geometryLogging) {
              console.info(
                'MeloSheetGeometry',
                JSON.stringify({
                  event: 'measured',
                  step: scrollKey,
                  bodyTop,
                  bodyHeight,
                  inputTop,
                  inputHeight,
                  scrollY: scrollY.current,
                  nextY,
                }),
              );
            }
            if (Math.abs(nextY - scrollY.current) > 1) {
              body.scrollTo({ y: nextY, animated: false });
            }
          },
          () => undefined,
        );
      });
    });
  }, [
    bodyScrollRef,
    bodyContentInset,
    geometryLogging,
    scrollKey,
    focusContextBefore,
    focusContextAfter,
    scrollable,
    shouldReduceMotion,
    visible,
  ]);
  const focusSettleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settleFocusedInput = useCallback(() => {
    focusSettleTimers.current.forEach(clearTimeout);
    keepFocusedInputVisible();
    // Android's native focus scroll can finish after the keyboard and compact form
    // layout events. Re-measure that final position so the first focused field
    // cannot remain above the resized body viewport.
    focusSettleTimers.current = [100, 300].map((delay) =>
      setTimeout(keepFocusedInputVisible, delay),
    );
  }, [keepFocusedInputVisible]);
  useEffect(() => {
    if (visible && keyboardMetrics) settleFocusedInput();
    return () => focusSettleTimers.current.forEach(clearTimeout);
  }, [visible, keyboardMetrics, settleFocusedInput]);
  const measureViewport = useCallback(() => {
    measureSheetFrame(rootRef.current, usesAndroidPortal, (next) => {
      setWindowFrame((current) =>
        current.x === next.x &&
        current.y === next.y &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      );
      keepFocusedInputVisible();
    });
  }, [keepFocusedInputVisible, usesAndroidPortal]);
  useLayoutEffect(() => {
    if (visible) measureViewport();
  }, [visible, width, height, keyboardMetrics, measureViewport]);
  useEffect(() => {
    return () => {
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    };
  }, []);
  useEffect(() => {
    if (visible) {
      scrollY.current = 0;
      bodyScrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [visible, scrollKey, bodyScrollRef]);
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
    translateY.setValue(entryHeight.current);
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
  }, [visible, shouldReduceMotion, translateY, scrimOpacity, usesAndroidPortal]);

  // Animate the panel back down, then tell the parent to unmount. With reduced motion we
  // close instantly. The Modal stays mounted (visible) for the duration of the slide-out
  // so the panel is still on screen while it animates away.
  const finishClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
    // Let the Modal unmount commit, then ask persistent chrome to repaint. This is paint-only state;
    // it does not reset the current route or reopen/close any sheet.
    scheduleUnderlyingRepaint();
  }, [onClose, scheduleUnderlyingRepaint]);

  const handleClose = useCallback(() => {
    if (!dismissible) return;
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
  }, [
    dismissible,
    finishClose,
    height,
    shouldReduceMotion,
    scrimOpacity,
    translateY,
    usesAndroidPortal,
  ]);

  const closeRef = useRef(handleClose);
  closeRef.current = handleClose;
  useEffect(() => {
    if (!visible || !usesAndroidPortal) return;
    const remove = registerSheetBack(portalId, () => closeRef.current());
    const listener = BackHandler.addEventListener('hardwareBackPress', dismissTopSheet);
    return () => {
      listener.remove();
      remove();
    };
  }, [visible, usesAndroidPortal, portalId]);

  const sheetLayer = useMemo(
    () =>
      visible ? (
        <View
          ref={rootRef}
          collapsable={false}
          onLayout={measureViewport}
          onFocus={keepFocusedInputVisible}
          style={[layout.root, usesAndroidPortal ? layout.portalLayer : undefined]}
        >
          <AnimatedPressable
            accessible={false}
            importantForAccessibility="no"
            onPress={handleClose}
            style={[s.scrim, { opacity: scrimOpacity }]}
          />
          <View
            // The panel and sticky footer live in the measured rectangle above the actual IME.
            // Using explicit edges also handles Android windows that have already resized.
            pointerEvents="box-none"
            style={[layout.avoider, { top: viewport.top, bottom: panelBottomOffset }]}
          >
            <Animated.View
              accessibilityViewIsModal
              accessibilityRole="none"
              importantForAccessibility="yes"
              style={[
                s.panel,
                { maxHeight, paddingBottom: panelBottomPadding },
                !scrollable && { height: maxHeight },
                { transform: [{ translateY }] },
              ]}
            >
              <View style={layout.chrome}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={s.handle}
                />
                {dismissible ? (
                  <Pressable
                    accessibilityLabel="Close"
                    accessibilityRole="button"
                    onPress={handleClose}
                    style={({ pressed }) => [s.close, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={s.closeLabel}>×</Text>
                  </Pressable>
                ) : null}
              </View>
              {header ? <View style={{ flexShrink: 0 }}>{header}</View> : null}
              {scrollable ? (
                <ScrollView
                  key={`sheet-body-${scrollKey ?? 'stable'}`}
                  ref={bodyScrollRef}
                  bounces={false}
                  removeClippedSubviews={false}
                  style={layout.scrollBody}
                  // The footer is already a sibling below this viewport. Adding
                  // its full height again as content padding can consume the
                  // entire S9 typing area and collapse intrinsic form rows.
                  contentContainerStyle={layout.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="none"
                  automaticallyAdjustKeyboardInsets={false}
                  onLayout={(event) => {
                    keepFocusedInputVisible();
                    if (geometryLogging) {
                      console.info(
                        'MeloSheetGeometry',
                        JSON.stringify({
                          event: 'body-layout',
                          step: scrollKey,
                          ...event.nativeEvent.layout,
                        }),
                      );
                    }
                  }}
                  onContentSizeChange={(widthValue, heightValue) => {
                    keepFocusedInputVisible();
                    if (geometryLogging) {
                      console.info(
                        'MeloSheetGeometry',
                        JSON.stringify({
                          event: 'content-size',
                          step: scrollKey,
                          width: widthValue,
                          height: heightValue,
                        }),
                      );
                    }
                  }}
                  onScroll={(event) => {
                    scrollY.current = event.nativeEvent.contentOffset.y;
                    if (geometryLogging) {
                      console.info(
                        'MeloSheetGeometry',
                        JSON.stringify({
                          event: 'scroll',
                          step: scrollKey,
                          scrollY: scrollY.current,
                          contentHeight: event.nativeEvent.contentSize.height,
                          viewportHeight: event.nativeEvent.layoutMeasurement.height,
                        }),
                      );
                    }
                  }}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator
                >
                  <View
                    ref={contentRef}
                    collapsable={false}
                    onFocus={settleFocusedInput}
                    onLayout={(event) => {
                      if (geometryLogging) {
                        console.info(
                          'MeloSheetGeometry',
                          JSON.stringify({
                            event: 'content-layout',
                            step: scrollKey,
                            ...event.nativeEvent.layout,
                          }),
                        );
                      }
                    }}
                    style={{ flexShrink: 0, width: '100%' }}
                  >
                    {bodyContentInset > 0 ? (
                      <View style={{ height: bodyContentInset, flexShrink: 0 }} />
                    ) : null}
                    {children}
                    {bodyContentInset > 0 ? (
                      <View style={{ height: bodyContentInset, flexShrink: 0 }} />
                    ) : null}
                  </View>
                </ScrollView>
              ) : (
                <View style={layout.sheetContent}>{children}</View>
              )}
              {footer ? <View style={s.footer}>{footer}</View> : null}
            </Animated.View>
          </View>
        </View>
      ) : null,
    [
      children,
      footer,
      header,
      dismissible,
      bodyScrollRef,
      bodyContentInset,
      handleClose,
      insets.bottom,
      insets.top,
      viewport.top,
      viewport.keyboardOccludesBottom,
      measureViewport,
      keepFocusedInputVisible,
      settleFocusedInput,
      maxHeight,
      panelBottomOffset,
      panelBottomPadding,
      s,
      scrimOpacity,
      translateY,
      usesAndroidPortal,
      visible,
      scrollable,
      scrollKey,
    ],
  );

  const upsertPortalLayer = portal?.upsert;
  const removePortalLayer = portal?.remove;
  useLayoutEffect(() => {
    if (!usesAndroidPortal || !upsertPortalLayer || !removePortalLayer) return;
    if (sheetLayer === null) {
      removePortalLayer(portalId);
      return;
    }
    // Update the existing host in place. Removing it on every content change can
    // detach the focused Android input between a keystroke and the next render.
    upsertPortalLayer(portalId, sheetLayer);
  }, [upsertPortalLayer, removePortalLayer, portalId, sheetLayer, usesAndroidPortal]);
  useEffect(
    () => () => {
      if (usesAndroidPortal) removePortalLayer?.(portalId);
    },
    [removePortalLayer, portalId, usesAndroidPortal],
  );

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
  // Explicit top/bottom edges constrain the panel and footer above the measured keyboard.
  avoider: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  scrollContent: {
    // The panel already owns the platform-safe bottom rhythm; the scroll content only needs
    // a little breathing room under the last child.
    paddingBottom: gap.sm,
    width: '100%',
  },
  chrome: { height: 48, flexShrink: 0, justifyContent: 'flex-start' },
  scrollBody: { flexShrink: 1, minHeight: 0, width: '100%', overflow: 'hidden' },
  sheetContent: {
    flex: 1,
    minHeight: 0,
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
      // The IME can make the avoider's available height smaller than maxHeight. Let both
      // scrollable forms and fixed-chrome sheets shrink inside the top safe-area boundary.
      flexShrink: 1,
      width: '100%',
      overflow: 'hidden',
      backgroundColor: t.surface,
      borderTopLeftRadius: SHEET_RADIUS,
      borderTopRightRadius: SHEET_RADIUS,
      paddingHorizontal: gap.xl,
      paddingTop: gap.md,
      // The soft UPWARD shadow — the sheet reads as lifting off the paper from below.
      ...elevation.sheet,
    },
    footer: {
      flexShrink: 0,
      paddingTop: gap.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.hairline,
    },
    handle: {
      alignSelf: 'center',
      width: HANDLE_WIDTH,
      height: HANDLE_HEIGHT,
      borderRadius: HANDLE_HEIGHT / 2,
      backgroundColor: t.hairlineStrong,
      marginBottom: gap.md,
    },
    close: {
      alignItems: 'center',
      height: 48,
      justifyContent: 'center',
      position: 'absolute',
      right: gap.xs,
      top: 0,
      width: 48,
      zIndex: 1,
    },
    closeLabel: { color: t.muted, fontSize: 28, fontWeight: '300', lineHeight: 30 },
  });
}
