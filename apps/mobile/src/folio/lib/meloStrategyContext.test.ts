import { beforeEach, describe, expect, it } from 'vitest';
import { getState, getPersistBlob, resetToEmpty, setPartial } from '../store';
import { buildMeloStrategySource } from './meloStrategyContext';
import { compactStrategyContext, runStrategyTool } from '../../local/meloStrategyTools';

const now = new Date('2026-09-13T12:00:00');
beforeEach(() => resetToEmpty());
describe('Strategy source boundary', () => {
  it('reads fresh canonical data without writing or leaking transaction history', () => {
    const state = getState();
    setPartial({
      onboarding: {
        ...state.onboarding,
        done: true,
        financialSetupConfirmed: true,
        payday: 25,
        monthlyIncome: 2000,
      },
      currentBalance: {
        amount: 1440,
        source: 'user-entered',
        confidence: 'corrected',
        provided: true,
        setAt: now.toISOString(),
      },
      accounts: [],
      bufferAmount: 500,
      transactions: [
        {
          id: 'private-transaction',
          merchant: 'PRIVATE TRANSACTION HISTORY',
          amount: -5,
          category: 'food',
          when: now.toISOString(),
          source: 'manual',
        },
      ],
    });
    const before = getPersistBlob();
    const source = buildMeloStrategySource(getState(), now)!;
    const compact = compactStrategyContext(source);
    expect(compact.currentBalanceMinor).toBe(144000);
    expect(compact.protectedBufferMinor).toBe(50000);
    expect(JSON.stringify(source)).not.toContain('PRIVATE TRANSACTION HISTORY');
    expect(JSON.stringify(compact)).not.toContain('private-transaction');
    expect(getPersistBlob()).toBe(before);
    setPartial({ bufferAmount: 600 });
    expect(buildMeloStrategySource(getState(), now)!.input.bufferMinor).toBe(60000);
  });
  it('keeps incomplete setup unknown', () => {
    const source = buildMeloStrategySource(getState(), now)!;
    expect(source.unknowns).toContain('current balance');
    const result = runStrategyTool(source, 'compare_debt_strategies', {
      amountMinor: 0,
      bufferMinor: null,
      cadence: 'once',
      debtId: null,
      strategy: 'avalanche',
    });
    expect(result.status).toBe('unknown');
    expect(result.facts[0]!.text).toContain('I need');
  });
  it('does not build a Personal context for a Business workspace', () => {
    const state = getState();
    expect(
      buildMeloStrategySource(
        { ...state, workspaces: state.workspaces.map((item) => ({ ...item, kind: 'business' })) },
        now,
      ),
    ).toBeNull();
  });
});
