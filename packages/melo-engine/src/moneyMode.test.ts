import { describe, expect, it } from 'vitest';

import { lintCopy } from './copy.js';
import { MODE_LABELS, resolveMoneyMode, type MoneyModeInputs } from './moneyMode.js';

const base = (over: Partial<MoneyModeInputs> = {}): MoneyModeInputs => ({
  ladder: 'calm',
  journey: 'none',
  billsCovered: true,
  savingsThisCyclePence: 0,
  cyclesEndedPositive: 0,
  incomeVaries: false,
  quietMode: false,
  hasDebtBills: false,
  manualMode: null,
  ...over,
});

describe('resolveMoneyMode — manual override wins', () => {
  it('manualMode beats every other signal', () => {
    expect(
      resolveMoneyMode(base({ manualMode: 'growth', ladder: 'overspent', quietMode: true })),
    ).toBe('growth');
  });
});

describe('resolveMoneyMode — priority order', () => {
  it('quietMode wins over everything except manualMode', () => {
    expect(resolveMoneyMode(base({ quietMode: true, ladder: 'danger', journey: 'recovery' }))).toBe(
      'lowVisibility',
    );
  });

  it('reset applies during recovery or rebuilding journeys', () => {
    expect(resolveMoneyMode(base({ journey: 'recovery' }))).toBe('reset');
    expect(resolveMoneyMode(base({ journey: 'rebuilding' }))).toBe('reset');
  });

  it('survival applies on the danger or overspent ladder', () => {
    expect(resolveMoneyMode(base({ ladder: 'danger' }))).toBe('survival');
    expect(resolveMoneyMode(base({ ladder: 'overspent' }))).toBe('survival');
  });

  it('irregular applies when income varies, ahead of debt', () => {
    expect(resolveMoneyMode(base({ incomeVaries: true, hasDebtBills: true }))).toBe('irregular');
  });

  it('debt applies when bills carry debt and income is steady', () => {
    expect(resolveMoneyMode(base({ hasDebtBills: true }))).toBe('debt');
  });

  it('growth requires a real streak and savings this cycle, together', () => {
    expect(resolveMoneyMode(base({ cyclesEndedPositive: 2, savingsThisCyclePence: 1_000 }))).toBe(
      'growth',
    );
    expect(resolveMoneyMode(base({ cyclesEndedPositive: 2, savingsThisCyclePence: 0 }))).not.toBe(
      'growth',
    );
    expect(
      resolveMoneyMode(base({ cyclesEndedPositive: 1, savingsThisCyclePence: 1_000 })),
    ).not.toBe('growth');
  });

  it('optimizer applies when stable and bills-covered but not yet saving this cycle', () => {
    expect(
      resolveMoneyMode(
        base({ billsCovered: true, cyclesEndedPositive: 1, savingsThisCyclePence: 0 }),
      ),
    ).toBe('optimizer');
  });

  it('optimizer yields to growth once savings actually land this cycle', () => {
    expect(
      resolveMoneyMode(
        base({
          billsCovered: true,
          cyclesEndedPositive: 2,
          savingsThisCyclePence: 500,
        }),
      ),
    ).toBe('growth');
  });

  it('stability applies when bills are covered and the ladder is calm or protected', () => {
    expect(resolveMoneyMode(base({ billsCovered: true, ladder: 'protected' }))).toBe('stability');
    expect(resolveMoneyMode(base({ billsCovered: true, ladder: 'calm' }))).toBe('stability');
  });

  it('falls back to planning when nothing else applies', () => {
    expect(resolveMoneyMode(base({ billsCovered: false, ladder: 'tight' }))).toBe('planning');
  });
});

describe('resolveMoneyMode — integer pence discipline', () => {
  it('fractional savings pence throws', () => {
    expect(() => resolveMoneyMode(base({ savingsThisCyclePence: 10.5 }))).toThrow(/integer pence/);
  });

  it('manualMode short-circuits before the pence assertion runs', () => {
    expect(() =>
      resolveMoneyMode(base({ manualMode: 'planning', savingsThisCyclePence: 10.5 })),
    ).not.toThrow();
  });
});

describe('MODE_LABELS — copy law', () => {
  it('every mode has a name and a line that passes lintCopy', () => {
    for (const mode of Object.keys(MODE_LABELS) as (keyof typeof MODE_LABELS)[]) {
      const { name, line } = MODE_LABELS[mode];
      expect(name.length).toBeGreaterThan(0);
      expect(lintCopy(line)).toEqual([]);
    }
  });
});
