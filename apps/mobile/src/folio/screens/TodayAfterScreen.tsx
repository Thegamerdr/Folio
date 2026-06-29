/**
 * @rn-screen    TodayAfterScreen
 * @rn-stack     Today > After (transient)
 * @purpose      Show the path re-drawing after a meaningful change (review accepted, sub paused).
 *               Faithful 1:1 RN port of the web design source
 *               (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenTodayAfter.tsx).
 * @reads        nav.pressure, transactions (declared on the web; the screen renders the design's
 *               before/after demo numbers — they belong to the unbuilt money-path engine, see @notes)
 * @writes       —
 * @opens-sheet  melo-chat (top-right Melo button) · route-detail (the 'Your low point / open' tile —
 *               opened by the body but understated in the web doc block; wired here per fidelityRisks)
 * @copy         FROZEN — every visible string ships verbatim (COPY_DECK + the screen's literal labels).
 * @tokens       canvas(--paper) · surface · inset · ink · muted(--muted-ink) · hairline · calm(--accent) ·
 *               positive · Fraunces headlines · tabular money
 * @motion       route-draw 2.2s (accent line only) · count-up 700ms · slide-in-r 360ms ·
 *               press .97 · Melo breathe (cheer 4.4s) · all collapse to final state under reduce-motion
 * @melo-mood    cheer (both Melo instances) — one less thing waiting, still on track (MELO_MOODS:
 *               "TodayAfter (route re-drawn) → cheer"); never escalate to celebrate (cycle-close only)
 * @notes        STATES.md TodayAfter: empty=n/a · error="falls back to Today" · offline=populated ·
 *               loading=route-draw (Melo curious + line, never a spinner). The £283 / −£42 /
 *               "after adding Tesco" verdict + both SVG path 'd' strings are the design's HARDCODED
 *               before/after demo of the money-path engine (not yet built — ENGINES §6), tagged
 *               `// @rn-engine money-path`. Preview-then-commit: this screen only navigates, it
 *               performs no store mutation.
 */

import { useEffect, useState } from 'react';
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

import {
  elevation,
  gap,
  PressureScreen,
  pressed,
  radius,
  serif,
  useCountUp,
  useTheme,
} from '@/folio/theme';
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

// @rn-engine money-path — the before/after route, the £283 spare-at-payday verdict, the −£42 delta
// and the 'after adding Tesco' provenance are the design's HARDCODED demo of the will-I-make-it
// engine (web prototype baked these in; ENGINES §6 marks the money-path + change-provenance engines
// as not-yet-built). Render the design state; do NOT treat these as live until the engine lands.
const TARGET_SPARE = 283; // £283 — the count-up target
const PRIOR_ROUTE_D = 'M 20 50 C 70 40, 110 30, 160 45 S 240 95, 305 80 L 380 55'; // ghost of the old route
const NEW_FILL_D = 'M 20 60 C 70 50, 110 38, 160 55 S 240 102, 305 92 L 380 62 L 380 120 L 20 120 Z'; // area under new route
const NEW_LINE_D = 'M 20 60 C 70 50, 110 38, 160 55 S 240 102, 305 92 L 380 62'; // the animated new route

/** STATES.md branch. 'populated' (the only designed layout) · 'loading' (route-draw into populated —
 *  Melo curious + line, never a spinner) · 'error' / 'empty' (no in-screen UI — the contract is
 *  "falls back to Today": route back rather than render here) · 'offline' (identical to populated —
 *  Folio is local-first). Defaults to 'populated'. */
type ScreenState = 'populated' | 'loading' | 'error' | 'empty' | 'offline';

export function TodayAfterScreen({
  nav,
  state = 'populated',
}: {
  nav: Nav;
  state?: ScreenState;
}) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();

  // STATES: error / empty "falls back to Today" — this screen invents no error/empty UI; on failure
  // to compute the change (or if reached with no change), the navigator routes back to TodayScreen.
  const fallsBackToToday = state === 'error' || state === 'empty';
  useEffect(() => {
    if (fallsBackToToday) nav.go('today');
  }, [fallsBackToToday, nav]);

  // count-up — the £283 balance ticks up over 700ms (cubic ease-out). Money never slides in with the
  // screen; it counts. Collapses to the final value under reduce-motion. (web: useCountUp(283, 700))
  const balance = useCountUp(TARGET_SPARE, 700, reduceMotion);

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
  // transition; when the shell hands an explicit loading state, hold the screen on Melo (curious) +
  // one quoted line — the same calm "working it out" affordance the rest of the app uses.
  if (state === 'loading') {
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
          <Text style={[styles.eyebrow, { color: t.muted }]}>One less thing waiting</Text>
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
            <Melo size={22} mood="cheer" />
          </Pressable>
        </View>

        {/* Verdict block */}
        <View
          style={styles.verdictBlock}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.positiveLine, { color: t.positive }]}>You make it to payday.</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.amount, { color: t.ink }]}>
              £{Math.round(balance).toLocaleString('en-GB')}
            </Text>
            <Text style={[styles.amountSuffix, { color: t.muted }]}>spare</Text>
          </View>
          <Text style={[styles.subLine, { color: t.muted }]}>after adding Tesco</Text>
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
            <Text style={[styles.eyebrow, { color: t.muted }]}>What changed</Text>
            <Text style={[styles.delta, { color: t.calm }]}>−£42</Text>
          </View>
          <Text style={[styles.cardBody, { color: t.ink }]}>
            Tesco lowered your low point by{' '}
            <Text style={[styles.cardBodyAccent, { color: t.calm }]}>£42</Text>.
          </Text>
          <View style={[styles.divider, { backgroundColor: t.hairline }]} />

          <View style={styles.svgWrap}>
            <Svg width="100%" height={SVG_RENDER_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
              <Defs>
                <LinearGradient id="afterFill" x1="0" x2="0" y1="0" y2="1">
                  <Stop offset="0%" stopColor={t.calm} stopOpacity={0.16} />
                  <Stop offset="100%" stopColor={t.calm} stopOpacity={0} />
                </LinearGradient>
              </Defs>

              {/* Ghost of the old route — static dashed hairline. */}
              <Path
                d={PRIOR_ROUTE_D}
                fill="none"
                stroke={t.hairline}
                strokeWidth={1}
                strokeDasharray="2 3"
              />

              {/* Area under the new route — static fill. */}
              <Path d={NEW_FILL_D} fill="url(#afterFill)" />

              {/* The new route — the ONLY animated path (route-draw). */}
              <AnimatedPath
                animatedProps={routeStrokeProps}
                d={NEW_LINE_D}
                fill="none"
                stroke={t.calm}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeDasharray={ROUTE_DASH}
              />

              {/* Low-point dot + label. */}
              <Circle cx={305} cy={92} r={5} fill={t.calm} />
              <SvgText
                x={305}
                y={80}
                textAnchor="middle"
                fontSize={9}
                fill={t.muted}
                fontFamily={serif.regular}
              >
                lowest
              </SvgText>

              {/* Payday dot + label. */}
              <Circle cx={380} cy={62} r={5} fill={t.calm} />
              <SvgText
                x={378}
                y={50}
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
          <Melo size={28} mood="cheer" />
          <Text style={[styles.meloQuote, { color: t.ink }]}>
            “One less thing waiting. You're still on track.”
          </Text>
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
    alignItems: 'baseline',
    gap: gap.sm,
  },
  amount: {
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
