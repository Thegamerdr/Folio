import { describe, expect, it } from 'vitest';

import {
  applyBusinessWeeklyProgress,
  applyCycleCloseProgress,
  applyRitualCompletion,
  calculateBusinessSetAsideCoverage,
  createMeloStreakState,
  createPhoenixStageState,
  deriveBusinessStage,
  deriveForegroundStage,
  deriveStage,
  STAGE_HISTORY_LIMIT,
  transitionPhoenixStage,
} from './stage';

const T0 = '2026-01-01T00:00:00.000Z';

describe('workspace-local phoenix stage', () => {
  it('keeps the frozen runway bands and standard cycle arc', () => {
    expect(deriveStage({ mode: 'lowvis', runwayDays: 13 }).stage).toBe('ash');
    expect(deriveStage({ mode: 'lowvis', runwayDays: 14 }).stage).toBe('rising');
    expect(deriveStage({ mode: 'lowvis', runwayDays: 45 }).stage).toBe('fledgling');
    expect(deriveStage({ mode: 'lowvis', runwayDays: 90 }).stage).toBe('full');
    expect(deriveStage({ mode: 'lowvis', runwayDays: 180 }).stage).toBe('ablaze');
    expect(
      deriveStage({
        daysToPayday: 5,
        cycleLength: 30,
        pathBendPct: 0,
        cleanStreakDays: 3,
      }).stage,
    ).toBe('ablaze');
  });

  it('caps transition history at twelve entries', () => {
    let stage = createPhoenixStageState(T0, 'ash');
    for (let index = 1; index <= STAGE_HISTORY_LIMIT + 4; index += 1) {
      stage = transitionPhoenixStage(
        stage,
        index % 2 === 0 ? 'ash' : 'ember',
        new Date(Date.parse(T0) + index * 60_000).toISOString(),
      );
    }
    expect(stage.history).toHaveLength(STAGE_HISTORY_LIMIT);
    expect(stage.history.at(-1)?.stage).toBe('ash');
  });

  it('increments qualifying cycles, keeps the best, and resets on a negative close', () => {
    const initialStage = createPhoenixStageState(T0, 'full');
    const initialStreak = createMeloStreakState(T0);
    const first = applyCycleCloseProgress(initialStage, initialStreak, {
      cycleId: 'personal:cycle-1',
      spare: 1,
      tightPoint: 0,
      closedAt: '2026-02-01T00:00:00.000Z',
    });
    const second = applyCycleCloseProgress(first.stage, first.streak, {
      cycleId: 'personal:cycle-2',
      spare: 20,
      tightPoint: 10,
      closedAt: '2026-03-01T00:00:00.000Z',
    });
    const red = applyCycleCloseProgress(second.stage, second.streak, {
      cycleId: 'personal:cycle-3',
      spare: -1,
      tightPoint: -1,
      closedAt: '2026-04-01T00:00:00.000Z',
    });

    expect(second.streak).toMatchObject({
      count: 2,
      bestCount: 2,
      lastQualifiedCycleId: 'personal:cycle-2',
    });
    expect(red.streak).toMatchObject({
      count: 0,
      bestCount: 2,
      lastQualifiedCycleId: null,
    });
    expect(red.stage.current).toBe('ash');
  });

  it('records rebirth only for the ash-to-ember ritual transition', () => {
    const ash = createPhoenixStageState(T0, 'ash');
    const at = '2026-02-01T10:00:00.000Z';
    const ember = applyRitualCompletion(ash, at);

    expect(ember.current).toBe('ember');
    expect(ember.enteredAt).toBe(at);
    expect(ember.lastRebirthAt).toBe(at);
  });

  it('refreshes on foreground only when enteredAt is older than 24 hours', () => {
    const ember = createPhoenixStageState(T0, 'ember');
    const beforeBoundary = deriveForegroundStage(
      ember,
      { mode: 'lowvis', runwayDays: 10 },
      '2026-01-02T00:00:00.000Z',
    );
    const afterBoundary = deriveForegroundStage(
      ember,
      { mode: 'lowvis', runwayDays: 10 },
      '2026-01-02T00:00:00.001Z',
    );

    expect(beforeBoundary).toBe(ember);
    expect(afterBoundary.current).toBe('ash');
  });

  it('ticks a Business streak once per local ISO week and never backfills missed weeks', () => {
    const initial = createMeloStreakState('2026-07-05T12:00:00.000Z');
    const first = applyBusinessWeeklyProgress(initial, {
      runwayDays: 30,
      overdueInvoiceCount: 0,
      now: '2026-07-06T12:00:00.000Z',
    });
    const sameWeek = applyBusinessWeeklyProgress(first, {
      runwayDays: 60,
      overdueInvoiceCount: 0,
      now: '2026-07-10T12:00:00.000Z',
    });
    const failed = applyBusinessWeeklyProgress(sameWeek, {
      runwayDays: 29,
      overdueInvoiceCount: 0,
      now: '2026-07-13T12:00:00.000Z',
    });

    expect(first).toMatchObject({
      count: 1,
      bestCount: 1,
      lastQualifiedCycleId: 'business-week:2026-W27',
    });
    expect(sameWeek).toBe(first);
    expect(failed).toMatchObject({
      count: 0,
      bestCount: 1,
      lastQualifiedCycleId: null,
    });
  });

  it('resets the Business streak when an overdue invoice exists at the weekly tick', () => {
    const previous = {
      ...createMeloStreakState('2026-07-06T12:00:00.000Z'),
      count: 3,
      bestCount: 3,
      lastQualifiedCycleId: 'business-week:2026-W27',
    };
    const next = applyBusinessWeeklyProgress(previous, {
      runwayDays: 90,
      overdueInvoiceCount: 1,
      now: '2026-07-13T12:00:00.000Z',
    });

    expect(next).toMatchObject({ count: 0, bestCount: 3, lastQualifiedCycleId: null });
  });

  it('derives Business stages in risk-first precedence', () => {
    const healthy = {
      quietMode: false,
      runwayDays: 180,
      overdueInvoiceCount: 0,
      overdueInvoice30DayCount: 0,
      nextDeadlineDaysAway: 10,
      setAsideCoverage: 1,
      cleanStreakWeeks: 4,
      hoursSinceFilingOrPaid: null,
    };

    expect(deriveBusinessStage(healthy)).toMatchObject({ stage: 'ablaze' });
    expect(deriveBusinessStage({ ...healthy, quietMode: true })).toMatchObject({ stage: 'ash' });
    expect(deriveBusinessStage({ ...healthy, nextDeadlineDaysAway: -1 })).toMatchObject({
      stage: 'ash',
    });
    expect(deriveBusinessStage({ ...healthy, overdueInvoice30DayCount: 1 })).toMatchObject({
      stage: 'ash',
    });
    expect(deriveBusinessStage({ ...healthy, hoursSinceFilingOrPaid: 6 })).toMatchObject({
      stage: 'ember',
      isRebirthBeat: true,
    });
    expect(deriveBusinessStage({ ...healthy, runwayDays: 44 })).toMatchObject({ stage: 'rising' });
    expect(
      deriveBusinessStage({ ...healthy, runwayDays: 89, setAsideCoverage: 0.84 }),
    ).toMatchObject({ stage: 'fledgling' });
    expect(
      deriveBusinessStage({ ...healthy, runwayDays: 90, setAsideCoverage: 0.85 }),
    ).toMatchObject({ stage: 'full' });
  });

  it('calculates Business set-aside coverage without clamping the stored ratio', () => {
    expect(
      calculateBusinessSetAsideCoverage({
        vatPotBalance: 60,
        corpTaxPotBalance: 50,
        saPotBalance: 10,
        vatDueNext: 50,
        corpTaxDueNext: 40,
        saDueNext: 10,
      }),
    ).toBe(1.2);
    expect(
      calculateBusinessSetAsideCoverage({
        vatPotBalance: 0,
        corpTaxPotBalance: 0,
        saPotBalance: 0,
        vatDueNext: 0,
        corpTaxDueNext: 0,
        saDueNext: 0,
      }),
    ).toBe(1);
  });
});
