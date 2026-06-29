// The signature money path — Folio's brand object.
//
// This is NOT a chart component. It is a single, large, calm "path to payday":
// today on the left, payday on the right, the line dipping through bills/debt and
// rising on income, with the lowest point made obvious and anything still waiting
// for review drawn as an uncertain ghost so the picture never fakes certainty.
//
// All geometry is derived from the canonical route points. When there isn't enough
// real data to draw a meaningful path, it shows an honest "fills in as you add
// money" state instead of a decorative line.
//
// The path is also lightly interactive (faithful to the web interactive path): a draggable scrub
// thumb previews "spend more today", a band toggle (This week / Next week / To payday) re-frames the
// range, a callout names the tight point, and a 3-column summary states coming in / going out /
// lowest. These are all OPTIONAL — the plain read-only path (and its tests) is unchanged when the
// extra props are absent.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { LocalRoutePoint, LocalRouteSummary } from '../../local/localLedger';
import type { TodayPathBand, TodayPathSummary } from './todayTypes';
import {
  Body,
  CheckGlyph,
  Eyebrow,
  gap,
  magnitude,
  money,
  pressed,
  radius,
  useTheme,
  type Palette,
} from './kit';
import { MeloPresence } from './melo';
import { routeHasMeaningfulPath } from './routeMath';

export { routeHasMeaningfulPath };

const PAD_X = 16;

// The plot is sized to the phone, not to one device. We clamp a fraction of the
// viewport height into a calm band so the path stays generous on tall screens and
// never dominates short ones. PLOT_TOP leaves room for the corner labels; the
// PLOT_BOTTOM_INSET below the baseline leaves room for the lowest-point callout.
const H_MIN = 220;
const H_MAX = 320;
const PLOT_TOP = 60;
const PLOT_BOTTOM_INSET = 40; // space below the baseline for the dashed drop-line (no text callout)

// The scrub thumb may travel only across the plotted x-range (today → payday), never into the side
// padding, so the previewed "spend" always lands on a real stretch of the path.
const SCRUB_MIN_X = PAD_X;

type Plot = { height: number; top: number; bottom: number };

function plotFor(windowHeight: number): Plot {
  const height = Math.round(Math.min(H_MAX, Math.max(H_MIN, windowHeight * 0.4)));
  return { height, top: PLOT_TOP, bottom: height - PLOT_BOTTOM_INSET };
}

type Node = {
  index: number;
  x: number;
  y: number;
  point: LocalRoutePoint;
  isToday: boolean;
  isPayday: boolean;
  isLowest: boolean;
  waiting: boolean;
  drop: boolean;
};

type Layout = {
  meaningful: boolean;
  pathD: string;
  areaD: string;
  baselineY: number;
  nodes: readonly Node[];
};

// The band toggle re-frames the range label + the strip of the path that is in view. The labels are
// fixed copy (the data behind the path doesn't change); the band only changes how the range reads.
const BANDS: readonly { id: TodayPathBand; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'next', label: 'Next week' },
  { id: 'payday', label: 'To payday' },
];

function isWaiting(point: LocalRoutePoint): boolean {
  const s = point.reviewState;
  return (
    s === 'requires review' ||
    s === 'needs user confirmation' ||
    s === 'needs source' ||
    s === 'preview only'
  );
}

function smooth(pts: readonly { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const cx = (a.x + b.x) / 2;
    d += ` C ${cx} ${a.y} ${cx} ${b.y} ${b.x} ${b.y}`;
  }
  return d;
}

function computeLayout(route: LocalRouteSummary, width: number, plot: Plot): Layout {
  const points = route.points;
  const balances = points.map((p) => p.balanceMinor);
  const maxV = Math.max(...balances, 0);
  const minV = Math.min(...balances, 0);
  const meaningful = routeHasMeaningfulPath(route);
  if (!meaningful) {
    return { meaningful: false, pathD: '', areaD: '', baselineY: plot.bottom, nodes: [] };
  }

  const innerW = Math.max(width - PAD_X * 2, 1);
  const range = maxV - minV;
  const y = (v: number) => plot.top + ((maxV - v) / range) * (plot.bottom - plot.top);
  const x = (i: number) => PAD_X + (innerW * i) / (points.length - 1);

  const lowestBalance = Math.min(...balances);
  let lowestIndex = balances.indexOf(lowestBalance);
  const tightMatch = points.findIndex((p) => p.date === route.tightestDay);
  if (tightMatch >= 0) lowestIndex = tightMatch;

  const coords = points.map((p, i) => ({ x: x(i), y: y(p.balanceMinor) }));
  const nodes: Node[] = points.map((p, i) => ({
    index: i,
    x: coords[i]!.x,
    y: coords[i]!.y,
    point: p,
    isToday: i === 0,
    isPayday: i === points.length - 1 && p.deltaMinor >= 0,
    isLowest: i === lowestIndex,
    waiting: isWaiting(p),
    drop: p.deltaMinor < 0,
  }));

  const pathD = smooth(coords);
  const lastX = coords[coords.length - 1]!.x;
  const firstX = coords[0]!.x;
  const areaD = `${pathD} L ${lastX} ${plot.bottom} L ${firstX} ${plot.bottom} Z`;
  return { meaningful: true, pathD, areaD, baselineY: y(0), nodes };
}

function nodeTone(t: Palette, node: Node): string {
  // The lowest point is the screen's attention object — terracotta accent while it holds (the
  // "tight point"), coral when it actually runs short. Payday is the calm-green end-cap.
  if (node.isLowest) {
    return node.point.balanceMinor < 0 ? t.repair : t.calm;
  }
  if (node.isPayday) return t.payday;
  if (node.drop) return t.warm;
  return t.positive;
}

// ---------------------------------------------------------------------------
// The route surface
// ---------------------------------------------------------------------------

export function MoneyPath({
  route,
  selectedIndex,
  onSelectPoint,
  band,
  onChangeBand,
  rangeLabel,
  summary,
  scrubPreviewMinor,
  onScrub,
  focusDateIso,
}: {
  route: LocalRouteSummary;
  selectedIndex: number | null;
  onSelectPoint: (index: number) => void;
  // --- optional interactive props (the Today rich-home passes these) ---
  /** Active range band. When set, the band toggle renders below the path. */
  band?: TodayPathBand | undefined;
  onChangeBand?: ((band: TodayPathBand) => void) | undefined;
  /** Range caption shown top-right of the path, e.g. "27 Jun → 25 Jul". */
  rangeLabel?: string | undefined;
  /** The 3-column coming-in / going-out / lowest summary under the path. */
  summary?: TodayPathSummary | undefined;
  /** A preview spend (minor units) the scrub thumb represents, for the caption under the path. */
  scrubPreviewMinor?: number | undefined;
  /** Called with a 0..1 fraction across the plotted range as the user drags the scrub thumb. */
  onScrub?: ((fraction: number) => void) | undefined;
  /** Calendar -> Route bridge: an ISO day to pulse on the path. When set, the node at (or nearest
   *  before) that date gets a vertical guide + a date chip. The container clears it after ~6s. */
  focusDateIso?: string | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [width, setWidth] = useState(340);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };

  const { height: windowHeight } = useWindowDimensions();
  const plot = plotFor(windowHeight);
  const layout = computeLayout(route, width, plot);
  const lowest = layout.nodes.find((n) => n.isLowest);
  const today = layout.nodes.find((n) => n.isToday);
  const payday = layout.nodes.find((n) => n.isPayday);

  // Calendar -> Route focus: the node on (or nearest on/before) the requested ISO day. A calendar day
  // need not land exactly on a route point, so we snap to the last point at/before it (else the first).
  const focusNode = useMemo(() => {
    if (!focusDateIso || layout.nodes.length === 0) return null;
    let chosen = layout.nodes[0]!;
    for (const node of layout.nodes) {
      if (node.point.date <= focusDateIso) chosen = node;
      else break;
    }
    return chosen;
  }, [focusDateIso, layout.nodes]);

  const interactive = onScrub !== undefined;
  const [scrub, setScrub] = useState(0); // 0..1 across the plotted range
  const scrubMaxX = Math.max(width - PAD_X, SCRUB_MIN_X + 1);
  const scrubRange = scrubMaxX - SCRUB_MIN_X;

  // The scrub thumb is dragged with a PanResponder (faithful to the web pointer-drag). We track the
  // fraction in a ref too so the responder reads a live value without re-creating the responder.
  const fractionRef = useRef(0);
  const applyFraction = (fraction: number) => {
    const clamped = Math.max(0, Math.min(1, fraction));
    fractionRef.current = clamped;
    setScrub(clamped);
    onScrub?.(clamped);
  };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: () => interactive,
        onPanResponderGrant: (e) => {
          applyFraction((e.nativeEvent.locationX - SCRUB_MIN_X) / scrubRange);
        },
        onPanResponderMove: (e) => {
          applyFraction((e.nativeEvent.locationX - SCRUB_MIN_X) / scrubRange);
        },
      }),
    // Rebuild only when the geometry the responder maps against changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive, scrubRange],
  );
  const thumbX = SCRUB_MIN_X + scrub * scrubRange;

  // The route is the screen's hero — ONE line carrying the whole emotional payload. Its colour is
  // the route's verdict: calm green while it holds to payday, gold when it stays tight, coral when
  // it runs short. The single line says calm-or-pressure before a word is read.
  const lineTone =
    route.tightestBalanceMinor < 0
      ? t.repair
      : route.tightestBalanceMinor < 10000
        ? t.warm
        : t.positive;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={routeAccessibilityLabel(route, layout.meaningful)}
      onLayout={onLayout}
      style={staticLayout.routeSurface}
    >
      <View style={staticLayout.routeHead}>
        <Eyebrow>Path to payday</Eyebrow>
        {rangeLabel ? (
          <Text style={s.rangeLabel}>{rangeLabel}</Text>
        ) : route.pendingReviewCount > 0 ? (
          <View style={s.waitingChip}>
            <View style={s.waitingDot} />
            <Text style={s.waitingChipText}>{route.pendingReviewCount} still to check</Text>
          </View>
        ) : null}
      </View>

      {!layout.meaningful ? (
        <RouteEmpty />
      ) : (
        <View>
          <View {...(interactive ? panResponder.panHandlers : {})}>
            <Svg width="100%" height={plot.height} viewBox={`0 0 ${width} ${plot.height}`}>
              {/* zero baseline */}
              <Line
                x1={PAD_X}
                y1={layout.baselineY}
                x2={width - PAD_X}
                y2={layout.baselineY}
                stroke={t.hairline}
                strokeWidth={1}
              />
              {/* soft area under the path — fades the line's own hue toward the baseline */}
              <Path d={layout.areaD} fill={lineTone} fillOpacity={0.1} />
              {/* drop line from the lowest point down to the baseline */}
              {lowest ? (
                <Line
                  x1={lowest.x}
                  y1={lowest.y}
                  x2={lowest.x}
                  y2={plot.bottom + 6}
                  stroke={nodeTone(t, lowest)}
                  strokeWidth={1.4}
                  strokeDasharray="3 4"
                />
              ) : null}
              {/* the path — the single muted semantic line */}
              <Path
                d={layout.pathD}
                fill="none"
                stroke={lineTone}
                strokeWidth={2.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* nodes */}
              {layout.nodes.map((node) => {
                const tone = nodeTone(t, node);
                if (node.waiting) {
                  // uncertain — a hollow dashed ring, never a solid claim
                  return (
                    <Circle
                      key={node.index}
                      cx={node.x}
                      cy={node.y}
                      r={6}
                      fill={t.surface}
                      stroke={t.hairlineStrong}
                      strokeWidth={1.6}
                      strokeDasharray="2 3"
                    />
                  );
                }
                const selected = selectedIndex === node.index;
                const r = node.isLowest || node.isToday || node.isPayday ? 7 : 5;
                return (
                  <Circle
                    key={node.index}
                    cx={node.x}
                    cy={node.y}
                    r={selected ? r + 3 : r}
                    fill={node.isToday ? t.ink : tone}
                    stroke={t.surface}
                    strokeWidth={selected ? 3 : 2.2}
                  />
                );
              })}

              {/* Tight-point callout — only at rest (no active scrub), naming when the dip lands. */}
              {interactive && lowest && scrub < 0.04 ? (
                <CalloutBox
                  cx={lowest.x}
                  topY={lowest.y - 14}
                  label={`${lowest.point.label} · ${money(lowest.point.balanceMinor)}`}
                  plotWidth={width}
                  t={t}
                />
              ) : null}

              {/* Scrub thumb — a dashed vertical guide + a filled accent knob the user drags. */}
              {interactive ? (
                <>
                  <Line
                    x1={thumbX}
                    y1={plot.top - 24}
                    x2={thumbX}
                    y2={plot.bottom}
                    stroke={t.calm}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    opacity={0.7}
                  />
                  <Circle cx={thumbX} cy={plot.top - 24} r={6} fill={t.calm} />
                  <Circle cx={thumbX} cy={plot.top - 24} r={3} fill={t.inverse} />
                </>
              ) : null}

              {/* Calendar -> Route focus marker: a vertical guide + ringed node + date chip at the
                  day the user asked to see. Drawn last so it sits above the path; the container
                  clears focusDateIso after ~6s so the pulse is transient. */}
              {focusNode ? (
                <>
                  <Line
                    x1={focusNode.x}
                    y1={plot.top - 18}
                    x2={focusNode.x}
                    y2={plot.bottom + 6}
                    stroke={t.calmStrong}
                    strokeWidth={1.4}
                    strokeDasharray="2 3"
                  />
                  <Circle
                    cx={focusNode.x}
                    cy={focusNode.y}
                    r={9}
                    fill="none"
                    stroke={t.calmStrong}
                    strokeWidth={2}
                  />
                  <CalloutBox
                    cx={focusNode.x}
                    topY={focusNode.y - 14}
                    label={focusDayLabel(focusNode.point.date)}
                    plotWidth={width}
                    t={t}
                  />
                </>
              ) : null}
            </Svg>
          </View>

          {/* Tappable overlays on each node (SVG nodes aren't pressable directly) */}
          {layout.nodes.map((node) => (
            <Pressable
              accessibilityHint="Explains this point on your money path."
              accessibilityLabel={node.point.accessibleLabel || node.point.title}
              accessibilityRole="button"
              key={`hit-${node.index}`}
              onPress={() => onSelectPoint(node.index)}
              style={[staticLayout.nodeHit, { left: node.x - 24, top: node.y - 24 }]}
            />
          ))}

          {/* Corner labels — kept in the top band, never crossing the line */}
          {today ? (
            <View style={[staticLayout.cornerLabel, { left: PAD_X }]} pointerEvents="none">
              <Text style={s.cornerCaption}>Today</Text>
              <Text style={s.cornerValue}>{money(today.point.balanceMinor)}</Text>
            </View>
          ) : null}
          {payday ? (
            <View style={[staticLayout.cornerLabel, staticLayout.cornerRight]} pointerEvents="none">
              <Text style={[s.cornerCaption, staticLayout.alignRight]}>Payday</Text>
              <Text style={[s.cornerValue, staticLayout.alignRight]}>
                {money(payday.point.balanceMinor)}
              </Text>
            </View>
          ) : null}

          {/* The lowest point is marked on the chart by the gold node + dashed drop-line; its
              value and context are stated once, in the hero above — never repeated here. */}
        </View>
      )}

      {/* Band toggle — re-frames the range. Only shown for the interactive Today path. */}
      {band && onChangeBand ? (
        <View style={staticLayout.bandRow}>
          {BANDS.map((option) => {
            const on = option.id === band;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                key={option.id}
                onPress={() => onChangeBand(option.id)}
                style={({ pressed: isPressed }) => [
                  staticLayout.bandChip,
                  on ? s.bandChipOn : s.bandChipOff,
                  isPressed ? pressed : undefined,
                ]}
              >
                <Text style={[staticLayout.bandLabel, on ? s.bandLabelOn : s.bandLabelOff]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Scrub caption — what a previewed spend would mean. */}
      {interactive && layout.meaningful ? (
        <Text style={s.scrubCaption}>
          {scrubPreviewMinor !== undefined && scrubPreviewMinor > 0
            ? `if you spend ${magnitude(scrubPreviewMinor)} today`
            : 'drag the line to preview a spend'}
        </Text>
      ) : null}

      {/* 3-column summary — coming in / going out / lowest. */}
      {summary && layout.meaningful ? (
        <View style={staticLayout.summaryRow}>
          <SummaryCell label="Coming in" value={money(summary.comingInMinor)} tone="positive" />
          <SummaryCell
            label="Going out"
            value={`-${magnitude(summary.goingOutMinor)}`}
            tone="repair"
          />
          <SummaryCell label="Lowest" value={money(summary.lowestMinor)} tone="ink" />
        </View>
      ) : null}
    </View>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'repair' | 'ink';
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const color = tone === 'positive' ? t.positiveInk : tone === 'repair' ? t.repairInk : t.ink;
  return (
    <View style={staticLayout.summaryCell}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[staticLayout.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

// A small rounded callout above the tight point. Clamped horizontally so it never overflows the plot.
function CalloutBox({
  cx,
  topY,
  label,
  plotWidth,
  t,
}: {
  cx: number;
  topY: number;
  label: string;
  plotWidth: number;
  t: Palette;
}) {
  const boxWidth = 120;
  const half = boxWidth / 2;
  const clampedCx = Math.max(PAD_X + half, Math.min(plotWidth - PAD_X - half, cx));
  const boxTop = topY - 12 - 22;
  return (
    <>
      <Line x1={cx} y1={topY} x2={cx} y2={topY - 12} stroke={t.calm} strokeWidth={0.9} />
      <Rect
        x={clampedCx - half}
        y={boxTop}
        width={boxWidth}
        height={22}
        rx={6}
        fill={t.surface}
        stroke={t.calm}
        strokeWidth={0.9}
      />
      <SvgText
        x={clampedCx}
        y={boxTop + 15}
        fill={t.ink}
        fontSize={10}
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </>
  );
}

// A spoken summary of the route for screen readers. The path itself is a picture, so
// this describes it in plain language: where you stand now, the lowest point, and what
// is still waiting to be checked.
function routeAccessibilityLabel(route: LocalRouteSummary, meaningful: boolean): string {
  if (!meaningful) {
    return `Your money path. It fills in as you add money. You can see ${money(route.availableNowMinor)} now.`;
  }
  const lowest = `Its lowest point is ${money(route.tightestBalanceMinor)} before ${route.nextPaydayLabel}.`;
  const waiting =
    route.pendingReviewCount > 0
      ? ` ${route.pendingReviewCount} ${route.pendingReviewCount === 1 ? 'thing is' : 'things are'} still to check.`
      : '';
  return `Your money path to payday. ${lowest}${waiting}`;
}

// "Mon 14 Jul" chip label for the Calendar -> Route focus marker. Local-time parse so it agrees with
// the ISO day the calendar passed (no UTC drift across the chip).
function focusDayLabel(iso: string): string {
  const parts = iso.split('-').map(Number);
  const d = new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] ?? '';
  const mon = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ][d.getMonth()] ?? '';
  return `${wd} ${d.getDate()} ${mon}`;
}

function RouteEmpty() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={staticLayout.routeEmpty}>
      <Svg width="100%" height={150} viewBox="0 0 320 150">
        <Line
          x1={16}
          y1={120}
          x2={304}
          y2={120}
          stroke={t.hairline}
          strokeWidth={1}
          strokeDasharray="2 5"
        />
        <Circle cx={28} cy={120} r={6} fill={t.ink} stroke={t.surface} strokeWidth={2} />
      </Svg>
      <Body style={s.routeEmptyText}>
        Your money path fills in as you add money — what you have now, when more comes in, and what
        has to leave before then.
      </Body>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Point explanation — human language only
// ---------------------------------------------------------------------------

function causeLine(point: LocalRoutePoint): { label: string; value: string } | null {
  if (point.deltaMinor === 0) return null;
  if (point.deltaMinor > 0) {
    return { label: 'Money in', value: magnitude(point.deltaMinor) };
  }
  const kind = point.pointKind;
  const label =
    kind === 'commitment' ? 'Set aside' : kind === 'shortfall' ? 'Short by' : 'Money out';
  return { label, value: magnitude(point.deltaMinor) };
}

function waitingLine(point: LocalRoutePoint): string {
  return isWaiting(point) ? 'Yes — 1 thing still to check' : 'Nothing';
}

export function PointExplanation({
  point,
  onClose,
  onSeeOnCalendar,
}: {
  point: LocalRoutePoint | null;
  onClose: () => void;
  /** Route -> Calendar bridge: open the calendar focused on this point's day. When provided, a
   *  secondary "See this day on the calendar" action shows; it calls back with point.date then closes.
   *  Omitted → only the "Got it" close button shows (the read-only path is unchanged). */
  onSeeOnCalendar?: ((dateIso: string) => void) | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const cause = point ? causeLine(point) : null;
  return (
    <Modal animationType="slide" transparent visible={point !== null} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={s.scrim} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.sheetHandle} />
        {point ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text accessibilityRole="header" style={s.sheetTitle}>
              {point.title}
            </Text>
            <MeloPresence
              line={`This ${point.deltaMinor < 0 ? 'drop' : 'rise'} is ${point.title.toLowerCase()}.`}
              size="sm"
              state="melo_path_explaining"
              style={staticLayout.sheetMelo}
            />
            <View style={staticLayout.sheetRows}>
              <ExplainRow label="Left after this" value={money(point.balanceMinor)} strong />
              {cause ? <ExplainRow label={cause.label} value={cause.value} /> : null}
              {typeof point.protectedMinor === 'number' &&
              point.protectedMinor > 0 &&
              point.protectedMinor !== Math.abs(point.deltaMinor) ? (
                <ExplainRow label="Kept aside" value={magnitude(point.protectedMinor)} />
              ) : null}
              <ExplainRow label="Still waiting" value={waitingLine(point)} />
            </View>
            {onSeeOnCalendar ? (
              <Pressable
                accessibilityHint="Opens the calendar focused on this day."
                accessibilityLabel="See this day on the calendar"
                accessibilityRole="button"
                onPress={() => {
                  onSeeOnCalendar(point.date);
                  onClose();
                }}
                style={({ pressed: isPressed }) => [
                  s.sheetSecondary,
                  isPressed ? { opacity: 0.85 } : undefined,
                ]}
              >
                <Text style={s.sheetSecondaryText}>See this day on the calendar</Text>
                <Text style={s.sheetSecondaryArrow}>→</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed: isPressed }) => [
                s.sheetDone,
                onSeeOnCalendar ? staticLayout.sheetDoneGrouped : undefined,
                isPressed ? { opacity: 0.85 } : undefined,
              ]}
            >
              <CheckGlyph color={t.calmStrong} size={20} />
              <Text style={s.sheetDoneText}>Got it</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

function ExplainRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean | undefined;
}): ReactNode {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={s.explainRow}>
      <Text style={s.explainLabel}>{label}</Text>
      <Text style={[s.explainValue, strong ? staticLayout.explainValueStrong : undefined]}>
        {value}
      </Text>
    </View>
  );
}

// Colour-free styles — shared across light and dark.
const staticLayout = StyleSheet.create({
  // Full-bleed: the route is the screen's hero object, sitting directly on the cream — no card,
  // no border, no fill. Near-flat by design; the cream IS the depth. (Editorial Ledger.)
  routeSurface: {
    paddingTop: gap.sm,
    paddingBottom: gap.lg,
  },
  routeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD_X,
    marginBottom: gap.sm,
  },

  nodeHit: { position: 'absolute', width: 48, height: 48 },

  cornerLabel: { position: 'absolute', top: 8 },
  cornerRight: { right: PAD_X },
  alignRight: { textAlign: 'right' },

  bandRow: { flexDirection: 'row', gap: 6, paddingHorizontal: PAD_X, marginTop: gap.sm },
  bandChip: {
    flex: 1,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandLabel: { fontSize: 11, letterSpacing: 0.2 },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: PAD_X,
    marginTop: gap.md,
  },
  summaryCell: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

  routeEmpty: { paddingHorizontal: gap.sm, paddingTop: gap.md, gap: gap.md },

  sheetMelo: { marginTop: gap.md },
  sheetRows: { marginTop: gap.lg, gap: 2 },
  explainValueStrong: { fontSize: 19, fontWeight: '800' },
  // When the secondary "See this day on the calendar" action is present, the two buttons read as one
  // action group — so the "Got it" close tightens up under it instead of keeping its full gap.xl top.
  sheetDoneGrouped: { marginTop: gap.sm },
});

// Colour-bearing styles, resolved against the active palette.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    rangeLabel: { color: t.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
    waitingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.warmSoft,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    waitingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.warm },
    waitingChipText: { color: t.warmInk, fontSize: 12, fontWeight: '700' },

    cornerCaption: { color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
    cornerValue: {
      color: t.ink,
      fontSize: 17,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      marginTop: 1,
    },

    bandChipOn: { backgroundColor: t.ink },
    bandChipOff: { backgroundColor: t.sunken },
    bandLabelOn: { color: t.inverse, fontWeight: '600' },
    bandLabelOff: { color: t.muted },

    scrubCaption: {
      color: t.muted,
      fontSize: 11,
      textAlign: 'center',
      marginTop: gap.sm,
    },

    summaryLabel: {
      color: t.muted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },

    routeEmptyText: { color: t.secondary },

    scrim: { flex: 1, backgroundColor: role_scrim() },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: gap.xl,
      paddingTop: gap.md,
      paddingBottom: gap.xxxl,
      maxHeight: '72%',
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.hairline,
      marginBottom: gap.lg,
    },
    sheetTitle: { color: t.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
    explainRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.hairline,
    },
    explainLabel: { color: t.secondary, fontSize: 16 },
    explainValue: {
      color: t.ink,
      fontSize: 16,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    sheetDone: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: gap.xl,
      paddingVertical: 15,
      borderRadius: 16,
      backgroundColor: t.calmSoft,
    },
    sheetDoneText: { color: t.calmStrong, fontSize: 16, fontWeight: '700' },
    // Secondary, quieter than the filled "Got it": an outlined surface button so the close stays the
    // primary. Colours come from the active palette (t.X) so it follows light/dark like the rest.
    sheetSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: gap.xl,
      paddingVertical: 15,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairlineStrong,
      backgroundColor: t.surface,
    },
    sheetSecondaryText: { color: t.ink, fontSize: 16, fontWeight: '700' },
    sheetSecondaryArrow: { color: t.calmStrong, fontSize: 16, fontWeight: '700' },
  });
}

// The scrim is a deliberate translucent overlay that reads on both grounds (a dark wash over the
// content behind the sheet), so it stays a literal rather than a palette key.
function role_scrim(): string {
  return 'rgba(24, 35, 29, 0.42)';
}
