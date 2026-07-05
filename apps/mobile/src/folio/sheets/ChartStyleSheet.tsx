// ChartStyleSheet — the faithful 1:1 RN port of the web
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetChartStyle.tsx).
//
// @rn-sheet     ChartStyleSheet
// @purpose      Live picker for the money-path rendering. Three cards, each showing the real
//               MoneyPathChart rendered at the actual style, so the user picks against what
//               they'll see, not against a label. Wires the dead `chart-style` SheetId — see
//               PARITY_GAPS.md Group 1 (the FolioShell stub title existed with no sheet file).
// @reads        chartStyle (via useChartStyle)
// @writes       set (via useChartStyle().set)
// @copy         FROZEN — verbatim from the web source.
// @tokens       canvas · surface · inset · ink · calm (accent) · calmSoft · hairline · muted ·
//               Fraunces headlines

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, pressed, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import {
  CHART_STYLES,
  CHART_STYLE_HINT,
  CHART_STYLE_LABEL,
  useChartStyle,
  type ChartStyle,
} from '@/folio/lib/chartStyle';
import { MoneyPathChart, type MoneyPathPoint } from '@/folio/ui/MoneyPathChart';

// A calm sample money-path so every preview shows the same story — the only thing changing
// between cards is the rendering. Ported verbatim from the web's SAMPLE_POINTS.
const SAMPLE_POINTS: MoneyPathPoint[] = [
  { x: 30, y: 140, label: 'today', value: '£1,240' },
  { x: 95, y: 110, label: '', value: '' },
  { x: 165, y: 95, label: '', value: '' },
  { x: 235, y: 175, label: '', value: '' },
  { x: 305, y: 195, label: 'lowest', value: '£340' },
  { x: 370, y: 150, label: 'payday', value: '+£2,180' },
];

export type ChartStyleSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function ChartStyleSheet({ visible, onClose }: ChartStyleSheetProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const { style: current, set } = useChartStyle();

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <Text style={s.headline} accessibilityRole="header">
          Pick a <Text style={s.headlineAccent}>shape</Text>.
        </Text>
        <Text style={s.subline}>
          Applies to the money path on Today and every progress glyph across your lenses.
        </Text>

        <View style={s.list}>
          {CHART_STYLES.map((style: ChartStyle) => {
            const isActive = style === current;
            return (
              <Pressable
                key={style}
                accessibilityRole="button"
                accessibilityLabel={`${CHART_STYLE_LABEL[style]} — ${CHART_STYLE_HINT[style]}${
                  isActive ? ' (current)' : ''
                }`}
                onPress={() => {
                  set(style);
                  onClose();
                }}
                style={({ pressed: isPressed }) => [
                  s.card,
                  isActive ? s.cardActive : s.cardInactive,
                  isPressed ? pressed : undefined,
                ]}
              >
                <View style={s.cardHead}>
                  <View style={s.cardHeadText}>
                    <Text style={s.cardLabel}>{CHART_STYLE_LABEL[style]}</Text>
                    <Text style={s.cardHint}>{CHART_STYLE_HINT[style]}</Text>
                  </View>
                  {isActive ? <Text style={s.currentTag}>Current</Text> : null}
                </View>
                <View style={s.preview}>
                  <MoneyPathChart points={SAMPLE_POINTS} style={style} pressure="soft" />
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.footnote}>
          Lens-specific extras (household split, leak list, days-held) stay as they are — they show
          different data, not the same shape in a different skin.
        </Text>
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: {
      paddingHorizontal: gap.xs,
      paddingTop: gap.sm,
      paddingBottom: gap.lg,
    },
    headline: {
      fontFamily: serif.display,
      fontSize: 22,
      lineHeight: 27,
      color: t.ink,
    },
    headlineAccent: {
      color: t.calm,
    },
    subline: {
      marginTop: 4,
      fontSize: 12,
      color: t.muted,
    },
    list: {
      marginTop: gap.lg,
      gap: gap.md,
    },
    card: {
      width: '100%',
      borderRadius: radius.lg,
      padding: gap.md,
      gap: gap.sm,
      borderWidth: StyleSheet.hairlineWidth,
    },
    cardActive: {
      backgroundColor: t.calmSoft,
      borderColor: t.calm,
    },
    cardInactive: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    cardHeadText: { flex: 1, paddingRight: gap.sm },
    cardLabel: {
      fontSize: 13.5,
      fontWeight: '500',
      color: t.ink,
    },
    cardHint: {
      marginTop: 2,
      fontSize: 11.5,
      fontStyle: 'italic',
      color: t.muted,
    },
    currentTag: {
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: t.calm,
    },
    preview: {
      borderRadius: radius.md,
      backgroundColor: t.canvas,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      padding: gap.sm,
    },
    footnote: {
      marginTop: gap.lg,
      fontSize: 10.5,
      fontStyle: 'italic',
      textAlign: 'center',
      color: t.muted,
    },
  });
}
