import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { deriveMeloPresence, deriveShellContextAction } from '@/folio/lib/melo/companion';
import {
  correctCompanionForScreen,
  denormalizeCompanionPosition,
  normalizeCompanionPosition,
  shellCompanionPlacement,
} from '@/folio/lib/melo/shellCompanion';
import { Melo } from '@/folio/melo/Melo';
import { MeloContextSheet } from '@/folio/sheets/MeloContextSheet';
import { setMelo, useAppStore } from '@/folio/store';
import { useTheme } from '@/folio/theme';
import type { Nav, ScreenId } from '@/folio/types';

const INTRO_DWELL_MS = 15_000;
const COMPANION_SIZE = 64;
const SAFE_INSET = 8;
const TAB_SAFE_BOTTOM = 104;
const SPRING = { damping: 19, stiffness: 240, mass: 0.72 } as const;

function clamp(value: number, minimum: number, maximum: number): number {
  'worklet';
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Shell-owned Melo host. Drag updates are entirely UI-thread worklets; JS is crossed only after a
 * completed drop to persist normalized coordinates, or after an actual tap to open the context.
 */
export function ShellMeloCompanion({ screen, nav }: { screen: ScreenId; nav: Nav }) {
  const t = useTheme();
  const melo = useAppStore((state) => state.melo ?? { quietMode: false, wardrobe: [] });
  const waitingCount = useAppStore((state) => state.reviewQueue?.length ?? 0);
  const workspaceKind = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ??
      'personal',
  );
  const placement = shellCompanionPlacement(
    screen,
    melo.preferredPosition ?? 'auto',
    workspaceKind,
  );
  const [showIntro, setShowIntro] = useState(melo.companionIntroSeen !== true);
  const [contextOpen, setContextOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [bounds, setBounds] = useState({ width: 360, height: 720 });
  const action = useMemo(() => deriveShellContextAction(screen), [screen]);
  const mood = screen === 'review' && waitingCount > 0 ? 'curious' : 'calm';
  const presence =
    dragging || contextOpen
      ? 'engaged'
      : deriveMeloPresence({
          quietMode: melo.quietMode,
          ...(action === undefined ? {} : { action }),
        });

  const x = useSharedValue(placement?.birdLeft ?? SAFE_INSET);
  const y = useSharedValue(placement?.top ?? SAFE_INSET);
  const startX = useSharedValue(x.value);
  const startY = useSharedValue(y.value);
  const dragScaleX = useSharedValue(1);
  const dragScaleY = useSharedValue(1);
  const tilt = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => mounted && setReduceMotion(enabled),
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (placement === null || dragging) return;
    const remembered =
      melo.companionPosition === undefined
        ? { x: placement.birdLeft, y: placement.top }
        : denormalizeCompanionPosition(melo.companionPosition, bounds);
    const target = correctCompanionForScreen(screen, remembered, bounds);
    if (reduceMotion) {
      x.value = target.x;
      y.value = target.y;
    } else {
      x.value = withSpring(target.x, SPRING);
      y.value = withSpring(target.y, SPRING);
    }
  }, [
    bounds.height,
    bounds.width,
    dragging,
    melo.companionPosition,
    placement?.birdLeft,
    placement?.top,
    reduceMotion,
    screen,
    x,
    y,
  ]);

  useEffect(() => {
    setContextOpen(false);
    setDragging(false);
  }, [screen]);

  useEffect(() => {
    if (!showIntro || placement === null || melo.quietMode) return undefined;
    const timeout = setTimeout(() => {
      setShowIntro(false);
      setMelo({ companionIntroSeen: true });
    }, INTRO_DWELL_MS);
    return () => clearTimeout(timeout);
  }, [melo.quietMode, placement, showIntro]);

  function beginDrag() {
    setDragging(true);
    setShowIntro(false);
    setMelo({ companionIntroSeen: true });
  }

  function finishDrag(rawX: number, rawY: number) {
    setDragging(false);
    const target = correctCompanionForScreen(screen, { x: rawX, y: rawY }, bounds);
    x.value = reduceMotion ? target.x : withSpring(target.x, SPRING);
    y.value = reduceMotion ? target.y : withSpring(target.y, SPRING);
    const normalized = normalizeCompanionPosition(target, bounds);
    setMelo({
      companionPosition: normalized,
      preferredPosition: normalized.x < 0.5 ? 'left' : 'right',
      companionIntroSeen: true,
    });
  }

  const pan = Gesture.Pan()
    .minDistance(6)
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      dragScaleX.value = withTiming(1.06, { duration: reduceMotion ? 0 : 90 });
      dragScaleY.value = withTiming(0.96, { duration: reduceMotion ? 0 : 90 });
      runOnJS(beginDrag)();
    })
    .onUpdate((event) => {
      const maxX = Math.max(SAFE_INSET, bounds.width - COMPANION_SIZE - SAFE_INSET);
      const maxY = Math.max(SAFE_INSET, bounds.height - COMPANION_SIZE - TAB_SAFE_BOTTOM);
      x.value = clamp(startX.value + event.translationX, SAFE_INSET, maxX);
      y.value = clamp(startY.value + event.translationY, SAFE_INSET, maxY);
      tilt.value = clamp(event.translationX * 0.055, -7, 7);
    })
    .onEnd(() => runOnJS(finishDrag)(x.value, y.value))
    .onFinalize(() => {
      dragScaleX.value = withSpring(1, SPRING);
      dragScaleY.value = withSpring(1, SPRING);
      tilt.value = withSpring(0, SPRING);
    });

  const tap = Gesture.Tap()
    .maxDistance(6)
    .onEnd((_event, success) => {
      if (success) runOnJS(setContextOpen)(true);
    });

  const gesture = Gesture.Exclusive(pan, tap);
  const animatedBird = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${tilt.value}deg` },
      { scaleX: dragScaleX.value },
      { scaleY: dragScaleY.value },
    ],
  }));
  const animatedBubble = useAnimatedStyle(() => ({
    transform: [
      { translateX: clamp(x.value - 220, SAFE_INSET, Math.max(SAFE_INSET, bounds.width - 228)) },
      { translateY: clamp(y.value, SAFE_INSET, Math.max(SAFE_INSET, bounds.height - 80)) },
    ],
  }));

  const onLayerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setBounds({ width, height });
  };

  if ((placement === null || melo.quietMode) && !contextOpen) return null;
  const contextPosition =
    (melo.companionPosition?.x ?? (melo.preferredPosition === 'left' ? 0 : 1)) < 0.5
      ? 'left'
      : 'right';

  return (
    <>
      {placement !== null && !melo.quietMode ? (
        <View
          pointerEvents="box-none"
          onLayout={onLayerLayout}
          style={[StyleSheet.absoluteFill, styles.layer]}
        >
          {showIntro ? (
            <Animated.View
              accessibilityLiveRegion="polite"
              accessibilityRole="text"
              pointerEvents="none"
              style={[
                styles.bubble,
                animatedBubble,
                { backgroundColor: t.ink, shadowColor: t.ink },
              ]}
            >
              <Text style={[styles.bubbleText, { color: t.canvas }]}>Hi, I&apos;m Melo.</Text>
            </Animated.View>
          ) : null}
          <GestureDetector gesture={gesture}>
            <Animated.View
              accessible
              accessibilityActions={[
                { name: 'activate', label: 'Open Melo options' },
                { name: 'move-left', label: 'Move Melo left' },
                { name: 'move-right', label: 'Move Melo right' },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Melo, ${presence}. Tap for options or drag to move.`}
              onAccessibilityAction={(event) => {
                const name = event.nativeEvent.actionName;
                if (name === 'activate') setContextOpen(true);
                if (name === 'move-left' || name === 'move-right') {
                  const normalized = {
                    x: name === 'move-left' ? 0 : 1,
                    y: melo.companionPosition?.y ?? 0.25,
                  };
                  setMelo({
                    companionPosition: normalized,
                    preferredPosition: name === 'move-left' ? 'left' : 'right',
                    companionIntroSeen: true,
                  });
                }
              }}
              style={[styles.bird, animatedBird]}
            >
              <Melo mood={mood} size={COMPANION_SIZE} grounded={false} />
            </Animated.View>
          </GestureDetector>
        </View>
      ) : null}
      <MeloContextSheet
        visible={contextOpen}
        onClose={() => setContextOpen(false)}
        mood={mood}
        presence={presence}
        {...(action === undefined ? {} : { action })}
        quietMode={melo.quietMode}
        position={contextPosition}
        onAction={() => action && nav.openMelo({ prefill: action.prompt })}
        onQuietModeChange={() => {
          setContextOpen(false);
          setMelo({ quietMode: !melo.quietMode });
        }}
        onPositionChange={(position) => {
          if (position === 'auto')
            setMelo({ preferredPosition: 'auto', companionPosition: undefined });
          else
            setMelo({
              preferredPosition: position,
              companionPosition: {
                x: position === 'left' ? 0 : 1,
                y: melo.companionPosition?.y ?? 0.25,
              },
            });
        }}
        onTalk={() => nav.openMelo()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 55 },
  bubble: {
    position: 'absolute',
    width: 220,
    minHeight: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 55,
    elevation: 8,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  bubbleText: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  bird: {
    position: 'absolute',
    width: COMPANION_SIZE,
    height: COMPANION_SIZE,
    zIndex: 56,
    elevation: 9,
  },
});
