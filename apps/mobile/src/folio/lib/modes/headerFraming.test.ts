// headerLineFor — Today header framing per money mode (Plan 108, D2 reframe).
//
// Several mode VOICE contracts explicitly ban payday-days framing (irregular.ts: "not
// days-to-payday"; growth.ts: "not days"; lowVis.ts: "never state numbers as fact"), yet the
// shared Today header used to render "{daysToPayday} days to payday →" for every mode. This pins
// the per-mode map: payday-days framing survives only where the mode's own voice anchors on
// payday (debt, reset — plus survival/stability, included for totality though TodayModeScreen
// never routes those two through this map; see headerFraming.ts's @notes).

import { describe, expect, it } from 'vitest';

import { headerLineFor } from './headerFraming';
import type { MoneyMode } from './types';

const ALL_MODES: readonly MoneyMode[] = [
  'survival',
  'stability',
  'growth',
  'debt',
  'irregular',
  'household',
  'planning',
  'optimizer',
  'reset',
  'lowVis',
];

const PAYDAY_DAYS_MODES: readonly MoneyMode[] = ['debt', 'reset', 'survival', 'stability'];
const NO_PAYDAY_MODES: readonly MoneyMode[] = ALL_MODES.filter(
  (mode) => !PAYDAY_DAYS_MODES.includes(mode),
);
const CADENCE_MODES: readonly MoneyMode[] = ['growth', 'optimizer', 'planning', 'household'];

describe('headerLineFor', () => {
  it.each(ALL_MODES)('%s: ends in the arrow and never carries the banned word "again"', (mode) => {
    const line = headerLineFor(mode, 5);
    expect(line.endsWith('→')).toBe(true);
    expect(line.toLowerCase()).not.toContain('again');
  });

  it.each(PAYDAY_DAYS_MODES)('%s: keeps payday-days framing (payday IS its anchor)', (mode) => {
    expect(headerLineFor(mode, 5)).toBe('5 days to payday →');
    expect(headerLineFor(mode, 0)).toBe('0 days to payday →');
  });

  it.each(NO_PAYDAY_MODES)('%s: never mentions payday', (mode) => {
    expect(headerLineFor(mode, 5).toLowerCase()).not.toContain('payday');
  });

  it.each(CADENCE_MODES)('%s: speaks in cadence ("This month"), not a day count', (mode) => {
    const line = headerLineFor(mode, 5);
    expect(line).toBe('This month →');
    expect(line).not.toMatch(/\d/);
  });

  it('irregular speaks in runway (weeks covered), not days-to-payday', () => {
    const line = headerLineFor('irregular', 5);
    expect(line).toBe('Your runway →');
    expect(line).not.toMatch(/\d/);
  });

  it('lowVis never states numbers as fact', () => {
    const line = headerLineFor('lowVis', 5);
    expect(line).toBe('Getting a picture →');
    expect(line).not.toMatch(/\d/);
  });
});
