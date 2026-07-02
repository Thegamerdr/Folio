import { describe, expect, it } from 'vitest';

import {
  computeRawLadder,
  resolveState,
  type MeloStateRecord,
  type StateInputs,
} from './states.js';

const mk = (over: Partial<StateInputs> = {}): StateInputs => ({
  safeZonePence: 18_400,
  perDayPence: 1_533,
  comfortablePerDayPence: 800,
  daysToPayday: 12,
  runwayDays: null,
  dangerDaysAway: null,
  overdraft: false,
  dataAgeHours: 1,
  paydayToday: false,
  paydayTomorrow: false,
  billsDueNext7: 1,
  billsTotalCycle: 4,
  allBillsShielded: false,
  bufferIntact: false,
  cyclesEndedPositive: 0,
  savingsGrowing: false,
  daysSinceRecoveryEnd: null,
  greenDaysStreak: 0,
  daysSinceOverdraftEvent: null,
  milestoneReached: false,
  returnedAfterAbsence: false,
  ...over,
});

const rec = (over: Partial<MeloStateRecord> = {}): MeloStateRecord => ({
  ladder: 'calm',
  ladderEnteredAt: '2026-07-01',
  journey: 'none',
  journeyEnteredAt: '2026-07-01',
  ...over,
});

describe('computeRawLadder', () => {
  it('defaults to calm when nothing is wrong', () => {
    expect(computeRawLadder(mk())).toBe('calm');
  });

  it('is protected when every bill is shielded and the buffer is intact', () => {
    expect(computeRawLadder(mk({ allBillsShielded: true, bufferIntact: true }))).toBe('protected');
  });

  it('is winning after two positive cycles with growing savings', () => {
    expect(computeRawLadder(mk({ cyclesEndedPositive: 2, savingsGrowing: true }))).toBe('winning');
  });

  it('winning is blocked inside the 60-day quiet window after a recovery', () => {
    const i = mk({ cyclesEndedPositive: 2, savingsGrowing: true, daysSinceRecoveryEnd: 30 });
    expect(computeRawLadder(i)).toBe('calm');
  });

  it('is tight when per-day drops below the comfortable threshold', () => {
    expect(computeRawLadder(mk({ comfortablePerDayPence: 2_000 }))).toBe('tight');
  });

  it('is warning when a danger date exists before payday', () => {
    expect(computeRawLadder(mk({ dangerDaysAway: 5, runwayDays: 5 }))).toBe('warning');
  });

  it('is danger when the storm is within three days', () => {
    expect(computeRawLadder(mk({ dangerDaysAway: 3, runwayDays: 3 }))).toBe('danger');
  });

  it('is danger at £10 or less with bills still pending', () => {
    expect(computeRawLadder(mk({ safeZonePence: 900, billsDueNext7: 2 }))).toBe('danger');
  });

  it('is overspent when the safe zone goes negative', () => {
    expect(computeRawLadder(mk({ safeZonePence: -2_300 }))).toBe('overspent');
  });

  it('is overspent in an overdraft regardless of the number', () => {
    expect(computeRawLadder(mk({ overdraft: true }))).toBe('overspent');
  });
});

describe('resolveState — hysteresis and dwell', () => {
  it('starts fresh with no history', () => {
    const { record, view } = resolveState(null, mk(), '2026-07-01');
    expect(record).toEqual(rec());
    expect(view.ladder).toBe('calm');
    expect(view.weather).toBe('sunny');
    expect(view.mascot).toEqual({ family: 'calm', intensity: 1 });
    expect(view.copyKey).toBe('calm');
    expect(view.monetizationAllowed).toBe(true);
  });

  it('worsening bypasses the dwell — safety is never delayed', () => {
    const prev = rec({ ladder: 'calm', ladderEnteredAt: '2026-07-01' });
    const { view } = resolveState(prev, mk({ safeZonePence: -500 }), '2026-07-01');
    expect(view.ladder).toBe('overspent');
  });

  it('improvement inside the 24h dwell is held back — the sky must not flap', () => {
    const prev = rec({ ladder: 'overspent', ladderEnteredAt: '2026-07-01' });
    const { view } = resolveState(prev, mk(), '2026-07-01');
    expect(view.ladder).toBe('overspent');
  });

  it('improvement lands once the dwell has passed', () => {
    const prev = rec({ ladder: 'overspent', ladderEnteredAt: '2026-07-01' });
    const { view, record } = resolveState(prev, mk(), '2026-07-02');
    expect(view.ladder).toBe('calm');
    expect(record.ladderEnteredAt).toBe('2026-07-02');
  });

  it('leaving Warning needs runway to clear payday with margin, not just one good day', () => {
    const prev = rec({ ladder: 'warning', ladderEnteredAt: '2026-07-01' });
    const held = resolveState(prev, mk({ runwayDays: 12, daysToPayday: 11 }), '2026-07-03');
    expect(held.view.ladder).toBe('warning'); // 12 < 11 + 2 — not clear enough yet

    const cleared = resolveState(prev, mk({ runwayDays: 13, daysToPayday: 11 }), '2026-07-03');
    expect(cleared.view.ladder).toBe('calm');
  });

  it('leaving Warning is allowed when spending stops entirely', () => {
    const prev = rec({ ladder: 'warning', ladderEnteredAt: '2026-07-01' });
    const { view } = resolveState(prev, mk({ runwayDays: null }), '2026-07-03');
    expect(view.ladder).toBe('calm');
  });
});

describe('resolveState — fog overrides everything', () => {
  it('stale data goes to fog: squint, no forecast certainty, no selling', () => {
    const { view } = resolveState(null, mk({ dataAgeHours: 100 }), '2026-07-01');
    expect(view.data).toBe('fog');
    expect(view.weather).toBe('fog');
    expect(view.mascot).toEqual({ family: 'squint', intensity: 2 });
    expect(view.copyKey).toBe('fog');
    expect(view.monetizationAllowed).toBe(false);
  });
});

describe('resolveState — overlays', () => {
  it('payday overlay takes the stage: joy, payday copy', () => {
    const { view } = resolveState(null, mk({ paydayToday: true }), '2026-07-01');
    expect(view.overlays).toContain('payday');
    expect(view.mascot).toEqual({ family: 'joy', intensity: 3 });
    expect(view.copyKey).toBe('payday');
  });

  it('payday eve only appears when it is not already payday', () => {
    const { view } = resolveState(
      null,
      mk({ paydayToday: true, paydayTomorrow: true }),
      '2026-07-01',
    );
    expect(view.overlays).not.toContain('paydayEve');
  });

  it('three bills inside a week make a bill week', () => {
    const { view } = resolveState(null, mk({ billsDueNext7: 3 }), '2026-07-01');
    expect(view.overlays).toContain('billWeek');
    expect(view.copyKey).toBe('billWeek');
  });

  it('bill week yields the stage to a warning', () => {
    const { view } = resolveState(
      null,
      mk({ billsDueNext7: 3, dangerDaysAway: 5, runwayDays: 5 }),
      '2026-07-01',
    );
    expect(view.copyKey).toBe('warning');
  });

  it('overspent copy beats bill-week context', () => {
    const { view } = resolveState(
      null,
      mk({ safeZonePence: -100, billsDueNext7: 3 }),
      '2026-07-01',
    );
    expect(view.copyKey).toBe('overspent');
  });
});

describe('resolveState — the recovery journey', () => {
  it('recovery is entered by choice, never forced', () => {
    const inputs = mk({ safeZonePence: -2_300 });
    const notAccepted = resolveState(null, inputs, '2026-07-01');
    expect(notAccepted.view.journey).toBe('none');
    expect(notAccepted.view.copyKey).toBe('overspent');

    const accepted = resolveState(null, inputs, '2026-07-01', { acceptRecovery: true });
    expect(accepted.view.journey).toBe('recovery');
    expect(accepted.view.copyKey).toBe('recovery');
    expect(accepted.view.mascot).toEqual({ family: 'hope', intensity: 2 });
    expect(accepted.view.weather).toBe('cloudy'); // clearing — being worked, not raging
    expect(accepted.view.monetizationAllowed).toBe(false);
  });

  it('cannot accept recovery from a calm state — there is nothing to recover from', () => {
    const { view } = resolveState(null, mk(), '2026-07-01', { acceptRecovery: true });
    expect(view.journey).toBe('none');
  });

  it('three green days graduate recovery into rebuilding with the rainbow moment', () => {
    const prev = rec({
      ladder: 'overspent',
      ladderEnteredAt: '2026-07-01',
      journey: 'recovery',
      journeyEnteredAt: '2026-07-01',
    });
    const { view, record } = resolveState(prev, mk({ greenDaysStreak: 3 }), '2026-07-04');
    expect(view.journey).toBe('rebuilding');
    expect(view.weather).toBe('rainbow'); // entry day only
    expect(view.mascot).toEqual({ family: 'hope', intensity: 3 });
    expect(record.journeyEnteredAt).toBe('2026-07-04');
  });

  it('the rainbow lasts one day; rebuilding then settles into hopeful work', () => {
    const prev = rec({ journey: 'rebuilding', journeyEnteredAt: '2026-07-04' });
    const { view } = resolveState(prev, mk(), '2026-07-05');
    expect(view.journey).toBe('rebuilding');
    expect(view.weather).not.toBe('rainbow');
    expect(view.mascot).toEqual({ family: 'hope', intensity: 2 });
  });

  it('rebuilding completes when the buffer refills', () => {
    const prev = rec({ journey: 'rebuilding', journeyEnteredAt: '2026-07-04' });
    const { view } = resolveState(prev, mk({ bufferIntact: true }), '2026-07-05');
    expect(view.journey).toBe('none');
  });

  it('rebuilding completes after a week regardless', () => {
    const prev = rec({ journey: 'rebuilding', journeyEnteredAt: '2026-07-04' });
    const { view } = resolveState(prev, mk(), '2026-07-11');
    expect(view.journey).toBe('none');
  });
});

describe('resolveState — the monetization contract (§8)', () => {
  it.each(['warning', 'danger', 'overspent'] as const)('no selling in %s', (ladder) => {
    const inputs =
      ladder === 'warning'
        ? mk({ dangerDaysAway: 5, runwayDays: 5 })
        : ladder === 'danger'
          ? mk({ dangerDaysAway: 2, runwayDays: 2 })
          : mk({ safeZonePence: -100 });
    const { view } = resolveState(null, inputs, '2026-07-01');
    expect(view.ladder).toBe(ladder);
    expect(view.monetizationAllowed).toBe(false);
  });

  it('the week after an overdraft is an upsell-free zone even in calm', () => {
    const embargoed = resolveState(null, mk({ daysSinceOverdraftEvent: 5 }), '2026-07-01');
    expect(embargoed.view.ladder).toBe('calm');
    expect(embargoed.view.monetizationAllowed).toBe(false);

    const past = resolveState(null, mk({ daysSinceOverdraftEvent: 8 }), '2026-07-01');
    expect(past.view.monetizationAllowed).toBe(true);
  });
});
