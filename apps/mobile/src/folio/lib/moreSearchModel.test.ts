import { describe, expect, it } from 'vitest';

import { buildMoreSearchResults } from './moreSearchModel';

describe('moreSearchModel', () => {
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
});
