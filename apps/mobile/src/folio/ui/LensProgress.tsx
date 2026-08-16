// LensProgress — the faithful 1:1 RN port of the web
// (folio-melo/.claude/worktrees/design-main/src/components/folio/charts/LensProgress.tsx).
//
// @rn-component LensProgress
// @purpose      One primitive for "progress toward a target" across every lens that has one
//               (Growth, Debt, Planning). Reads the user's chartStyle so the visual grammar
//               matches the money-path chart on Today.
// @copy         Caller supplies labels — nothing baked in here.
// @tokens       accent (calm) · positive · caution · ink · muted-ink (muted) · inset · hairline ·
//               tabular via accessibilityLabel only (no visible numerals drawn here)
//
// RN mapping: the web draws one inline <svg> with three style branches (curve/bars/minimal). This
// port mirrors the same viewBox (320x44), same three branches, same geometry math, via
// react-native-svg. No CSS var strings — every colour comes from the active palette (useTheme),
// with `tone` still overridable by the caller (now a palette key rather than a CSS var name).

import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { useTheme } from '@/folio/theme';

const WIDTH = 320;
const HEIGHT = 44;
const PAD = 12;
const DEFAULT_SEGMENTS = 12;

export type LensProgressChartStyle = 'curve' | 'bars' | 'minimal';

export type LensProgressProps = {
  value: number;
  target: number;
  style: LensProgressChartStyle;
  /** Palette colour for the filled tone. Defaults to the calm (accent) colour. */
  tone?: string | undefined;
  /** Segment count for the `bars` style. Default 12. */
  segments?: number | undefined;
};

export function LensProgress({
  value,
  target,
  style,
  tone,
  segments = DEFAULT_SEGMENTS,
}: LensProgressProps) {
  const t = useTheme();
  const fillTone = tone ?? t.calm;
  const pct = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  const inner = WIDTH - PAD * 2;
  const cx = PAD + pct * inner;
  const label = `progress ${Math.round(pct * 100)} percent`;

  return (
    <Svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {style === 'curve' ? (
        <>
          <Line
            x1={PAD}
            x2={WIDTH - PAD}
            y1={HEIGHT / 2}
            y2={HEIGHT / 2}
            stroke={t.hairline}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Line
            x1={PAD}
            x2={cx}
            y1={HEIGHT / 2}
            y2={HEIGHT / 2}
            stroke={fillTone}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Circle cx={cx} cy={HEIGHT / 2} r={5} fill={fillTone} />
          <Circle
            cx={WIDTH - PAD}
            cy={HEIGHT / 2}
            r={5}
            fill="none"
            stroke={t.muted}
            strokeWidth={1}
            opacity={0.5}
          />
        </>
      ) : null}

      {style === 'bars' ? (
        <>
          {Array.from({ length: segments }).map((_, i) => {
            const filled = i / segments < pct;
            const x = PAD + (i / segments) * inner;
            const barW = inner / segments - 2;
            const opacity = filled ? 0.55 + (i / segments) * 0.45 : 1;
            return (
              <Rect
                key={i}
                x={x}
                y={HEIGHT / 2 - 8}
                width={barW}
                height={16}
                rx={2}
                fill={filled ? fillTone : t.inset}
                opacity={opacity}
              />
            );
          })}
        </>
      ) : null}

      {style === 'minimal' ? (
        <>
          <Line
            x1={PAD}
            x2={WIDTH - PAD}
            y1={HEIGHT / 2}
            y2={HEIGHT / 2}
            stroke={t.hairline}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <Circle cx={PAD} cy={HEIGHT / 2} r={2.5} fill={t.muted} />
          <Circle
            cx={WIDTH - PAD}
            cy={HEIGHT / 2}
            r={4}
            fill="none"
            stroke={t.muted}
            strokeWidth={1}
          />
          <Circle cx={cx} cy={HEIGHT / 2} r={4} fill={fillTone} />
        </>
      ) : null}
    </Svg>
  );
}
