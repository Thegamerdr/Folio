// InsightsScreen — the faithful 1:1 React Native port of the web retrospective screen
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenInsights.tsx).
//
// @rn-screen    InsightsScreen
// @rn-stack     More > Insights
// @purpose      The shape of your months — 6-month tight-point chart, saved-across-cycles delta,
//               past cycle notes. A retrospective screen: gentle, never predictive. Read-only.
// @reads        cycles · pots · subPaused  (the doc-block @reads says only `cycles`, but the web
//               body also reads pots + subPaused; per the spec DOC-BLOCK DRIFT note the RN port wires
//               all THREE store slices — the real reads, not the doc block.)
// @writes       — none. Strictly read-only; no store mutation. Side effects only via nav.
// @opens-sheet  share  (footer CTA → nav.openSheet('share'))
// @copy         FROZEN — gentle, retrospective, never predictive.
// @tokens       surface · hairline · calm (accent) · positive · repair (negative) · muted · ink ·
//               inverse (CTA label on the ink button) · inset (via EmptyState) — all from the kit via
//               '@/folio/theme'. No new token.
// @motion       route-draw on the chart line (2200ms ease-out) · count-up on the figures (700ms
//               easeOutCubic) · slide-in-r (whole screen, 360ms ease-out-expo) · press 0.97 on the
//               back arrow + footer CTA. Reduced motion = final state everywhere (route fully drawn,
//               count-up snapped, slide resolved). NO spinners.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • Tokens map web → kit: --surface→surface · --hairline→hairline · --accent→calm · --positive→
//     positive · --negative→repair · --muted-ink→muted · --ink→ink · --paper→inverse (the on-ink CTA
//     label) · --inset→inset (inside EmptyState). The chart gradient/line/last-dot use `calm`.
//   • formatGBP is ported VERBATIM from the web source (spec rnPrimitiveMap): a U+2212 MINUS for
//     negatives + '£' + en-GB grouping. It is defined locally in this file (only this file may be
//     created) so the money reads identically. The cycle figures are whole pounds, so this never
//     touches the minor-unit kit `money()`; that is intentional — the web used these same whole-pound
//     `formatGBP` values.
//   • count-up: the four stat-tile figures and the avg subtitle settle via the kit `useCountUp` (700ms,
//     re-exported through '@/folio/theme'), snapping under reduce-motion — same easeOutCubic the rest
//     of the surface uses.
//   • route-draw: the chart line path animates strokeDashoffset 1200 → 0 over 2200ms ease-out, ONCE
//     per visit (never a loop). Under reduce-motion it renders fully drawn (offset 0). Mirrors the
//     web .route-draw (strokeDasharray 1200 → strokeDashoffset 0).
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion, mirroring ReviewScreen / Melo / StartScreen.
//   • The chart math (W=320 H=96 padX=12 padY=14, stepX, minT/maxT/range, y, avgY, last-point label
//     anchor) is ported COORDINATE-FOR-COORDINATE from the web so the line never distorts.
//   • Single-point case (n<=1): the area fill AND the route-draw line are BOTH omitted — only the
//     dashed avg line + one dot + the label render (spec sub-branch (b)).
//   • The accent word is UPRIGHT terracotta inside the Fraunces line (web <em class="not-italic
//     text-accent">) — built as three Text runs so the accented word is the single coloured run.
//   • The empty-state strings come from COPY_DECK via copy.insights.empty.* (the keys that exist):
//     head/body/cta. The **bold** marker in the head string maps to EmptyState's single accent word.
//     The web in-file empty strings drift from the deck (spec COPY DRIFT) — per the hard rule "copy
//     VERBATIM via '@/folio/copy/copy' keys where they exist", the deck wins for the keyed strings.
//   • Melo presence: the populated branch instantiates Melo ONLY via the conditional cheer MeloLine
//     (paused subs); no standalone calm Melo is added (spec: "No mood = no Melo"). The empty branch's
//     Melo is the EmptyState's own curious Melo.
//
// Banned visible words (import / rows / parser / extraction / OCR / sync / dashboard / analytics /
// users / 100% / bank-grade / AI-powered / smart / provenance / source record / indexed) are absent.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useCountUp, useTheme, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { ScreenHeader } from '@/folio/ui/ScreenHeader';
import { copy } from '@/folio/copy/copy';
import { useAppStore } from '@/folio/store';
import { getRetrospect, formatDelta } from '@/folio/lib/modes/retrospect';
import type { Nav } from '@/folio/types';

// ---------------------------------------------------------------------------
// formatGBP — ported VERBATIM from the web source (spec rnPrimitiveMap):
//   sign '−' (U+2212) for negatives; '£' + Math.abs(n) with en-GB grouping, no decimals.
// ---------------------------------------------------------------------------
function formatGBP(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}£${Math.abs(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// Motion constants
// ---------------------------------------------------------------------------

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1) — for the slide-in.
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// route-draw (web .route-draw): strokeDasharray 1200, strokeDashoffset 1200 → 0 over 2200ms ease-out.
const ROUTE_DASH = 1200;
const ROUTE_DRAW_MS = 2200;

// count-up (web useCountUp(..., 700)).
const COUNT_MS = 700;

// Chart geometry — coordinate-for-coordinate with the web (W=320 H=96 padX=12 padY=14).
const CHART_W = 320;
const CHART_H = 96;
const CHART_PAD_X = 12;
const CHART_PAD_Y = 14;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Local reduce-motion read, mirroring Melo.tsx / ReviewScreen.tsx exactly: read once, then subscribe.
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

// Strip a single **bold** marker from a deck string → { lead, accent } for EmptyState. The deck head
// "Close one cycle **first.**" carries the accent word in **…**; EmptyState colours its `accent` and
// leads with the rest. The marker is the deck's source of truth for which word is the accent word.
function splitBoldHeadline(deckString: string): string {
  // EmptyState takes a plain string and accents the LAST word; the deck marks the accent word with
  // **…** and it IS the last word here, so removing the marker leaves EmptyState's last-word accent
  // landing on exactly the marked word. Keep punctuation attached.
  return deckString.replace(/\*\*(.+?)\*\*/g, '$1');
}

export type InsightsScreenProps = {
  nav: Nav;
};

export function InsightsScreen({ nav }: InsightsScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const s = useMemo(() => makeStyles(t), [t]);

  // All real store slices (spec DOC-BLOCK DRIFT: wire the real reads, not the doc block). moneyMode /
  // transactions / tinyWins added for the mode-tinted retrospect + weekly digest + tiny-wins section.
  const cycles = useAppStore((st) => st.cycles);
  const pots = useAppStore((st) => st.pots);
  const subPaused = useAppStore((st) => st.subPaused);
  const moneyMode = useAppStore((st) => st.moneyMode ?? 'survival');
  const transactions = useAppStore((st) => st.transactions);
  const tinyWins = useAppStore((st) => st.tinyWins ?? []);

  // Derived aggregates — ported 1:1 from the web body. Summary tiles aggregate ALL cycles; the chart
  // windows to 6; the notes list windows to 4 (spec: three different windows, do not unify).
  const avgTight = cycles.length
    ? Math.round(cycles.reduce((acc, c) => acc + c.tightPoint, 0) / cycles.length)
    : 0;
  const pausedCount = Object.values(subPaused).filter(Boolean).length;
  const potsTotal = pots.reduce((acc, p) => acc + p.saved, 0);
  const latest = cycles[0];
  const prior = cycles[1];
  const spareDelta = latest && prior ? latest.spare - prior.spare : 0;

  // Mode-tinted retrospective framing (web `getRetrospect(mode, cycles, potsTotal)`) — the eyebrow,
  // headline, both KPI cards, the trend caption, and the Melo note all vary by moneyMode.
  const retro = useMemo(
    () => getRetrospect(moneyMode, cycles, potsTotal),
    [moneyMode, cycles, potsTotal],
  );

  // Weekly digest — trailing 7 days of user-visible spend + quiet days (web `weekly` memo).
  const weekly = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    const week = transactions.filter((t) => new Date(t.when).getTime() >= weekAgo && t.amount < 0);
    const spent = week.reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const daysWithSpend = new Set(week.map((t) => new Date(t.when).toISOString().slice(0, 10)))
      .size;
    const quietDays = Math.max(0, 7 - daysWithSpend);
    return { spent: Math.round(spent), quietDays };
  }, [transactions]);

  // Tight-point trend: one point per closed cycle, oldest → newest (web: slice(0,6).reverse()).
  const trend = useMemo(() => cycles.slice(0, 6).reverse(), [cycles]);

  // slide-in-r — drives the whole screen on both branches. Resolves to final state under reduce-motion.
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

  // ----- EMPTY (cycles.length === 0) -------------------------------------------------------------
  if (cycles.length === 0) {
    return (
      <Animated.View style={[s.root, enterStyle]}>
        <View style={[s.screen, { paddingTop: insets.top + gap.sm }]}>
          <ScreenHeader
            onBack={nav.back}
            eyebrow="Insights"
            backHitWidth={24}
            eyebrowTracking={1.68}
          />

          <View style={s.titleBlock}>
            <Text style={s.eyebrowItalic}>Nothing wrapped up yet</Text>
            <Text accessibilityRole="header" style={s.headline}>
              {retro.title.lead}
              <Text style={s.headlineAccent}>{retro.title.accent}</Text>
              {retro.title.tail}
            </Text>
          </View>

          <View style={s.emptyBlock}>
            <EmptyState
              mood="curious"
              headline={splitBoldHeadline(copy.insights.empty.head)}
              body={copy.insights.empty.body}
              cta={{ label: copy.insights.empty.cta, onPress: () => nav.go('ritual') }}
            />
          </View>
        </View>
      </Animated.View>
    );
  }

  // ----- POPULATED (cycles.length > 0) -----------------------------------------------------------
  return (
    <Animated.View style={[s.root, enterStyle]}>
      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          { paddingTop: insets.top + gap.sm, paddingBottom: insets.bottom + gap.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          onBack={nav.back}
          eyebrow="Insights"
          backHitWidth={24}
          eyebrowTracking={1.68}
        />

        <View style={s.titleBlock}>
          <Text style={s.eyebrowItalic}>{retro.eyebrow}</Text>
          <Text accessibilityRole="header" style={s.headline}>
            {retro.title.lead}
            <Text style={s.headlineAccent}>{retro.title.accent}</Text>
            {retro.title.tail}
          </Text>
        </View>

        {/* 2×2 stat tiles. The primary/secondary cards are mode-tinted (web `retro.primary` /
            `retro.secondary`) — label, value, and tone all vary by moneyMode. The other two
            ("In pots right now" / "Average set aside") stay generic across every mode. */}
        <View style={s.grid}>
          <StatTile
            label={retro.primary.label}
            value={retro.primary.value}
            tone={retro.primary.tone === 'ink' ? undefined : retro.primary.tone}
            styles={s}
            sub={
              prior ? (
                <Text style={[s.delta, spareDelta >= 0 ? s.deltaPositive : s.deltaNegative]}>
                  {`${formatDelta(spareDelta)} vs ${prior.label}`}
                </Text>
              ) : undefined
            }
          />
          <StatTile
            label="In pots right now"
            value={formatGBP(potsTotal)}
            styles={s}
            reduceMotion={reduceMotion}
            countUpValue={potsTotal}
          />
          <StatTile
            label={retro.secondary.label}
            value={retro.secondary.value}
            tone={retro.secondary.tone === 'ink' ? undefined : retro.secondary.tone}
            styles={s}
          />
          <StatTile
            label="Average set aside"
            value={formatGBP(
              cycles.length
                ? Math.round(cycles.reduce((acc, c) => acc + c.setAside, 0) / cycles.length)
                : 0,
            )}
            styles={s}
            reduceMotion={reduceMotion}
            countUpValue={
              cycles.length
                ? Math.round(cycles.reduce((acc, c) => acc + c.setAside, 0) / cycles.length)
                : 0
            }
          />
        </View>

        {/* Chart card — the only element with a shadow (shadow-card); tiles use hairline only.
            The trend caption is mode-tinted (web `retro.trendCaption`). */}
        <View style={s.chartCard}>
          <View style={s.chartTitleRow}>
            <Text style={s.chartTitle}>{retro.trendCaption}</Text>
            <ChartAvg avgTight={avgTight} styles={s} reduceMotion={reduceMotion} />
          </View>
          <TrendChart trend={trend} avgTight={avgTight} palette={t} reduceMotion={reduceMotion} />
          <View style={s.axisRow}>
            {trend.map((c) => (
              <Text key={c.closedAt} numberOfLines={1} style={s.axisTick}>
                {c.label.slice(0, 3)}
              </Text>
            ))}
          </View>
        </View>

        {/* Mode-tinted Melo note (web `retro.meloNote`) — directly under the chart, ahead of the
            weekly digest / tiny wins / notes-from-past-you sections. */}
        <View style={s.meloNoteBlock}>
          <MeloLine mood="calm" text={retro.meloNote} />
        </View>

        {/* Weekly digest — trailing 7 days, a calm 30-second read (web "This week, at a glance"). */}
        <View style={s.weeklyCard}>
          <Text style={s.weeklyEyebrow}>This week, at a glance</Text>
          <View style={s.weeklyGrid}>
            <View style={s.weeklyCol}>
              <Text style={s.weeklyLabel}>Spent</Text>
              <Text style={s.weeklyValue}>{formatGBP(weekly.spent)}</Text>
            </View>
            <View style={s.weeklyCol}>
              <Text style={s.weeklyLabel}>Quiet days</Text>
              <Text
                style={[s.weeklyValue, weekly.quietDays >= 3 ? s.tileValuePositive : undefined]}
              >
                {`${weekly.quietDays}d`}
              </Text>
            </View>
          </View>
        </View>

        {/* Tiny wins — up to 4, newest first (web `tinyWins.slice(0,4)`). Only renders once the
            award engine (lib/wins.ts) has actually awarded one; empty state shows nothing, matching
            the web's `tinyWins.length > 0` guard. */}
        {tinyWins.length > 0 ? (
          <View style={s.winsBlock}>
            <Text style={s.winsEyebrow}>Tiny wins</Text>
            <View style={s.winsCard}>
              {tinyWins.slice(0, 4).map((w, i, arr) => (
                <View
                  key={w.id}
                  style={[s.winRow, i < arr.length - 1 ? s.noteRowDivider : undefined]}
                >
                  <Text style={s.winMessage}>{w.message}</Text>
                  <Text style={s.winDate}>
                    {new Date(w.awardedAt).toLocaleDateString('en-GB', { weekday: 'long' })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Notes from past you — up to 4 closed cycles. */}
        <View style={s.notesBlock}>
          <Text style={s.notesEyebrow}>Notes from past you</Text>
          <View style={s.notesCard}>
            {cycles.slice(0, 4).map((c, i, arr) => (
              <View
                key={c.closedAt}
                style={[s.noteRow, i < arr.length - 1 ? s.noteRowDivider : undefined]}
              >
                <View style={s.noteHead}>
                  <Text style={s.noteLabel}>{c.label}</Text>
                  <Text style={s.noteSpare}>{`left over £${c.spare}`}</Text>
                </View>
                {c.note ? <Text style={s.noteBody}>{`“${c.note}”`}</Text> : null}
              </View>
            ))}
          </View>
        </View>

        {/* Optional paused-subs Melo line — the ONLY Melo on the populated branch (cheer). */}
        {pausedCount > 0 ? (
          <View style={s.meloBlock}>
            <MeloLine
              mood="cheer"
              text={`${pausedCount} ${
                pausedCount === 1 ? 'sub' : 'subs'
              } paused — quietly working in your favour.`}
            />
          </View>
        ) : null}

        {/* Footer CTA — opens the share sheet. */}
        <View style={s.ctaBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this month"
            onPress={() => nav.openSheet('share')}
            style={({ pressed }) => [s.cta, pressed ? s.pressed : undefined]}
          >
            <Text style={s.ctaLabel}>Share this month</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// StatTile — one of the four summary tiles. The figure counts up (kit useCountUp); the value is
// formatted through formatGBP so the money reads identically to the web.
// ---------------------------------------------------------------------------
function StatTile({
  label,
  value,
  tone,
  sub,
  styles,
  reduceMotion,
  countUpValue,
}: {
  label: string;
  /** Pre-formatted display string (web `Kpi.value` / `formatGBP(...)`) — this tile never formats
   *  money itself, so mode-tinted retro values (which arrive already formatted, e.g. "£420" or a
   *  non-money string like a month count) render byte-identical to the web source. */
  value: string;
  tone?: 'positive' | 'accent' | 'negative' | undefined;
  sub?: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
  reduceMotion?: boolean | undefined;
  /** When provided, the tile counts up to this raw number instead of rendering `value` directly —
   *  only used by the two mode-invariant tiles ("In pots right now" / "Average set aside") that kept
   *  their original count-up treatment; the mode-tinted retro tiles render their string as-is. */
  countUpValue?: number | undefined;
}) {
  const counted = useCountUp(countUpValue ?? 0, COUNT_MS, reduceMotion ?? true);
  const display = countUpValue !== undefined ? formatGBP(Math.round(counted)) : value;
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text
        style={[
          styles.tileValue,
          tone === 'positive' ? styles.tileValuePositive : undefined,
          tone === 'accent' ? styles.tileValueAccent : undefined,
          tone === 'negative' ? styles.deltaNegative : undefined,
        ]}
      >
        {display}
      </Text>
      {sub}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ChartAvg — the "avg £{n}" chart subtitle, counted up.
// ---------------------------------------------------------------------------
function ChartAvg({
  avgTight,
  styles,
  reduceMotion,
}: {
  avgTight: number;
  styles: ReturnType<typeof makeStyles>;
  reduceMotion: boolean;
}) {
  const counted = useCountUp(avgTight, COUNT_MS, reduceMotion);
  return <Text style={styles.chartAvg}>{`avg £${Math.round(counted)}`}</Text>;
}

// ---------------------------------------------------------------------------
// TrendChart — the inline SVG: dashed average line, optional area fill + route-draw line (n>1),
// per-point dots (last one accent + larger), and the labelled last point.
// ---------------------------------------------------------------------------
function TrendChart({
  trend,
  avgTight,
  palette,
  reduceMotion,
}: {
  trend: { tightPoint: number; closedAt: string; label: string }[];
  avgTight: number;
  palette: Palette;
  reduceMotion: boolean;
}) {
  const t = palette;
  const n = trend.length;

  // Geometry — coordinate-for-coordinate with the web.
  const stepX = n > 1 ? (CHART_W - CHART_PAD_X * 2) / (n - 1) : 0;
  const minT = Math.min(...trend.map((c) => c.tightPoint), 0);
  const maxT = Math.max(...trend.map((c) => c.tightPoint), 1);
  const range = Math.max(1, maxT - minT);
  const ptsArr = trend.map((c, i) => {
    const x = CHART_PAD_X + i * stepX;
    const y = CHART_PAD_Y + (CHART_H - CHART_PAD_Y * 2) * (1 - (c.tightPoint - minT) / range);
    return { x, y, c };
  });
  const d = ptsArr
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const avgY = CHART_PAD_Y + (CHART_H - CHART_PAD_Y * 2) * (1 - (avgTight - minT) / range);
  const last = ptsArr[ptsArr.length - 1];

  // route-draw — the line draws once (offset 1200 → 0). Final state (0) under reduce-motion.
  const draw = useSharedValue(reduceMotion ? 0 : ROUTE_DASH);
  useEffect(() => {
    if (reduceMotion) {
      draw.value = 0;
      return;
    }
    draw.value = ROUTE_DASH;
    draw.value = withTiming(0, { duration: ROUTE_DRAW_MS, easing: Easing.out(Easing.ease) });
  }, [draw, reduceMotion, d]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: draw.value }));

  return (
    <Svg
      width="100%"
      height={CHART_H}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      accessibilityRole="image"
      accessibilityLabel={`Lowest balance trend over your last ${n} months`}
    >
      <Defs>
        <LinearGradient id="insFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={t.calm} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={t.calm} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Dashed average line — always rendered. */}
      <Line
        x1={CHART_PAD_X}
        x2={CHART_W - CHART_PAD_X}
        y1={avgY}
        y2={avgY}
        stroke={t.hairline}
        strokeDasharray="2 4"
      />

      {/* Area fill + route-draw line — only with more than one point (spec sub-branch (b)). */}
      {n > 1 ? (
        <Path
          d={`${d} L ${(CHART_W - CHART_PAD_X).toFixed(1)} ${CHART_H - CHART_PAD_Y} L ${CHART_PAD_X} ${
            CHART_H - CHART_PAD_Y
          } Z`}
          fill="url(#insFill)"
        />
      ) : null}
      {n > 1 ? (
        <AnimatedPath
          d={d}
          fill="none"
          stroke={t.calm}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={ROUTE_DASH}
          animatedProps={lineProps}
        />
      ) : null}

      {/* Per-point dots — last is accent-filled + larger, no stroke; the rest are surface + ink ring. */}
      {ptsArr.map((p, i) => {
        const isLast = i === ptsArr.length - 1;
        return (
          <Circle
            key={p.c.closedAt}
            cx={p.x}
            cy={p.y}
            r={isLast ? 3.5 : 2.4}
            fill={isLast ? t.calm : t.surface}
            stroke={t.ink}
            strokeWidth={isLast ? 0 : 1.1}
          />
        );
      })}

      {/* Labelled last point — £{tightPoint}. */}
      {last ? (
        <SvgText
          x={Math.min(CHART_W - 4, last.x + 6)}
          y={Math.max(10, last.y - 6)}
          fontSize={9.5}
          fontFamily="Inter Tight"
          fontWeight="600"
          fill={t.ink}
          textAnchor={last.x > CHART_W - 40 ? 'end' : 'start'}
        >
          {`£${last.c.tightPoint}`}
        </SvgText>
      ) : null}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — two layers per the DARK-MODE PATTERN. Colour-bearing styles in makeStyles(t); the rest
// ride along (single source per element). The whole sheet is rebuilt per theme via useMemo.
// ---------------------------------------------------------------------------
function makeStyles(t: Palette) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.canvas,
    },
    // Empty branch is non-scrolling (web returns a flex column early). px-7 → gap.xl, like ReviewScreen.
    screen: {
      flex: 1,
      paddingHorizontal: gap.xl,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: gap.xl,
    },

    // Title block — italic eyebrow + the Fraunces headline with the single accent word.
    titleBlock: {
      marginTop: gap.lg + gap.xs, // mt-5 (20)
    },
    eyebrowItalic: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 28,
      lineHeight: 29, // web leading-[1.05]
      marginTop: gap.xs,
    },
    // The accent word stays UPRIGHT terracotta (web em.not-italic text-accent).
    headlineAccent: {
      color: t.calm,
      fontFamily: serif.display,
      fontStyle: 'normal',
    },

    // Empty-state block — mt-6.
    emptyBlock: {
      marginTop: gap.xl,
    },

    // 2×2 stat grid — gap-3, mt-5.
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.md,
      marginTop: gap.lg + gap.xs,
    },
    // bg-surface, hairline, 2xl radius, p-4. Each tile is just under half the row (the gap takes 12).
    tile: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      flexBasis: '47%',
      flexGrow: 1,
      padding: gap.lg,
    },
    tileLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 10.5 * 0.12, // tracking-[0.12em]
      textTransform: 'uppercase',
    },
    // Money — size 'lg', tabular. Default ink; tone overrides recolour.
    tileValue: {
      color: t.ink,
      fontSize: 24,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: gap.xs,
    },
    tileValuePositive: { color: t.positive },
    tileValueAccent: { color: t.calm },
    // Spare-delta sub-line — tabular, mt-1, coloured by sign.
    delta: {
      fontSize: 10.5,
      fontVariant: ['tabular-nums'],
      marginTop: gap.xs,
    },
    deltaPositive: { color: t.positive },
    deltaNegative: { color: t.repair },

    // Chart card — surface, hairline, 2xl radius, p-5, mt-6, the ONLY element with the card shadow.
    chartCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.xl,
      padding: gap.lg + gap.xs, // p-5 (20)
      // shadow-card: warm near-black soft lift (web 0 12px 28px -16px ink/12). iOS + Android.
      shadowColor: '#1A1815',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 3,
    },
    chartTitleRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: gap.md,
    },
    chartTitle: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 11 * 0.12, // tracking-[0.12em]
      textTransform: 'uppercase',
    },
    chartAvg: {
      color: t.muted,
      fontSize: 10.5,
      fontVariant: ['tabular-nums'],
    },
    // Month axis ticks — even columns under the chart, mt-1.
    axisRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: gap.xs,
    },
    axisTick: {
      color: t.muted,
      flex: 1,
      fontSize: 10,
      textAlign: 'center',
    },

    // Mode-tinted Melo note, directly under the chart — mt-4.
    meloNoteBlock: {
      marginTop: gap.lg,
    },

    // Weekly digest card — surface, hairline, 2xl radius, p-4, mt-5.
    weeklyCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg + gap.xs,
      padding: gap.lg,
    },
    weeklyEyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 11 * 0.14, // tracking-[0.14em]
      textTransform: 'uppercase',
    },
    weeklyGrid: {
      flexDirection: 'row',
      gap: gap.md,
      marginTop: gap.sm,
    },
    weeklyCol: {
      flex: 1,
    },
    weeklyLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 10.5 * 0.12, // tracking-[0.12em]
      textTransform: 'uppercase',
    },
    weeklyValue: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 18,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
      marginTop: gap.xxs,
    },

    // Tiny wins block — mt-5.
    winsBlock: {
      marginTop: gap.lg + gap.xs,
    },
    winsEyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 11 * 0.14, // tracking-[0.14em]
      marginBottom: gap.sm,
      paddingHorizontal: gap.xs,
      textTransform: 'uppercase',
    },
    winsCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    // Each win row — px-5 py-3.
    winRow: {
      paddingHorizontal: gap.lg + gap.xs,
      paddingVertical: gap.md,
    },
    winMessage: {
      color: t.ink,
      fontSize: 13.5,
    },
    winDate: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 10.5,
      marginTop: 2,
    },

    // Notes block — mt-5.
    notesBlock: {
      marginTop: gap.lg + gap.xs,
    },
    notesEyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 11 * 0.16, // tracking-[0.16em]
      marginBottom: gap.sm,
      paddingHorizontal: gap.xs, // web px-1
      textTransform: 'uppercase',
    },
    notesCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    // Each note row — px-5 py-4; a hairline divider between rows (web divide-y), none after the last.
    noteRow: {
      paddingHorizontal: gap.lg + gap.xs,
      paddingVertical: gap.lg,
    },
    noteRowDivider: {
      borderBottomColor: t.hairline,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    noteHead: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    noteLabel: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '500',
    },
    noteSpare: {
      color: t.muted,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },
    // Note body — Fraunces italic, muted, in literal quotes, mt-1.
    noteBody: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 12.5,
      marginTop: gap.xs,
    },

    // Paused-subs Melo line — mt-5.
    meloBlock: {
      marginTop: gap.lg + gap.xs,
    },

    // Footer CTA — mt-5 mb-8, full-width h-12 2xl-radius ink button with the paper-toned label.
    ctaBlock: {
      marginBottom: gap.xxl,
      marginTop: gap.lg + gap.xs,
    },
    cta: {
      alignItems: 'center',
      backgroundColor: t.ink,
      borderRadius: radius.xxl,
      height: 48,
      justifyContent: 'center',
    },
    ctaLabel: {
      color: t.inverse, // web --paper text on the ink button → the on-ink light label
      fontSize: 13.5,
      fontWeight: '500',
    },

    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
