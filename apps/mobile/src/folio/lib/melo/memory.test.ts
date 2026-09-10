import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addCycle,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  resetToEmpty,
  setPartial,
} from '../../store';
import { buildFinancialPlanFromState } from '../financialPlan';
import { deriveMeloMemory, formatMeloMemoryTime } from './memory';

const now = new Date('2026-09-10T09:45:00.000Z');
afterEach(() => {
  vi.useRealTimers();
  resetToEmpty();
});

describe('Melo review memory distinguishes saved forecasts from confirmed safety', () => {
  it('keeps a just-recorded positive cash forecast neutral when the real safe-to-spend result is −£15', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    resetToEmpty();
    const base = getState();
    setPartial({
      currentBalance: {
        amount: 1700,
        source: 'user-entered',
        confidence: 'corrected',
        provided: true,
        setAt: now.toISOString(),
      },
      accounts: [],
      transactions: [],
      pots: [],
      subs: [],
      debts: [
        {
          id: 'card',
          name: 'Evidence card',
          kind: 'card',
          balance: 220,
          minPayment: 40,
          dueDom: 19,
          apr: 19.9,
          addedAt: now.toISOString(),
        },
      ],
      onboarding: {
        ...base.onboarding,
        done: true,
        monthlyIncome: 1800,
        payday: 10,
        financialSetupConfirmed: true,
      },
      incomeSources: [
        {
          id: 'pay',
          label: 'Pay',
          amount: 1800,
          cadence: 'monthly',
          dayOfMonth: 10,
          source: 'manual',
        },
      ],
      calendarEvents: [
        { id: 'rent', date: '2026-09-12', kind: 'out', title: 'Rent and bills', amount: -950 },
        { id: 'phone', date: '2026-09-15', kind: 'out', title: 'Phone', amount: -35 },
        { id: 'extra', date: '2026-09-20', kind: 'out', title: 'Extra bill', amount: -200 },
      ],
      bufferAmount: 200,
      modeExtras: { reset: 70 },
      cycles: [],
      tinyWins: [],
    });
    const plan = buildFinancialPlanFromState(getState(), { now });
    expect([
      plan.currentBalanceMinor,
      plan.protectedBeforeIncomeMinor,
      plan.safeToSpendMinor,
    ]).toEqual([170000, 151500, -1500]);
    addCycle({
      closedAt: '2026-09-10',
      label: 'September',
      spare: 1975,
      tightPoint: 185,
      setAside: 0,
      note: 'Review recorded',
    });
    const expected = [
      {
        id: 'cycle-2026-09-10-September',
        at: '2026-09-10',
        kind: 'cycle-review',
        line: 'Recorded September review.',
      },
    ];
    expect(deriveMeloMemory(getState().tinyWins ?? [], getState().cycles)).toEqual(expected);
    hydrateFromBlob(getPersistBlob());
    expect(deriveMeloMemory(getState().tinyWins ?? [], getState().cycles)).toEqual(expected);
    expect(buildFinancialPlanFromState(getState(), { now }).safeToSpendMinor).toBe(-1500);
    expect(formatMeloMemoryTime(getState().cycles[0]!.closedAt, now)).toBe('today');
  });
  it('neutralizes older positive and negative cycle wording without rewriting saved records', () => {
    const cycles = [
      {
        closedAt: '2026-08-31',
        label: 'August',
        spare: 1000,
        tightPoint: 10,
        setAside: 0,
        note: 'Keep this note',
      },
      {
        closedAt: '2026-07-31',
        label: 'July',
        spare: -100,
        tightPoint: -100,
        setAside: 0,
        note: '',
      },
    ];
    const before = JSON.stringify(cycles);
    expect(deriveMeloMemory([], cycles).map((event) => event.line)).toEqual([
      'Recorded August review.',
      'Recorded July review.',
    ]);
    expect(JSON.stringify(cycles)).toBe(before);
  });
  it('does not invent a completed review from reconstructed transaction history', () => {
    expect(
      deriveMeloMemory(
        [],
        [
          {
            closedAt: '2026-08-31',
            label: 'August',
            spare: 100,
            tightPoint: 0,
            setAside: 0,
            note: '',
            reconstructed: true,
          },
        ],
      ),
    ).toEqual([]);
  });
  it('formats date-only history without claiming a known time of day', () => {
    expect(formatMeloMemoryTime('2026-09-10', now)).toBe('today');
    expect(formatMeloMemoryTime('2026-09-09', now)).toBe('yesterday');
    expect(formatMeloMemoryTime('2026-09-01', now)).toBe('1 Sept 2026');
  });
  it('preserves elapsed-time labels for real timestamps and rejects invalid dates', () => {
    expect(formatMeloMemoryTime('2026-09-10T09:45:00Z', now)).toBe('just now');
    expect(formatMeloMemoryTime('2026-09-10T09:35:00Z', now)).toBe('10m ago');
    expect(formatMeloMemoryTime('not-a-date', now)).toBe('');
  });
});
