export type BillingProduct = Readonly<{
  productId: string;
  tier: 'full' | 'live';
  billingType: 'one_time' | 'subscription';
  cadence: 'one_time' | 'monthly' | 'annual';
  /** Current product brief price; Play Console remains the price authority. */
  prototypePrice: 'GBP 29.99' | 'GBP 2.99/month' | 'GBP 24.99/year' | 'legacy';
  sellable: boolean;
  restoreTier: 'full' | 'live';
}>;

/** Melo's current product shape. Legacy IDs remain restore-only. */
export const BILLING_CATALOG: readonly BillingProduct[] = [
  {
    productId: 'folio.full',
    tier: 'full',
    billingType: 'one_time',
    cadence: 'one_time',
    prototypePrice: 'GBP 29.99',
    sellable: true,
    restoreTier: 'full',
  },
  {
    productId: 'folio.live.monthly',
    tier: 'live',
    billingType: 'subscription',
    cadence: 'monthly',
    prototypePrice: 'GBP 2.99/month',
    sellable: true,
    restoreTier: 'live',
  },
  {
    productId: 'folio.live.yearly',
    tier: 'live',
    billingType: 'subscription',
    cadence: 'annual',
    prototypePrice: 'GBP 24.99/year',
    sellable: true,
    restoreTier: 'live',
  },
  ...(
    ['folio.plus.monthly', 'folio.plus.yearly', 'folio.pro.monthly', 'folio.pro.yearly'] as const
  ).map((productId) => ({
    productId,
    tier: 'full' as const,
    billingType: 'subscription' as const,
    cadence: productId.endsWith('.monthly') ? ('monthly' as const) : ('annual' as const),
    prototypePrice: 'legacy' as const,
    sellable: false,
    restoreTier: 'full' as const,
  })),
];

export const BILLING_PRODUCT_TIERS = new Map(
  BILLING_CATALOG.map((product) => [product.productId, product.tier] as const),
);

export const SELLABLE_BILLING_PRODUCTS = BILLING_CATALOG.filter((product) => product.sellable);
