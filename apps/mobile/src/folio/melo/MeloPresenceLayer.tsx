import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Keyboard,
  PanResponder,
  View,
} from 'react-native';
import { useAppStore } from '@/folio/store';
import { useUndo } from '@/folio/ui/useUndo';
import { MeloAtlas } from './MeloAtlas';
import {
  motionBetween,
  PRESENCE_TIMING,
  resolvePresenceTarget,
  type PresencePhase,
} from '@/folio/lib/melo/presenceMotion';
import type { Rect } from '@/folio/lib/melo/scrollOwner';

export type PresenceAnchor = {
  id: string;
  screen: string;
  node: View | null;
  viewport: View | null;
  exclusion: View | null;
  visible: boolean;
  onPress: () => void;
  onMove: (side: 'left' | 'right' | 'auto') => void;
  onDrop: (dx: number, dy: number) => boolean;
};
type PresenceApi = {
  publish: (anchor: PresenceAnchor) => void;
  remove: (id: string) => void;
  refresh: (scrolling?: boolean) => void;
  authored: (id: string, visible: boolean) => void;
};
const PresenceContext = createContext<PresenceApi | null>(null);
export const useMeloPresenceLayer = () => useContext(PresenceContext);
type Target = { id: string; screen: string; rect: Rect; followingScroll: boolean };
const measure = (node: View | null): Promise<Rect | null> =>
  new Promise((resolve) => {
    if (!node) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) =>
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null),
    );
  });
const intersection = (a: Rect, b: Rect): Rect => ({
  x: Math.max(a.x, b.x),
  y: Math.max(a.y, b.y),
  width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)),
  height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)),
});

/** Mounted outside keyed route frames. Screen components publish whitespace next
 * to the relevant explanation. All layout measurements use one window coordinate
 * space; the renderer is translated into its root only after safety resolution. */
export function MeloPresenceProvider({
  children,
  screen,
  blocked,
  bottomClearance,
  topClearance,
  toastHeight,
}: {
  children: ReactNode;
  screen: string;
  blocked: boolean;
  bottomClearance: number;
  topClearance: number;
  toastHeight: number;
}) {
  const root = useRef<View>(null);
  const rootFrame = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const anchors = useRef(new Map<string, PresenceAnchor>());
  const authoredOwners = useRef(new Set<string>());
  const [authoredVisible, setAuthoredVisible] = useState(false);
  const { undoVisible, undoHeight } = useUndo();
  const [target, setTarget] = useState<Target | null>(null);
  const [rendered, setRendered] = useState<Target | null>(null);
  const [phase, setPhase] = useState<PresencePhase>('hidden');
  const [faceLeft, setFaceLeft] = useState(false);
  const [shortHop, setShortHop] = useState(true);
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const [backgrounded, setBackgrounded] = useState(AppState.currentState !== 'active');
  const [reduce, setReduce] = useState(true);
  const [still, setStill] = useState(false);
  const stillRef = useRef(still);
  stillRef.current = still;
  const quiet = useAppStore((state) => state.melo?.quietMode === true);
  const suppressed = blocked || keyboard || quiet || authoredVisible || backgrounded;
  const live = useRef({ screen, suppressed, bottomClearance, topClearance, feedback: 0 });
  live.current = {
    screen,
    suppressed,
    bottomClearance,
    topClearance,
    feedback: undoVisible ? undoHeight : toastHeight,
  };
  const previous = useRef<Target | null>(null);
  const epoch = useRef(0);
  const frame = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);
  const dragging = useRef(false);
  const dragStart = useRef<Rect | null>(null);
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const refresh = useCallback((followingScroll = false) => {
    const version = ++epoch.current;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (dragging.current) return;
      const owner = [...anchors.current.values()].find(
        (a) => a.screen === live.current.screen && a.visible && a.node,
      );
      if (!owner || live.current.suppressed) {
        setTarget(null);
        return;
      }
      void Promise.all([
        measure(root.current),
        measure(owner.node),
        measure(owner.viewport),
        measure(owner.exclusion),
      ]).then(([shell, slot, viewport, exclusion]) => {
        if (
          version !== epoch.current ||
          anchors.current.get(owner.id) !== owner ||
          owner.screen !== live.current.screen
        )
          return;
        if (!shell || !slot || !viewport || !exclusion) {
          setTarget(null);
          return;
        }
        rootFrame.current = shell;
        const bounds = intersection(viewport, {
          ...shell,
          y: shell.y + live.current.topClearance,
          height: Math.max(
            0,
            shell.height -
              live.current.topClearance -
              live.current.bottomClearance -
              live.current.feedback,
          ),
        });
        const rect = resolvePresenceTarget(slot, bounds, [exclusion]);
        // These dense screens have no registered shell whitespace outside the
        // semantic slot. Unsafe means hidden, never an invented corner or rail.
        if (!rect) {
          setTarget(null);
          return;
        }
        const next = {
          id: owner.id,
          screen: owner.screen,
          rect: { ...rect, x: rect.x - shell.x, y: rect.y - shell.y },
          followingScroll,
        };
        setTarget((old) =>
          old &&
          old.id === next.id &&
          Math.abs(old.rect.x - next.rect.x) < 0.5 &&
          Math.abs(old.rect.y - next.rect.y) < 0.5 &&
          old.rect.width === next.rect.width
            ? old
            : next,
        );
      });
    });
  }, []);
  const publish = useCallback(
    (anchor: PresenceAnchor) => {
      anchors.current.set(anchor.id, anchor);
      refresh();
    },
    [refresh],
  );
  const remove = useCallback(
    (id: string) => {
      anchors.current.delete(id);
      refresh();
    },
    [refresh],
  );
  const authored = useCallback((id: string, visible: boolean) => {
    if (visible) authoredOwners.current.add(id);
    else authoredOwners.current.delete(id);
    setAuthoredVisible(authoredOwners.current.size > 0);
  }, []);
  const api = useMemo(
    () => ({ publish, remove, refresh, authored }),
    [publish, remove, refresh, authored],
  );
  useLayoutEffect(() => {
    refresh();
  }, [
    screen,
    suppressed,
    bottomClearance,
    topClearance,
    toastHeight,
    undoVisible,
    undoHeight,
    refresh,
  ]);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduce(value);
    });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    const app = AppState.addEventListener('change', (value) => setBackgrounded(value !== 'active'));
    return () => {
      alive = false;
      motion.remove();
      show.remove();
      hide.remove();
      app.remove();
      ++epoch.current;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (stillTimer.current) clearTimeout(stillTimer.current);
    };
  }, []);
  const becomeStill = useCallback(() => {
    setStill(true);
    if (stillTimer.current) clearTimeout(stillTimer.current);
    stillTimer.current = setTimeout(() => setStill(false), PRESENCE_TIMING.stillAfterEngagement);
  }, []);
  // Engagement changes opacity/ambient playback without restarting route travel.
  useEffect(() => {
    if (phase === 'perched') opacity.setValue(still ? 0.55 : 1);
  }, [still, phase, opacity]);
  useEffect(() => {
    const version = ++sequence.current;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    x.stopAnimation();
    y.stopAnimation();
    lift.stopAnimation();
    opacity.stopAnimation();
    const schedule = (fn: () => void, ms: number) =>
      timers.current.push(
        setTimeout(() => {
          if (sequence.current === version) fn();
        }, ms),
      );
    const hide = () => {
      setPhase('hidden');
      opacity.setValue(0);
      setRendered(null);
      previous.current = null;
    };
    if (suppressed) {
      hide();
      return;
    }
    if (!target) {
      if (previous.current && !reduce) {
        setPhase('leaving');
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(lift, { toValue: -8, duration: 180, useNativeDriver: true }),
        ]).start();
        schedule(hide, 180);
      } else hide();
      return () => timers.current.forEach(clearTimeout);
    }
    const old = previous.current;
    const settle = () => {
      previous.current = target;
      setRendered(target);
      setPhase('perched');
      x.setValue(target.rect.x);
      y.setValue(target.rect.y);
      lift.setValue(0);
      opacity.setValue(stillRef.current ? 0.55 : 1);
    };
    setRendered(target);
    if (
      reduce ||
      (old?.id === target.id &&
        (target.followingScroll || motionBetween(old.rect, target.rect).distance < 2))
    ) {
      settle();
      return;
    }
    const from = old?.rect ?? {
      ...target.rect,
      x: target.rect.x + (target.rect.x > rootFrame.current.width / 2 ? 24 : -24),
      y: target.rect.y + 16,
    };
    const motion = motionBetween(from, target.rect);
    setFaceLeft(motion.faceLeft);
    setShortHop(motion.distance <= 180);
    x.setValue(from.x);
    y.setValue(from.y);
    lift.setValue(0);
    const move = () => {
      setPhase(old ? 'moving' : 'entering');
      opacity.setValue(old ? 1 : 0.4);
      Animated.parallel([
        Animated.timing(x, {
          toValue: target.rect.x,
          duration: motion.duration,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: target.rect.y,
          duration: motion.duration,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(lift, {
            toValue: -motion.arc,
            duration: motion.duration / 2,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(lift, {
            toValue: motion.overshoot,
            duration: motion.duration / 2,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(lift, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
      schedule(() => {
        if (old) settle();
        else {
          setPhase('peeking');
          schedule(settle, 240);
        }
      }, motion.duration + 180);
    };
    if (old) {
      setPhase('leaving');
      schedule(move, 180);
    } else {
      setPhase('waiting');
      opacity.setValue(0);
      schedule(move, 1200);
    }
    return () => timers.current.forEach(clearTimeout);
  }, [target, suppressed, reduce, x, y, lift, opacity]);

  const activate = () => {
    if (!rendered || phase !== 'perched') return;
    becomeStill();
    anchors.current.get(rendered.id)?.onPress();
  };
  const finishDrag = (dx: number, dy: number) => {
    const start = dragStart.current;
    dragging.current = false;
    if (!rendered || !start) return;
    const moved = { ...start, x: start.x + dx, y: start.y + dy };
    previous.current = { ...rendered, rect: moved };
    becomeStill();
    const accepted = anchors.current.get(rendered.id)?.onDrop(dx, dy) === true;
    if (accepted) {
      refresh();
      return;
    }
    // An unsafe drop visibly returns in the reference's bounded 260 ms.
    setPhase('moving');
    setShortHop(true);
    setFaceLeft(dx > 0);
    Animated.parallel([
      Animated.timing(x, {
        toValue: start.x,
        duration: reduce ? 0 : 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: start.y,
        duration: reduce ? 0 : 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        previous.current = rendered;
        setPhase('perched');
        refresh();
      }
    });
  };
  const touchAt = useRef(0);
  const gesture = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gestureState) =>
      phase === 'perched' &&
      Date.now() - touchAt.current >= 180 &&
      Math.hypot(gestureState.dx, gestureState.dy) > 8,
    onPanResponderGrant: () => {
      dragging.current = true;
      dragStart.current = rendered?.rect ?? null;
    },
    onPanResponderMove: (_event, event) => {
      const start = dragStart.current;
      if (start) {
        x.setValue(start.x + event.dx);
        y.setValue(start.y + event.dy);
      }
    },
    onPanResponderRelease: (_event, event) => finishDrag(event.dx, event.dy),
    onPanResponderTerminate: () => finishDrag(0, 80),
    onPanResponderTerminationRequest: () => false,
  });
  return (
    <PresenceContext.Provider value={api}>
      <View ref={root} collapsable={false} onLayout={() => refresh()} style={{ flex: 1 }}>
        {children}
        {rendered && !suppressed ? (
          <Animated.View
            {...gesture.panHandlers}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Melo. Tap for options, or hold and drag to move."
            onTouchStart={() => {
              touchAt.current = Date.now();
            }}
            onTouchEnd={() => {
              if (!dragging.current && Date.now() - touchAt.current < 180) activate();
            }}
            accessibilityActions={[
              { name: 'activate', label: 'Open Melo options' },
              { name: 'move-left', label: 'Move Melo left' },
              { name: 'move-right', label: 'Move Melo right' },
              { name: 'reset-position', label: 'Back to its place' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'activate') activate();
              else
                anchors.current
                  .get(rendered.id)
                  ?.onMove(
                    event.nativeEvent.actionName === 'move-left'
                      ? 'left'
                      : event.nativeEvent.actionName === 'move-right'
                        ? 'right'
                        : 'auto',
                  );
            }}
            pointerEvents={phase === 'perched' ? 'auto' : 'none'}
            importantForAccessibility={phase === 'perched' ? 'auto' : 'no-hide-descendants'}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: rendered.rect.width,
              height: rendered.rect.height,
              zIndex: 50,
              opacity,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ translateX: x }, { translateY: Animated.add(y, lift) }],
            }}
          >
            <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
              <MeloAtlas
                size={rendered.rect.width}
                phase={phase}
                faceLeft={faceLeft}
                shortHop={shortHop}
                paused={still || reduce}
              />
            </View>
          </Animated.View>
        ) : null}
      </View>
    </PresenceContext.Provider>
  );
}
