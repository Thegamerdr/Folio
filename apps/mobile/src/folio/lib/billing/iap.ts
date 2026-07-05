// Play Billing seam — a thin wrapper around expo-iap that the paywall calls instead of the
// library directly. This exists so PaywallScreen (and any future upsell surface) never has to
// know whether real billing is reachable: `probeAvailability()` tells the truth, and every other
// export degrades to a safe no-op/throw when billing isn't available, rather than crashing.
//
// HONEST REALITY (2026-07): there is no Play Store listing for this app yet, so on-device this
// module will always resolve `available: false` — `initConnection()` succeeds (expo-iap's mock/
// no-op path in dev) but `fetchProducts()` for our real SKUs returns an empty array because the
// SKUs aren't registered anywhere. `probeAvailability()` treats "connected but zero products
// found for our SKUs" as unavailable, which is the honest signal until a listing exists. This
// keeps the seam real (wired to the actual expo-iap API) while being truthful about what today's
// build can and cannot do — no fake success path, no invented purchase flow.
//
// PaywallScreen's existing preview behavior (Alert-based trial start / restore stub) is the
// fallback whenever `available` is false. When a real listing exists, flip the paywall to call
// `purchase()` / `restore()` here instead — the entitlement write-through is identical either way
// (see ./entitlements.ts).

import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Product,
  type Purchase,
} from 'expo-iap';

export type BillingTier = 'plus' | 'pro';
export type BillingCadence = 'monthly' | 'yearly';

/** Product ids — mirrors PaywallScreen's two tiers x two cadences (monthly/yearly toggle). */
export const PRODUCT_IDS = {
  plus: { monthly: 'folio.plus.monthly', yearly: 'folio.plus.yearly' },
  pro: { monthly: 'folio.pro.monthly', yearly: 'folio.pro.yearly' },
} as const;

const ALL_PRODUCT_IDS: readonly string[] = [
  PRODUCT_IDS.plus.monthly,
  PRODUCT_IDS.plus.yearly,
  PRODUCT_IDS.pro.monthly,
  PRODUCT_IDS.pro.yearly,
];

export function productIdFor(tier: BillingTier, cadence: BillingCadence): string {
  return PRODUCT_IDS[tier][cadence];
}

export function tierForProductId(productId: string): BillingTier | null {
  if (productId === PRODUCT_IDS.plus.monthly || productId === PRODUCT_IDS.plus.yearly)
    return 'plus';
  if (productId === PRODUCT_IDS.pro.monthly || productId === PRODUCT_IDS.pro.yearly) return 'pro';
  return null;
}

export type AvailabilityResult = {
  available: boolean;
  /** Short honest reason, for logging only — never shown verbatim to the user. */
  reason: 'ready' | 'connect-failed' | 'no-products-listed' | 'unsupported-platform';
};

let connected = false;

/**
 * True platform + store availability probe. NEVER throws — every failure mode collapses to
 * `available: false` with a reason, because this gates whether the paywall shows real purchase
 * buttons or its existing honest preview fallback. Safe to call repeatedly; connection is
 * memoized for the session.
 */
export async function probeAvailability(): Promise<AvailabilityResult> {
  try {
    if (!connected) {
      const ok = await initConnection();
      if (!ok) return { available: false, reason: 'connect-failed' };
      connected = true;
    }
    const products = await fetchProducts({ skus: [...ALL_PRODUCT_IDS], type: 'subs' });
    if (!Array.isArray(products) || products.length === 0) {
      return { available: false, reason: 'no-products-listed' };
    }
    return { available: true, reason: 'ready' };
  } catch {
    // Store not reachable (no listing, dev/debug client, emulator without Play, offline, etc.) —
    // this is the expected state until a real Play listing exists. Never surface as a crash.
    return { available: false, reason: 'connect-failed' };
  }
}

/** Fetch store-listed product metadata (price strings, etc.) for the given SKUs. Empty array on
 *  any failure — callers should treat that the same as "billing unavailable". Our SKUs are all
 *  subscriptions, so the `'subs'` query type always yields subscription-shaped entries; the cast
 *  narrows the library's broader `type`-discriminated union back to the `Product` shape this
 *  module's callers expect (price/title/etc. — the fields we actually read). */
export async function queryProducts(skus: readonly string[] = ALL_PRODUCT_IDS): Promise<Product[]> {
  try {
    const result = await fetchProducts({ skus: [...skus], type: 'subs' });
    return Array.isArray(result) ? (result as unknown as Product[]) : [];
  } catch {
    return [];
  }
}

export type PurchaseOutcome =
  | { status: 'purchased'; purchase: Purchase }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

/**
 * Start a purchase flow for one SKU and resolve once expo-iap's event listeners report an
 * outcome for it (expo-iap's requestPurchase is event-based, not promise-resolved — see
 * node_modules/expo-iap CLAUDE.md "Hook API Semantics"). Callers own writing the entitlement
 * (./entitlements.ts) and calling `finishPurchase` after their own verification step.
 */
export function purchase(productId: string): Promise<PurchaseOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (outcome: PurchaseOutcome) => {
      if (settled) return;
      settled = true;
      updatedSub.remove();
      errorSub.remove();
      resolve(outcome);
    };

    const updatedSub = purchaseUpdatedListener((p) => {
      if (p.productId === productId) settle({ status: 'purchased', purchase: p });
    });
    const errorSub = purchaseErrorListener((err) => {
      if (err.code === 'user-cancelled') {
        settle({ status: 'cancelled' });
      } else {
        settle({ status: 'failed', message: err.message });
      }
    });

    requestPurchase({
      request: { google: { skus: [productId] } },
      type: 'subs',
    }).catch((err: unknown) => {
      settle({
        status: 'failed',
        message: err instanceof Error ? err.message : 'Purchase could not be started.',
      });
    });
  });
}

/** Mark a verified purchase finished so the store queue clears it. Subscriptions are never
 *  consumable. Swallows failure — a stuck unfinished transaction just replays harmlessly next
 *  launch, it must never crash the app. */
export async function finishPurchase(p: Purchase): Promise<void> {
  try {
    await finishTransaction({ purchase: p, isConsumable: false });
  } catch {
    /* replay-safe: the platform will re-deliver this transaction next launch/query. */
  }
}

/** The device's currently-held (unfinished/active) purchases for our SKUs. Empty array on any
 *  failure — callers should treat that the same as "nothing found", never as a crash. */
export async function restore(): Promise<Purchase[]> {
  try {
    const all = await getAvailablePurchases();
    return all.filter((p) => ALL_PRODUCT_IDS.includes(p.productId));
  } catch {
    return [];
  }
}

/** Release the store connection. Call on app background/unmount if the app ever opens one
 *  explicitly outside of `probeAvailability()`; safe to call even if never connected. */
export async function closeConnection(): Promise<void> {
  try {
    await endConnection();
  } catch {
    /* no-op — nothing to close. */
  } finally {
    connected = false;
  }
}
