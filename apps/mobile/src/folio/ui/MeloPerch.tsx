import { useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Keyboard, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { deriveShellContextAction } from '@/folio/lib/melo/companion';
import { perchTargets, resolvePerchDrop, PERCH_SIZE, type PerchSide } from '@/folio/lib/melo/perch';
import { MeloFigure } from '@/folio/melo/MeloFigure';
import { MeloSuppressedContext } from '@/folio/melo/MeloVisibility';
import { MeloContextSheet } from '@/folio/sheets/MeloContextSheet';
import { setMelo, useAppStore } from '@/folio/store';
import { useTheme } from '@/folio/theme';
import type { Nav, ScreenId } from '@/folio/types';
import { MeloPerchBubble } from './MeloPerchBubble';

/** A measured semantic lane. The native layout reserves its whole area, so
 * dragging cannot cover headings, amounts, controls, system bars or Undo.
 */
export function MeloPerch({ screen, nav }: { screen: ScreenId; nav: Nav }) {
  const t = useTheme();
  const quiet = useAppStore((state) => state.melo?.quietMode === true);
  const suppressed = useContext(MeloSuppressedContext);
  const preferred = useAppStore((state) => state.melo?.preferredPosition ?? 'auto');
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(Keyboard.isVisible());
  const [reduce, setReduce] = useState(false);
  const [dragging, setDragging] = useState(false);
  const x = useSharedValue(0);
  const origin = useSharedValue(0);
  const targets = perchTargets(width);
  const action = deriveShellContextAction(screen);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardOpen(true);
      setOpen(false);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      motion.remove();
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    x.value = reduce
      ? targets[preferred]
      : withSpring(targets[preferred], { damping: 22, stiffness: 240 });
  }, [preferred, width, reduce, x]);
  function move(side: PerchSide) {
    setMelo({ preferredPosition: side, companionPosition: undefined });
    x.value = reduce ? targets[side] : withSpring(targets[side], { damping: 22, stiffness: 240 });
  }
  function finish(rawX: number, rawY: number) {
    setDragging(false);
    move(resolvePerchDrop(width, rawX, rawY, preferred));
  }
  const drag = Gesture.Pan()
    .activateAfterLongPress(180)
    .minDistance(8)
    .onStart(() => {
      origin.value = x.value;
      runOnJS(setDragging)(true);
    })
    .onUpdate((event) => {
      x.value = Math.max(0, Math.min(width - PERCH_SIZE, origin.value + event.translationX));
    })
    .onEnd((event) => runOnJS(finish)(origin.value + event.translationX, event.translationY))
    .onFinalize(() => runOnJS(setDragging)(false));
  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd((_event, success) => {
      if (success) runOnJS(setOpen)(true);
    });
  const birdStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  if (quiet) return null;
  return (
    <>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.lane}>
        {dragging
          ? Object.entries(targets).map(([side, left]) => (
              <View
                key={side}
                pointerEvents="none"
                style={[styles.target, { left, borderColor: t.calm }]}
              />
            ))
          : null}
        {!keyboardOpen && !optionsOpen && !suppressed && width >= PERCH_SIZE ? (
          <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
            <Animated.View
              accessible
              accessibilityRole="button"
              accessibilityLabel="Melo. Tap for options, or hold and drag to move."
              accessibilityActions={[
                { name: 'activate', label: 'Open Melo options' },
                { name: 'move-left', label: 'Move Melo left' },
                { name: 'move-right', label: 'Move Melo right' },
                { name: 'reset-position', label: 'Back to its place' },
              ]}
              onAccessibilityAction={(event) => {
                const actionName = event.nativeEvent.actionName;
                if (actionName === 'activate') setOpen(true);
                else
                  move(
                    actionName === 'move-left'
                      ? 'left'
                      : actionName === 'move-right'
                        ? 'right'
                        : 'auto',
                  );
              }}
              style={[styles.bird, birdStyle]}
            >
              <View importantForAccessibility="no-hide-descendants">
                <MeloFigure role="perch" />
              </View>
            </Animated.View>
          </GestureDetector>
        ) : null}
      </View>
      {open && !keyboardOpen && !optionsOpen && !suppressed ? (
        <View style={styles.bubbleSlot}>
          <MeloPerchBubble
            {...(action ? { action } : {})}
            position={preferred}
            anchorX={targets[preferred] + PERCH_SIZE / 2}
            onClose={() => setOpen(false)}
            onMove={move}
            onOptions={() => {
              setOpen(false);
              setOptionsOpen(true);
            }}
            onExpand={() => {
              setOpen(false);
              nav.openMelo(action ? { prefill: action.prompt } : undefined);
            }}
          />
        </View>
      ) : null}
      <MeloContextSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        mood="calm"
        presence="perched"
        {...(action ? { action } : {})}
        quietMode={quiet}
        position={preferred}
        onAction={() => action && nav.openMelo({ prefill: action.prompt })}
        onQuietModeChange={() => {
          setMelo({ quietMode: !quiet });
          setOpen(false);
          setOptionsOpen(false);
        }}
        onPositionChange={move}
        onTalk={() => nav.openMelo()}
      />
    </>
  );
}
const styles = StyleSheet.create({
  bubbleSlot: { marginTop: -8, marginBottom: 24 },
  lane: { height: 96, marginVertical: 16, position: 'relative' },
  bird: { position: 'absolute', top: 4, width: 88, height: 88 },
  target: {
    position: 'absolute',
    top: 4,
    width: 88,
    height: 88,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
  },
});
