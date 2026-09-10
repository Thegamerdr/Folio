import { describe, expect, it } from 'vitest';

import { buildMoreSearchResults } from './moreSearchModel';

describe('moreSearchModel', () => {
  it('keeps Shortfall discoverable through normal navigation even without a funded pot', () => {
    const empty = { pots: [], subscriptions: [], debts: [] };
    expect(buildMoreSearchResults('shortfall', empty)).toEqual([
      expect.objectContaining({
        label: 'Shortfall',
        target: { kind: 'screen', screen: 'shortfall' },
      }),
    ]);
    expect(buildMoreSearchResults('', empty).some((row) => row.id === 'shortfall')).toBe(true);
  });
  it.each(['transfer', 'refund'] as const)('finds the shipping %s action', (query) => {
    const result = buildMoreSearchResults(query, { pots: [], subscriptions: [], debts: [] });
    expect(result).toHaveLength(1);
    expect(result[0]?.target).toEqual({ kind: 'sheet', sheet: query });
  });

  it('searches current records and keeps actions on real destinations', () => {
    const results = buildMoreSearchResults('spotify', {
      pots: ['Holiday'],
      subscriptions: ['Spotify'],
      debts: ['Credit card'],
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.target).toEqual({ kind: 'screen', screen: 'subs' });
  });

  it('routes Add a debt to the declaration sheet rather than a payment form', () => {
    const result = buildMoreSearchResults('add a debt', {
      pots: [],
      subscriptions: [],
      debts: [],
    })[0];
    expect(result?.target).toEqual({ kind: 'sheet', sheet: 'declare-debt' });
  });

  it('keeps legacy subscription searches working after the inclusive destination rename', () => {
    const data = { pots: [], subscriptions: ['Rent + bills', 'Spotify'], debts: [] };
    for (const query of ['subscriptions', 'subscription', 'subs']) {
      const results = buildMoreSearchResults(query, data);
      expect(results.map((row) => row.label)).toEqual([
        'Rent + bills',
        'Spotify',
        'Bills and commitments',
      ]);
      expect(
        results.every((row) => row.target.kind === 'screen' && row.target.screen === 'subs'),
      ).toBe(true);
    }
    const destination = buildMoreSearchResults('bills and commitments', data);
    expect(destination).toHaveLength(1);
    expect(destination[0]?.target).toEqual({ kind: 'screen', screen: 'subs' });
    expect(buildMoreSearchResults('rent', data)[0]?.meta).toBe(
      'Bill / commitment · recurring charge',
    );
  });
});
