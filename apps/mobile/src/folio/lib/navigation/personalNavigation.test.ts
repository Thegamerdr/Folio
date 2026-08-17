import { describe, expect, it } from 'vitest';

import { SCREEN_IDS } from '../../types';

import {
  isPersonalTransientScreen,
  personalTabForScreen,
  screenForPersonalTab,
} from './personalNavigation';

describe('personal navigation', () => {
  it.each([
    ['today', 'today'],
    ['today-mode', 'today'],
    ['today-stability', 'today'],
    ['today-after', 'today'],
    ['insights', 'today'],
    ['plans', 'plan'],
    ['calendar', 'plan'],
    ['whatif', 'plan'],
    ['recovery', 'plan'],
    ['shortfall', 'plan'],
    ['subs', 'plan'],
    ['pots', 'plan'],
    ['review', 'review'],
    ['timeline', 'review'],
    ['decision-history', 'review'],
    ['privacy', 'more'],
    ['money-sources', 'more'],
    ['intake', 'more'],
  ] as const)('maps %s to the %s tab', (screen, tab) => {
    expect(personalTabForScreen(screen)).toBe(tab);
  });

  it.each([
    ['today', 'today'],
    ['plan', 'plans'],
    ['review', 'review'],
    ['more', 'more'],
  ] as const)('maps the %s tab to %s', (tab, screen) => {
    expect(screenForPersonalTab(tab)).toBe(screen);
  });

  it('assigns every current native ScreenId to one primary tab', () => {
    expect(SCREEN_IDS.map((screen) => personalTabForScreen(screen))).toHaveLength(
      SCREEN_IDS.length,
    );
  });

  it.each(['start', 'first-answer', 'intake', 'pdf-success', 'add-bill'] as const)(
    'keeps %s out of persistent tab memory',
    (screen) => expect(isPersonalTransientScreen(screen)).toBe(true),
  );
});
