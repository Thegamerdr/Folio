import { describe, expect, it } from 'vitest';

import { shouldShowTimelineEmptyState } from './timelineVisibility';

describe('Timeline visibility', () => {
  it('shows the empty state only when no ordinary rows or material-change facts exist', () => {
    expect(
      shouldShowTimelineEmptyState({
        state: 'populated',
        rowCount: 0,
        materialChangeCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldShowTimelineEmptyState({
        state: 'populated',
        rowCount: 0,
        materialChangeCount: 1,
      }),
    ).toBe(false);

    expect(
      shouldShowTimelineEmptyState({
        state: 'populated',
        rowCount: 1,
        materialChangeCount: 0,
      }),
    ).toBe(false);
  });

  it('keeps the explicit empty fixture branch available for state testing', () => {
    expect(
      shouldShowTimelineEmptyState({
        state: 'empty',
        rowCount: 1,
        materialChangeCount: 1,
      }),
    ).toBe(true);
  });
});
