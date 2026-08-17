import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  Animated,
  AppState,
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CompanionEngine,
  PRESENCE,
  createMemoryPersistence,
  type CompanionAnchor,
  type CompanionEvent,
  type CompanionExclusion,
  type CompanionRect,
  type CompanionSnapshot,
} from '@folio/melo-companion-engine';

import { Melo, type MeloMood, type MeloPose } from '@/folio/melo/Melo';
import { useReducedMotion } from '@/folio/lib/motion';
import { subscribeAllMeloReactions } from '@/folio/lib/melo/reactionBus';
import type { MeloIntent, ScreenId } from '@/folio/types';
import { MeloCompanionVisibilityProvider } from './MeloCompanionVisibility';
import { MeloAnimatedSprite } from './MeloAnimatedSprite';
import { meloCompanionBehaviorSeed, persistMeloCompanionBehavior } from './persistence';

const COMPANION_WIDTH = 58;
const COMPANION_HEIGHT = 76;
const MEASURE_SETTLE_MS = 120;

type AnchorOptions = Readonly<{
  placement?: CompanionAnchor['placement'];
  priority?: number;
  offset?: Readonly<{ x: number; y: number }>;
  gap?: number;
}>;

type CompanionContextValue = Readonly<{
  screen: ScreenId;
  upsertAnchor: (anchor: CompanionAnchor) => void;
  removeAnchor: (id: string) => void;
  upsertExclusion: (zone: CompanionExclusion) => void;
  removeExclusion: (id: string) => void;
  registerMeasurer: (id: string, measure: () => void) => () => void;
  refreshMeasurements: () => void;
  beginScroll: () => void;
  endScroll: () => void;
  emit: (event: CompanionEvent) => void;
  tucked: boolean;
  setTucked: (value: boolean) => void;
}>;

const CompanionContext = createContext<CompanionContextValue | null>(null);

export type MeloCompanionHostProps = PropsWithChildren<{
  screen: ScreenId;
  modalOpen: boolean;
  quiet: boolean;
  wardrobe: readonly string[];
  onOpenMelo: (intent?: MeloIntent) => void;
}>;

/** One persistent mobile companion instance. Screens supply semantic perches; no perch means hide. */
export function MeloCompanionHost({
  screen,
  modalOpen,
  quiet,
  wardrobe,
  onOpenMelo,
  children,
}: MeloCompanionHostProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const persistenceRef = useRef(createMemoryPersistence(meloCompanionBehaviorSeed()));
  const engineRef = useRef<CompanionEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new CompanionEngine({
      instanceId: 'melo-mobile-companion',
      persistence: persistenceRef.current,
      size: { width: COMPANION_WIDTH, height: COMPANION_HEIGHT },
      timings: {
        wait: 1350,
        enter: 180,
        peek: 520,
        move: 430,
        settle: 360,
        routeLeave: 140,
      },
    });
  }
  const engine = engineRef.current;
  const [snapshot, setSnapshot] = useState<CompanionSnapshot>(() => engine.snapshot());
  const [scrolling, setScrolling] = useState(false);
  const [anchorCount, setAnchorCount] = useState(0);
  const anchorCleanups = useRef(new Map<string, () => void>());
  const exclusionCleanups = useRef(new Map<string, () => void>());
  const measurers = useRef(new Map<string, () => void>());
  const scrollSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshMeasurements = useCallback(() => {
    for (const measure of measurers.current.values()) measure();
  }, []);

  const upsertAnchor = useCallback(
    (anchor: CompanionAnchor) => {
      anchorCleanups.current.get(anchor.id)?.();
      anchorCleanups.current.set(anchor.id, engine.registerAnchor(anchor));
      setAnchorCount(anchorCleanups.current.size);
    },
    [engine],
  );

  const removeAnchor = useCallback((id: string) => {
    anchorCleanups.current.get(id)?.();
    anchorCleanups.current.delete(id);
    setAnchorCount(anchorCleanups.current.size);
  }, []);

  const upsertExclusion = useCallback(
    (zone: CompanionExclusion) => {
      exclusionCleanups.current.get(zone.id)?.();
      exclusionCleanups.current.set(zone.id, engine.registerExclusion(zone));
    },
    [engine],
  );

  const removeExclusion = useCallback((id: string) => {
    exclusionCleanups.current.get(id)?.();
    exclusionCleanups.current.delete(id);
  }, []);

  const registerMeasurer = useCallback((id: string, measure: () => void) => {
    measurers.current.set(id, measure);
    return () => measurers.current.delete(id);
  }, []);

  const beginScroll = useCallback(() => {
    if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
    setScrolling(true);
  }, []);

  const endScroll = useCallback(() => {
    if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
    scrollSettleTimer.current = setTimeout(() => {
      refreshMeasurements();
      setScrolling(false);
    }, MEASURE_SETTLE_MS);
  }, [refreshMeasurements]);

  const emit = useCallback((event: CompanionEvent) => void engine.emit(event), [engine]);
  const setTucked = useCallback((value: boolean) => engine.setTucked(value), [engine]);
  const suppressInlineCharacter =
    quiet ||
    modalOpen ||
    snapshot.lifecycle.animationPaused ||
    snapshot.screenProfile.hidden ||
    (anchorCount > 0 &&
      Boolean(snapshot.placement?.rect) &&
      snapshot.presence !== PRESENCE.HIDDEN &&
      snapshot.presence !== PRESENCE.TUCKED &&
      snapshot.presence !== PRESENCE.WAITING);

  const contextValue = useMemo<CompanionContextValue>(
    () => ({
      screen,
      upsertAnchor,
      removeAnchor,
      upsertExclusion,
      removeExclusion,
      registerMeasurer,
      refreshMeasurements,
      beginScroll,
      endScroll,
      emit,
      tucked: snapshot.tucked,
      setTucked,
    }),
    [
      screen,
      upsertAnchor,
      removeAnchor,
      upsertExclusion,
      removeExclusion,
      registerMeasurer,
      refreshMeasurements,
      beginScroll,
      endScroll,
      emit,
      snapshot.tucked,
      setTucked,
    ],
  );

  useEffect(() => {
    const unsubscribe = engine.subscribe((next) => {
      setSnapshot(next);
      persistMeloCompanionBehavior(persistenceRef.current.dump());
    });
    return () => {
      unsubscribe();
      engine.destroy();
    };
  }, [engine]);

  useEffect(() => {
    engine.setShell({ x: 0, y: 0, width, height });
    const topCleanup = engine.registerExclusion({
      id: '__system/status-bar',
      rect: { x: 0, y: 0, width, height: insets.top + 6 },
    });
    const bottomHeight = insets.bottom + 78;
    const bottomCleanup = engine.registerExclusion({
      id: '__system/bottom-navigation',
      rect: { x: 0, y: Math.max(0, height - bottomHeight), width, height: bottomHeight },
    });
    refreshMeasurements();
    return () => {
      topCleanup();
      bottomCleanup();
    };
  }, [engine, height, insets.bottom, insets.top, refreshMeasurements, width]);

  useEffect(() => {
    engine.navigate(screen);
    const frame = requestAnimationFrame(refreshMeasurements);
    return () => cancelAnimationFrame(frame);
  }, [engine, refreshMeasurements, screen]);

  useEffect(
    () => engine.setOptions({ reducedMotion, modalOpen }),
    [engine, modalOpen, reducedMotion],
  );

  useEffect(() => engine.setQuiet(quiet), [engine, quiet]);

  useEffect(
    () =>
      subscribeAllMeloReactions((channel, payload) => {
        if (!payload.eventType) return;
        engine.emit({
          type: payload.eventType,
          source: { channel, key: payload.key ?? null },
          ...(payload.eventPriority ? { priority: payload.eventPriority } : {}),
          ...(payload.eventIntensity ? { intensity: payload.eventIntensity } : {}),
          ...(payload.eventDirection ? { direction: payload.eventDirection } : {}),
        });
      }),
    [engine],
  );

  useEffect(() => {
    const supported = ['crown', 'headphones', 'scarf'].find((item) => wardrobe.includes(item));
    engine.setWardrobe(supported ?? null);
  }, [engine, wardrobe]);

  useEffect(() => {
    // Android may expose a null/unknown AppState during the first committed render and then never
    // replay the already-active transition to this listener. Treat only an explicit background
    // state as hidden during hydration so Melo cannot get stranded invisible on cold start.
    engine.setOptions({ appHidden: AppState.currentState === 'background' });
    const subscription = AppState.addEventListener('change', (state) => {
      engine.setOptions({ appHidden: state !== 'active' });
      if (state === 'active') refreshMeasurements();
    });
    return () => subscription.remove();
  }, [engine, refreshMeasurements]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => engine.setOptions({ typing: true }));
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      engine.setOptions({ typing: false });
      refreshMeasurements();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [engine, refreshMeasurements]);

  // The pure engine advances only when asked. Use one bounded timer that sleeps in the background
  // and never drives layout at animation-frame frequency.
  useEffect(() => {
    if (snapshot.appHidden) return undefined;
    const now = Date.now();
    const due = [snapshot.transitionUntil, snapshot.bubble?.expiresAt, snapshot.idle.nextAt]
      .filter((value): value is number => typeof value === 'number' && value > now)
      .sort((left, right) => left - right)[0];
    const delay = due === undefined ? 1000 : Math.max(16, Math.min(1000, due - now));
    const timer = setTimeout(() => engine.tick(), delay);
    return () => clearTimeout(timer);
  }, [engine, snapshot]);

  useEffect(
    () => () => {
      if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
      for (const cleanup of anchorCleanups.current.values()) cleanup();
      for (const cleanup of exclusionCleanups.current.values()) cleanup();
    },
    [],
  );

  const engage = useCallback(() => {
    const action = engine.snapshot().screenProfile.action;
    engine.engage(action);
    onOpenMelo(action ? { prefill: action.prompt } : undefined);
  }, [engine, onOpenMelo]);

  return (
    <MeloCompanionVisibilityProvider suppressInlineCharacter={suppressInlineCharacter}>
      <CompanionContext.Provider value={contextValue}>
        <View collapsable={false} style={styles.host}>
          {children}
          <MeloCompanionLayer
            engage={engage}
            engine={engine}
            scrolling={scrolling}
            tuck={() => setTucked(true)}
            snapshot={snapshot}
            wardrobeActive={wardrobe.length > 0}
          />
        </View>
      </CompanionContext.Provider>
    </MeloCompanionVisibilityProvider>
  );
}

export function MeloCompanionPerch({
  id,
  priority = 10,
  companionSize = COMPANION_WIDTH,
  style,
  children,
}: {
  id: string;
  priority?: number;
  companionSize?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const context = useContext(CompanionContext);
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    if (!context) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      // The placeholder reserves the character's visual footprint. Register its lower edge so the
      // engine's top-right placement lands fully inside that intentional empty area.
      context.upsertAnchor({
        id,
        screen: context.screen,
        rect: { x, y: y + height, width, height: 0 },
        placement: 'top-right',
        size: { width: companionSize, height: companionSize },
        priority,
        gap: 0,
        reserved: true,
      });
    });
  }, [companionSize, context, id, priority]);

  useEffect(() => {
    if (!context) return undefined;
    const unregisterMeasure = context.registerMeasurer(id, measure);
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      unregisterMeasure();
      context.removeAnchor(id);
    };
  }, [context, id, measure]);

  return (
    <View
      collapsable={false}
      onLayout={measureOnLayout(measure)}
      pointerEvents="box-none"
      ref={ref}
      style={[styles.perch, { height: companionSize, width: companionSize }, style]}
    >
      {children}
    </View>
  );
}

export function MeloCompanionExclusion({
  id,
  children,
  style,
  attentionSalience,
}: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When supplied, touching this protected region also gives Melo a bounded gaze target. */
  attentionSalience?: number;
}) {
  const context = useContext(CompanionContext);
  const ref = useRef<View>(null);
  const measuredRect = useRef<CompanionRect | null>(null);
  const measure = useCallback(() => {
    if (!context) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      const rect = { x, y, width, height };
      measuredRect.current = rect;
      context.upsertExclusion({ id, screen: context.screen, rect });
    });
  }, [context, id]);

  const attend = useCallback(() => {
    if (!context || attentionSalience === undefined || !measuredRect.current) return;
    context.emit({
      type: 'SCREEN_INTERACTION',
      target: measuredRect.current,
      source: id,
      salience: Math.max(0, Math.min(1, attentionSalience)),
      notice: false,
    });
  }, [attentionSalience, context, id]);

  useEffect(() => {
    if (!context) return undefined;
    const unregisterMeasure = context.registerMeasurer(id, measure);
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      unregisterMeasure();
      context.removeExclusion(id);
    };
  }, [context, id, measure]);

  return (
    <View
      collapsable={false}
      onLayout={measureOnLayout(measure)}
      onTouchStart={attentionSalience === undefined ? undefined : attend}
      ref={ref}
      style={style}
    >
      {children}
    </View>
  );
}

export function useMeloCompanionScrollHandlers() {
  const context = useContext(CompanionContext);
  return useMemo(
    () => ({
      onScrollBeginDrag: context?.beginScroll,
      onScrollEndDrag: context?.endScroll,
      onMomentumScrollBegin: context?.beginScroll,
      onMomentumScrollEnd: context?.endScroll,
    }),
    [context],
  );
}

export function useMeloCompanionEvents(): (event: CompanionEvent) => void {
  return useContext(CompanionContext)?.emit ?? noopCompanionEvent;
}

export function useMeloCompanionControls(): Readonly<{
  tucked: boolean;
  setTucked: (value: boolean) => void;
}> {
  const value = useContext(CompanionContext);
  return value
    ? { tucked: value.tucked, setTucked: value.setTucked }
    : { tucked: false, setTucked: noopTuckedControl };
}

function noopTuckedControl(_value: boolean): void {}
function noopCompanionEvent(_event: CompanionEvent): void {}

function measureOnLayout(measure: () => void) {
  return (_event: LayoutChangeEvent) => measure();
}

function MeloCompanionLayer({
  engage,
  engine,
  scrolling,
  tuck,
  snapshot,
  wardrobeActive,
}: {
  engage: () => void;
  engine: CompanionEngine;
  scrolling: boolean;
  tuck: () => void;
  snapshot: CompanionSnapshot;
  wardrobeActive: boolean;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const currentRect = useRef<CompanionRect | null>(null);
  const dragStart = useRef<CompanionRect | null>(null);
  const desiredRect =
    snapshot.routeMotion?.phase === 'moving' && snapshot.routeMotion.toRect
      ? snapshot.routeMotion.toRect
      : (snapshot.placement?.rect ?? null);
  const desiredX = desiredRect?.x ?? null;
  const desiredY = desiredRect?.y ?? null;
  const desiredWidth = desiredRect?.width ?? null;
  const desiredHeight = desiredRect?.height ?? null;
  const visible =
    !scrolling &&
    desiredRect !== null &&
    snapshot.presence !== 'hidden' &&
    snapshot.presence !== 'tucked' &&
    snapshot.presence !== PRESENCE.WAITING &&
    !snapshot.quiet &&
    !snapshot.lifecycle.animationPaused;

  useEffect(() => {
    if (desiredX === null || desiredY === null || desiredWidth === null || desiredHeight === null) {
      return;
    }
    const nextRect = {
      x: desiredX,
      y: desiredY,
      width: desiredWidth,
      height: desiredHeight,
    };
    const previous = currentRect.current;
    const first = previous === null;
    const unchanged =
      previous !== null &&
      previous.x === nextRect.x &&
      previous.y === nextRect.y &&
      previous.width === nextRect.width &&
      previous.height === nextRect.height;
    currentRect.current = nextRect;
    // Engine snapshots are cloned for safety. Comparing their rect object identity would restart
    // this timing animation on every idle tick even when Melo has not moved.
    if (unchanged) return;
    if (snapshot.reducedMotion || first || snapshot.presence === 'dragging') {
      position.setValue({ x: nextRect.x, y: nextRect.y });
      return;
    }
    Animated.timing(position, {
      toValue: { x: nextRect.x, y: nextRect.y },
      duration: snapshot.routeMotion?.phase === 'moving' ? 430 : 260,
      useNativeDriver: true,
    }).start();
  }, [
    desiredHeight,
    desiredWidth,
    desiredX,
    desiredY,
    position,
    snapshot.presence,
    snapshot.reducedMotion,
    snapshot.routeMotion?.phase,
  ]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? (snapshot.presence === 'leaving' ? 0.35 : 1) : 0,
      duration: snapshot.reducedMotion ? 0 : visible ? 160 : 100,
      useNativeDriver: true,
    }).start();
  }, [opacity, snapshot.presence, snapshot.reducedMotion, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 7 || Math.abs(gesture.dy) > 7,
        onPanResponderGrant: () => {
          dragStart.current = currentRect.current;
          engine.dragStart({ rect: currentRect.current });
        },
        onPanResponderMove: (_event, gesture) => {
          const start = dragStart.current;
          if (!start) return;
          engine.dragMove({ ...start, x: start.x + gesture.dx, y: start.y + gesture.dy });
        },
        onPanResponderRelease: () => {
          dragStart.current = null;
          engine.dragEnd();
        },
        onPanResponderTerminate: () => {
          dragStart.current = null;
          engine.dragEnd();
        },
      }),
    [engine],
  );

  if (!desiredRect) return null;
  const performance = companionPerformance(snapshot.visualState);

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.layer,
        {
          height: desiredRect.height,
          opacity,
          transform: position.getTranslateTransform(),
          width: desiredRect.width,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable
        accessibilityHint="Tap for help, drag to move, or long press to tuck Melo away."
        accessibilityLabel={`Melo companion, ${performance.label}`}
        accessibilityRole="button"
        hitSlop={Math.max(0, (44 - Math.min(desiredRect.width, desiredRect.height)) / 2)}
        onLongPress={tuck}
        onPress={engage}
        style={styles.characterButton}
      >
        <MeloAnimatedSprite
          height={desiredRect.height}
          paused={!visible || snapshot.lifecycle.animationPaused}
          reducedMotion={snapshot.reducedMotion}
          visualState={snapshot.visualState}
          wardrobeActive={wardrobeActive}
          wardrobeFallback={
            <Melo
              ambientMotion={false}
              asleep={performance.asleep}
              effects={performance.effects}
              facing={snapshot.gaze.direction}
              grounded
              mood={performance.mood}
              persistent
              pose={performance.pose}
              size={Math.min(desiredRect.width, desiredRect.height)}
            />
          }
          width={desiredRect.width}
        />
      </Pressable>
    </Animated.View>
  );
}

function companionPerformance(visualState: string): Readonly<{
  mood: MeloMood;
  pose: MeloPose;
  asleep: boolean;
  effects: boolean;
  label: string;
}> {
  if (visualState === 'sleeping') {
    return { mood: 'calm', pose: 'none', asleep: true, effects: false, label: 'resting' };
  }
  if (visualState.includes('thinking')) {
    return { mood: 'think', pose: 'thinking', asleep: false, effects: false, label: 'thinking' };
  }
  if (visualState.includes('concern') || visualState === 'blocked') {
    return { mood: 'concern', pose: 'check', asleep: false, effects: false, label: 'concerned' };
  }
  if (visualState === 'reassurance') {
    return { mood: 'protect', pose: 'safe', asleep: false, effects: true, label: 'reassuring' };
  }
  if (visualState === 'positive-major') {
    return {
      mood: 'celebrate',
      pose: 'sealed',
      asleep: false,
      effects: true,
      label: 'celebrating',
    };
  }
  if (visualState === 'positive-small' || visualState === 'result-acknowledgement') {
    return { mood: 'cheer', pose: 'safe', asleep: false, effects: true, label: 'pleased' };
  }
  if (
    visualState === 'notice-user' ||
    visualState === 'peek' ||
    visualState.startsWith('gaze-') ||
    visualState.startsWith('move-short') ||
    visualState === 'waiting-for-user'
  ) {
    return { mood: 'curious', pose: 'none', asleep: false, effects: false, label: 'attentive' };
  }
  return { mood: 'calm', pose: 'none', asleep: false, effects: false, label: 'calm' };
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  perch: {},
  layer: { left: 0, position: 'absolute', top: 0, zIndex: 80 },
  characterButton: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    width: '100%',
  },
});
