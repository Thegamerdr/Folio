import { beforeEach, describe, expect, it } from 'vitest';

import {
  FREE_LENSES,
  PLUS_LENSES,
  PRO_LENSES,
  canAccessLens,
  tierOf,
  trialEndIsoFor,
} from './lens';
import {
  endLensTrial,
  getState,
  resetAll,
  setLensPlusUnlocked,
  setLensProUnlocked,
  startLensTrial,
  type IncomeSource,
} from '../store';

describe('frozen lens bands', () => {
  it('maps all ten lenses to the exact tier bands', () => {
    expect(FREE_LENSES).toEqual(['survival', 'stability']);
    expect(PLUS_LENSES).toEqual(['growth', 'reset', 'optimizer', 'planning']);
    expect(PRO_LENSES).toEqual(['lowVis', 'irregular', 'debt', 'household']);
    expect([...FREE_LENSES, ...PLUS_LENSES, ...PRO_LENSES]).toHaveLength(10);
    for (const mode of FREE_LENSES) expect(tierOf(mode)).toBe('free');
    for (const mode of PLUS_LENSES) expect(tierOf(mode)).toBe('plus');
    for (const mode of PRO_LENSES) expect(tierOf(mode)).toBe('pro');
  });

  it('keeps Free open, Plus scoped, and Pro as a superset', () => {
    const free = { plusUnlocked: false, proUnlocked: false, trialActive: false };
    const plus = { plusUnlocked: true, proUnlocked: false, trialActive: false };
    const pro = { plusUnlocked: true, proUnlocked: true, trialActive: false };
    expect(canAccessLens('survival', free)).toBe(true);
    expect(canAccessLens('growth', free)).toBe(false);
    expect(canAccessLens('growth', plus)).toBe(true);
    expect(canAccessLens('debt', plus)).toBe(false);
    expect(canAccessLens('growth', pro)).toBe(true);
    expect(canAccessLens('debt', pro)).toBe(true);
  });

  it('opens every paid lens during the single shared trial', () => {
    const trial = { plusUnlocked: false, proUnlocked: false, trialActive: true };
    for (const mode of [...PLUS_LENSES, ...PRO_LENSES]) {
      expect(canAccessLens(mode, trial)).toBe(true);
    }
  });
});

describe('trial close estimate', () => {
  it('uses the next cadence occurrence with no 21-day floor', () => {
    const weekly: IncomeSource = {
      id: 'weekly',
      label: 'Pay',
      amount: 500,
      cadence: 'weekly',
      anchorISO: '2026-06-05',
      source: 'manual',
    };
    expect(trialEndIsoFor('2026-06-01', [weekly], 25)).toBe('2026-06-05');
  });

  it('uses the next legacy payday with no 21-day floor', () => {
    expect(trialEndIsoFor('2026-06-20', [], 25)).toBe('2026-06-25');
  });
});

describe('entitlement and trial persistence', () => {
  beforeEach(() => resetAll());

  it('grants Plus without Pro and grants Pro as a Plus superset', () => {
    setLensPlusUnlocked(true);
    expect(getState().lens).toMatchObject({ plusUnlocked: true, proUnlocked: false });
    setLensProUnlocked(true);
    expect(getState().lens).toMatchObject({ plusUnlocked: true, proUnlocked: true });
  });

  it('keeps the trial active until explicit cycle close', () => {
    startLensTrial('2026-06-01');
    expect(getState().lens?.trialCycleId).toBe('2026-06-01');

    endLensTrial();
    expect(getState().lens).toMatchObject({
      trialCycleId: null,
      trialEndedCycleId: '2026-06-01',
      trialEndAcknowledged: false,
    });
  });

  it('allows only one trial ever', () => {
    startLensTrial('2026-06-01');
    endLensTrial();
    startLensTrial('2026-07-01');
    expect(getState().lens?.trialCycleId).toBeNull();
    expect(getState().lens?.trialEndedCycleId).toBe('2026-06-01');
  });
});
