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
