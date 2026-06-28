// Insights — the shape of your months (Quiet Paper Luxury).
//
// Faithful RN port of the web ScreenInsights (src/components/folio/screens/ScreenInsights.tsx):
// a "{n} cycles closed" kicker over the serif headline "The shape of your months." (one terracotta
// accent word — "shape"), a 2-col KPI grid (saved across cycles / in pots now / avg tight point /
// avg set aside), a tight-point trend bar chart (<=6 bars, newest on the right, terracotta/70 fill),
// a "Notes from past you" list, an optional Melo line about paused subs, and a single "Share this
// cycle" action.
//
// Presentation only — it never touches the engine. The container builds the LocalInsightsModel (via
// buildLocalInsightsModel) and passes it in, along with the optional per-cycle notes and the
// onShareCycle callback. Money is pre-formatted in the model (minor units -> formatMinorAmount), so
// the screen never re-derives currency. The bar chart is drawn with react-native-svg, mirroring the
// web's flex-of-bars exactly: a label above each bar, the terracotta bar, a 3-char month below.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { gap, Headline, paper, PressureScreen, PrimaryAction, Surface } from './kit';
import { Kicker, MeloLine, ScreenHeader, SectionLabel } from './secondaryKit';
import type {
  LocalInsightsModel,
  LocalInsightsTrendPoint,
} from '../../local/localInsightsAdapter';

// One row in "Notes from past you". The engine's LocalInsightsModel carries only the trend (label +
// tight point), so the per-cycle spare + reflection note live on this lightweight shape the
// container supplies from the same closed cycles. Faithful to the web, which lists the latest 4
// closed cycles with "spare £X" and the optional saved note.
export type InsightsNote = Readonly<{
  // A stable key per cycle (the web keys on closedAt) — the cycle's closedAt timestamp is ideal.
  id: string;
  // The cycle label, e.g. "June".
  label: string;
  // Pre-formatted spare for this cycle, e.g. "£120" (container formats via formatMinorAmount).
  spare: string;
  // The reflection the user left when closing the cycle, if any.
  note?: string | undefined;
}>;

// ---------------------------------------------------------------------------
// Tight-point trend chart
// ---------------------------------------------------------------------------

// The web caps the chart at the last 6 cycles and draws each bar's height as a fraction of the
// tallest tight point (min 8px, max 78px in an 88px-tall row). We reproduce that exactly: the model
// already trims the trend to <=6 newest-last, so the SVG renders it left -> right with the newest on
// the right. Each bar carries the formatted tight point above and a 3-char month label below.
const CHART_HEIGHT = 78; // tallest bar
const BAR_MIN_HEIGHT = 8; // a zero/near-zero tight point still shows a sliver
const BAR_RADIUS = 6; // rounded top (web rounded-t-md)
const ACCENT_70 = 'rgba(224, 99, 58, 0.7)'; // paper.calm (#E0633A) at 70% — web bg-accent/70

function TrendChart({ trend }: { trend: readonly LocalInsightsTrendPoint[] }) {
  const maxTight = Math.max(...trend.map((point) => point.tightPointMinor), 1);

  return (
    <View style={styles.chartRow}>
      {trend.map((point, index) => {
        const height = Math.max(
          BAR_MIN_HEIGHT,
          Math.round((point.tightPointMinor / maxTight) * CHART_HEIGHT),
        );
        return (
          <View key={`${point.label}-${index}`} style={styles.chartCol}>
            <Text style={styles.chartValue}>{point.tightPoint}</Text>
            <Svg width="100%" height={height}>
              <Rect
                x="0"
                y="0"
                width="100%"
                height={height}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                fill={ACCENT_70}
              />
            </Svg>
            <Text style={styles.chartLabel} numberOfLines={1}>
              {point.label.slice(0, 3)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------

type KpiTone = 'ink' | 'positive' | 'accent';

function kpiColor(tone: KpiTone): string {
  if (tone === 'positive') return paper.positiveInk;
  if (tone === 'accent') return paper.calm;
  return paper.ink;
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone: KpiTone }) {
  return (
    <Surface style={styles.kpiTile}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color: kpiColor(tone) }]}>{value}</Text>
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function InsightsScreen({
  insights,
  notes = [],
  pausedCount = 0,
  onBack,
  onShareCycle,
}: {
  // The view-model the container builds via buildLocalInsightsModel(ledger).
  insights: LocalInsightsModel;
  // Per-cycle reflections for "Notes from past you" (latest first). The container derives these from
  // the same closed cycles; defaults to none so the section simply hides before any cycle closes.
  notes?: readonly InsightsNote[] | undefined;
  // Paused-subscription count, for the quiet Melo line. From LocalSubscriptionsModel.pausedCount;
  // omit/0 to hide the line. Faithful to the web, which surfaces "{n} subs paused" from subPaused.
  pausedCount?: number | undefined;
  onBack: () => void;
  // Opens the share sheet for the current cycle. Wired by the container (web: nav.openSheet('share')).
  onShareCycle: () => void;
}) {
  const { kpis, trend, cycleCount } = insights;
  // Web caps the notes list at the latest 4 closed cycles.
  const noteRows = notes.slice(0, 4);

  return (
    <PressureScreen>
      <ScreenHeader label="Insights" onBack={onBack} />

      <View style={{ gap: gap.xs }}>
        <Kicker>
          {cycleCount} {cycleCount === 1 ? 'cycle' : 'cycles'} closed
        </Kicker>
        <Headline lead="The " accent="shape" tail=" of your months." />
      </View>

      <View style={styles.kpiGrid}>
        <KpiTile label="Saved across all cycles" value={kpis.savedAcrossCycles} tone="positive" />
        <KpiTile label="In pots right now" value={kpis.inPotsNow} tone="ink" />
        <KpiTile label="Avg tight point" value={kpis.avgTightPoint} tone="accent" />
        <KpiTile label="Avg set aside" value={kpis.avgSetAside} tone="ink" />
      </View>

      {trend.length > 0 ? (
        <Surface style={styles.chartCard}>
          <SectionLabel>Tight point, last {trend.length}</SectionLabel>
          <TrendChart trend={trend} />
        </Surface>
      ) : null}

      {noteRows.length > 0 ? (
        <View>
          <SectionLabel>Notes from past you</SectionLabel>
          <View style={styles.notesCard}>
            {noteRows.map((row, index) => (
              <View key={row.id} style={[styles.noteRow, index === 0 ? styles.noteRowFirst : undefined]}>
                <View style={styles.noteHead}>
                  <Text style={styles.noteLabel}>{row.label}</Text>
                  <Text style={styles.noteSpare}>spare {row.spare}</Text>
                </View>
                {row.note ? <Text style={styles.noteBody}>{`“${row.note}”`}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {pausedCount > 0 ? (
        <MeloLine
          tone="soft"
          text={`${pausedCount} ${
            pausedCount === 1 ? 'sub' : 'subs'
          } paused — quietly working in your favour.`}
        />
      ) : null}

      <PrimaryAction
        label="Share this cycle"
        tone="ink"
        accessibilityHint="Opens the share sheet for this cycle."
        onPress={onShareCycle}
      />
    </PressureScreen>
  );
}

const styles = StyleSheet.create({
  // KPI grid — 2 columns, calm gutters. The Surface tiles carry the soft lift from the kit.
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gap.sm,
  },
  kpiTile: {
    // Two per row: half the width minus half the gutter.
    flexBasis: '47%',
    flexGrow: 1,
    padding: gap.lg,
    gap: 6,
  },
  kpiLabel: {
    color: paper.muted,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 26,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },

  // Trend chart card.
  chartCard: { gap: gap.md },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: gap.md,
    height: 88,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  chartValue: {
    color: paper.muted,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  chartLabel: {
    color: paper.muted,
    fontSize: 10,
  },

  // Notes list.
  notesCard: {
    backgroundColor: paper.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairlineStrong,
    overflow: 'hidden',
  },
  noteRow: {
    paddingVertical: 14,
    paddingHorizontal: gap.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.hairline,
  },
  noteRowFirst: { borderTopWidth: 0 },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  noteLabel: {
    color: paper.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  noteSpare: {
    color: paper.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  noteBody: {
    color: paper.muted,
    fontFamily: 'Fraunces_500Medium_Italic',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
});
