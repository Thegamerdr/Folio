export type ChartLabelPoint = {
  x: number;
  y: number;
  text: string;
};

export type ChartLabelRect = {
  index: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  baseline: number;
};

const LABEL_MIN_SIZE = 12;
const LABEL_LINE_HEIGHT = 1.28;
const HORIZONTAL_GAP = 4;
const VERTICAL_GAP = 2;

function glyphWidth(character: string, fontSize: number): number {
  if (
    character === ' ' ||
    character === '.' ||
    character === ',' ||
    character === ':' ||
    character === '·'
  ) {
    return fontSize * 0.28;
  }
  if (character === '£' || character === '−' || character === '-') return fontSize * 0.58;
  return fontSize * 0.6;
}

/** Conservative native-width estimate used before SVG text measurement is available. */
export function estimateChartLabelWidth(text: string, fontScale: number): number {
  const fontSize = Math.max(LABEL_MIN_SIZE, LABEL_MIN_SIZE * fontScale);
  return Math.ceil(
    Array.from(text).reduce((sum, character) => sum + glyphWidth(character, fontSize), 0) + 2,
  );
}

function overlaps(a: ChartLabelRect, b: ChartLabelRect): boolean {
  return (
    a.left < b.right + HORIZONTAL_GAP &&
    a.right + HORIZONTAL_GAP > b.left &&
    a.top < b.bottom + VERTICAL_GAP &&
    a.bottom + VERTICAL_GAP > b.top
  );
}

export function chartLabelRects(
  points: readonly ChartLabelPoint[],
  plotWidth: number,
  plotHeight: number,
  fontScale: number,
  padX: number,
): ChartLabelRect[] {
  const fontSize = Math.max(LABEL_MIN_SIZE, LABEL_MIN_SIZE * fontScale);
  const lineHeight = fontSize * LABEL_LINE_HEIGHT;
  return points.map((point, index) => {
    const width = estimateChartLabelWidth(point.text, fontScale);
    const isFirst = index === 0;
    const isLast = index === points.length - 1;
    const left = isFirst ? padX : isLast ? plotWidth - padX - width : point.x - width / 2;
    const baseline = Math.max(lineHeight, Math.min(plotHeight - 2, point.y - 8));
    return {
      index,
      left,
      right: left + width,
      top: baseline - lineHeight,
      bottom: baseline + 2,
      baseline,
    };
  });
}

export function chartLabelsFit(
  rects: readonly ChartLabelRect[],
  plotWidth: number,
  plotHeight: number,
): boolean {
  return rects.every(
    (rect) =>
      rect.left >= 0 &&
      rect.right <= plotWidth &&
      rect.top >= 0 &&
      rect.bottom <= plotHeight &&
      rects.every((other) => other === rect || !overlaps(rect, other)),
  );
}

/**
 * Amounts are all shown only when their measured conservative bounds fit. Otherwise the two
 * endpoints remain visible and every intermediate value remains available through its focus target.
 */
export function visibleChartLabelIndices(
  points: readonly ChartLabelPoint[],
  plotWidth: number,
  plotHeight: number,
  fontScale: number,
  padX: number,
): number[] {
  const rects = chartLabelRects(points, plotWidth, plotHeight, fontScale, padX);
  return points.length <= 2 || chartLabelsFit(rects, plotWidth, plotHeight)
    ? rects.map((rect) => rect.index)
    : [0, points.length - 1];
}

export type ChartLabelPosition = ChartLabelRect & {
  x: number;
  textAnchor: 'start' | 'middle' | 'end';
};

/**
 * Returns the exact SVG label coordinates. If endpoint bounds would overlap, the endpoints use
 * separate vertical lanes so both remain legible without shrinking or horizontal scrolling.
 */
export function chartLabelPositions(
  points: readonly ChartLabelPoint[],
  plotWidth: number,
  plotHeight: number,
  fontScale: number,
  padX: number,
): ChartLabelPosition[] {
  const visible = visibleChartLabelIndices(points, plotWidth, plotHeight, fontScale, padX);
  const rects = chartLabelRects(points, plotWidth, plotHeight, fontScale, padX);
  const fontSize = Math.max(LABEL_MIN_SIZE, LABEL_MIN_SIZE * fontScale);
  const lineHeight = fontSize * LABEL_LINE_HEIGHT;
  const laneGap = lineHeight + VERTICAL_GAP;
  const endpointCollision = rects.length > 1 && overlaps(rects[0]!, rects[rects.length - 1]!);
  const endpointBaselines = endpointCollision
    ? (() => {
        const first = rects[0]!;
        const last = rects[rects.length - 1]!;
        const low = Math.max(lineHeight, Math.min(plotHeight - 2 - laneGap, first.baseline));
        const high = Math.min(plotHeight - 2, Math.max(lineHeight + laneGap, last.baseline));
        return low + laneGap <= plotHeight - 2 ? [low, low + laneGap] : [high - laneGap, high];
      })()
    : undefined;
  return visible.map((index) => {
    const rect = rects[index]!;
    const isFirst = index === 0;
    const isLast = index === points.length - 1;
    const baseline = endpointBaselines
      ? isFirst
        ? endpointBaselines[0]!
        : isLast
          ? endpointBaselines[1]!
          : rect.baseline
      : rect.baseline;
    const lineHeight = fontSize * LABEL_LINE_HEIGHT;
    return {
      ...rect,
      top: baseline - lineHeight,
      bottom: baseline + 2,
      baseline,
      x: isFirst ? padX : isLast ? plotWidth - padX : points[index]!.x,
      textAnchor: isFirst ? 'start' : isLast ? 'end' : 'middle',
    };
  });
}
