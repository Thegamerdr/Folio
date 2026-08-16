import { describe, expect, it } from 'vitest';

import { personalTabForScreen, screenForPersonalTab } from './personalNavigation';

describe('personal navigation', () => {
  it.each([
    ['today', 'today'],
    ['today-mode', 'today'],
    ['today-stability', 'today'],
    ['today-after', 'today'],
    ['plans', 'plan'],
    ['review', 'review'],
    ['privacy', 'more'],
    ['calendar', 'more'],
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
});
