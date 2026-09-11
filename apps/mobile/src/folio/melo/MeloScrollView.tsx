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
  Keyboard,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewProps,
} from 'react-native';
import { useAppStore } from '@/folio/store';
import { MeloSuppressedContext } from './MeloVisibility';
import { shouldTuckMelo, visibleMeloFraction, type Rect } from '@/folio/lib/melo/scrollOwner';

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
 * A single owned bird scrolls naturally and suppresses when its safe slot leaves
 * view. There is no invented full-width restore banner. Appearance and placement
 * remain subject to the reference choreography review; no safe corner is guessed.
 */
export const MeloScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function MeloScrollView(props, forwardedRef) {
    const quiet = useAppStore((state) => state.melo?.quietMode === true);
    const suppressed = useContext(MeloSuppressedContext);
    const dimensions = useWindowDimensions();
    const viewport = useRef<View>(null);
    const scroller = useRef<ScrollView | null>(null);
    const anchor = useRef<View | null>(null);
    const offset = useRef(0);
    const geometry = useRef<{ slot: Rect; viewport: Rect } | null>(null);
    const active = useRef(false);
    const alive = useRef(true);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const epoch = useRef(0);
    const [tucked, setTucked] = useState(false);
    const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
    const blocked = quiet || suppressed || keyboard;
    const blockedRef = useRef(blocked);
    blockedRef.current = blocked;

    const refresh = useCallback(() => {
      if (timer.current) clearTimeout(timer.current);
      const version = ++epoch.current;
      timer.current = setTimeout(() => {
        if (active.current || blockedRef.current || !anchor.current || !viewport.current) return;
        viewport.current.measureInWindow((vx, vy, vw, vh) => {
          anchor.current?.measureInWindow((ax, ay, aw, ah) => {
            if (!alive.current || version !== epoch.current || active.current || blockedRef.current)
              return;
            if (vw <= 0 || vh <= 0 || aw <= 0 || ah <= 0) return;
            const protectedViewport = { x: vx + 4, y: vy + 4, width: vw - 8, height: vh - 8 };
            geometry.current = {
              slot: { x: ax, y: ay + offset.current, width: aw, height: ah },
              viewport: protectedViewport,
            };
            const fraction = visibleMeloFraction(
              { x: ax, y: ay, width: aw, height: ah },
              protectedViewport,
            );
            setTucked((wasTucked) => shouldTuckMelo(wasTucked, fraction));
          });
        });
      }, 120);
    }, []);
    const register = useCallback(
      (node: View | null) => {
        anchor.current = node;
        geometry.current = null;
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
                offset.current = event.nativeEvent.contentOffset.y;
                // Hide immediately before the owned rectangle crosses the inset. Do not wait
                // for the idle measurement while a clipped character passes through the edge.
                const measured = geometry.current;
                if (measured && !blockedRef.current) {
                  const fraction = visibleMeloFraction(
                    { ...measured.slot, y: measured.slot.y - offset.current },
                    measured.viewport,
                  );
                  if (shouldTuckMelo(false, fraction)) setTucked(true);
                }
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
        </View>
      </OwnerContext.Provider>
    );
  },
);
const styles = StyleSheet.create({ root: { flex: 1 } });
