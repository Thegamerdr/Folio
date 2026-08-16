import { describe, expect, it } from 'vitest';

import { closeCycle, deriveCycleState, type CycleInputs, type CycleRecord } from './cycles.js';
import { lintCopy } from './copy.js';

const record = (endedISO: string, endedPositive: boolean, closing = 5_000): CycleRecord => ({
  endedISO,
  endedPositive,
  closingSafeZonePence: closing,
});

const inputs = (over: Partial<CycleInputs> = {}): CycleInputs => ({
  todayISO: '2026-07-02',
  history: [],
  lastOpenedISO: null,
  recoveryEndISO: null,
  bufferPence: 0,
  savingsPence: 0,
  reachedMilestoneIds: [],
  ...over,
});

describe('cyclesEndedPositive — a streak, not a lifetime count', () => {
  it('counts only the consecutive most-recent green cycles', () => {
    // Lifetime positives = 4, but the streak since the last red cycle = 2.
    const history = [
      record('2026-02-28', true),
      record('2026-03-31', true),
      record('2026-04-30', false),
      record('2026-05-31', true),
      record('2026-06-30', true),
    ];
    expect(deriveCycleState(inputs({ history })).cyclesEndedPositive).toBe(2);
  });

  it('a negative most-recent cycle resets the streak to zero', () => {
    const history = [
      record('2026-04-30', true),
      record('2026-05-31', true),
      record('2026-06-30', false),
    ];
    expect(deriveCycleState(inputs({ history })).cyclesEndedPositive).toBe(0);
  });

  it('an unbroken history counts in full, regardless of input order', () => {
    // Shuffled on purpose — the streak follows dates, not array position.
    const history = [
      record('2026-06-30', true),
      record('2026-04-30', true),
      record('2026-05-31', true),
    ];
    expect(deriveCycleState(inputs({ history })).cyclesEndedPositive).toBe(3);
  });

  it('empty history means no streak', () => {
    expect(deriveCycleState(inputs()).cyclesEndedPositive).toBe(0);
  });
});

describe('closeCycle', () => {
  it('appends a new record without mutating the input', () => {
    const history = [record('2026-05-31', true)];
    const next = closeCycle(history, record('2026-06-30', false));
    expect(next).toHaveLength(2);
    expect(history).toHaveLength(1);
    expect(next[1]?.endedISO).toBe('2026-06-30');
  });

  it('dedupes by endedISO — a re-closed cycle replaces the earlier record', () => {
    const history = [record('2026-06-30', false, 0)];
    const next = closeCycle(history, record('2026-06-30', true, 12_300));
    expect(next).toHaveLength(1);
    expect(next[0]?.endedPositive).toBe(true);
    expect(next[0]?.closingSafeZonePence).toBe(12_300);
  });

  it('keeps only the most recent 24 records', () => {
    let history: readonly CycleRecord[] = [];
    for (let month = 0; month < 30; month += 1) {
      const iso = `${2024 + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}-01`;
      history = closeCycle(history, record(iso, true));
    }
    expect(history).toHaveLength(24);
    expect(history[0]?.endedISO).toBe('2024-07-01'); // the 6 oldest fell off
    expect(history[23]?.endedISO).toBe('2026-06-01');
  });
});

describe('recovery distance and absence', () => {
  it('daysSinceRecoveryEnd is null when no recovery has ended', () => {
    expect(deriveCycleState(inputs()).daysSinceRecoveryEnd).toBeNull();
  });

  it('daysSinceRecoveryEnd counts days from recovery end to today', () => {
    const derived = deriveCycleState(inputs({ recoveryEndISO: '2026-06-20' }));
    expect(derived.daysSinceRecoveryEnd).toBe(12);
  });

  it('nine days away is not an absence', () => {
    const derived = deriveCycleState(inputs({ lastOpenedISO: '2026-06-23' }));
    expect(derived.returnedAfterAbsence).toBe(false);
  });

  it('ten days away is — the boundary is inclusive', () => {
    const derived = deriveCycleState(inputs({ lastOpenedISO: '2026-06-22' }));
    expect(derived.returnedAfterAbsence).toBe(true);
  });

  it('a first-ever open (no lastOpenedISO) is never an absence return', () => {
    expect(deriveCycleState(inputs({ lastOpenedISO: null })).returnedAfterAbsence).toBe(false);
  });
});

describe('milestone ladder', () => {
  it('fires at the exact threshold', () => {
    const derived = deriveCycleState(inputs({ bufferPence: 10_000 }));
    expect(derived.newMilestoneIds).toEqual(['buffer-100']);
  });

  it('stays silent one penny below the threshold', () => {
    const derived = deriveCycleState(inputs({ bufferPence: 9_999 }));
    expect(derived.newMilestoneIds).toEqual([]);
  });

  it('already-reached milestones never fire twice', () => {
    const derived = deriveCycleState(
      inputs({ bufferPence: 30_000, reachedMilestoneIds: ['buffer-100', 'buffer-250'] }),
    );
    expect(derived.newMilestoneIds).toEqual([]);
  });

  it('buffer and savings ladders are independent and returned ascending', () => {
    const derived = deriveCycleState(inputs({ bufferPence: 50_000, savingsPence: 25_000 }));
    expect(derived.newMilestoneIds).toEqual([
      'buffer-100',
      'buffer-250',
      'buffer-500',
      'savings-100',
      'savings-250',
    ]);
  });

  it('savings reach the top rung at £1000', () => {
    const derived = deriveCycleState(
      inputs({
        savingsPence: 100_000,
        reachedMilestoneIds: ['savings-100', 'savings-250', 'savings-500'],
      }),
    );
    expect(derived.newMilestoneIds).toEqual(['savings-1000']);
  });

  it('emits one line per new milestone, mentioning the amount', () => {
    const derived = deriveCycleState(inputs({ bufferPence: 25_000 }));
    expect(derived.milestoneLines).toHaveLength(2);
    expect(derived.milestoneLines[0]).toContain('£100');
    expect(derived.milestoneLines[1]).toContain('£250');
  });

  it('every milestone line renders clean against the copy law', () => {
    const derived = deriveCycleState(inputs({ bufferPence: 100_000, savingsPence: 100_000 }));
    expect(derived.milestoneLines).toHaveLength(8);
    for (const line of derived.milestoneLines) {
      expect(lintCopy(line)).toEqual([]);
    }
  });
});

describe('integer pence enforcement', () => {
  it('fractional bufferPence throws', () => {
    expect(() => deriveCycleState(inputs({ bufferPence: 100.5 }))).toThrow(/integer pence/);
  });

  it('fractional savingsPence throws', () => {
    expect(() => deriveCycleState(inputs({ savingsPence: 0.01 }))).toThrow(/integer pence/);
  });

  it('a fractional closing balance in history throws from deriveCycleState', () => {
    const history = [record('2026-06-30', true, 12_345.6)];
    expect(() => deriveCycleState(inputs({ history }))).toThrow(/integer pence/);
  });

  it('closeCycle rejects a fractional closing balance', () => {
    expect(() => closeCycle([], record('2026-06-30', true, 1.5))).toThrow(/integer pence/);
  });
});
