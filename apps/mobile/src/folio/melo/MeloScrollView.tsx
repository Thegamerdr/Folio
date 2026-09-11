import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ScrollViewProps,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAppStore } from '@/folio/store';
import { useTheme } from '@/folio/theme';
import { MeloSuppressedContext } from './MeloVisibility';
import { shouldTuckMelo, visibleMeloFraction } from '@/folio/lib/melo/scrollOwner';

type Owner = { register: (node: View | null) => void; refresh: () => void; tucked: boolean };
const OwnerContext = createContext<Owner | null>(null);

/** Exactly one editorial/perch slot registers per screen. Its reserved box remains
 * in the scroll content while the body tucks, so scroll position never jumps.
 */
export function useMeloScrollAnchor(enabled: boolean) {
  const owner = useContext(OwnerContext);
  return {
    ref: enabled ? owner?.register : undefined,
    onLayout: enabled ? owner?.refresh : undefined,
    tucked: enabled && owner?.tucked === true,
  };
}

/** Full-width content is a protected rectangle: no free shell corner is assumed.
 * The fallback occupies its own chrome row, outside content and bottom nav.
 * A single owned bird scrolls naturally; the restore affordance is a flame,
 * never a second Fenice. Side preferences stay on the semantic perch.
 */
export const MeloScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function MeloScrollView(props, forwardedRef) {
    const t = useTheme();
    const quiet = useAppStore((state) => state.melo?.quietMode === true);
    const side = useAppStore((state) => state.melo?.preferredPosition ?? 'auto');
    const suppressed = useContext(MeloSuppressedContext);
    const dimensions = useWindowDimensions();
    const viewport = useRef<View>(null);
    const scroller = useRef<ScrollView | null>(null);
    const anchor = useRef<View | null>(null);
    const offset = useRef(0);
    const active = useRef(false);
    const alive = useRef(true);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const epoch = useRef(0);
    const [tucked, setTucked] = useState(false);
    const [scrolling, setScrolling] = useState(false);
    const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
    const blocked = quiet || suppressed || keyboard;
    const blockedRef = useRef(blocked);
    blockedRef.current = blocked;

    const refresh = useCallback(() => {
      if (timer.current) clearTimeout(timer.current);
      const version = ++epoch.current;
      timer.current = setTimeout(() => {
        if (!active.current && alive.current) setScrolling(false);
        if (active.current || blockedRef.current || !anchor.current || !viewport.current) return;
        viewport.current.measureInWindow((vx, vy, vw, vh) => {
          anchor.current?.measureInWindow((ax, ay, aw, ah) => {
            if (!alive.current || version !== epoch.current || active.current || blockedRef.current)
              return;
            if (vw <= 0 || vh <= 0 || aw <= 0 || ah <= 0) return;
            const fraction = visibleMeloFraction(
              { x: ax, y: ay, width: aw, height: ah },
              { x: vx, y: vy, width: vw, height: vh },
            );
            setTucked((wasTucked) => shouldTuckMelo(wasTucked, fraction));
          });
        });
      }, 120);
    }, []);
    const register = useCallback(
      (node: View | null) => {
        anchor.current = node;
        if (!node) setTucked(false);
        refresh();
      },
      [refresh],
    );
    useEffect(() => {
      alive.current = true;
      const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
      const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
      return () => {
        alive.current = false;
        ++epoch.current;
        if (timer.current) clearTimeout(timer.current);
        show.remove();
        hide.remove();
      };
    }, []);
    useEffect(() => {
      // Insets, font size and rotation invalidate every previous measurement.
      if (blocked) setTucked(false);
      refresh();
    }, [blocked, dimensions.width, dimensions.height, dimensions.fontScale, refresh]);
    const restore = () => {
      viewport.current?.measureInWindow((_x, vy) => {
        anchor.current?.measureInWindow((_ax, ay) => {
          // Scroll directly to the owned slot; avoid an autonomous bird flight.
          scroller.current?.scrollTo({
            y: Math.max(0, offset.current + ay - vy - 12),
            animated: false,
          });
          refresh();
        });
      });
    };
    const owner = useMemo(
      () => ({ register, refresh, tucked: tucked && !blocked }),
      [register, refresh, tucked, blocked],
    );
    return (
      <OwnerContext.Provider value={owner}>
        <View style={styles.root}>
          <View ref={viewport} collapsable={false} style={styles.root} onLayout={refresh}>
            <ScrollView
              {...props}
              ref={(node) => {
                scroller.current = node;
                if (typeof forwardedRef === 'function') forwardedRef(node);
                else if (forwardedRef) forwardedRef.current = node;
              }}
              scrollEventThrottle={16}
              onLayout={(event) => {
                props.onLayout?.(event);
                refresh();
              }}
              onContentSizeChange={(width, height) => {
                props.onContentSizeChange?.(width, height);
                refresh();
              }}
              onScroll={(event) => {
                setScrolling(true);
                offset.current = event.nativeEvent.contentOffset.y;
                props.onScroll?.(event);
                refresh();
              }}
              onScrollBeginDrag={(event) => {
                active.current = true;
                ++epoch.current;
                props.onScrollBeginDrag?.(event);
              }}
              onScrollEndDrag={(event) => {
                active.current = false;
                props.onScrollEndDrag?.(event);
                refresh();
              }}
              onMomentumScrollBegin={(event) => {
                active.current = true;
                ++epoch.current;
                props.onMomentumScrollBegin?.(event);
              }}
              onMomentumScrollEnd={(event) => {
                active.current = false;
                props.onMomentumScrollEnd?.(event);
                refresh();
              }}
            />
          </View>
          {tucked && !blocked ? (
            <View
              style={[
                styles.chrome,
                {
                  backgroundColor: t.canvas,
                  borderTopColor: t.hairline,
                  alignItems: side === 'left' ? 'flex-start' : 'flex-end',
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show Melo"
                accessibilityHint="Returns to Melo's place on this screen."
                onPress={restore}
                style={styles.restore}
              >
                <TuckedEmber color={t.calm} still={!scrolling} />
                <Text style={{ color: t.calm, fontSize: 13 }}>Show Melo</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </OwnerContext.Provider>
    );
  },
);
const styles = StyleSheet.create({
  root: { flex: 1 },
  chrome: { minHeight: 48, justifyContent: 'center', borderTopWidth: 1, paddingHorizontal: 16 },
  restore: {
    minWidth: 44,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
});

function TuckedEmber({ color, still }: { color: string; still: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    opacity.stopAnimation();
    opacity.setValue(1);
    if (reduce || !still) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.65,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reduce, still]);
  return (
    <Animated.View style={{ opacity }} importantForAccessibility="no-hide-descendants">
      <Svg width={22} height={24} viewBox="0 0 24 28" accessibilityElementsHidden>
        <Path
          fill={color}
          d="M13 1c2 7-3 8-2 12 2-1 4-3 5-6 1 3 6 7 6 12a10 10 0 0 1-20 0C2 12 9 10 13 1Z"
        />
      </Svg>
    </Animated.View>
  );
}
