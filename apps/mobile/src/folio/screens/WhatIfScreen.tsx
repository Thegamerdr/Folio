/**
 * @rn-screen    WhatIfScreen
 * @rn-stack     More > What if
 * @purpose      Spend-preview slider — dial a hypothetical "spend £X today" amount with −/+ steppers
 *               (default £40, step £5, clamp 0..500) and watch, in real time with a count-up, what the
 *               new lowest point to payday becomes, how many days that figure covers, and whether it
 *               breaches the Melo-set floor or would eat into pots. A mini money-path SVG redraws its
 *               dip as the amount changes. A quiet, strictly read-only experiment — nothing is ever
 *               committed ("Close — nothing was added"). Faithful 1:1 RN port of the web design source
 *               (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenWhatIf.tsx).
 * @reads        pressure (mood band → baseLow via pressureLow) · tightPointGoal · pots (potsTotal)
 * @writes       — NONE. The whole point of the screen is that nothing is committed. No store mutation.
 *               Local component state `amount` only (preview-then-commit; no silent path mutation).
 * @opens-sheet  — (the web @opens-sheet declared melo-chat as intent, but the body never opens it; the
 *               inline Melo here is non-interactive, so no sheet is opened — faithful to the source).
 * @copy         FROZEN — the WhatIf strings are inline @copy FROZEN in the web source and are NOT keyed
 *               in COPY_DECK; kept VERBATIM here, including the apostrophe in "today's spend" and the
 *               em-dash in "Close — nothing was added". The £{amount} accent word renders terracotta.
 * @tokens       canvas(paper) · surface · inset · ink · muted · secondary · calm(accent) · positive ·
 *               caution · repair(negative) · hairline · payday · inverse(on-accent white) · Fraunces ·
 *               tabular money — all from '@/folio/theme' (no new tokens).
 * @motion       count-up 380ms (NOT the canonical 700ms — it replays on every stepper tap; honour the
 *               in-code value) on the two stat-tile figures · route-draw 900ms (NOT 2200ms; replays on
 *               every amount change) on the accent money path · slide-in-r 360ms (whole-screen
 *               entrance) · press 0.97 (steppers, both CTAs, back chevron). Reduced motion → final state.
 * @melo-mood    dynamic severity (the web kit took calm|soft|alert computed from newLow); reconciled to
 *               the canonical Melo vocabulary the SAME way the Today wave did — soft → curious,
 *               alert → concern, calm → calm — so copy still carries meaning and no unmapped 'alert'
 *               ships. WhatIf's documented exploring baseline is curious; the dynamic verdict overrides
 *               it because the line's meaning forks with newLow.
 *
 * @rn-engine money-path — the real lowest-to-payday baseline (faked here via pressureLow[pressure]),
 *            newLow = baseLow − amount, the dip shape, and the days-cover burn-rate are the money-path
 *            engine's job (ENGINES §6, not yet built). This wave renders the DESIGN STATE off the
 *            pressure constant + a burn-rate stand-in (28 days/cycle), preview-only — nothing is
 *            committed and no path is mutated.
 *
 * Banned visible words (import / rows / parser / extraction / OCR / sync / dashboard / analytics /
 * users / 100% / bank-grade / AI-powered / smart / provenance / source record / indexed) are absent.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useCountUp, useTheme, type Palette } from '@/folio/theme';
import { Melo, type MeloMood } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { useAppStore } from '@/folio/store';
import type { Nav, Pressure } from '@/folio/types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ---------------------------------------------------------------------------
// Constants — ported verbatim from the web source.
// ---------------------------------------------------------------------------

// The fallback lowest-to-payday spare for each route pressure band. The web WhatIf imported this from
// types.ts (`pressureLow`); the RN `@/folio/types` defines the `Pressure` union but not the derived
// maps (the Today wave keeps its own copy in screens/today/pressure.ts for the same reason). WhatIf is
// strictly read-only and can only edit its own file, so it keeps the WhatIf-local copy here. These are
// the @rn-engine money-path baseline stand-ins — replaced by the engine's real current low later.
const pressureLow: Readonly<Record<Pressure, number>> = {
  safe: 612,
  calm: 325,
  soft: 184,
  pressured: 42,
  overspent: -86,
};

// Stepper bounds (web Math.max(0, v - 5) / Math.min(500, v + 5)).
const AMOUNT_MIN = 0;
const AMOUNT_MAX = 500;
const AMOUNT_STEP = 5;
const AMOUNT_DEFAULT = 40;

// Burn-rate stand-in: days/cycle. @rn-engine money-path supplies the real daily burn (28 = the web's
// magic number). daysCover = max(0, round((newLow / 28) * 10) / 10).
const DAYS_PER_CYCLE = 28;

// Verdict thresholds — load-bearing (preserve exactly). New lowest reads negative when
// breachesGoal || newLow < TIGHT; Days reads negative when daysCover < DAYS_NEGATIVE.
const TIGHT = 50;
const EASY = 150;
const DAYS_NEGATIVE = 5;

// count-up 380ms here (NOT the canonical 700ms — it replays on every stepper tap; the table default
// would feel laggy). route-draw 900ms (NOT 2200ms; replays on every amount change).
const COUNT_UP_MS = 380;
const ROUTE_DRAW_MS = 900;

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// The kit press feel (web `press` util — scale 0.97 / lowered opacity).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// em → absolute conversions. The captions/eyebrow track 0.14em; the eyebrow is 12px, the small
// captions are 10.5px (web text-[10.5px] tracking-[0.14em]).
const EYEBROW_TRACKING = 12 * 0.14;
const CAPTION_TRACKING = 10.5 * 0.14;

// SVG user space — the web authored the mini path in a 390×200 viewBox, rendered ~140px tall. Every
// coordinate below is the web coordinate, unchanged; react-native-svg scales it via the viewBox.
const VB_W = 390;
const VB_H = 200;
const ROUTE_DASH = 900; // >= the actual path length so the dash-offset draw never clips.

// Minus glyph — the web rendered "−" (U+2212 minus sign), not a hyphen. Kept exact.
const MINUS = '−';

// ---------------------------------------------------------------------------
// Reduced-motion read — mirrors Melo.tsx / VisualizerScreen.tsx exactly: read once, then subscribe.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// The render states this screen can occupy (STATES.md). offline ≡ populated (local-first).
// ---------------------------------------------------------------------------

export type WhatIfState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type WhatIfScreenProps = {
  nav: Nav;
  /** The route pressure mood. The web read this off `nav.pressure`; the RN Nav contract has no
   *  pressure, so the shell threads it explicitly (same convention as Today / Pots). Defaults to the
   *  shell's calm landing band. */
  pressure?: Pressure;
  /** STATES.md branch. 'populated' (the only branch the web body implements) · 'loading' (Melo curious
   *  + one line, never a spinner — the ~380ms count-up is the recompute affordance) · 'empty' (no money
   *  to preview → the calm doorway) · 'error' (n/a here — no async — falls through to populated) ·
   *  'offline' (≡ populated; no network at all). Defaults to 'populated'. */
  state?: WhatIfState;
};

// ---------------------------------------------------------------------------
// WhatIfScreen
// ---------------------------------------------------------------------------

export function WhatIfScreen({ nav, pressure = 'calm', state = 'populated' }: WhatIfScreenProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Live store reads (read-only — WhatIf writes nothing).
  const tightPointGoal = useAppStore((s) => s.tightPointGoal);
  const potsTotal = useAppStore((s) => s.pots.reduce((sum, p) => sum + p.saved, 0));

  // The single piece of local state — the hypothetical spend. Clamp 0..500, step 5.
  const [amount, setAmount] = useState(AMOUNT_DEFAULT);

  // @rn-engine money-path — baseLow is faked off the pressure band until the engine supplies the real
  // current low; newLow = baseLow − amount, the dip shape and burn-rate derive from it.
  const baseLow = pressureLow[pressure];
  const newLow = baseLow - amount;
  const daysCover = Math.max(0, Math.round((newLow / DAYS_PER_CYCLE) * 10) / 10);

  // count-up (380ms) drives the two stat-tile figures; reduce-motion snaps to the target. The centre
  // £{amount} uses the raw value (it is the input — instant, never animated).
  const lowDisplay = useCountUp(newLow, COUNT_UP_MS, reduceMotion);
  const coverDisplay = useCountUp(daysCover, COUNT_UP_MS, reduceMotion);

  // Honest signal: would this drop you below your Melo-set floor?
  const breachesGoal = tightPointGoal !== null && newLow < tightPointGoal;
  // Honest signal: do you have enough across pots to absorb it? (Keep the >= direction.)
  const wouldEatPots = newLow < 0 && potsTotal >= Math.abs(newLow);

  // path with shifted dip based on amount (web dipY = min(190, 130 + amount*0.55)).
  const dipY = Math.min(190, 130 + amount * 0.55);
  const d = `M 18 80 C 70 90, 110 70, 160 110 S 240 ${dipY}, 300 150 S 350 60, 372 50`;

  // The dynamic verdict band (web kit calm|soft|alert), reconciled to the canonical Melo vocabulary the
  // same way the Today wave did: alert → concern, soft → curious, calm → calm.
  const mood: MeloMood =
    breachesGoal || newLow < TIGHT ? 'concern' : newLow < EASY ? 'curious' : 'calm';

  const meloLine = breachesGoal
    ? `That drops you below your £${tightPointGoal} floor.`
    : newLow < 0
      ? wouldEatPots
        ? `You'd have to dip into pots — about £${Math.abs(newLow)} from somewhere.`
        : "This one wouldn't fit. Try a smaller hold."
      : newLow < TIGHT
        ? 'This one would press you. Try a smaller hold.'
        : newLow < EASY
          ? "You'd feel it, but you'd make it."
          : 'Plenty of room. Spend if it serves you.';

  // The negative tones (web): New lowest negative when breachesGoal || newLow < 50; Days negative when
  // daysCover < 5; the floor caption is negative ONLY on breach.
  const lowIsNegative = breachesGoal || newLow < TIGHT;
  const daysIsNegative = daysCover < DAYS_NEGATIVE;

  // slide-in-r — drives the whole screen. Resolves straight to final state under reduce-motion.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: SLIDE_MS, easing: EASE_OUT_EXPO });
  }, [enter, reduceMotion]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * SLIDE_FROM_X }],
  }));

  // route-draw — the accent stroke draws in via an animated dash-offset, replayed on EVERY amount
  // change (the web re-keyed the <svg> on `amount`). draw 0 = undrawn (offset = full dash), 1 = drawn
  // (offset 0). Reduce-motion = fully drawn final state.
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    draw.value = withTiming(1, { duration: ROUTE_DRAW_MS, easing: EASE_OUT_EXPO });
  }, [draw, reduceMotion, amount]);
  const routeProps = useAnimatedProps(() => ({
    strokeDashoffset: ROUTE_DASH * (1 - draw.value),
  }));

  const decrement = () => setAmount((v) => Math.max(AMOUNT_MIN, v - AMOUNT_STEP));
  const increment = () => setAmount((v) => Math.min(AMOUNT_MAX, v + AMOUNT_STEP));

  // empty — no money to preview yet (STATES.md WhatIf empty = "Add some moves first"). The web body has
  // no empty guard; the port adds the calm doorway (Melo + Fraunces line + one CTA → intake) so the
  // experiment never opens onto an empty path. The CTA routes to intake (add what you have).
  if (state === 'empty') {
    return (
      <EmptyState
        mood="curious"
        headline="Add some moves first."
        body="Once there's something on your money path, you can try a spend here and see how the lowest point shifts — before any of it counts."
        cta={{ label: 'Add what you have', onPress: () => nav.go('intake') }}
      />
    );
  }

  // loading — Melo curious + ONE line, NEVER a spinner (the hard rule + STATES.md "recompute 400ms").
  // There is no async on this surface; the ~380ms stat count-up is the real recompute affordance. This
  // branch only renders if the shell ever threads state="loading".
  if (state === 'loading') {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl },
        ]}
      >
        <MeloLine mood="curious" text="One second — working out where this lands." />
      </View>
    );
  }

  // populated / offline / error — the slider. offline ≡ populated (no network); error is n/a (no async
  // to fail), so it falls through to the same experiment.
  return (
    <Animated.View style={[styles.flex, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={enterStyle}>
          {/* Header — back · "Preview" eyebrow · balancing 20px spacer (the 3-column balance that
              centres the eyebrow; without it the eyebrow drifts). */}
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={16}
              onPress={nav.back}
              style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
            >
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
            <Text style={styles.eyebrow}>Preview</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Title — italic kicker · headline with the terracotta £{amount} accent word. */}
          <View style={styles.title}>
            <Text style={styles.kicker}>A quiet experiment</Text>
            <Text accessibilityRole="header" style={styles.headline}>
              {'What if I spend '}
              <Text style={styles.headlineAccent}>£{amount}</Text>
              {' today?'}
            </Text>
          </View>

          {/* Spend card — the −/+ steppers around the centred amount, then the mini money path. */}
          <View style={styles.spendCard}>
            <View style={styles.stepperRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Spend five pounds less"
                onPress={decrement}
                style={({ pressed: isPressed }) => [
                  styles.stepper,
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={styles.stepperGlyph}>{MINUS}</Text>
              </Pressable>

              <View style={styles.stepperCenter}>
                <Text style={styles.amountValue}>£{amount}</Text>
                <Text style={styles.amountCaption}>today's spend</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Spend five pounds more"
                onPress={increment}
                style={({ pressed: isPressed }) => [
                  styles.stepper,
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={styles.stepperGlyph}>+</Text>
              </Pressable>
            </View>

            {/* Mini money path (@rn-engine money-path) — a dashed hairline guide under an accent stroke
                that draws in (route-draw 900ms, replayed on every amount change), with the payday cap
                and the shifting lowest-point dot + label. */}
            <View style={styles.svgWrap}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} fill="none">
                {/* Dashed guide path. */}
                <Path d={d} stroke={t.hairline} strokeWidth={1} strokeDasharray="2 4" fill="none" />
                {/* Accent route — animated dash-offset draw. */}
                <AnimatedPath
                  d={d}
                  stroke={t.calm}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeDasharray={ROUTE_DASH}
                  animatedProps={routeProps}
                  fill="none"
                />
                {/* Payday end-cap + label. */}
                <Circle cx={372} cy={50} r={5} fill={t.calm} />
                <SvgText
                  x={350}
                  y={40}
                  fontFamily={serif.displayItalic}
                  fontSize={10}
                  fill={t.ink}
                >
                  payday
                </SvgText>
                {/* Lowest-point dot + label — both bound to `amount` via dipY. */}
                <Circle cx={300} cy={dipY} r={3.5} fill={t.ink} />
                <SvgText
                  x={245}
                  y={dipY + 18}
                  fontFamily={serif.displayItalic}
                  fontSize={10}
                  fill={t.muted}
                >
                  lowest point
                </SvgText>
              </Svg>
            </View>
          </View>

          {/* Stat tiles — New lowest (count-up, negative tone on breach / tight) + floor caption (only
              when a floor is set), and Days this would last (count-up, negative under 5d) + pots total. */}
          <View style={styles.tilesRow}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>New lowest</Text>
              <Text style={[styles.tileValue, lowIsNegative ? styles.tileValueNegative : undefined]}>
                {formatGBP(Math.round(lowDisplay))}
              </Text>
              {tightPointGoal !== null ? (
                <Text
                  style={[
                    styles.tileCaption,
                    styles.tabular,
                    breachesGoal ? styles.tileCaptionNegative : undefined,
                  ]}
                >
                  floor £{tightPointGoal}
                </Text>
              ) : null}
            </View>

            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Days this would last</Text>
              <Text style={[styles.tileValue, daysIsNegative ? styles.tileValueNegative : undefined]}>
                {coverDisplay.toFixed(1)}d
              </Text>
              <Text style={[styles.tileCaption, styles.tabular]}>£{potsTotal} in pots</Text>
            </View>
          </View>

          {/* Melo line — the quiet companion verdict, mood derived dynamically from newLow. Melo is
              grounded and non-interactive here (the web never made it tappable / never opened a sheet). */}
          <View style={styles.meloRow}>
            <Melo size={28} mood={mood} />
            <Text style={styles.meloLine}>{meloLine}</Text>
          </View>

          {/* CTAs — the dominant "See it on your money path" (→ today) and the quiet, honest close
              ("Close — nothing was added", → back). Nothing was committed. */}
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens your money path on Today."
            onPress={() => nav.go('today')}
            style={({ pressed: isPressed }) => [
              styles.primary,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={styles.primaryLabel}>See it on your money path</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Closes this experiment. Nothing here is saved."
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [styles.close, isPressed ? styles.pressed : undefined]}
          >
            <Text style={styles.closeLabel}>Close — nothing was added</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// formatGBP — the New-lowest figure formatter. The web's <Money>/formatGBP rendered a signed,
// grouped, no-pence pound figure (e.g. "£325" / "−£86"). Pure; ported as the local equivalent so the
// negative-low band ("£-86" → "−£86") reads as money with the same minus glyph as the steppers.
// ---------------------------------------------------------------------------

function formatGBP(value: number): string {
  const sign = value < 0 ? MINUS : '';
  const grouped = Math.abs(value).toLocaleString('en-GB');
  return `${sign}£${grouped}`;
}

// ---------------------------------------------------------------------------
// Styles — two layers per the kit DARK-MODE PATTERN. Colour + the few layout-with-colour styles ride
// in makeStyles(t) (rebuilt per render via useMemo) so the surface follows light/dark; pure-layout
// values use the gap/radius scales (no hard-coded spacing).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    flex: { flex: 1 },

    // Loading column (Melo curious + one line). px-7 ≈ gap.xl.
    loading: {
      flex: 1,
      paddingHorizontal: gap.xl,
    },

    // The scroll content column — web px-7 pt-4.
    content: {
      paddingHorizontal: gap.xl,
    },

    // Header — back · "Preview" eyebrow · 20px balancing spacer (web flex justify-between, w-5 spacer).
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    backArrow: {
      color: t.muted,
      fontSize: 20,
    },
    eyebrow: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: EYEBROW_TRACKING,
      textTransform: 'uppercase',
    },
    headerSpacer: {
      width: 20,
    },

    // Title — web mt-5. Italic Fraunces kicker (13px muted), then the 30px headline with the accent £.
    title: {
      marginTop: gap.xl,
    },
    kicker: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 30,
      letterSpacing: -0.3,
      lineHeight: 32, // web leading-[1.05] on 30px ≈ 31.5
      marginTop: gap.xs,
    },
    // The accent word £{amount} — same upright Fraunces face, recoloured terracotta (web
    // <em class="not-italic text-[var(--accent)]">). Inherits the headline face; only colour overridden.
    headlineAccent: {
      color: t.calm,
      fontFamily: serif.display,
      fontStyle: 'normal',
    },

    // Spend card — web mt-5 bg-surface hairline rounded-2xl p-5.
    spendCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.xl,
      padding: gap.xl,
    },
    stepperRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    // The 44px round stepper — inset well fill + hairline (web w-11 h-11 rounded-full hairline bg-inset).
    stepper: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    stepperGlyph: {
      color: t.ink,
      fontSize: 20,
      lineHeight: 24,
    },
    stepperCenter: {
      alignItems: 'center',
    },
    // The centred amount — the input itself (Money xl, tone accent). Instant, never count-up.
    amountValue: {
      color: t.calm,
      fontSize: 40,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
      letterSpacing: -1,
      lineHeight: 44,
    },
    amountCaption: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: CAPTION_TRACKING,
      marginTop: gap.xs,
      textTransform: 'uppercase',
    },

    // Mini money path box — web mt-4 w-full h-[140px].
    svgWrap: {
      height: 140,
      marginTop: gap.lg,
      width: '100%',
    },

    // Stat tiles — web mt-4 grid-cols-2 gap-2.5.
    tilesRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: gap.lg,
    },
    // Each tile — web bg-surface hairline rounded-2xl px-4 py-4.
    tile: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.lg,
    },
    tileLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: CAPTION_TRACKING,
      textTransform: 'uppercase',
    },
    // The tile figure (Money md). Ink by default; coral (repair) on the negative bands.
    tileValue: {
      color: t.ink,
      fontSize: 22,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: gap.sm,
    },
    tileValueNegative: {
      color: t.repairInk,
    },
    tileCaption: {
      color: t.muted,
      fontSize: 10.5,
      marginTop: gap.xs,
    },
    tileCaptionNegative: {
      color: t.repairInk,
    },
    tabular: {
      fontVariant: ['tabular-nums'],
    },

    // Melo line — web mt-5 flex items-start gap-3, the quote in Fraunces italic muted.
    meloRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: gap.md,
      marginTop: gap.xl,
    },
    meloLine: {
      color: t.muted,
      flex: 1,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },

    // Primary CTA — web press mt-5 mb-3 h-[54px] rounded-2xl bg-accent text-white. The literal white
    // label is the on-accent foreground (t.inverse), not ink.
    primary: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.xl,
      height: 54,
      justifyContent: 'center',
      marginBottom: gap.md,
      marginTop: gap.xl,
    },
    primaryLabel: {
      color: t.inverse,
      fontSize: 15,
      fontWeight: '500',
    },

    // Quiet close — web press mb-8 h-[44px] text-[13px] muted. The honest "nothing was added" line.
    close: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      marginBottom: gap.xl,
    },
    closeLabel: {
      color: t.muted,
      fontSize: 13,
    },

    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
