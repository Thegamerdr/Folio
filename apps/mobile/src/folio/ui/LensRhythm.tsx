// LensRhythm — the faithful 1:1 RN port of the web
// (folio-melo/.claude/worktrees/design-main/src/components/folio/charts/LensRhythm.tsx).
//
// @rn-component LensRhythm
// @purpose      One primitive for "segmented rhythm" across every lens that renders a bounded
//               horizon of buckets — Stability's 4-week bill rhythm, Irregular's 12-week runway.
//               Reads the user's chartStyle so it shares visual grammar with the money-path chart
//               and LensProgress.
// @copy         Caller supplies segment labels — nothing baked in here.
// @tokens       accent (calm) · caution · ink · muted-ink (muted) · inset · hairline · tabular
//
// RN mapping: same viewBox math as the web (320x68), same three style branches, via
// react-native-svg <Path>/<Rect>/<Circle>/<Line>/<Text>. Segment labels render as SvgText at the
// kit's tabular numeral discipline is not needed here (labels are short strings, e.g. "W1").

import { Fragment } from 'react';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/folio/theme';

export type LensRhythmChartStyle = 'curve' | 'bars' | 'minimal';

export type RhythmSegment = { label: string; value: number };

export type LensRhythmProps = {
  segments: RhythmSegment[];
  style: LensRhythmChartStyle;
  /** Palette colour for the non-peak fill. Defaults to the muted-ink colour. */
  tone?: string | undefined;
  /** If true, the max-value segment gets an accent tint. */
  peakAccent?: boolean | undefined;
};

const HEIGHT = 68;
const TOP = 6;
const BOTTOM = 48;
const PAD_X = 4;
const WIDTH = 320;

export function LensRhythm({ segments, style, tone, peakAccent = true }: LensRhythmProps) {
  const t = useTheme();
  const baseTone = tone ?? t.muted;
  const max = Math.max(1, ...segments.map((s) => s.value));
  const n = segments.length;
  const inner = WIDTH - PAD_X * 2;
  const step = n > 0 ? inner / n : inner;
  const peakIndex =
    n > 0 ? segments.reduce((best, s, i, arr) => (s.value > arr[best]!.value ? i : best), 0) : 0;

  const points = segments.map((s, i) => {
    const cx = PAD_X + step * (i + 0.5);
    const barH = s.value === 0 ? 4 : Math.max(6, Math.round((s.value / max) * (BOTTOM - TOP)));
    return { cx, barH, value: s.value, label: s.label, isPeak: i === peakIndex && s.value > 0 };
  });

  const curvePath =
    points.length > 0 ? `M ${points.map((p) => `${p.cx} ${BOTTOM - p.barH}`).join(' L ')}` : '';
  const areaPath =
    points.length > 0
      ? `M ${points[0]!.cx} ${BOTTOM} L ${points
          .map((p) => `${p.cx} ${BOTTOM - p.barH}`)
          .join(' L ')} L ${points[n - 1]!.cx} ${BOTTOM} Z`
      : '';

  const label = `rhythm across ${n} segments`;

  return (
    <Svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {style === 'curve' && points.length > 0 ? (
        <>
          <Path
            d={curvePath}
            fill="none"
            stroke={baseTone}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.75}
          />
          <Path d={areaPath} fill={baseTone} opacity={0.14} />
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={p.cx}
              cy={BOTTOM - p.barH}
              r={p.isPeak && peakAccent ? 4 : 2.5}
              fill={p.isPeak && peakAccent ? t.calm : baseTone}
            />
          ))}
        </>
      ) : null}

      {style === 'bars' ? (
        <>
          {points.map((p, i) => {
            const barW = Math.max(6, step - 6);
            const color = p.isPeak && peakAccent ? t.calm : baseTone;
            const opacity = p.value === 0 ? 0.18 : p.isPeak && peakAccent ? 0.85 : 0.55;
            return (
              <Rect
                key={i}
                x={p.cx - barW / 2}
                y={BOTTOM - p.barH}
                width={barW}
                height={p.barH}
                rx={2}
                fill={color}
                opacity={opacity}
              />
            );
          })}
        </>
      ) : null}

      {style === 'minimal' ? (
        <>
          <Line
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={BOTTOM}
            y2={BOTTOM}
            stroke={t.hairline}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          {points.map((p, i) => {
            const lineColor = p.isPeak && peakAccent ? t.calm : t.muted;
            return (
              <Fragment key={i}>
                <Line
                  x1={p.cx}
                  x2={p.cx}
                  y1={BOTTOM}
                  y2={BOTTOM - p.barH}
                  stroke={lineColor}
                  strokeWidth={1}
                  opacity={p.value === 0 ? 0.25 : 0.6}
                />
                <Circle
                  cx={p.cx}
                  cy={BOTTOM - p.barH}
                  r={p.isPeak && peakAccent ? 3 : 2}
                  fill={lineColor}
                />
              </Fragment>
            );
          })}
        </>
      ) : null}

      {/* Segment labels — same across every style. */}
      {points.map((p, i) => (
        <SvgText
          key={`l-${i}`}
          x={p.cx}
          y={HEIGHT - 2}
          textAnchor="middle"
          fontSize={7.5}
          fill={t.muted}
        >
          {p.label}
        </SvgText>
      ))}
    </Svg>
  );
}
