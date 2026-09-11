import { useContext, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { FinancialPlanResult } from '@folio/finance-engine';
import { selectFinancialPresentation } from '@/folio/lib/financialPresentation';
import { meloAnchorContext } from '@/folio/lib/melo/anchorContext';
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
import { useMeloScrollAnchor } from '@/folio/melo/MeloScrollView';
import { MeloContextSheet } from '@/folio/sheets/MeloContextSheet';
import { setMelo, useAppStore } from '@/folio/store';
import { useTheme } from '@/folio/theme';
import type { Nav, ScreenId } from '@/folio/types';
import { MeloPerchBubble } from './MeloPerchBubble';

/** A measured semantic lane. The native layout reserves its whole area, so
 * dragging cannot cover headings, amounts, controls, system bars or Undo.
 */
export function MeloPerch({
  screen,
  nav,
  plan,
}: {
  screen: ScreenId;
  nav: Nav;
  plan: FinancialPlanResult | null;
}) {
  const t = useTheme();
  const state = useAppStore((current) => current);
  const { fontScale } = useWindowDimensions();
  const context = meloAnchorContext(plan, selectFinancialPresentation(state, plan));
  const stack = fontScale > 1.3;
  const anchor = useMeloScrollAnchor(true);
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
  const followContext = () => {
    if (context.destination === 'onboarding') nav.openSheet('onboarding');
    else if (context.destination === 'melo')
      nav.openMelo(action ? { prefill: action.prompt } : undefined);
    else nav.go(context.destination);
  };
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
  if (quiet)
    return (
      <View style={[styles.context, { marginVertical: 12 }]}>
        <Text style={[styles.contextLine, { color: t.ink }]}>{context.sentence}</Text>
        <Pressable accessibilityRole="button" onPress={followContext} style={styles.contextAction}>
          <Text style={[styles.contextLabel, { color: t.calm }]}>{context.label} →</Text>
        </Pressable>
      </View>
    );
  return (
    <>
      <View
        ref={anchor.ref}
        collapsable={false}
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          anchor.onLayout?.();
        }}
        style={[styles.lane, stack ? { paddingTop: 100 } : undefined]}
      >
        <View
          pointerEvents={dragging ? 'none' : 'auto'}
          importantForAccessibility={dragging ? 'no-hide-descendants' : 'auto'}
          style={[
            styles.context,
            stack ? undefined : preferred === 'left' ? { marginLeft: 100 } : { marginRight: 100 },
            { opacity: dragging ? 0 : 1 },
          ]}
        >
          <Text style={[styles.contextLine, { color: t.ink }]}>{context.sentence}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={followContext}
            style={styles.contextAction}
          >
            <Text style={[styles.contextLabel, { color: t.calm }]}>{context.label} →</Text>
          </Pressable>
        </View>
        {dragging
          ? Object.entries(targets)
              .filter(([side]) => side !== 'auto')
              .map(([side, left]) => (
                <View
                  key={side}
                  pointerEvents="none"
                  style={[styles.target, { left, borderColor: t.calm }]}
                />
              ))
          : null}
        {!anchor.tucked && !keyboardOpen && !optionsOpen && !suppressed && width >= PERCH_SIZE ? (
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
      {open && !anchor.tucked && !keyboardOpen && !optionsOpen && !suppressed ? (
        <View style={styles.bubbleSlot}>
          <MeloPerchBubble
            statement={context.sentence}
            position={preferred}
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
  bubbleSlot: { marginBottom: 24 },
  lane: { minHeight: 96, marginVertical: 12, position: 'relative' },
  context: { minHeight: 96, justifyContent: 'center' },
  contextLine: { fontSize: 14, lineHeight: 20 },
  contextAction: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  contextLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
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
