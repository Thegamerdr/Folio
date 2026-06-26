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

import { useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { LocalRoutePoint, LocalRouteSummary } from '../../local/localLedger';
import { Body, CheckGlyph, Eyebrow, gap, magnitude, money, paper } from './kit';
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
const PLOT_BOTTOM_INSET = 68; // distance from the bottom of the SVG to the baseline band

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

function nodeTone(node: Node): string {
  if (node.isLowest) {
    return node.point.balanceMinor < 0 ? paper.repair : paper.warm;
  }
  if (node.isPayday) return paper.payday;
  if (node.drop) return paper.warm;
  return paper.calm;
}

// ---------------------------------------------------------------------------
// The route surface
// ---------------------------------------------------------------------------

export function MoneyPath({
  route,
  selectedIndex,
  onSelectPoint,
}: {
  route: LocalRouteSummary;
  selectedIndex: number | null;
  onSelectPoint: (index: number) => void;
}) {
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

  return (
    <View
      accessibilityLabel={routeAccessibilityLabel(route, layout.meaningful)}
      onLayout={onLayout}
      style={styles.routeSurface}
    >
      <View style={styles.routeHead}>
        <Eyebrow>Your money path to payday</Eyebrow>
        {route.pendingReviewCount > 0 ? (
          <View style={styles.waitingChip}>
            <View style={styles.waitingDot} />
            <Text style={styles.waitingChipText}>{route.pendingReviewCount} still to check</Text>
          </View>
        ) : null}
      </View>

      {!layout.meaningful ? (
        <RouteEmpty />
      ) : (
        <View>
          <Svg width="100%" height={plot.height} viewBox={`0 0 ${width} ${plot.height}`}>
            {/* zero baseline */}
            <Line
              x1={PAD_X}
              y1={layout.baselineY}
              x2={width - PAD_X}
              y2={layout.baselineY}
              stroke={paper.hairline}
              strokeWidth={1}
            />
            {/* soft area under the path */}
            <Path d={layout.areaD} fill={paper.calm} fillOpacity={0.09} />
            {/* drop line from the lowest point down to the baseline */}
            {lowest ? (
              <Line
                x1={lowest.x}
                y1={lowest.y}
                x2={lowest.x}
                y2={plot.bottom + 6}
                stroke={nodeTone(lowest)}
                strokeWidth={1.4}
                strokeDasharray="3 4"
              />
            ) : null}
            {/* the path */}
            <Path
              d={layout.pathD}
              fill="none"
              stroke={paper.ink}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* nodes */}
            {layout.nodes.map((node) => {
              const tone = nodeTone(node);
              if (node.waiting) {
                // uncertain — a hollow dashed ring, never a solid claim
                return (
                  <Circle
                    key={node.index}
                    cx={node.x}
                    cy={node.y}
                    r={6}
                    fill={paper.surface}
                    stroke={paper.hairlineStrong}
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
                  fill={node.isToday ? paper.ink : tone}
                  stroke={paper.surface}
                  strokeWidth={selected ? 3 : 2.2}
                />
              );
            })}
          </Svg>

          {/* Tappable overlays on each node (SVG nodes aren't pressable directly) */}
          {layout.nodes.map((node) => (
            <Pressable
              accessibilityHint="Explains this point on your money path."
              accessibilityLabel={node.point.accessibleLabel || node.point.title}
              accessibilityRole="button"
              key={`hit-${node.index}`}
              onPress={() => onSelectPoint(node.index)}
              style={[styles.nodeHit, { left: node.x - 24, top: node.y - 24 }]}
            />
          ))}

          {/* Corner labels — kept in the top band, never crossing the line */}
          {today ? (
            <View style={[styles.cornerLabel, { left: PAD_X }]} pointerEvents="none">
              <Text style={styles.cornerCaption}>Today</Text>
              <Text style={styles.cornerValue}>{money(today.point.balanceMinor)}</Text>
            </View>
          ) : null}
          {payday ? (
            <View style={[styles.cornerLabel, styles.cornerRight]} pointerEvents="none">
              <Text style={[styles.cornerCaption, styles.alignRight]}>Payday</Text>
              <Text style={[styles.cornerValue, styles.alignRight]}>
                {money(payday.point.balanceMinor)}
              </Text>
            </View>
          ) : null}

          {/* Lowest-point callout — below the plot, leader line up, no overlap */}
          {lowest ? (
            <View
              style={[styles.lowestCallout, lowestCalloutAlign(lowest.x, width)]}
              pointerEvents="none"
            >
              <Text style={[styles.lowestLabel, { color: nodeTone(lowest) }]}>
                {lowest.point.balanceMinor < 0 ? 'Lowest point — short' : 'Lowest point'}
              </Text>
              <Text style={styles.lowestValue}>{money(lowest.point.balanceMinor)}</Text>
              <Text style={styles.lowestDay}>{lowestDayLabel(lowest.point)}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function lowestCalloutAlign(x: number, width: number) {
  if (x < width * 0.33) return { left: PAD_X };
  if (x > width * 0.66) return { right: PAD_X };
  return { left: Math.max(PAD_X, x - 60) };
}

// The callout's day line names *when* the lowest point lands. A bare "Today" here would
// duplicate the corner "Today" header and read as a second, contradicting figure — so when
// the lowest point sits on today we name what causes the dip instead of repeating the day.
function lowestDayLabel(point: LocalRoutePoint): string {
  if (point.label !== 'Today') return point.label;
  if (point.deltaMinor < 0 || point.pointKind === 'commitment' || point.pointKind === 'shortfall') {
    return 'after bills are set aside';
  }
  return 'where you stand now';
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
      ? ` ${route.pendingReviewCount} ${route.pendingReviewCount === 1 ? 'row is' : 'rows are'} still to check.`
      : '';
  return `Your money path to payday. ${lowest}${waiting}`;
}

function RouteEmpty() {
  return (
    <View style={styles.routeEmpty}>
      <Svg width="100%" height={150} viewBox="0 0 320 150">
        <Line
          x1={16}
          y1={120}
          x2={304}
          y2={120}
          stroke={paper.hairline}
          strokeWidth={1}
          strokeDasharray="2 5"
        />
        <Circle cx={28} cy={120} r={6} fill={paper.ink} stroke={paper.surface} strokeWidth={2} />
      </Svg>
      <Body style={styles.routeEmptyText}>
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
  return isWaiting(point) ? 'Yes — 1 row still to check' : 'Nothing';
}

export function PointExplanation({
  point,
  onClose,
}: {
  point: LocalRoutePoint | null;
  onClose: () => void;
}) {
  const cause = point ? causeLine(point) : null;
  return (
    <Modal animationType="slide" transparent visible={point !== null} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        {point ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              {point.title}
            </Text>
            <MeloPresence
              line={`This ${point.deltaMinor < 0 ? 'drop' : 'rise'} is ${point.title.toLowerCase()}.`}
              size="sm"
              state="melo_path_explaining"
              style={styles.sheetMelo}
            />
            <View style={styles.sheetRows}>
              <ExplainRow label="Left after this" value={money(point.balanceMinor)} strong />
              {cause ? <ExplainRow label={cause.label} value={cause.value} /> : null}
              {typeof point.protectedMinor === 'number' &&
              point.protectedMinor > 0 &&
              point.protectedMinor !== Math.abs(point.deltaMinor) ? (
                <ExplainRow label="Kept aside" value={magnitude(point.protectedMinor)} />
              ) : null}
              <ExplainRow label="Still waiting" value={waitingLine(point)} />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.sheetDone, pressed ? { opacity: 0.85 } : undefined]}
            >
              <CheckGlyph color={paper.calmStrong} size={20} />
              <Text style={styles.sheetDoneText}>Got it</Text>
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
  return (
    <View style={styles.explainRow}>
      <Text style={styles.explainLabel}>{label}</Text>
      <Text style={[styles.explainValue, strong ? styles.explainValueStrong : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  routeSurface: {
    backgroundColor: paper.surface,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairline,
    paddingTop: gap.lg,
    paddingBottom: gap.xl,
    paddingHorizontal: gap.sm,
  },
  routeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gap.sm,
    marginBottom: gap.xs,
  },
  waitingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: paper.warmSoft,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  waitingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: paper.warm },
  waitingChipText: { color: paper.warmInk, fontSize: 12, fontWeight: '700' },

  nodeHit: { position: 'absolute', width: 48, height: 48 },

  cornerLabel: { position: 'absolute', top: 8 },
  cornerRight: { right: gap.sm },
  cornerCaption: { color: paper.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  cornerValue: {
    color: paper.ink,
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  alignRight: { textAlign: 'right' },

  lowestCallout: { position: 'absolute', bottom: 2, maxWidth: 150 },
  lowestLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  lowestValue: {
    color: paper.ink,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  lowestDay: { color: paper.muted, fontSize: 12, marginTop: 1 },

  routeEmpty: { paddingHorizontal: gap.sm, paddingTop: gap.md, gap: gap.md },
  routeEmptyText: { color: paper.secondary },

  scrim: { flex: 1, backgroundColor: role_scrim() },
  sheet: {
    backgroundColor: paper.surface,
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
    backgroundColor: paper.hairline,
    marginBottom: gap.lg,
  },
  sheetTitle: { color: paper.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  sheetMelo: { marginTop: gap.md },
  sheetRows: { marginTop: gap.lg, gap: 2 },
  explainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.hairline,
  },
  explainLabel: { color: paper.secondary, fontSize: 16 },
  explainValue: {
    color: paper.ink,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  explainValueStrong: { fontSize: 19, fontWeight: '800' },
  sheetDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: gap.xl,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: paper.calmSoft,
  },
  sheetDoneText: { color: paper.calmStrong, fontSize: 16, fontWeight: '700' },
});

function role_scrim(): string {
  return 'rgba(24, 35, 29, 0.42)';
}
