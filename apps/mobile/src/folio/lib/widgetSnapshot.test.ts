// widgetSnapshot tests — the pure store→SafeZoneWidgetSnapshot builder
// (apps/mobile/src/folio/lib/widgetSnapshot.ts) that feeds the Android home-screen
// widget. Node-safe: imports the pure builder + the store singleton (both node-safe,
// no react-native runtime), so it is collected by the apps/**/*.test.ts vitest runner.
// Relative imports — the runner has no `@` alias (mirrors storeRoute.test.ts).

import { beforeEach, describe, expect, it } from 'vitest';

import { buildWidgetSnapshot } from './widgetSnapshot';
import { getState, resetAll, setBufferAmount, setCurrentBalance } from '../store';
import { PERSONAL_WORKSPACE_ID } from './workspaceRoot';

beforeEach(() => {
  resetAll();
});

// A fixed mid-month "today" well before the seed payday (25th), matching
// storeRoute.test.ts's own fixture day.
const NOW = '2026-06-10';

describe('buildWidgetSnapshot — fresh install (sample balance)', () => {
  it('flags isSample and returns no payday date, so the widget shows the honest empty state', () => {
    const snapshot = buildWidgetSnapshot(getState(), NOW);

    expect(snapshot.isSample).toBe(true);
    expect(snapshot.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(snapshot.paydayISO).toBeNull();
  });
});

describe('buildWidgetSnapshot — real balance set', () => {
  beforeEach(() => {
    setCurrentBalance({ amount: 720, source: 'user-entered', confidence: 'corrected' });
    setBufferAmount(100);
  });

  it('is no longer flagged as sample and resolves a real ISO payday date', () => {
    const snapshot = buildWidgetSnapshot(getState(), NOW);

    expect(snapshot.isSample).toBe(false);
    expect(snapshot.paydayISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns integer pence for both money fields (no float leakage from pounds)', () => {
    const snapshot = buildWidgetSnapshot(getState(), NOW);

    expect(Number.isInteger(snapshot.safeZonePence)).toBe(true);
    expect(Number.isInteger(snapshot.perDayPence)).toBe(true);
  });

  it('derives a weather word from the same vocabulary MeloWeatherGlyph draws', () => {
    const snapshot = buildWidgetSnapshot(getState(), NOW);
    const validWeathers = [
      'sunny',
      'cloudy',
      'rainy',
      'storm',
      'rainbow',
      'night',
      'alarm',
      'fog',
      'windy',
      'heatwave',
      'freeze',
    ];

    expect(validWeathers).toContain(snapshot.weather);
  });

  it('is stable across two consecutive builds against the same state (pure — no hidden clock read)', () => {
    const first = buildWidgetSnapshot(getState(), NOW);
    const second = buildWidgetSnapshot(getState(), NOW);

    expect(second).toEqual(first);
  });
});
