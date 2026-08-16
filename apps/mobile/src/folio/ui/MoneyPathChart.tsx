// MoneyPathChart — the faithful 1:1 RN port of the web
// (folio-melo/.claude/worktrees/design-main/src/components/folio/charts/MoneyPathChart.tsx).
//
// @rn-component MoneyPathChart
// @purpose      One primitive for the money-path visual on Today. Renders the same underlying
//               points in one of three styles picked by the user in More → Chart style. Cohesion
//               across lenses without flattening lens-specific extras (goal-pace bars, household
//               split, leak lists live in their own components).
// @copy         Labels come from callers; nothing baked in here.
// @tokens       canvas · ink · calm (accent) · positive · repair (negative) · hairline · inset ·
//               muted (muted-ink) · tabular via Text fontVariant
//
// RN mapping: the web draws one inline <svg> with three style branches (curve/bars/minimal). This
// port mirrors the same 400x240 viewBox, the same three branches, and the same point-marker /
// scrub-thumb / focus-callout geometry, via react-native-svg. No CSS var strings — every colour
// comes from the active palette (useTheme).
//
// Built for PARITY_GAPS.md Group 1 (ChartStyleSheet needs a real MoneyPathChart primitive to
// preview against). TodayScreen keeps its own bespoke SVG hero (route-draw animation, live scrub
// PanResponder, Reanimated pulse/callout) rather than being rewired onto this primitive — this
// component exists so the chart-style PICKER can show each style rendered for real, matching the
// web SheetChartStyle's use of the same MoneyPathChart it also renders live on Today.

import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { useTheme, type Palette } from '@/folio/theme';
import type { ChartStyle } from '@/folio/lib/chartStyle';
import type { Pressure } from '@/folio/types';

export type MoneyPathPoint = {
  x: number; // 0..400 viewBox
  y: number; // 0..240 viewBox
  label: string;
  value: string;
};

export type MoneyPathChartProps = {
  points: readonly MoneyPathPoint[];
  style: ChartStyle;
  pressure: Pressure;
  /** 0..1 scrub position — only used by the `curve` style. */
  scrub?: number | undefined;
  focusX?: number | null | undefined;
  focusLabel?: string | null | undefined;
};

const W = 400;
const H = 240;
const PAD_X = 30;
const RIGHT = 370;
const BASELINE = 220;

export function MoneyPathChart({
  points,
  style,
  pressure,
  scrub = 0,
  focusX,
  focusLabel,
}: MoneyPathChartProps) {
  const t = useTheme();
  if (points.length === 0) return null;

  const d = `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
  const areaD = `${d} L ${RIGHT} ${BASELINE} L ${PAD_X} ${BASELINE} Z`;
  const endStop = pressure === 'overspent' ? t.repair : t.positive;
  const last = points[points.length - 1]!;
  const first = points[0]!;

  return (
    <Svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={180}
      accessibilityRole="image"
      accessibilityLabel="Money path from today to payday"
    >
      <Defs>
        <LinearGradient id="mpcStroke" x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0%" stopColor={t.ink} />
          <Stop offset={`${60 - scrub * 30}%`} stopColor={t.calm} />
          <Stop offset="100%" stopColor={endStop} />
        </LinearGradient>
        <LinearGradient id="mpcFill" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0%" stopColor={t.calm} stopOpacity={0.14} />
          <Stop offset="100%" stopColor={t.calm} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Gridlines — same across all styles so the eye reads the same floor. */}
      {[80, 130, 180].map((y) => (
        <Line key={y} x1={20} x2={380} y1={y} y2={y} stroke={t.hairline} strokeWidth={1} />
      ))}

      {style === 'curve' ? (
        <>
          <Path
            d={`${d} L ${RIGHT} ${last.y + 14} L ${PAD_X} ${first.y + 14} Z`}
            fill={t.inset}
            opacity={0.55}
          />
          <Path d={areaD} fill="url(#mpcFill)" />
          <Path
            d={d}
            fill="none"
            stroke="url(#mpcStroke)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}

      {style === 'bars' ? (
        <G>
          {points.map((p, i) => {
            const barW = 26;
            const barH = Math.max(6, BASELINE - p.y);
            const isLow = i === points.length - 2;
            const color = isLow ? t.calm : t.ink;
            const opacity = isLow ? 0.85 : 0.55;
            return (
              <Rect
                key={`bar-${i}`}
                x={p.x - barW / 2}
                y={p.y}
                width={barW}
                height={barH}
                rx={3}
                fill={color}
                opacity={opacity}
              />
            );
          })}
        </G>
      ) : null}

      {style === 'minimal' ? (
        <G>
          <Line
            x1={PAD_X}
            x2={RIGHT}
            y1={150}
            y2={150}
            stroke={t.hairline}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          <Path
            d={d}
            fill="none"
            stroke={t.muted}
            strokeWidth={1}
            strokeDasharray="2 4"
            opacity={0.5}
          />
        </G>
      ) : null}

      {/* Point markers + labels — shared across styles so the story reads the same. Today
          (filled), lowest (accent ring), payday (open). */}
      {points.map((p, i) => {
        const isToday = i === 0;
        const isLow = i === points.length - 2;
        const isPayday = i === points.length - 1;
        const above = p.y - 12;
        return (
          <G key={`pt-${i}`}>
            {isLow ? (
              <>
                <Circle cx={p.x} cy={p.y} r={16} fill={t.calm} opacity={0.1} />
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={10}
                  fill="none"
                  stroke={t.calm}
                  strokeWidth={1}
                  opacity={0.5}
                />
              </>
            ) : null}
            {isPayday ? (
              <Circle cx={p.x} cy={p.y} r={5} fill={t.canvas} stroke={t.ink} strokeWidth={1.4} />
            ) : (
              <Circle
                cx={p.x}
                cy={p.y}
                r={isLow ? 5 : isToday ? 4 : 3}
                fill={isLow ? t.calm : t.ink}
                {...(isLow ? { stroke: t.canvas, strokeWidth: 1.5 } : { strokeWidth: 0 })}
              />
            )}
            {isLow ? (
              <>
                <Rect x={p.x - 20} y={above - 8} width={40} height={12} rx={6} fill={t.calm} />
                <SvgText
                  x={p.x}
                  y={above + 1}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight="700"
                  fill={t.canvas}
                  letterSpacing={0.4}
                >
                  {`TIGHT · ${p.label}`}
                </SvgText>
                <SvgText
                  x={p.x}
                  y={above - 14}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="700"
                  fill={t.calm}
                >
                  {p.value}
                </SvgText>
              </>
            ) : (
              <>
                <SvgText
                  x={p.x}
                  y={above}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight="500"
                  fill={t.muted}
                >
                  {p.label}
                </SvgText>
                <SvgText
                  x={p.x}
                  y={above - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="600"
                  fill={t.ink}
                >
                  {p.value}
                </SvgText>
              </>
            )}
          </G>
        );
      })}

      {style === 'curve' ? (
        <G transform={`translate(${30 + scrub * 340}, 30)`}>
          <Line
            x1={0}
            x2={0}
            y1={0}
            y2={200}
            stroke={t.calm}
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.6}
          />
          <Circle cx={0} cy={0} r={4} fill={t.calm} />
        </G>
      ) : null}

      {focusX != null ? (
        <G>
          <Line
            x1={focusX}
            x2={focusX}
            y1={30}
            y2={220}
            stroke={t.calm}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.7}
          />
          <Circle cx={focusX} cy={30} r={9} fill="none" stroke={t.calm} strokeWidth={1} />
          <Rect
            x={focusX - 48}
            y={10}
            width={96}
            height={18}
            rx={6}
            fill={t.canvas}
            stroke={t.calm}
            strokeWidth={0.8}
          />
          <SvgText
            x={focusX}
            y={22}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight="600"
            fill={t.ink}
          >
            {`from Calendar · ${focusLabel}`}
          </SvgText>
        </G>
      ) : null}
    </Svg>
  );
}

// Keep the Palette type import used (avoids an unused-import lint if a caller wants it re-exported
// from here too).
export type { Palette };
