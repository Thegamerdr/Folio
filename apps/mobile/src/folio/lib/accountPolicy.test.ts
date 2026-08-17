import { describe, expect, it } from 'vitest';

import {
  creditPosition,
  isAccountInLaunchMoneyPicture,
  isAccountSelectable,
  isCashAccountInLaunchPosition,
  overdraftPosition,
  summarizeCreditAvailability,
  summarizeOverdrafts,
  type LaunchAccountPolicyInput,
} from './accountPolicy';

function account(input: Partial<LaunchAccountPolicyInput> = {}): LaunchAccountPolicyInput {
  return {
    kind: 'bank',
    isLiability: false,
    balanceMinor: 0,
    ...input,
  };
}

describe('launch account policy', () => {
  it('keeps hidden accounts in money totals while preventing new selection', () => {
    const hidden = account({ hidden: true, balanceMinor: 500 });

    expect(isAccountInLaunchMoneyPicture(hidden)).toBe(true);
    expect(isCashAccountInLaunchPosition(hidden)).toBe(true);
    expect(isAccountSelectable(hidden)).toBe(false);
  });

  it('fails closed for foreign, closed and explicitly excluded accounts', () => {
    for (const unavailable of [
      account({ currency: 'EUR' }),
      account({ closed: true }),
      account({ excludedFromTotals: true }),
    ]) {
      expect(isAccountInLaunchMoneyPicture(unavailable)).toBe(false);
      expect(isCashAccountInLaunchPosition(unavailable)).toBe(false);
      expect(isAccountSelectable(unavailable)).toBe(false);
    }
  });

  it('reports card debt, credit balances and facility headroom without treating it as cash', () => {
    expect(
      creditPosition(
        account({
          kind: 'credit-card',
          isLiability: true,
          balanceMinor: 250,
          creditLimit: 1_000,
        }),
      ),
    ).toEqual({
      owed: 250,
      creditBalance: 0,
      limit: 1_000,
      availableCredit: 750,
      overLimitBy: 0,
    });
    expect(
      creditPosition(
        account({
          kind: 'credit-card',
          isLiability: true,
          balanceMinor: -40,
          creditLimit: 500,
        }),
      ),
    ).toEqual({
      owed: 0,
      creditBalance: 40,
      limit: 500,
      availableCredit: 540,
      overLimitBy: 0,
    });
    expect(
      creditPosition(
        account({
          kind: 'credit-card',
          isLiability: true,
          balanceMinor: 1_100,
          creditLimit: 1_000,
        }),
      )?.overLimitBy,
    ).toBe(100);
  });

  it('classifies arranged and unarranged overdrafts without adding headroom to balance', () => {
    expect(overdraftPosition(account({ balanceMinor: -150, arrangedOverdraftLimit: 300 }))).toEqual(
      {
        state: 'arranged',
        balance: -150,
        arrangedLimit: 300,
        arrangedUsed: 150,
        arrangedRemaining: 150,
        unarrangedBy: 0,
      },
    );
    expect(overdraftPosition(account({ balanceMinor: -350, arrangedOverdraftLimit: 300 }))).toEqual(
      {
        state: 'unarranged',
        balance: -350,
        arrangedLimit: 300,
        arrangedUsed: 300,
        arrangedRemaining: 0,
        unarrangedBy: 50,
      },
    );
  });

  it('summaries exclude unavailable accounts and keep debt capacity separate from cash', () => {
    const accounts = [
      account({
        kind: 'credit-card',
        isLiability: true,
        balanceMinor: 250,
        creditLimit: 1_000,
      }),
      account({
        kind: 'credit-card',
        isLiability: true,
        balanceMinor: 10,
      }),
      account({ balanceMinor: -150, arrangedOverdraftLimit: 300 }),
      account({ balanceMinor: -900, arrangedOverdraftLimit: 1_000, closed: true }),
    ];

    expect(summarizeCreditAvailability(accounts)).toEqual({
      knownAvailableCredit: 750,
      unknownLimitAccountCount: 1,
      overLimitBy: 0,
    });
    expect(summarizeOverdrafts(accounts)).toEqual({
      arrangedUsed: 150,
      arrangedRemaining: 150,
      unarrangedBy: 0,
      overdrawnAccountCount: 1,
    });
  });
});
