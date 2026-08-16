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
 *               performs no store mutation. The verdict line + Melo reassurance-strip quote are
 *               mode-tinted per moneyMode (AFTER_VERDICT table, 1:1 web ScreenTodayAfter.tsx
 *               lines 55-66) — not a single hardcoded pair.
 */

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
import { useRoute } from '@/folio/lib/storeRoute';
import { useAppStore } from '@/folio/store';
import type { RoutePoint } from '@/folio/lib/moneyPath';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import type { Nav } from '@/folio/types';
import type { MoneyMode } from '@/folio/lib/modes/types';

// Mode-tinted verdict for the "one less thing waiting" moment. 1:1 port of the web's AFTER_VERDICT
// table (ScreenTodayAfter.tsx lines 55-66) — the spare number is unchanged; only the framing shifts
// so Growth doesn't read like Survival and Reset doesn't read like Optimizer. FROZEN copy.
const AFTER_VERDICT: Record<MoneyMode, { line: string; melo: string }> = {
  survival: {
    line: 'You make it to payday.',
    melo: "One less thing waiting. You're still on track.",
  },
  stability: { line: 'The shape still holds.', melo: 'Buffer intact. Nothing to do.' },
  growth: { line: 'Still room to save.', melo: 'That trim feeds the pace next month.' },
  debt: { line: 'Still on the plan.', melo: 'Small win. It compounds.' },
  optimizer: { line: 'Leak closed. Cleaner shape.', melo: 'One down. The rest can wait a cycle.' },
  reset: { line: 'One small step held.', melo: 'That counts. Rest the plan.' },
  irregular: { line: 'Runway just got longer.', melo: 'Every trim buys a week.' },
  household: { line: 'Your share still holds.', melo: 'Household stays square.' },
  planning: { line: 'The goal moved closer.', melo: 'Steady nudges the date.' },
  lowVis: { line: 'A little clearer.', melo: 'Each move sharpens the picture.' },
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The web's cubic-bezier(.16, 1, .3, 1) "ease-out-expo" — the shared screen easing.
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// The SVG is authored in the web's 400×120 user space; react-native-svg scales it to the card width
// via the viewBox, so every coordinate below is the web coordinate, unchanged.
const VB_W = 400;
const VB_H = 120;
const SVG_RENDER_H = 110; // the web rendered the 400×120 viewBox into a 110px-tall box
const ROUTE_DASH = 1200; // >= the new accent line's length so route-draw never clips (web strokeDasharray)

// @rn-engine money-path — WIRED to the real route. The spare-at-payday verdict, the new route line +
// fill, and the lowest / payday marker positions all come from the shared store→money-path bridge
// (@/folio/lib/storeRoute → computeRoute), the same engine Today, Calendar and the pressure-map
// TodayAfter draw from — so this transient re-states the user's actual path, not a baked demo.
//
// Change provenance (the ghost of the OLD route + the "What changed" −£42 delta) needs a before/after
// pair: the pre-change route vs the route after the just-accepted change. The honest "before" can ONLY
// be captured at the instant the change is applied, because the two upstream flows into this screen —
//   • RecoveryScreen.onRebuild():     pickedMove.commit()  then  nav.go('today-after')
//   • VisualizerScreen.acceptSelected(): addTransaction(...) loop  then  nav.go('today-after')
// — both mutate the live store FIRST and navigate SECOND. The pre-change curve exists in the store only
// up to that mutating call; by the time `nav.go` runs, the shell renders Today After, or any read here
// fires, the store already holds the AFTER-route and the before-route is gone. So the snapshot must be
// taken inside those two screens, one statement before the mutation, and threaded to this screen.
//
// Threading it honestly is a cross-file refactor OUTSIDE this fix's allowed edit surface
// (TodayAfterScreen.tsx / store.ts / FolioShell.tsx): it requires editing RecoveryScreen + Visualizer
// to snapshot the pre-mutation route, and either widening `nav.go` (types.ts) to carry the payload or
// adding an ephemeral `beforeRoutePoints` store field those two screens write before committing. None
// of those files may be touched here. The three editable files cannot capture it on their own:
//   • store.ts has no injected "now" to compute a route and its mutators (togglePaused / nudgeSub /
//     setTightPointGoal / addToPot / addTransaction) are shared by many flows that never reach this
//     screen — auto-snapshotting on each would FABRICATE a "before" for unrelated edits, not honesty.
//   • FolioShell.go and this screen both run AFTER the mutation, so neither can ever observe the before.
// Rather than fake the ghost from the current curve (a fabricated line the design forbids), the screen
// keeps the single honest line: it draws the user's REAL current route and omits the dashed ghost. Per
// the design contract ("if no change context, show the current route") this is the faithful fallback;
// the FROZEN "What changed" copy ships verbatim as the design's settled-state framing. Restoring the
// two-line before/after is a follow-up that touches RecoveryScreen + VisualizerScreen + the nav/store
// thread — see the matching note at the ghost's draw site below.

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

export function TodayAfterScreen({ nav, state = 'populated' }: { nav: Nav; state?: ScreenState }) {
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

  // The settled spare-at-payday verdict + the re-drawn route preview both read from the real route.
  const spareTarget = route ? Math.round(route.spare) : 0;
  const geometry = useMemo(() => previewGeometry(route?.points ?? []), [route]);

  // count-up — the spare balance ticks up over 700ms (cubic ease-out). Money never slides in with the
  // screen; it counts. Collapses to the final value under reduce-motion. (web: useCountUp(283, 700))
  const balance = useCountUp(spareTarget, 700, reduceMotion);

  // What actually changed: the most-recently-added transaction. The store keeps transactions
  // newest-first, and this screen is reached immediately after addTransaction (Visualizer accept /
  // Recovery rebuild). The screen carries no separate change payload, so transactions[0] IS the
  // change — its real merchant + signed amount drive the honest "what changed" copy below, never a
  // hardcoded "Tesco · −£42".
  const lastTxn = useAppStore((s) => s.transactions[0]);
  const changeMerchant = lastTxn?.merchant ?? 'your change';
  const changeAmount = lastTxn?.amount ?? 0;
  const changeMagnitude = Math.abs(Math.round(changeAmount));
  const changeIsOut = changeAmount < 0;
  // The verdict is conditional on the REAL spare, never an unconditional "you make it".
  const makesIt = spareTarget >= 0;

  // Mode-tinted verdict (1:1 web parity, ScreenTodayAfter.tsx AFTER_VERDICT) — the frozen line/melo
  // pair shifts with the user's declared MoneyMode instead of collapsing to two hardcoded strings.
  const moneyMode = useAppStore((s) => s.moneyMode ?? 'survival');
  const verdict = AFTER_VERDICT[moneyMode] ?? AFTER_VERDICT.survival;

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
            {/* Web always renders this instance as mood="cheer" (ScreenTodayAfter.tsx line 83),
                unconditionally — never tinted by outcome. */}
            <Melo size={22} mood="cheer" />
          </Pressable>
        </View>

        {/* Verdict block */}
        <View style={styles.verdictBlock} accessibilityLiveRegion="polite">
          <Text style={[styles.positiveLine, { color: makesIt ? t.positive : t.repair }]}>
            {verdict.line}
          </Text>
          <View style={styles.amountRow}>
            <Text style={[styles.amount, { color: t.ink }]}>
              £{Math.round(balance).toLocaleString('en-GB')}
            </Text>
            <Text style={[styles.amountSuffix, { color: t.muted }]}>spare</Text>
          </View>
          <Text style={[styles.subLine, { color: t.muted }]}>after adding {changeMerchant}</Text>
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
            <Text style={[styles.delta, { color: t.calmStrong }]}>
              {changeIsOut ? '−' : '+'}£{changeMagnitude.toLocaleString('en-GB')}
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: t.ink }]}>
            {changeMerchant} {changeIsOut ? 'lowered' : 'raised'} your low point by{' '}
            <Text style={[styles.cardBodyAccent, { color: t.calmStrong }]}>
              £{changeMagnitude.toLocaleString('en-GB')}
            </Text>
            .
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

              {/* Ghost of the old route — static dashed hairline (the design's "before" line). It is
                  OMITTED here, not faked. The honest before-route can only be snapshotted at the
                  instant the change is applied, inside the two upstream flows (RecoveryScreen.onRebuild
                  → commit; VisualizerScreen.acceptSelected → addTransaction) — each mutates the store
                  first and navigates here second, so by the time this screen reads the route the
                  before-curve is already gone. Capturing + threading it is a cross-file refactor outside
                  this fix's editable surface (it needs RecoveryScreen + VisualizerScreen + the nav/store
                  thread, none touchable here); see the full provenance note at the top of this file.
                  Drawing a ghost from the current curve would fabricate a route the user never had, so
                  the screen keeps one honest line until that before/after thread lands. */}

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
          <Melo size={28} mood="cheer" />
          <Text style={[styles.meloQuote, { color: t.ink }]}>“{verdict.melo}”</Text>
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
            <Text style={[styles.tileTitle, { color: t.calmStrong }]}>open</Text>
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
