export type TimelineVisibilityState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export function shouldShowTimelineEmptyState({
  materialChangeCount,
  rowCount,
  state,
}: {
  state: TimelineVisibilityState;
  rowCount: number;
  materialChangeCount: number;
}): boolean {
  if (state === 'empty') return true;
  return rowCount === 0 && materialChangeCount === 0;
}
