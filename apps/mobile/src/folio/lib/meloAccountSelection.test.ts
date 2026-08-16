import { beforeEach, describe, expect, it } from 'vitest';

import { getState, resetAll, setPartial } from '../store';
import { resolveMeloAccountSelection } from './meloAccountSelection';

const NOW = '2026-07-15T12:00:00.000Z';

beforeEach(() => {
  resetAll();
  setPartial({
    currentBalance: {
      amount: 900,
      source: 'user-entered',
      confidence: 'rough',
      setAt: NOW,
    },
    accounts: [
      {
        id: 'private-current-id',
        name: 'Daily current',
        kind: 'bank',
        isLiability: false,
        balanceMinor: 700,
        balanceAsOfISO: NOW,
        addedAt: NOW,
      },
      {
        id: 'private-savings-id',
        name: 'Rainy day',
        kind: 'savings',
        isLiability: false,
        balanceMinor: 200,
        balanceAsOfISO: NOW,
        addedAt: NOW,
      },
    ],
  });
});

describe('resolveMeloAccountSelection', () => {
  it('does not pick an account for a general account-list question', () => {
    expect(resolveMeloAccountSelection(getState(), 'Show my accounts')).toEqual({
      state: 'not-requested',
    });
  });

  it('requires a choice for an ambiguous account balance question', () => {
    const result = resolveMeloAccountSelection(getState(), 'What is my account balance?');
    expect(result).toMatchObject({ state: 'needs-selection' });
    expect(
      result.state === 'needs-selection' ? result.choices.map((choice) => choice.label) : [],
    ).toEqual(['Daily current', 'Rainy day']);
  });

  it('resolves a named or typed account locally', () => {
    expect(resolveMeloAccountSelection(getState(), 'Use Rainy day')).toEqual({
      state: 'selected',
      accountId: 'private-savings-id',
      label: 'Rainy day',
    });
    expect(resolveMeloAccountSelection(getState(), 'Use my savings account')).toEqual({
      state: 'selected',
      accountId: 'private-savings-id',
      label: 'Rainy day',
    });
  });

  it('refuses account-name access after a crafted Business workspace switch', () => {
    const state = {
      ...getState(),
      activeWorkspaceId: 'workspace_business_injected' as ReturnType<
        typeof getState
      >['activeWorkspaceId'],
    };

    expect(() => resolveMeloAccountSelection(state, 'Use Rainy day')).toThrow(/unavailable/);
  });
});
