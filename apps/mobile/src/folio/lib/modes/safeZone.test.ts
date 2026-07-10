// safeZoneMath — pure-logic coverage for the Bills Shield window (lib/modes/safeZone.ts).
//
// Pins the 2026-07-10 device-smoke fix: `shieldedBills` computed its days-to-tight-date window
// with Math.round over a midnight-ISO tight date minus a mid-day Date.now(), so a bill landing
// exactly ON the tight date rounded DOWN out of the window — the Safe Zone sheet showed
// Bills Shield £0 while the route visibly dipped by that bill. The window must ceil, covering
// through the tight day itself.
//
// Determinism note: `shieldedBills` reads the real clock (Date.now()) internally, so these tests
// build `tightestDate` as a full ISO timestamp RELATIVE to the real clock — fractional-day gaps
// are then exact regardless of what wall-clock time the suite runs at.

import { describe, expect, it } from 'vitest';

import { safeZoneMath } from './safeZone';
import type { ModeInputs } from './types';

const DAY_MS = 86_400_000;

function inputsWith(overrides: Partial<ModeInputs>): ModeInputs {
  return {
    currentBalance: {
      amount: 2150,
      source: 'user-entered',
      confidence: 'rough',
      setAt: new Date().toISOString(),
    },
    onboarding: { done: true, name: 'Test', payday: 25, monthlyIncome: 2180 },
    pots: [],
    subs: [],
    subPaused: {},
    tightestSpare: 0,
    tightestDate: null,
    ritualCompletedRecently: false,
    bufferAmount: 100,
    ...overrides,
  } as ModeInputs;
}

function sub(name: string, cost: number, nextRenewalDaysAway: number) {
  return { name, cost, nextRenewalDaysAway, lastUsedDaysAgo: 0, usesPerMonth: 0 };
}

describe('safeZoneMath — Bills Shield window', () => {
  it('a bill landing exactly ON the tight date is shielded (ceil, not round)', () => {
    // Tight date 11.4 days out (fractional on purpose): round() would give 11 and exclude a
    // 12-days-away bill; ceil() gives 12 and includes it — the on-device £0-shield repro.
    const tightestDate = new Date(Date.now() + 11.4 * DAY_MS).toISOString();
    const zone = safeZoneMath(
      inputsWith({ tightestDate, subs: [sub('Rent', 120, 12)] }),
    );

    const shield = zone.lines.find((line) => line.key === 'shield');
    expect(shield?.amount).toBe(-120);
    expect(zone.total).toBe(2150 - 120 - 100);
  });

  it('a bill beyond the window is not shielded', () => {
    const tightestDate = new Date(Date.now() + 11.4 * DAY_MS).toISOString();
    const zone = safeZoneMath(
      inputsWith({ tightestDate, subs: [sub('Insurance', 80, 20)] }),
    );

    const shield = zone.lines.find((line) => line.key === 'shield');
    expect(shield?.amount).toBe(-0);
  });

  it('a paused bill inside the window is not shielded', () => {
    const tightestDate = new Date(Date.now() + 11.4 * DAY_MS).toISOString();
    const zone = safeZoneMath(
      inputsWith({
        tightestDate,
        subs: [sub('Water', 50, 3)],
        subPaused: { Water: true },
      }),
    );

    const shield = zone.lines.find((line) => line.key === 'shield');
    expect(shield?.amount).toBe(-0);
  });

  it('no tight date -> shield contributes £0 and the zone still resolves', () => {
    const zone = safeZoneMath(inputsWith({ subs: [sub('Rent', 120, 2)] }));

    const shield = zone.lines.find((line) => line.key === 'shield');
    expect(shield?.amount).toBe(-0);
    expect(zone.total).toBe(2150 - 100);
  });
});
