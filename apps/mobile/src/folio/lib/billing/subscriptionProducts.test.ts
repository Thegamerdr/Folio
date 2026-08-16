import { describe, expect, it } from 'vitest';

import { SUBSCRIPTION_PRODUCTS } from './subscriptionProducts';

describe('live subscription products', () => {
  it('pins the Lovable monthly and yearly identifiers and prices', () => {
    expect(SUBSCRIPTION_PRODUCTS).toEqual({
      plus: {
        monthly: { id: 'melo_plus_monthly', priceGbp: 4.99, cadence: 'monthly' },
        yearly: { id: 'melo_plus_yearly', priceGbp: 39.99, cadence: 'yearly' },
      },
      pro: {
        monthly: { id: 'melo_pro_monthly', priceGbp: 8.99, cadence: 'monthly' },
        yearly: { id: 'melo_pro_yearly', priceGbp: 69.99, cadence: 'yearly' },
      },
    });
  });
});
