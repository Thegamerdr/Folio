import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import {
  classifyMeloGesture,
  deriveMeloPresence,
  deriveShellContextAction,
  meloDropSide,
} from '@/folio/lib/melo/companion';
import { shellCompanionPlacement } from '@/folio/lib/melo/shellCompanion';
import { Melo } from '@/folio/melo/Melo';
import { MeloContextSheet } from '@/folio/sheets/MeloContextSheet';
import { setMelo, useAppStore } from '@/folio/store';
import { useTheme } from '@/folio/theme';
import type { Nav, ScreenId } from '@/folio/types';

const INTRO_DWELL_MS = 15_000;
const COMPANION_SIZE = 64;
const SAFE_INSET = 8;
const TAB_SAFE_BOTTOM = 104;

/** Native counterpart of the pinned shell-local semantic companion layer. It renders only where
 * the source owns a real perch, honours quiet mode and the persisted side preference, and keeps
 * the canonical phoenix as the sole character renderer. */
export function ShellMeloCompanion({ screen, nav }: { screen: ScreenId; nav: Nav }) {
  const t = useTheme();
  const melo = useAppStore((state) => state.melo ?? { quietMode: false, wardrobe: [] });
  const waitingCount = useAppStore((state) => state.reviewQueue?.length ?? 0);
  const workspaceKind = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ??
      'personal',
  );
  const [showIntro, setShowIntro] = useState(melo.companionIntroSeen !== true);
  const [contextOpen, setContextOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [layerBounds, setLayerBounds] = useState({ width: 360, height: 720 });
  const placement = shellCompanionPlacement(
    screen,
    melo.preferredPosition ?? 'auto',
    workspaceKind,
  );
  const action = useMemo(() => deriveShellContextAction(screen), [screen]);
  const mood = screen === 'review' && waitingCount > 0 ? 'curious' : 'calm';
  const presence = dragging
    ? 'engaged'
    : contextOpen
      ? 'engaged'
      : deriveMeloPresence({
          quietMode: melo.quietMode,
          ...(action === undefined ? {} : { action }),
        });
  const animatedPosition = useRef(new Animated.ValueXY()).current;
  const gestureStart = useRef({ at: 0, x: 0, y: 0 });

  useEffect(() => {
    if (placement === null || dragging) return;
    Animated.spring(animatedPosition, {
      toValue: { x: placement.birdLeft, y: placement.top },
      useNativeDriver: false,
      speed: 22,
      bounciness: 5,
    }).start();
  }, [animatedPosition, dragging, placement?.birdLeft, placement?.top]);

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
  }, [melo.quietMode, placement?.bubbleLeft, placement?.top, showIntro]);

  const markIntroSeen = () => {
    setShowIntro(false);
    setMelo({ companionIntroSeen: true });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          if (placement === null) return;
          markIntroSeen();
          gestureStart.current = {
            at: Date.now(),
            x: placement.birdLeft,
            y: placement.top,
          };
          setDragging(true);
        },
        onPanResponderMove: (_event, gesture) => {
          if (placement === null) return;
          const x = Math.max(
            SAFE_INSET,
            Math.min(
              layerBounds.width - COMPANION_SIZE - SAFE_INSET,
              gestureStart.current.x + gesture.dx,
            ),
          );
          const y = Math.max(
            SAFE_INSET,
            Math.min(
              layerBounds.height - COMPANION_SIZE - TAB_SAFE_BOTTOM,
              gestureStart.current.y + gesture.dy,
            ),
          );
          animatedPosition.setValue({ x, y });
        },
        onPanResponderRelease: (_event, gesture) => {
          const kind = classifyMeloGesture(
            gesture.dx,
            gesture.dy,
            Date.now() - gestureStart.current.at,
          );
          setDragging(false);
          if (kind === 'tap') {
            setContextOpen(true);
            return;
          }
          const side = meloDropSide(
            gestureStart.current.x + gesture.dx,
            COMPANION_SIZE,
            layerBounds.width,
          );
          const target = shellCompanionPlacement(screen, side, workspaceKind);
          if (target !== null) {
            setMelo({ preferredPosition: side, companionIntroSeen: true });
            Animated.spring(animatedPosition, {
              toValue: { x: target.birdLeft, y: target.top },
              useNativeDriver: false,
              speed: 20,
              bounciness: 7,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          if (placement !== null) {
            Animated.spring(animatedPosition, {
              toValue: { x: placement.birdLeft, y: placement.top },
              useNativeDriver: false,
            }).start();
          }
        },
        onShouldBlockNativeResponder: () => true,
      }),
    [
      animatedPosition,
      layerBounds.height,
      layerBounds.width,
      placement,
      screen,
      workspaceKind,
    ],
  );

  const onLayerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setLayerBounds({ width, height });
  };

  if ((placement === null || melo.quietMode) && !contextOpen) return null;

  return (
    <>
      {placement !== null && !melo.quietMode ? (
        <View
          pointerEvents="box-none"
          onLayout={onLayerLayout}
          style={[StyleSheet.absoluteFill, styles.layer]}
        >
          {showIntro ? (
            <View
              accessibilityLiveRegion="polite"
              accessibilityRole="text"
              pointerEvents="none"
              style={[
                styles.bubble,
                {
                  top: placement.top,
                  left: placement.bubbleLeft,
                  backgroundColor: t.ink,
                  shadowColor: t.ink,
                },
              ]}
            >
              <Text style={[styles.bubbleText, { color: t.canvas }]}>Hi, I&apos;m Melo.</Text>
            </View>
          ) : null}
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
                setMelo({
                  preferredPosition: name === 'move-left' ? 'left' : 'right',
                  companionIntroSeen: true,
                });
              }
            }}
            {...panResponder.panHandlers}
            style={[
              styles.bird,
              animatedPosition.getLayout(),
              dragging ? styles.grabbed : undefined,
            ]}
          >
            <Melo mood={mood} size={COMPANION_SIZE} grounded={false} />
          </Animated.View>
        </View>
      ) : null}
      <MeloContextSheet
        visible={contextOpen}
        onClose={() => setContextOpen(false)}
        mood={mood}
        presence={presence}
        {...(action === undefined ? {} : { action })}
        quietMode={melo.quietMode}
        position={melo.preferredPosition ?? 'auto'}
        onAction={() => action && nav.openMelo({ prefill: action.prompt })}
        onQuietModeChange={() => {
          setContextOpen(false);
          setMelo({ quietMode: !melo.quietMode });
        }}
        onPositionChange={(position) => setMelo({ preferredPosition: position })}
        onTalk={() => nav.openMelo()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 55,
  },
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
  bubbleText: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  bird: {
    position: 'absolute',
    width: COMPANION_SIZE,
    height: COMPANION_SIZE,
    zIndex: 56,
    elevation: 9,
  },
  grabbed: {
    opacity: 0.9,
    transform: [{ scale: 1.05 }],
  },
});
