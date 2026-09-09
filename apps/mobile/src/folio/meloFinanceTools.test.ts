import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyMeloTool,
  getState,
  resetAll,
  setPartial,
} from './store';

beforeEach(() => resetAll());

describe('confirmed Melo finance tools', () => {
  it('records a completed debt payment against debt, cash and the ledger, with scoped undo', () => {
    const result = applyMeloTool('log_debt_payment', { debtName: 'Klarna', amount: 40 });
    expect(result.applied).toBe(true);
    expect(getState().debts?.find((debt) => debt.id === 'seed-klarna')?.balance).toBe(280);
    expect(getState().accounts?.find((account) => account.id === 'acct-main')?.balanceMinor).toBe(680);
    expect(getState().transactions[0]).toMatchObject({ amount: -40, category: 'bills', source: 'melo' });
    if (result.applied) expect(result.undo()).toBe(true);
    expect(getState().debts?.find((debt) => debt.id === 'seed-klarna')?.balance).toBe(320);
    expect(getState().accounts?.find((account) => account.id === 'acct-main')?.balanceMinor).toBe(720);
    expect(getState().transactions[0]?.source).toBe('seed');
  });

  it('rejects an ambiguous debt target and protects against stale undo', () => {
    const original = getState().debts?.[0];
    setPartial({
      debts: [
        ...(getState().debts ?? []),
        ...(original === undefined ? [] : [{ ...original, id: 'duplicate-loan' }]),
      ],
    });
    const result = applyMeloTool('set_debt_balance', { debtName: 'Personal', balance: 0 });
    expect(result).toMatchObject({ applied: false });
    const buffer = applyMeloTool('set_buffer_amount', { amount: 50.5 });
    expect(buffer.applied).toBe(true);
    setPartial({ bufferAmount: 60 });
    if (buffer.applied) expect(buffer.undo()).toBe(false);
    expect(getState().bufferAmount).toBe(60);
  });

  it('persists pence and converts non-weekly essentials into the weekly engine input', () => {
    const buffer = applyMeloTool('set_buffer_amount', { amount: 50.5 });
    expect(buffer.applied).toBe(true);
    expect(getState().bufferAmount).toBe(50.5);
    const essentials = applyMeloTool('set_living_cost', {
      category: 'food',
      amount: 100,
      cadence: 'monthly',
    });
    expect(essentials.applied).toBe(true);
    expect(getState().modeExtras?.reset).toBe(23.08);
  });

  it('updates an existing recurring commitment without changing its cadence', () => {
    const before = getState().subs.find((sub) => sub.name === 'Spotify');
    const result = applyMeloTool('set_commitment', { name: 'Spotify', amount: 12 });
    expect(result.applied).toBe(true);
    expect(getState().subs.find((sub) => sub.name === 'Spotify')).toMatchObject({ cost: 12 });
    expect(getState().subs.find((sub) => sub.name === 'Spotify')?.renewalPeriodDays).toBe(
      before?.renewalPeriodDays,
    );
    expect(applyMeloTool('set_commitment', { name: 'new rent', amount: 950 })).toMatchObject({
      applied: false,
    });
  });
});
