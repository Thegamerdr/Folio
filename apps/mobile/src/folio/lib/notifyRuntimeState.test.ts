import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: null,
  EncodingType: { UTF8: 'utf8' },
}));

import { EMPTY_NOTIFY_RUNTIME_STATE, parseNotifyRuntimeState } from './notifyRuntimeState';

describe('parseNotifyRuntimeState', () => {
  it('restores a valid snapshot and fatigue counters across restart', () => {
    expect(
      parseNotifyRuntimeState(
        JSON.stringify({
          version: 1,
          localDay: '2026-07-14',
          sentToday: 1,
          dangerSentToday: 1,
          lastSnapshot: { ladder: 'warning', dangerDaysAway: 2 },
        }),
      ),
    ).toEqual({
      version: 1,
      localDay: '2026-07-14',
      sentToday: 1,
      dangerSentToday: 1,
      lastSnapshot: { ladder: 'warning', dangerDaysAway: 2 },
    });
  });

  it('contains no copy or financial fields and fails malformed input closed', () => {
    const state = parseNotifyRuntimeState('not-json');
    expect(state).toEqual(EMPTY_NOTIFY_RUNTIME_STATE);
    expect(Object.keys(state)).toEqual([
      'version',
      'localDay',
      'sentToday',
      'dangerSentToday',
      'lastSnapshot',
    ]);
  });
});
