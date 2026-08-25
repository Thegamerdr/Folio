/** Melo's signature money journey, ported from the pinned design source. */
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

import { useTheme } from '@/folio/theme';
import type { ChartStyle } from '@/folio/lib/chartStyle';
import type { Pressure } from '@/folio/types';

export type MoneyPathPoint = { x: number; y: number; label: string; value: string };
export type MoneyPathEvent = { x: number; label: string; amount: number };

export type MoneyPathChartProps = {
  points: readonly MoneyPathPoint[];
  events?: readonly MoneyPathEvent[];
  style: ChartStyle;
  pressure: Pressure;
  scrub?: number | undefined;
  focusX?: number | null | undefined;
  focusLabel?: string | null | undefined;
  onTightTap?: (() => void) | undefined;
};

const W = 400;
const PAD_X = 30;
const RIGHT = 370;
const BASELINE = 214;

function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function yAt(points: readonly { x: number; y: number }[], x: number): number {
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    if (x >= a.x && x <= b.x) {
      const fraction = (x - a.x) / Math.max(1, b.x - a.x);
      return a.y + (b.y - a.y) * fraction;
    }
  }
  return points.at(-1)?.y ?? BASELINE;
}

export function MoneyPathChart({
  points,
  events = [],
  style,
  pressure,
  scrub = 0,
  focusX,
  focusLabel,
  onTightTap,
}: MoneyPathChartProps) {
  const t = useTheme();
  if (points.length === 0) return null;

  const d = smoothPath(points);
  const areaD = `${d} L ${RIGHT} ${BASELINE} L ${PAD_X} ${BASELINE} Z`;
  const endStop = pressure === 'overspent' ? t.repair : t.positive;
  const strokeWidth = style === 'minimal' ? 1.6 : 2.6;
  const first = points[0]!;
  const last = points.at(-1)!;
  const tight = points.reduce((lowest, point) => (point.y > lowest.y ? point : lowest), first);
  const ghost =
    scrub > 0.02
      ? smoothPath(
          points.map((point, index) => ({
            x: point.x,
            y: index === 0 ? point.y : point.y + scrub * 26,
          })),
        )
      : null;
  const namedEvents = new Set(
    [...events]
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 3)
      .map((event) => event.x),
  );

  return (
    <Svg
      viewBox="0 36 400 204"
      width="100%"
      height={184}
      accessibilityRole="image"
      accessibilityLabel={`Money path: ${first.value} today, tight point ${tight.value} on ${tight.label}, ${last.value} by ${last.label}.`}
    >
      <Defs>
        <LinearGradient id="mpcStroke" x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0%" stopColor={t.ink} />
          <Stop offset={`${60 - scrub * 30}%`} stopColor={t.calm} />
          <Stop offset="100%" stopColor={endStop} />
        </LinearGradient>
        <LinearGradient id="mpcFill" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0%" stopColor={t.calm} stopOpacity={0.16} />
          <Stop offset="100%" stopColor={t.calm} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      <Line x1={PAD_X - 8} x2={RIGHT + 8} y1={BASELINE} y2={BASELINE} stroke={t.hairline} />
      {style === 'bars'
        ? [0.25, 0.5, 0.75].map((fraction) => {
            const x = PAD_X + (RIGHT - PAD_X) * fraction;
            return (
              <Line
                key={`tick-${fraction}`}
                x1={x}
                x2={x}
                y1={yAt(points, x) + 6}
                y2={BASELINE}
                stroke={t.hairline}
                opacity={0.8}
              />
            );
          })
        : null}
      {style !== 'minimal' ? <Path d={areaD} fill="url(#mpcFill)" /> : null}
      {ghost ? (
        <Path
          d={ghost}
          fill="none"
          stroke={t.calm}
          strokeWidth={1.4}
          strokeDasharray="3 4"
          opacity={0.45}
        />
      ) : null}
      <Path
        d={d}
        fill="none"
        stroke="url(#mpcStroke)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 1 ? (
        <Line
          x1={first.x}
          y1={first.y}
          x2={first.x + (points[1]!.x - first.x) * 0.1}
          y2={first.y + (points[1]!.y - first.y) * 0.1}
          stroke={t.ink}
          strokeWidth={strokeWidth + 0.6}
          strokeLinecap="round"
        />
      ) : null}

      {style !== 'minimal'
        ? events.map((event, index) => {
            const y = yAt(points, event.x);
            const outgoing = event.amount < 0;
            const ink = outgoing ? t.muted : t.positive;
            const showLabel = namedEvents.has(event.x);
            return (
              <G key={`event-${index}`}>
                <Line
                  x1={event.x}
                  x2={event.x}
                  y1={y}
                  y2={y + (outgoing ? 10 : -10)}
                  stroke={ink}
                  opacity={showLabel ? 0.85 : 0.4}
                  strokeLinecap="round"
                />
                <Circle
                  cx={event.x}
                  cy={y}
                  r={showLabel ? 2.2 : 1.5}
                  fill={t.canvas}
                  stroke={ink}
                  strokeWidth={1.1}
                  opacity={showLabel ? 1 : 0.55}
                />
                {showLabel ? (
                  <SvgText
                    x={event.x}
                    y={y + (outgoing ? 21 : -16)}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight="500"
                    letterSpacing={0.3}
                    fill={t.muted}
                  >
                    {event.label}
                  </SvgText>
                ) : null}
              </G>
            );
          })
        : null}

      {points.map((point, index) => {
        const isToday = index === 0;
        const isPayday = index === points.length - 1;
        const isLow = point === tight && !isToday && !isPayday;
        const anchor = isToday ? 'start' : isPayday ? 'end' : 'middle';
        const dx = isToday ? -2 : isPayday ? 2 : 0;
        return (
          <G key={`station-${index}`} onPress={isLow ? onTightTap : undefined}>
            <Line
              x1={point.x}
              x2={point.x}
              y1={point.y + 6}
              y2={BASELINE}
              stroke={isLow ? t.calm : t.hairline}
              opacity={isLow ? 0.35 : 1}
            />
            {isLow ? <Circle cx={point.x} cy={point.y} r={11} fill={t.calm} opacity={0.12} /> : null}
            {isPayday ? (
              <>
                <Circle cx={point.x} cy={point.y} r={6} fill={t.canvas} stroke={t.ink} strokeWidth={1.4} />
                <Circle cx={point.x} cy={point.y} r={2.2} fill={t.ink} />
              </>
            ) : (
              <Circle
                cx={point.x}
                cy={point.y}
                r={isLow ? 4.6 : 4}
                fill={isLow ? t.calm : t.ink}
                stroke={t.canvas}
                strokeWidth={isLow ? 1.5 : 0}
              />
            )}
            <SvgText
              x={point.x + dx}
              y={point.y - (isLow ? 15 : 13)}
              textAnchor={anchor}
              fontSize={isLow ? 13 : 11}
              fontWeight={isLow ? '700' : '600'}
              fill={isLow ? t.calm : t.ink}
            >
              {point.value}
            </SvgText>
            <SvgText
              x={point.x + dx}
              y={BASELINE + 15}
              textAnchor={anchor}
              fontSize={8.5}
              fontWeight={isLow ? '700' : '500'}
              fill={isLow ? t.calm : t.muted}
              letterSpacing={0.9}
            >
              {point.label.toUpperCase()}
            </SvgText>
          </G>
        );
      })}

      {focusX != null ? (
        <G>
          <Line x1={focusX} x2={focusX} y1={62} y2={BASELINE} stroke={t.calm} strokeDasharray="3 3" opacity={0.7} />
          <Circle cx={focusX} cy={62} r={9} fill="none" stroke={t.calm} />
          <Rect
            x={Math.max(4, Math.min(W - 100, focusX - 48))}
            y={40}
            width={96}
            height={18}
            rx={6}
            fill={t.canvas}
            stroke={t.calm}
            strokeWidth={0.8}
          />
          <SvgText
            x={Math.max(52, Math.min(W - 52, focusX))}
            y={52}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight="600"
            fill={t.ink}
          >
            from Calendar · {focusLabel}
          </SvgText>
        </G>
      ) : null}
    </Svg>
  );
}
