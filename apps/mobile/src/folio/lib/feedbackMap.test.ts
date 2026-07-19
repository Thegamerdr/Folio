import { describe, expect, it } from 'vitest';

import { FEEDBACK_MAP } from './feedbackMap';

describe('approved physical feedback map', () => {
  it('keeps sound limited to earned or completed signature moments', () => {
    expect(
      Object.entries(FEEDBACK_MAP)
        .filter(([, rule]) => rule.sound !== null)
        .map(([event, rule]) => [event, rule.sound]),
    ).toEqual([
      ['ritual-complete', 'bell-warm'],
      ['earn-stamp', 'chime-soft'],
      ['postcard-shared', 'bell-warm'],
      ['shortfall-closed', 'chime-soft'],
    ]);
  });

  it('keeps routine commits silent and errors physically distinct', () => {
    expect(FEEDBACK_MAP['log-commit']).toEqual({ haptic: 'light', sound: null });
    expect(FEEDBACK_MAP['transaction-corrected']).toEqual({
      haptic: 'light',
      sound: null,
    });
    expect(FEEDBACK_MAP['delete-confirm']).toEqual({ haptic: 'heavy', sound: null });
    expect(FEEDBACK_MAP.error).toEqual({ haptic: 'error', sound: null });
  });
});
