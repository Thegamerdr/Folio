/** Store identifiers and fallback GBP prices for the live Lovable pricing surface. */
export const SUBSCRIPTION_PRODUCTS = {
  plus: {
    monthly: {
      id: 'melo_plus_monthly',
      priceGbp: 4.99,
      cadence: 'monthly',
    },
    yearly: {
      id: 'melo_plus_yearly',
      priceGbp: 39.99,
      cadence: 'yearly',
    },
  },
  pro: {
    monthly: {
      id: 'melo_pro_monthly',
      priceGbp: 8.99,
      cadence: 'monthly',
    },
    yearly: {
      id: 'melo_pro_yearly',
      priceGbp: 69.99,
      cadence: 'yearly',
    },
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PRODUCTS;
export type SubscriptionCadence = keyof (typeof SUBSCRIPTION_PRODUCTS)['plus'];
export type SubscriptionProduct =
  (typeof SUBSCRIPTION_PRODUCTS)[SubscriptionTier][SubscriptionCadence];

export const SUBSCRIPTION_PRODUCT_IDS: readonly string[] = Object.values(
  SUBSCRIPTION_PRODUCTS,
).flatMap((tier) => Object.values(tier).map((product) => product.id));

export function subscriptionProductFor(
  tier: SubscriptionTier,
  cadence: SubscriptionCadence,
): SubscriptionProduct {
  return SUBSCRIPTION_PRODUCTS[tier][cadence];
}

export function subscriptionTierForProductId(productId: string): SubscriptionTier | null {
  for (const tier of ['plus', 'pro'] as const) {
    if (Object.values(SUBSCRIPTION_PRODUCTS[tier]).some((product) => product.id === productId)) {
      return tier;
    }
  }
  return null;
}
