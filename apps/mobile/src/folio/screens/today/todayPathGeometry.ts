/**
 * Geometry for the Today signature path.
 *
 * The route engine deliberately samples beyond payday so it can find a later
 * tight point. Today, however, is a path *to payday*: its plotted horizon ends
 * at the resolved payday point. Keeping that distinction here prevents a
 * one-day horizon from compressing the Today and Payday labels into adjacent
 * pixels while post-payday samples consume the plot width.
 */

export const TODAY_PATH_PLOT = {
  x0: 30,
  x1: 370,
  yTop: 72,
  yBottom: 196,
  baseline: 240,
} as const;

export type TodayPathRoutePoint = Readonly<{
  date: string;
  y: number;
}>;

export type TodayPathPoint = Readonly<{
  x: number;
  y: number;
  label: string;
}>;

export type TodayPathGeometry = Readonly<{
  points: readonly TodayPathPoint[];
  lowIndex: number;
  /** The lowest real route sample in the plotted (payday-inclusive) horizon. */
  lowPoint: TodayPathRoutePoint | null;
}>;

export type TodayJourneyPoint = Readonly<{
  x: number;
  y: number;
  label: 'today' | 'tightest' | 'payday';
  value: string;
}>;

export type TodayJourneyEvent = Readonly<{
  x: number;
  label: string;
  amount: number;
}>;

export type TodayCalendarMovement = Readonly<{
  date: string;
  title?: string;
  amount?: number;
}>;

const DAY_MS = 86_400_000;

function atLocalMidnight(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime();
}

function formatGBP(value: number): string {
  const rounded = Math.round(value);
  return `${rounded < 0 ? '−' : ''}£${Math.abs(rounded).toLocaleString('en-GB')}`;
}

/**
 * Source-authoritative three-station journey used by Today.
 *
 * The tight point deliberately comes from the full 35-day projection, just as
 * the headline does. All stations share one vertical scale, which prevents the
 * route from visually contradicting its money labels.
 */
export function buildTodayJourneyGeometry({
  now,
  todayAmount,
  tightAmount,
  tightDate,
  paydayAmount,
}: {
  now: Date;
  todayAmount: number;
  tightAmount: number;
  tightDate: string | null;
  paydayAmount: number;
}): readonly TodayJourneyPoint[] {
  const tightDays = tightDate
    ? Math.max(0, Math.min(28, Math.round((atLocalMidnight(tightDate) - now.getTime()) / DAY_MS)))
    : 14;
  const tightX = Math.round(70 + (tightDays / 28) * 250);
  const lo = Math.min(todayAmount, tightAmount, paydayAmount, 0);
  const hi = Math.max(todayAmount, tightAmount, paydayAmount, lo + 1);
  const y = (value: number) => Math.round(200 - ((value - lo) / (hi - lo)) * 132);

  return [
    { x: 30, y: y(todayAmount), label: 'today', value: formatGBP(todayAmount) },
    { x: tightX, y: y(tightAmount), label: 'tightest', value: formatGBP(tightAmount) },
    { x: 370, y: y(paydayAmount), label: 'payday', value: formatGBP(paydayAmount) },
  ];
}

/** Select and position the two largest real movements before payday. */
export function buildTodayJourneyEvents(
  events: readonly TodayCalendarMovement[],
  now: Date,
  paydayIso: string,
  tightX: number,
): readonly TodayJourneyEvent[] {
  const nowMs = now.getTime();
  const paydayMs = atLocalMidnight(paydayIso);
  return events
    .filter((event) => {
      const at = atLocalMidnight(event.date);
      return at > nowMs && at <= paydayMs && Math.abs(event.amount ?? 0) > 0;
    })
    .sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0))
    .slice(0, 2)
    .map((event) => {
      const days = Math.max(
        0,
        Math.min(28, Math.round((atLocalMidnight(event.date) - nowMs) / DAY_MS)),
      );
      return {
        x: Math.round(30 + (days / 28) * 340),
        label: event.title ?? '',
        amount: event.amount ?? 0,
      };
    })
    .filter((event) => event.x > 55 && event.x < 345 && Math.abs(event.x - tightX) > 34)
    .sort((a, b) => a.x - b.x);
}

/** Sum the same forward movements that draw the journey, capped at payday. */
export function summarizeTodayCycleFlows(
  events: readonly TodayCalendarMovement[],
  paydayIso: string,
): Readonly<{ incoming: number; outgoing: number }> {
  let incoming = 0;
  let outgoing = 0;
  for (const event of events) {
    if (event.date > paydayIso) continue;
    const amount = event.amount ?? 0;
    if (amount > 0) incoming += amount;
    else outgoing += -amount;
  }
  return { incoming, outgoing };
}

/**
 * Build the plotted Today path from the canonical route.
 *
 * The route may contain a 35-day window, while `daysToPayday` identifies the
 * resolved payday inside that window. Plot only that inclusive horizon. If a
 * route has fewer than two samples, retain the calm two-node fallback used by
 * the screen before a real series is available.
 */
export function buildTodayPathGeometry(
  routePoints: readonly TodayPathRoutePoint[],
  daysToPayday: number,
  plotMid: number,
): TodayPathGeometry {
  const horizon = Math.max(0, Math.trunc(daysToPayday));
  const plotted = routePoints.slice(0, Math.min(routePoints.length, horizon + 1));

  if (plotted.length < 2) {
    return {
      points: [
        { x: TODAY_PATH_PLOT.x0, y: plotMid, label: 'today' },
        { x: TODAY_PATH_PLOT.x1, y: plotMid, label: 'payday' },
      ],
      lowIndex: 0,
      lowPoint: plotted[0] ?? null,
    };
  }

  const balances = plotted.map((point) => point.y);
  const maxBalance = Math.max(...balances);
  const minBalance = Math.min(...balances);
  const span = maxBalance - minBalance;
  const n = plotted.length;
  const xAt = (index: number) =>
    TODAY_PATH_PLOT.x0 + (index / (n - 1)) * (TODAY_PATH_PLOT.x1 - TODAY_PATH_PLOT.x0);
  const yAt = (balance: number) =>
    span < 1
      ? plotMid
      : TODAY_PATH_PLOT.yBottom -
        ((balance - minBalance) / span) * (TODAY_PATH_PLOT.yBottom - TODAY_PATH_PLOT.yTop);

  let lowIndex = 0;
  for (let index = 1; index < balances.length; index += 1) {
    if ((balances[index] ?? 0) < (balances[lowIndex] ?? 0)) lowIndex = index;
  }

  // `plotted` is payday-inclusive, so this is normally its last point. The
  // clamp keeps the helper total for malformed/incomplete route data.
  const paydayIndex = Math.max(0, Math.min(n - 1, horizon));
  const points = plotted.map((point, index) => ({
    x: xAt(index),
    y: yAt(point.y),
    // Endpoint labels win intentionally when the lowest point is Today or
    // Payday; a duplicate "lowest" callout at the same node is noise.
    label:
      index === 0 ? 'today' : index === paydayIndex ? 'payday' : index === lowIndex ? 'lowest' : '',
  }));

  return { points, lowIndex, lowPoint: plotted[lowIndex] ?? null };
}
