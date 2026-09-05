// Play Billing seam — a thin wrapper around expo-iap that the paywall calls instead of the
// library directly. This exists so PaywallScreen (and any future upsell surface) never has to
// know whether real billing is reachable: `probeAvailability()` tells the truth, and every other
// export degrades to a safe no-op/throw when billing isn't available, rather than crashing.
//
// HONEST REALITY (2026-07): there is no Play Store listing for this app yet, so on-device this
// module resolves `available: false` until a real Play listing exists — `initConnection()` may
// succeed (expo-iap's mock/no-op path in dev) while `fetchProducts()` returns no registered SKUs.
// Each SKU is tracked independently so one legacy/partial listing cannot make an unrelated sell
// button appear. This keeps the seam real while being truthful about what the build can do.
//
// PaywallScreen's existing preview behavior (Alert-based trial start / restore stub) remains the
// fallback for unavailable SKUs. Listed purchases use the same verified write-through
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
  type ProductOrSubscription,
  type Purchase,
} from 'expo-iap';
import { Platform } from 'react-native';

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
const SELLABLE_PRODUCT_IDS: readonly string[] = [
  PRODUCT_IDS.full,
  PRODUCT_IDS.live.monthly,
  PRODUCT_IDS.live.yearly,
];

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
  /** Store-listed, localized metadata keyed by SKU. Legacy restore SKUs remain visible here but
   * are never sold by the paywall. */
  products: Readonly<Record<string, StoreProductMetadata>>;
  availableProductIds: readonly string[];
  /** Short honest reason, for logging only — never shown verbatim to the user. */
  reason: 'ready' | 'connect-failed' | 'no-products-listed' | 'unsupported-platform';
};

export type StoreProductMetadata = Readonly<{
  productId: string;
  displayPrice: string;
  currency: string;
  type: 'in-app' | 'subs';
  /** The selected eligible Play offer. Required for subscription purchase requests. */
  offerToken?: string;
  basePlanId?: string;
  offerId?: string;
  billingPeriod?: 'P1M' | 'P1Y';
}>;

export function metadataForProducts(
  products: readonly ProductOrSubscription[],
): StoreProductMetadata[] {
  return products.flatMap((product) => {
    if (typeof product.id !== 'string' || typeof product.displayPrice !== 'string') return [];
    if (product.type !== productTypeFor(product.id) || product.displayPrice.trim().length === 0)
      return [];
    const metadata: StoreProductMetadata = {
      productId: product.id,
      displayPrice: product.displayPrice,
      currency: product.currency,
      type: product.type,
    };
    if (product.type === 'subs' && product.platform === 'android') {
      const offers = product.subscriptionOfferDetailsAndroid ?? [];
      // Sell the regular auto-renewing base plan only. Introductory/instalment offers need
      // their own multi-phase disclosure UI; do not pick one while advertising another price.
      const expectedPeriod = product.id.endsWith('.yearly') ? 'P1Y' : 'P1M';
      const offer = offers.find((candidate) => {
        const phases = candidate.pricingPhases.pricingPhaseList;
        return (
          !candidate.offerId &&
          !candidate.installmentPlanDetails &&
          candidate.offerToken.length > 0 &&
          phases.length === 1 &&
          phases[0]?.recurrenceMode === 1 &&
          phases[0].billingPeriod === expectedPeriod
        );
      });
      if (offer) {
        return [
          {
            ...metadata,
            displayPrice: offer.pricingPhases.pricingPhaseList[0]!.formattedPrice,
            currency: offer.pricingPhases.pricingPhaseList[0]!.priceCurrencyCode,
            billingPeriod: expectedPeriod,
            offerToken: offer.offerToken,
            basePlanId: offer.basePlanId,
            ...(offer.offerId ? { offerId: offer.offerId } : {}),
          },
        ];
      }
      return [];
    }
    if (product.platform === 'ios') {
      if (product.type === 'in-app') return product.typeIOS === 'non-consumable' ? [metadata] : [];
      const expectedUnit = product.id.endsWith('.yearly') ? 'year' : 'month';
      const period = product.subscriptionInfoIOS?.subscriptionPeriod;
      const unit = product.subscriptionPeriodUnitIOS ?? period?.unit;
      const count = Number(product.subscriptionPeriodNumberIOS ?? period?.value);
      // Commitment plans need their own disclosure. Sell only ordinary monthly/yearly terms here.
      if (
        product.typeIOS !== 'auto-renewable-subscription' ||
        unit !== expectedUnit ||
        count !== 1 ||
        (product.pricingTermsIOS?.length ??
          product.subscriptionInfoIOS?.pricingTerms?.length ??
          0) > 0
      )
        return [];
      return [{ ...metadata, billingPeriod: expectedUnit === 'year' ? 'P1Y' : 'P1M' }];
    }
    return [metadata];
  });
}

let connected = false;
let cachedProducts: Readonly<Record<string, StoreProductMetadata>> = {};
type PurchaseSubscription = { remove: () => void };
type PurchaseUpdateHandler = (purchase: Purchase) => void;
let purchaseUpdatesSubscription: PurchaseSubscription | null = null;
let purchaseErrorsSubscription: PurchaseSubscription | null = null;
const purchaseUpdateHandlers = new Set<PurchaseUpdateHandler>();
const pendingResolvers = new Map<string, (outcome: PurchaseOutcome) => void>();

export function subscribeToPurchaseUpdates(handler: PurchaseUpdateHandler): () => void {
  purchaseUpdateHandlers.add(handler);
  return () => purchaseUpdateHandlers.delete(handler);
}

export function ensurePurchaseListeners(): void {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  if (purchaseUpdatesSubscription !== null) return;
  purchaseUpdatesSubscription = purchaseUpdatedListener((purchase) => {
    // Play is the durable queue, including pending purchases across restarts. Never suppress a
    // redelivery merely because the paywall saw it: verification/persistence may have failed.
    const resolver = pendingResolvers.get(purchase.productId);
    if (resolver) {
      if (purchase.purchaseState === 'pending') {
        pendingResolvers.delete(purchase.productId);
        resolver({ status: 'pending' });
      } else if (purchase.purchaseState === 'purchased') {
        pendingResolvers.delete(purchase.productId);
        resolver({ status: 'purchased', purchase });
      }
    }
    purchaseUpdateHandlers.forEach((handler) => {
      try {
        handler(purchase);
      } catch {
        /* One observer must not interrupt expo-iap's durable native event listener. */
      }
    });
  });
  purchaseErrorsSubscription = purchaseErrorListener((error) => {
    const productId = error.productId ?? [...pendingResolvers.keys()][0];
    const resolver = productId === undefined ? undefined : pendingResolvers.get(productId);
    if (!resolver || productId === undefined) return;
    pendingResolvers.delete(productId);
    resolver(
      error.code === 'user-cancelled'
        ? { status: 'cancelled' }
        : { status: 'failed', message: error.message },
    );
  });
}

/**
 * True platform + store availability probe. NEVER throws — every failure mode collapses to
 * `available: false` with a reason, because this gates whether the paywall shows real purchase
 * buttons or its existing honest preview fallback. Safe to call repeatedly; connection is
 * memoized for the session.
 */
export async function probeAvailability(): Promise<AvailabilityResult> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return {
      available: false,
      products: {},
      availableProductIds: [],
      reason: 'unsupported-platform',
    };
  }
  try {
    if (!connected) {
      const ok = await initConnection();
      if (!ok)
        return {
          available: false,
          products: {},
          availableProductIds: [],
          reason: 'connect-failed',
        };
      connected = true;
    }
    // Full is an in-app product and Live a subscription, so the probe must query both types —
    // either being listed is enough to call billing reachable.
    const [inApp, subs] = await Promise.all([
      fetchProducts({ skus: [PRODUCT_IDS.full], type: 'in-app' }).catch(() => []),
      fetchProducts({ skus: [...SUB_PRODUCT_IDS], type: 'subs' }).catch(() => []),
    ]);
    const products = metadataForProducts([
      ...(Array.isArray(inApp) ? inApp : []),
      ...(Array.isArray(subs) ? subs : []),
    ]);
    cachedProducts = Object.fromEntries(products.map((product) => [product.productId, product]));
    const availableProductIds = products
      .filter(
        (product) =>
          SELLABLE_PRODUCT_IDS.includes(product.productId) &&
          (product.productId === PRODUCT_IDS.full ||
            (Platform.OS === 'ios'
              ? product.billingPeriod !== undefined
              : product.offerToken !== undefined)),
      )
      .map((product) => product.productId);
    return availableProductIds.length === 0
      ? {
          available: false,
          products: cachedProducts,
          availableProductIds,
          reason: 'no-products-listed',
        }
      : { available: true, products: cachedProducts, availableProductIds, reason: 'ready' };
  } catch {
    // Store not reachable (no listing, dev/debug client, emulator without Play, offline, etc.) —
    // this is the expected state until a real Play listing exists. Never surface as a crash.
    return {
      available: false,
      products: cachedProducts,
      availableProductIds: [],
      reason: 'connect-failed',
    };
  }
}

/** Fetch store-listed product metadata (price strings, etc.) for the given SKUs. Empty array on
 * any failure — callers should treat that the same as "billing unavailable". SKUs are split by
 * product type (Full = in-app, everything else = subs) and queried per type. */
export async function queryProducts(
  skus: readonly string[] = ALL_PRODUCT_IDS,
): Promise<ProductOrSubscription[]> {
  try {
    const inAppSkus = skus.filter((sku) => productTypeFor(sku) === 'in-app');
    const subSkus = skus.filter((sku) => productTypeFor(sku) === 'subs');
    const [inApp, subs] = await Promise.all([
      inAppSkus.length > 0 ? fetchProducts({ skus: inAppSkus, type: 'in-app' }) : [],
      subSkus.length > 0 ? fetchProducts({ skus: subSkus, type: 'subs' }) : [],
    ]);
    const merged = [...(Array.isArray(inApp) ? inApp : []), ...(Array.isArray(subs) ? subs : [])];
    return merged;
  } catch {
    return [];
  }
}

export type PurchaseOutcome =
  | { status: 'purchased'; purchase: Purchase }
  | { status: 'pending' }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

/**
 * Start a purchase flow for one SKU and resolve once expo-iap's event listeners report an
 * outcome for it (expo-iap's requestPurchase is event-based, not promise-resolved — see
 * node_modules/expo-iap CLAUDE.md "Hook API Semantics"). Callers own writing the entitlement
 * (./entitlements.ts) and calling `finishPurchase` after their own verification step.
 */
export function purchase(productId: string, offerToken?: string): Promise<PurchaseOutcome> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios')
    return Promise.resolve({
      status: 'failed',
      message: 'Store purchases are unavailable on this platform.',
    });
  if (
    ![PRODUCT_IDS.full, PRODUCT_IDS.live.monthly, PRODUCT_IDS.live.yearly].some(
      (id) => id === productId,
    )
  ) {
    return Promise.resolve({
      status: 'failed',
      message: 'This product is restore-only or unavailable.',
    });
  }
  if (pendingResolvers.size > 0) {
    return Promise.resolve({
      status: 'failed',
      message: 'A store purchase is already in progress.',
    });
  }
  const selectedOfferToken = offerToken ?? cachedProducts[productId]?.offerToken;
  if (Platform.OS === 'android' && productTypeFor(productId) === 'subs' && !selectedOfferToken) {
    return Promise.resolve({
      status: 'failed',
      message: 'This subscription has no eligible Play offer.',
    });
  }
  try {
    ensurePurchaseListeners();
  } catch {
    return Promise.resolve({
      status: 'failed',
      message: 'The store could not start this purchase.',
    });
  }
  return new Promise((resolve) => {
    // A lost native event must not leave the paywall permanently busy. Later events still reach
    // the app-wide verifier; timing out never finishes a purchase or fabricates ownership.
    const timeout = setTimeout(() => {
      if (pendingResolvers.get(productId) === settle) pendingResolvers.delete(productId);
      resolve({
        status: 'failed',
        message: 'No store result arrived yet. Check Restore purchases before trying again.',
      });
    }, 120_000);
    const settle = (outcome: PurchaseOutcome) => {
      clearTimeout(timeout);
      resolve(outcome);
    };
    pendingResolvers.set(productId, settle);

    requestPurchase({
      request:
        Platform.OS === 'ios'
          ? { apple: { sku: productId, andDangerouslyFinishTransactionAutomatically: false } }
          : {
              google: {
                skus: [productId],
                ...(selectedOfferToken
                  ? { subscriptionOffers: [{ sku: productId, offerToken: selectedOfferToken }] }
                  : {}),
              },
            },
      type: productTypeFor(productId),
    }).catch((err: unknown) => {
      if (pendingResolvers.get(productId) === settle) pendingResolvers.delete(productId);
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
export async function finishPurchase(p: Purchase): Promise<boolean> {
  try {
    await finishTransaction({ purchase: p, isConsumable: false });
    return true;
  } catch {
    /* replay-safe: the platform will re-deliver this transaction next launch/query. */
    return false;
  }
}

/** Play owns the durable unfinished/pending queue. A query failure is not an empty queue;
 * callers must catch it and offer retry instead of claiming no purchases exist. */
export async function restore(): Promise<Purchase[]> {
  const all = await getAvailablePurchases();
  return all.filter((p) => ALL_PRODUCT_IDS.includes(p.productId));
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
