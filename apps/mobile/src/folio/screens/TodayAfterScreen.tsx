/** Current plan after a saved change. Recovery carries an explicit before/after receipt; visits
 * without one show the current canonical plan without guessing which historical record changed. */

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { elevation, gap, PressureScreen, pressed, radius, serif, useTheme } from '@/folio/theme';
import { useRoute } from '@/folio/lib/storeRoute';
import { useAppStore } from '@/folio/store';
import { buildFinancialPlanFromState } from '@/folio/lib/financialPlan';
import { formatMoney } from '@/folio/lib/financialPresentation';
import { selectAfterChangePresentation, type RecoveryReceipt } from '@/folio/lib/recoveryReceipt';
import type { RoutePoint } from '@/folio/lib/moneyPath';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import type { Nav } from '@/folio/types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The web's cubic-bezier(.16, 1, .3, 1) "ease-out-expo" — the shared screen easing.
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// The SVG is authored in the web's 400×120 user space; react-native-svg scales it to the card width
// via the viewBox, so every coordinate below is the web coordinate, unchanged.
const VB_W = 400;
const VB_H = 120;
const SVG_RENDER_H = 110; // the web rendered the 400×120 viewBox into a 110px-tall box
const ROUTE_DASH = 1200; // >= the new accent line's length so route-draw never clips (web strokeDasharray)

// The plot shows the current cash path. The headline uses the protected spending limit from
// finance-engine; saved recovery comparisons use only the explicit action receipt.

// The preview plot lives in the web's authored 400×120 viewBox; these bands are the drawable region
// the route maps into (matching the pressure-map TodayAfter preview so the curve reads as the same
// family of line). The lowest / payday markers sit on the real curve.
const PLOT_TOP = 30;
const PLOT_BOTTOM = 92;
const PLOT_LEFT = 20;
const PLOT_RIGHT = 380;

/** The new route's drawable geometry, derived from the engine points: the smooth curve, the matching
 *  area fill under it, and the screen coordinates of the lowest (tight point) and payday (last) markers
 *  so the two callouts sit on the real line. Falls back to a calm flat line when there aren't enough
 *  points to draw a shape — the same fallback the pressure-map preview uses. */
type PreviewGeometry = Readonly<{
  curveD: string;
  areaD: string;
  lowest: { x: number; y: number };
  payday: { x: number; y: number };
}>;

function previewGeometry(points: readonly RoutePoint[]): PreviewGeometry {
  const flat: PreviewGeometry = {
    curveD: `M ${PLOT_LEFT} ${PLOT_BOTTOM} L ${PLOT_RIGHT} ${PLOT_BOTTOM}`,
    areaD: `M ${PLOT_LEFT} ${PLOT_BOTTOM} L ${PLOT_RIGHT} ${PLOT_BOTTOM} L ${PLOT_RIGHT} ${VB_H} L ${PLOT_LEFT} ${VB_H} Z`,
    lowest: { x: PLOT_RIGHT - 75, y: PLOT_BOTTOM },
    payday: { x: PLOT_RIGHT, y: PLOT_BOTTOM },
  };
  if (points.length < 2) return flat;

  const balances = points.map((p) => p.y);
  const maxV = Math.max(...balances);
  const minV = Math.min(...balances);
  const span = maxV - minV;

  // y maps high balance → top of the band, low balance → bottom.
  const yFor = (v: number): number => {
    if (span === 0) return (PLOT_TOP + PLOT_BOTTOM) / 2;
    const frac = (v - minV) / span; // 0 at lowest .. 1 at highest
    return PLOT_BOTTOM - frac * (PLOT_BOTTOM - PLOT_TOP);
  };
  const xFor = (i: number): number =>
    PLOT_LEFT + (i / (points.length - 1)) * (PLOT_RIGHT - PLOT_LEFT);

  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.y) }));

  // Smooth with the same mid-point cubic the MoneyPath / pressure-map preview use, so the line reads
  // as one family across surfaces.
  let curveD = `M ${coords[0]!.x} ${coords[0]!.y}`;
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const cx = (a.x + b.x) / 2;
    curveD += ` C ${cx} ${a.y} ${cx} ${b.y} ${b.x} ${b.y}`;
  }
  const last = coords[coords.length - 1]!;
  const areaD = `${curveD} L ${last.x} ${VB_H} L ${coords[0]!.x} ${VB_H} Z`;

  // Lowest balance = the tight point; payday = the last sampled day.
  let lowestIndex = 0;
  for (let i = 1; i < balances.length; i += 1) {
    if (balances[i]! < balances[lowestIndex]!) lowestIndex = i;
  }

  return { curveD, areaD, lowest: coords[lowestIndex]!, payday: last };
}

// A stable sentinel "now" for the one render before the mount-gate opens. `useRoute` can't be called
// conditionally, so it runs against this until `now` is set; that frame's result is discarded (the
// screen holds the loading affordance). Module-level so its identity never churns the hook's memo.
const EPOCH = new Date(0);

/** STATES.md branch. 'populated' (the only designed layout) · 'loading' (route-draw into populated —
 *  Melo curious + line, never a spinner) · 'error' / 'empty' (no in-screen UI — the contract is
 *  "falls back to Today": route back rather than render here) · 'offline' (identical to populated —
 *  Folio is local-first). Defaults to 'populated'. */
type ScreenState = 'populated' | 'loading' | 'error' | 'empty' | 'offline';

export function TodayAfterScreen({
  nav,
  state = 'populated',
  recovery,
}: {
  nav: Nav;
  state?: ScreenState;
  recovery?: RecoveryReceipt | undefined;
}) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();

  // STATES: error / empty "falls back to Today" — this screen invents no error/empty UI; on failure
  // to compute the change (or if reached with no change), the navigator routes back to TodayScreen.
  const fallsBackToToday = state === 'error' || state === 'empty';
  useEffect(() => {
    if (fallsBackToToday) nav.go('today');
  }, [fallsBackToToday, nav]);

  // Mount-gate (mirrors TodayScreen): defer `new Date()` so the engine has an honest "today" before it
  // draws, and the route-draw plays once against the real curve rather than flashing a transient. The
  // gate also keeps the loading affordance (Melo curious + line, never a spinner) on the first frame.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // @rn-engine money-path — the real route from the shared store→money-path bridge. `useRoute` can't be
  // called conditionally, so it always runs against `now ?? EPOCH`; before the gate opens (`now === null`)
  // the engine has no honest "today", so that transient result is discarded (`route = null`) and the
  // screen holds the loading branch. No change context reaches this screen, so this IS the current route.
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;

  const appState = useAppStore((value) => value);
  const plan = useMemo(
    () => buildFinancialPlanFromState(appState, { now: now ?? EPOCH }),
    [appState, now],
  );
  const model = selectAfterChangePresentation(appState, plan, recovery);
  const geometry = useMemo(
    () => previewGeometry(route?.points.slice(0, route.daysToPayday + 1) ?? []),
    [route],
  );

  // slide-in-r — the whole screen enters from the right (translateX 28→0) over 360ms.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: 360, easing: EASE_OUT_EXPO });
  }, [enter, reduceMotion]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: 28 * (1 - enter.value) }],
  }));

  // route-draw — the NEW accent line strokes on over 2200ms (strokeDashoffset 1200 → 0). ONLY the
  // solid accent line animates; the dashed ghost route and the fill area are static (animating either
  // breaks the old→new read). Collapses to fully drawn under reduce-motion.
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    cancelAnimation(draw);
    if (reduceMotion) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    draw.value = withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(draw);
  }, [draw, reduceMotion]);
  const routeStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: ROUTE_DASH * (1 - draw.value),
  }));

  // loading branch (STATES.md / spec): never a spinner. The route-draw IS the loading-into-populated
  // transition; when the shell hands an explicit loading state — or the mount-gate is still closed so
  // the engine has no honest "today" yet — hold the screen on Melo (curious) + one quoted line, the
  // same calm "working it out" affordance the rest of the app uses.
  if (state === 'loading' || now === null) {
    return (
      <Animated.View style={[styles.root, enterStyle]}>
        <PressureScreen centered>
          <MeloLine mood="curious" text="Re-drawing your path…" />
        </PressureScreen>
      </Animated.View>
    );
  }

  // error / empty: render nothing while the fallback effect routes back to Today.
  if (fallsBackToToday) return null;

  // populated (and offline — identical): the full "after a change" layout.
  return (
    <Animated.View style={[styles.root, enterStyle]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Today"
            onPress={() => nav.go('today')}
            hitSlop={10}
            style={({ pressed: p }) => (p ? pressed : undefined)}
          >
            <Text style={[styles.backArrow, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>
            {model.receipt ? 'Change saved' : 'Current plan'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Melo"
            onPress={() => nav.openMelo()}
            style={({ pressed: p }) => [
              styles.meloButton,
              { backgroundColor: t.surface, borderColor: t.hairline },
              p ? pressed : undefined,
            ]}
          >
            <Melo size={22} mood={model.canReassure ? 'calm' : 'concern'} />
          </Pressable>
        </View>

        {/* Verdict block */}
        <View style={styles.verdictBlock} accessibilityLiveRegion="polite">
          <Text style={[styles.positiveLine, { color: model.canReassure ? t.positive : t.repair }]}>
            {model.headline}
          </Text>
          <View style={styles.amountRow}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              style={[styles.amount, { color: t.ink }]}
            >
              {model.amount === null ? '—' : formatMoney(model.amount)}
            </Text>
            <Text style={[styles.amountSuffix, { color: t.muted }]}>
              {model.amount === null ? 'needs checking' : model.amountLabel}
            </Text>
          </View>
          <Text style={[styles.subLine, { color: t.muted }]}>{model.changeTitle}</Text>
        </View>

        {/* What-changed card */}
        <View
          style={[
            styles.card,
            { backgroundColor: t.surface, borderColor: t.hairline },
            elevation.card,
          ]}
        >
          <View style={styles.cardHead}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>
              {model.receipt ? 'Saved change · before → after' : 'Current plan'}
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: t.ink }]}>{model.changeDetail}</Text>
          {model.rows.map((row) => (
            <View key={row.label} style={styles.receiptRow}>
              <Text style={[styles.cardBody, { color: t.muted }]}>{row.label}</Text>
              <Text style={[styles.cardBody, { color: t.ink }]}>
                {formatMoney(row.before)} → {formatMoney(row.after)}
              </Text>
            </View>
          ))}
          {model.changedSinceReceipt ? (
            <Text style={[styles.cardBody, { color: t.muted }]}>
              Your plan has changed again since this saved action. The amount above is your current
              position.
            </Text>
          ) : null}
          <View style={[styles.divider, { backgroundColor: t.hairline }]} />

          <View style={styles.svgWrap}>
            <Svg width="100%" height={SVG_RENDER_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
              <Defs>
                <LinearGradient id="afterFill" x1="0" x2="0" y1="0" y2="1">
                  <Stop offset="0%" stopColor={t.calm} stopOpacity={0.16} />
                  <Stop offset="100%" stopColor={t.calm} stopOpacity={0} />
                </LinearGradient>
              </Defs>

              {/* Current cash path; no before-line is inferred from historical transactions. */}

              {/* Area under the new route — static fill, from the real route geometry. */}
              <Path d={geometry.areaD} fill="url(#afterFill)" />

              {/* The new route — the ONLY animated path (route-draw), from the real route geometry. */}
              <AnimatedPath
                animatedProps={routeStrokeProps}
                d={geometry.curveD}
                fill="none"
                stroke={t.calm}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeDasharray={ROUTE_DASH}
              />

              {/* Low-point dot + label — sits on the real tight point. */}
              <Circle cx={geometry.lowest.x} cy={geometry.lowest.y} r={5} fill={t.calm} />
              <SvgText
                x={geometry.lowest.x}
                y={geometry.lowest.y - 12}
                textAnchor="middle"
                fontSize={9}
                fill={t.muted}
                fontFamily={serif.regular}
              >
                lowest
              </SvgText>

              {/* Payday dot + label — sits on the real payday point. */}
              <Circle cx={geometry.payday.x} cy={geometry.payday.y} r={5} fill={t.calm} />
              <SvgText
                x={geometry.payday.x - 2}
                y={geometry.payday.y - 12}
                textAnchor="end"
                fontSize={9}
                fill={t.muted}
                fontFamily={serif.regular}
              >
                payday
              </SvgText>
            </Svg>
          </View>
        </View>

        {/* Melo reassurance strip */}
        <View style={[styles.meloStrip, { backgroundColor: t.inset }]}>
          <Melo size={28} mood={model.canReassure ? 'calm' : 'concern'} />
          <Text style={[styles.meloQuote, { color: t.ink }]}>“{model.message}”</Text>
        </View>

        {/* Exit tiles */}
        <View style={styles.exitGrid}>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('today')}
            style={({ pressed: p }) => [
              styles.tile,
              { backgroundColor: t.surface, borderColor: t.hairline },
              p ? pressed : undefined,
            ]}
          >
            <Text style={[styles.tileEyebrow, { color: t.muted }]}>Back to today</Text>
            <Text style={[styles.tileTitle, { color: t.ink }]}>Today</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.openSheet('route-detail')}
            style={({ pressed: p }) => [
              styles.tile,
              { backgroundColor: t.surface, borderColor: t.hairline },
              p ? pressed : undefined,
            ]}
          >
            <Text style={[styles.tileEyebrow, { color: t.muted }]}>Your low point</Text>
            <Text style={[styles.tileTitle, { color: t.calm }]}>open</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// Reduced-motion (final state) — read once, then subscribe. Mirrors the kit's hook so route-draw,
// count-up, and the screen entrance all collapse to their final state (path fully drawn, number at
// 283, screen in place) rather than playing a slower animation.
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  receiptRow: { gap: gap.xs, marginTop: gap.md },
  scrollContent: { paddingBottom: gap.xxl },

  // Header — px-7 pt-4 pb-2, space-between (web)
  header: {
    paddingHorizontal: 28,
    paddingTop: gap.md,
    paddingBottom: gap.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backArrow: {
    fontSize: 20,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.54, // web tracking 0.14em at 11px
    textTransform: 'uppercase',
  },
  meloButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Verdict block — px-7 pt-3
  verdictBlock: {
    paddingHorizontal: 28,
    paddingTop: gap.sm,
  },
  positiveLine: {
    fontFamily: serif.displayItalic,
    fontSize: 15,
  },
  amountRow: {
    marginTop: gap.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: gap.sm,
  },
  amount: {
    maxWidth: '100%',
    fontFamily: serif.display,
    fontSize: 64,
    lineHeight: 64, // leading-none
    fontVariant: ['tabular-nums'],
  },
  amountSuffix: {
    fontFamily: serif.displayItalic,
    fontSize: 18,
  },
  subLine: {
    fontFamily: serif.displayItalic,
    fontSize: 12.5,
    marginTop: 4,
  },

  // What-changed card — mt-5 mx-4 rounded-2xl p-5 shadow-card
  card: {
    marginTop: gap.xl - 4, // mt-5 = 20 (matches TodayScreen's mt-5 mapping)
    marginHorizontal: gap.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: gap.xl - 4,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: gap.sm,
  },
  delta: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  cardBody: {
    fontSize: 13.5,
    lineHeight: 20, // leading-relaxed
  },
  cardBodyAccent: {
    fontSize: 13.5,
    fontWeight: '500', // font-medium
    fontVariant: ['tabular-nums'],
  },
  divider: {
    marginTop: gap.md,
    height: StyleSheet.hairlineWidth,
  },
  svgWrap: {
    marginTop: gap.sm,
    width: '100%',
    height: SVG_RENDER_H,
  },

  // Melo strip — mx-4 mt-3 inset rounded-xl p-4, row gap-3 align-start
  meloStrip: {
    marginHorizontal: gap.lg,
    marginTop: gap.sm,
    borderRadius: radius.lg,
    padding: gap.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: gap.sm,
  },
  meloQuote: {
    flex: 1,
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },

  // Exit grid — mx-4 mt-3 mb-6, 2 cols gap-2.5
  exitGrid: {
    marginHorizontal: gap.lg,
    marginTop: gap.sm,
    flexDirection: 'row',
    gap: 10, // gap-2.5
  },
  tile: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: 14, // p-3.5
  },
  tileEyebrow: {
    fontSize: 11,
    letterSpacing: 1.32, // tracking 0.12em at 11px
    textTransform: 'uppercase',
  },
  tileTitle: {
    fontFamily: serif.display,
    fontSize: 16,
    marginTop: 4,
  },
});
