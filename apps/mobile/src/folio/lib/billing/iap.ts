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

/** Billing tiers since the Free/Full/Live restructure (MONEY_MODEL.md §2b): 'full' is a ONE-TIME
 *  non-consumable ("yours forever" — zero marginal cost), 'live' is the only subscription
 *  (unlimited AI reads + live sync when built — the only recurring cost). */
export type BillingTier = 'full' | 'live';
export type BillingCadence = 'monthly' | 'yearly';

/** Product ids. `full` is an in-app (non-consumable) product; `live` is a subscription.
 *  LEGACY_PRODUCT_IDS are the superseded Plus/Pro subscription SKUs — never sold anymore, still
 *  recognized on restore so an early purchaser grandfathers into Full. */
export const PRODUCT_IDS = {
  full: 'folio.full',
  live: { monthly: 'folio.live.monthly', yearly: 'folio.live.yearly' },
} as const;

export const LEGACY_PRODUCT_IDS: readonly string[] = [
  'folio.plus.monthly',
  'folio.plus.yearly',
  'folio.pro.monthly',
  'folio.pro.yearly',
];

const SUB_PRODUCT_IDS: readonly string[] = [
  PRODUCT_IDS.live.monthly,
  PRODUCT_IDS.live.yearly,
  ...LEGACY_PRODUCT_IDS,
];

const ALL_PRODUCT_IDS: readonly string[] = [PRODUCT_IDS.full, ...SUB_PRODUCT_IDS];

export function productIdFor(tier: BillingTier, cadence: BillingCadence): string {
  return tier === 'full' ? PRODUCT_IDS.full : PRODUCT_IDS.live[cadence];
}

/** Whether a SKU purchases as a Play subscription or a one-time in-app product — drives the
 *  request/query `type` expo-iap needs. */
export function productTypeFor(productId: string): 'subs' | 'in-app' {
  return productId === PRODUCT_IDS.full ? 'in-app' : 'subs';
}

/** Map a store SKU back to the tier it entitles. Legacy Plus/Pro subs map to 'full' — the
 *  grandfather rule (an early recurring purchaser owns the one-time tier outright). */
export function tierForProductId(productId: string): BillingTier | null {
  if (productId === PRODUCT_IDS.full) return 'full';
  if (productId === PRODUCT_IDS.live.monthly || productId === PRODUCT_IDS.live.yearly)
    return 'live';
  if (LEGACY_PRODUCT_IDS.includes(productId)) return 'full';
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
    // Full is an in-app product and Live a subscription, so the probe must query both types —
    // either being listed is enough to call billing reachable.
    const [inApp, subs] = await Promise.all([
      fetchProducts({ skus: [PRODUCT_IDS.full], type: 'in-app' }),
      fetchProducts({ skus: [...SUB_PRODUCT_IDS], type: 'subs' }),
    ]);
    const found =
      (Array.isArray(inApp) ? inApp.length : 0) + (Array.isArray(subs) ? subs.length : 0);
    if (found === 0) {
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
 *  any failure — callers should treat that the same as "billing unavailable". SKUs are split by
 *  product type (Full = in-app, everything else = subs) and queried per type; the cast narrows
 *  the library's broader `type`-discriminated union back to the `Product` shape this module's
 *  callers expect (price/title/etc. — the fields we actually read). */
export async function queryProducts(skus: readonly string[] = ALL_PRODUCT_IDS): Promise<Product[]> {
  try {
    const inAppSkus = skus.filter((sku) => productTypeFor(sku) === 'in-app');
    const subSkus = skus.filter((sku) => productTypeFor(sku) === 'subs');
    const [inApp, subs] = await Promise.all([
      inAppSkus.length > 0 ? fetchProducts({ skus: inAppSkus, type: 'in-app' }) : [],
      subSkus.length > 0 ? fetchProducts({ skus: subSkus, type: 'subs' }) : [],
    ]);
    const merged = [...(Array.isArray(inApp) ? inApp : []), ...(Array.isArray(subs) ? subs : [])];
    return merged as unknown as Product[];
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
      type: productTypeFor(productId),
    }).catch((err: unknown) => {
      settle({
        status: 'failed',
        message: err instanceof Error ? err.message : 'Purchase could not be started.',
      });
    });
  });
}

/** Mark a verified purchase finished so the store queue clears it. Neither the Full
 *  non-consumable nor the Live subscription is consumable. Swallows failure — a stuck unfinished
 *  transaction just replays harmlessly next launch, it must never crash the app. */
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
