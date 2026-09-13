import { describe, expect, it } from 'vitest';

import {
  chartLabelRects,
  chartLabelsFit,
  chartLabelPositions,
  estimateChartLabelWidth,
  visibleChartLabelIndices,
} from './insightsChartLayout';

function points(count: number, text: string, y = 116) {
  return Array.from({ length: count }, (_, index) => ({
    x: 20 + index * (272 / Math.max(1, count - 1)),
    y,
    text,
  }));
}

describe('Insights chart label geometry', () => {
  it('keeps every amount visible for a short flat series when measured bounds do not collide', () => {
    for (const count of [2, 3, 4]) {
      const series = points(count, '£120.00');
      expect(visibleChartLabelIndices(series, 312, 232, 1, 20)).toEqual(
        Array.from({ length: count }, (_, index) => index),
      );
    }
    for (const count of [5, 6]) {
      const series = points(count, '£1');
      expect(visibleChartLabelIndices(series, 312, 232, 1, 20)).toEqual(
        Array.from({ length: count }, (_, index) => index),
      );
    }
  });

  it('falls back to visible endpoints for long flat values at both scales', () => {
    for (const fontScale of [1, 2]) {
      const series = points(4, '−£1,234,567.89');
      expect(
        visibleChartLabelIndices(series, 312, fontScale === 2 ? 288 : 232, fontScale, 20),
      ).toEqual([0, 3]);
    }
  });

  it('separates colliding long endpoints into two in-bounds vertical lanes', () => {
    for (const fontScale of [1, 2]) {
      const height = fontScale === 2 ? 288 : 232;
      const series = points(2, fontScale === 2 ? '−£123,456,789,012.34' : '−£123,456.78');
      const positions = chartLabelPositions(series, 312, height, fontScale, 20);
      expect(positions).toHaveLength(2);
      if (fontScale === 2) expect(positions[0]!.baseline).not.toBe(positions[1]!.baseline);
      expect(positions.every((position) => position.left >= 0 && position.right <= 312)).toBe(true);
      expect(positions.every((position) => position.top >= 0 && position.bottom <= height)).toBe(
        true,
      );
    }
  });

  it('keeps the six-point window honest and exposes all intermediate values by focus', () => {
    const series = points(6, '−£987,654.32');
    expect(visibleChartLabelIndices(series, 312, 288, 2, 20)).toEqual([0, 5]);
    expect(series).toHaveLength(6);
  });

  it('keeps top and bottom label rectangles inside the declared plot at every supported scale', () => {
    for (const fontScale of [1, 1.3, 2]) {
      const height = fontScale >= 1.3 ? 288 : 232;
      for (const y of [20, height - 20]) {
        const rects = chartLabelRects(points(3, '£120', y), 312, height, fontScale, 20);
        expect(rects.every((rect) => rect.top >= 0 && rect.bottom <= height)).toBe(true);
      }
    }
  });

  it('keeps genuinely fitting nominal flat intermediates visible near the top edge', () => {
    for (const fontScale of [1, 1.3, 2]) {
      const height = fontScale >= 1.3 ? 288 : 232;
      const series = [
        { x: 20, y: 20, text: '£120' },
        { x: 156, y: 20, text: '£90' },
        { x: 292, y: 20, text: '£10' },
      ];
      expect(visibleChartLabelIndices(series, 312, height, fontScale, 20)).toEqual([0, 1, 2]);
    }
  });

  it('does not treat vertical separation as a collision', () => {
    const series = points(4, '£120.00').map((point, index) => ({ ...point, y: 52 + index * 48 }));
    const rects = chartLabelRects(series, 312, 232, 1, 20);
    expect(chartLabelsFit(rects, 312, 232)).toBe(true);
    expect(visibleChartLabelIndices(series, 312, 232, 1, 20)).toEqual([0, 1, 2, 3]);
  });

  it('uses a conservative width that grows with native font scale', () => {
    expect(estimateChartLabelWidth('−£1,234.56', 2)).toBeGreaterThan(
      estimateChartLabelWidth('−£1,234.56', 1),
    );
  });
});
