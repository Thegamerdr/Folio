// Today — After (transient): the path re-drawing after a meaningful change.
//
// Faithful RN port of the web ScreenTodayAfter (folio-melo/src/components/folio/screens/
// ScreenTodayAfter.tsx). A brief settled moment shown right after the user does something that moved
// the path — a review accepted, a charge logged, a subscription paused. It re-states where the money
// now lands (the settled verdict + a count-up spare), names what changed (a delta + a small preview
// of the re-drawn route), reassures through a quiet Melo line, and offers two calm doorways: back to
// Today, or open the tight point. The path still holds.
//
// PRESENTATION ONLY. It never touches the engine. The container reads the route AFTER the change and
// maps it into the small TodayAfterProps shape below (the settled verdict, the spare at the tightest
// point, the change label + delta, and the route points the preview draws). Every navigation is a
// callback the container owns. Money is read through formatMinorAmount (via the kit) so there is no
// formatting drift with the rest of the app.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import type { LocalRoutePoint } from '../../local/localLedger';
import { MeloPresence } from './melo';
import { useCountUp } from './useCountUp';
import {
  Eyebrow,
  elevation,
  gap,
  magnitude,
  paper,
  pressed,
  radius,
  serif,
  type VerdictTone,
} from './kit';

// The settled "spare" figure counts up to its target the same way the Today hero does: easeOutCubic
// over 700ms (the web uses a 700ms count-up here), honouring reduced motion (snaps to the value).
const SPARE_COUNT_UP_MS = 700;

// The preview plot — a small calm curve, sized in the SVG's own viewBox space (the web uses a
// 400x120 viewBox). It is a decorative re-statement of the re-drawn route, NOT the interactive
// MoneyPath; geometry is derived from the route points the container supplies so the curve reflects
// this device's real shape rather than a fixed decorative line.
const PLOT_W = 400;
const PLOT_H = 120;
const PLOT_TOP = 30;
const PLOT_BOTTOM = 92;
const PLOT_LEFT = 20;
const PLOT_RIGHT = 380;

function verdictColor(tone: VerdictTone | undefined): string {
  if (tone === 'repair') return paper.repairInk;
  if (tone === 'warm') return paper.warmInk;
  if (tone === 'positive') return paper.positiveInk;
  return paper.ink;
}

// Map the route's balances onto the small preview plot. Returns the smooth curve, the matching area
// fill below it, and the screen coordinates of the tight point (lowest) and payday (last) markers, so
// the two callouts sit on the real curve. Falls back to a calm flat line when there aren't enough
// points to draw a shape.
type PreviewGeometry = Readonly<{
  curveD: string;
  areaD: string;
  lowest: { x: number; y: number };
  payday: { x: number; y: number };
}>;

function previewGeometry(points: readonly LocalRoutePoint[]): PreviewGeometry {
  const flat: PreviewGeometry = {
    curveD: `M ${PLOT_LEFT} ${PLOT_BOTTOM} L ${PLOT_RIGHT} ${PLOT_BOTTOM}`,
    areaD: `M ${PLOT_LEFT} ${PLOT_BOTTOM} L ${PLOT_RIGHT} ${PLOT_BOTTOM} L ${PLOT_RIGHT} ${PLOT_H} L ${PLOT_LEFT} ${PLOT_H} Z`,
    lowest: { x: PLOT_RIGHT - 75, y: PLOT_BOTTOM },
    payday: { x: PLOT_RIGHT, y: PLOT_BOTTOM },
  };
  if (points.length < 2) return flat;

  const balances = points.map((p) => p.balanceMinor);
  const maxV = Math.max(...balances);
  const minV = Math.min(...balances);
  const span = maxV - minV;

  // y maps high balance → top, low balance → bottom of the plot band.
  const yFor = (v: number): number => {
    if (span === 0) return (PLOT_TOP + PLOT_BOTTOM) / 2;
    const frac = (v - minV) / span; // 0 at lowest .. 1 at highest
    return PLOT_BOTTOM - frac * (PLOT_BOTTOM - PLOT_TOP);
  };
  const xFor = (i: number): number =>
    PLOT_LEFT + (i / (points.length - 1)) * (PLOT_RIGHT - PLOT_LEFT);

  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.balanceMinor) }));

  // Smooth the curve with the same mid-point cubic the MoneyPath uses, so the preview reads as the
  // same family of line.
  let curveD = `M ${coords[0]!.x} ${coords[0]!.y}`;
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const cx = (a.x + b.x) / 2;
    curveD += ` C ${cx} ${a.y} ${cx} ${b.y} ${b.x} ${b.y}`;
  }
  const last = coords[coords.length - 1]!;
  const areaD = `${curveD} L ${last.x} ${PLOT_H} L ${coords[0]!.x} ${PLOT_H} Z`;

  // The tight point is the lowest balance; payday is the last point (the end of the route).
  let lowestIndex = 0;
  for (let i = 1; i < balances.length; i += 1) {
    if (balances[i]! < balances[lowestIndex]!) lowestIndex = i;
  }

  return {
    curveD,
    areaD,
    lowest: coords[lowestIndex]!,
    payday: last,
  };
}

export type TodayAfterProps = {
  /** The settled verdict line, split into a lead, ONE accent word, and a tail — the Editorial Ledger
   *  signature (e.g. lead "You " · accent "make it" · tail " to payday."). */
  verdictLead?: string | undefined;
  verdictAccent: string;
  verdictTail?: string | undefined;
  /** Colours the accent word + the spare to the verdict's meaning (positive / warm / repair).
   *  Undefined = the calm-green positive reading the settled "you make it" state implies. */
  verdictTone?: VerdictTone | undefined;
  /** Spare (minor units) at the tightest point AFTER the change — drives the settled count-up. */
  spareMinor: number;
  /** A short note naming the change, shown beneath the figure, e.g. "after adding Tesco". The
   *  container builds this from the real change (the merchant/charge just logged). */
  changeNote: string;
  /** How much the change lowered (negative) or lifted (positive) the tightest point, minor units —
   *  the "What changed" delta. */
  changeDeltaMinor: number;
  /** A sentence stating what changed, e.g. "Tesco lowered your tightest point by £42." Built by the
   *  container from the real change so the merchant/figure are honest. */
  changeLine: string;
  /** The route points AFTER the change — the preview curve is derived from these. */
  routePoints: readonly LocalRoutePoint[];
  reduceMotion?: boolean | undefined;
  /** Back to the full Today path. */
  onBack: () => void;
  /** Open Melo. */
  onOpenMelo: () => void;
  /** Open the tight-point detail. */
  onOpenTightPoint: () => void;
};

export function TodayAfterScreen({
  verdictLead,
  verdictAccent,
  verdictTail,
  verdictTone,
  spareMinor,
  changeNote,
  changeDeltaMinor,
  changeLine,
  routePoints,
  reduceMotion,
  onBack,
  onOpenMelo,
  onOpenTightPoint,
}: TodayAfterProps) {
  const spareDisplay = useCountUp(spareMinor, SPARE_COUNT_UP_MS, reduceMotion);
  const accentColor = verdictColor(verdictTone ?? 'positive');
  const geometry = previewGeometry(routePoints);

  // The "What changed" delta reads as a signed magnitude with the accent colour (the web shows it as
  // "−£42" in terracotta). A lift is shown as a positive change in the calm green.
  const deltaTone = changeDeltaMinor > 0 ? paper.positiveInk : paper.calm;
  const deltaSign = changeDeltaMinor > 0 ? '+' : '−';
  const deltaLabel = `${deltaSign}${magnitude(changeDeltaMinor)}`;

  return (
    <View style={styles.screen}>
      {/* Top bar — back, the transient eyebrow, a round Melo button. */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityHint="Back to Today."
          accessibilityLabel="Back to Today"
          accessibilityRole="button"
          hitSlop={10}
          onPress={onBack}
          style={({ pressed: isPressed }) => (isPressed ? pressed : undefined)}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Eyebrow tone="muted">One less thing waiting</Eyebrow>
        <Pressable
          accessibilityHint="Opens Melo."
          accessibilityLabel="Melo"
          accessibilityRole="button"
          onPress={onOpenMelo}
          style={({ pressed: isPressed }) => [styles.meloButton, isPressed ? pressed : undefined]}
        >
          <MeloPresence reduceMotion={reduceMotion} size="sm" state="melo_idle" withCopy={false} />
        </Pressable>
      </View>

      {/* The settled verdict + count-up spare + the change note. */}
      <View accessibilityLiveRegion="polite" style={styles.hero}>
        <Text style={[styles.verdictLine, { color: accentColor }]}>
          {verdictLead}
          <Text style={styles.verdictAccent}>{verdictAccent}</Text>
          {verdictTail}
        </Text>
        <View style={styles.heroFigureRow}>
          <Text style={[styles.heroFigure, { color: accentColor }]}>
            £{Math.round(spareDisplay / 100).toLocaleString('en-GB')}
          </Text>
          <Text style={styles.heroSuffix}>spare</Text>
        </View>
        <Text style={styles.changeNote}>{changeNote}</Text>
      </View>

      {/* What changed — the delta, the sentence, and the small re-drawn route preview. */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardEyebrow}>What changed</Text>
          <Text style={[styles.cardDelta, { color: deltaTone }]}>{deltaLabel}</Text>
        </View>
        <Text style={styles.cardLine}>{changeLine}</Text>

        <View style={styles.cardHairline} />

        <Svg height={PLOT_H} style={styles.plot} viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} width="100%">
          <Defs>
            <LinearGradient id="afterFill" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0%" stopColor={paper.calm} stopOpacity={0.16} />
              <Stop offset="100%" stopColor={paper.calm} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={geometry.areaD} fill="url(#afterFill)" />
          <Path
            d={geometry.curveD}
            fill="none"
            stroke={paper.calm}
            strokeLinecap="round"
            strokeWidth={2.2}
          />
          <Circle cx={geometry.lowest.x} cy={geometry.lowest.y} fill={paper.calm} r={5} />
          <SvgText
            fill={paper.muted}
            fontSize={9}
            textAnchor="middle"
            x={geometry.lowest.x}
            y={geometry.lowest.y - 12}
          >
            lowest
          </SvgText>
          <Circle cx={geometry.payday.x} cy={geometry.payday.y} fill={paper.payday} r={5} />
          <SvgText
            fill={paper.muted}
            fontSize={9}
            textAnchor="end"
            x={geometry.payday.x - 2}
            y={geometry.payday.y - 12}
          >
            payday
          </SvgText>
        </Svg>
      </View>

      {/* A quiet Melo line — the reassurance. */}
      <View style={styles.meloLine}>
        <MeloPresence reduceMotion={reduceMotion} size="sm" state="melo_path_explaining" withCopy={false} />
        <Text style={styles.meloLineText}>“One less thing waiting. The path still holds.”</Text>
      </View>

      {/* Two calm doorways — back to Today, or open the tight point. */}
      <View style={styles.actions}>
        <Pressable
          accessibilityHint="Back to your path."
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed: isPressed }) => [styles.actionTile, isPressed ? pressed : undefined]}
        >
          <Text style={styles.actionLabel}>View path</Text>
          <Text style={styles.actionValue}>Today</Text>
        </Pressable>
        <Pressable
          accessibilityHint="Opens the tight point."
          accessibilityRole="button"
          onPress={onOpenTightPoint}
          style={({ pressed: isPressed }) => [styles.actionTile, isPressed ? pressed : undefined]}
        >
          <Text style={styles.actionLabel}>Tight point</Text>
          <Text style={[styles.actionValue, styles.actionValueAccent]}>open</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: gap.lg, paddingTop: gap.sm, paddingBottom: gap.xxxl },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: paper.muted, fontSize: 24, lineHeight: 24, fontWeight: '400', width: 20 },
  meloButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: paper.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },

  hero: { gap: gap.xs },
  verdictLine: { fontFamily: serif.displayItalic, fontSize: 15, lineHeight: 21 },
  verdictAccent: { fontFamily: serif.displayItalic },
  heroFigureRow: { flexDirection: 'row', alignItems: 'flex-end', gap: gap.sm, marginTop: gap.xs },
  heroFigure: {
    fontFamily: serif.display,
    fontSize: 60,
    lineHeight: 62,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  heroSuffix: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 18,
    marginBottom: 6,
  },
  changeNote: { color: paper.muted, fontFamily: serif.displayItalic, fontSize: 12.5, marginTop: 2 },

  card: {
    backgroundColor: paper.surface,
    borderRadius: radius.xl,
    padding: gap.xl,
    ...elevation.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: gap.sm,
  },
  cardEyebrow: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  cardDelta: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cardLine: { color: paper.ink, fontSize: 13.5, lineHeight: 20 },
  cardHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.hairline,
    marginTop: gap.lg,
  },
  plot: { marginTop: gap.sm },

  meloLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: gap.md,
    backgroundColor: paper.inset,
    borderRadius: radius.md,
    padding: gap.lg,
  },
  meloLineText: {
    flex: 1,
    color: paper.ink,
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 19,
  },

  actions: { flexDirection: 'row', gap: gap.sm },
  actionTile: {
    flex: 1,
    backgroundColor: paper.surface,
    borderRadius: radius.md,
    padding: gap.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairline,
  },
  actionLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  actionValue: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 16,
    marginTop: gap.xs,
  },
  actionValueAccent: { color: paper.calm },
});
