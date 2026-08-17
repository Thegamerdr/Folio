/**
 * Store seam for the live Melo Plus / Melo Pro subscription model.
 *
 * Billing availability is proven by a successful store connection and at least one configured
 * Melo product. Purchases are event-driven, remain locked while pending, and are never granted
 * locally without the signed server entitlement handled by billingVerification.ts.
 */
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type ProductSubscription,
  type Purchase,
} from 'expo-iap';

import {
  SUBSCRIPTION_PRODUCT_IDS,
  subscriptionProductFor,
  subscriptionTierForProductId,
  type SubscriptionCadence,
  type SubscriptionTier,
} from './subscriptionProducts';

export type BillingTier = SubscriptionTier;
export type BillingCadence = SubscriptionCadence;

export type SubscriptionReplacement = Readonly<{
  oldProductId: string;
  purchaseToken: string;
}>;

export function productIdFor(tier: BillingTier, cadence: BillingCadence): string {
  return subscriptionProductFor(tier, cadence).id;
}

export function tierForProductId(productId: string): BillingTier | null {
  return subscriptionTierForProductId(productId);
}

export type AvailabilityResult = {
  available: boolean;
  /** Short diagnostic reason; UI uses product copy rather than exposing this value. */
  reason: 'ready' | 'connect-failed' | 'no-products-listed' | 'unsupported-platform';
};

let connected = false;

/** Store availability probe. Every failure becomes an honest unavailable result, never a crash. */
export async function probeAvailability(): Promise<AvailabilityResult> {
  try {
    if (!connected) {
      const ok = await initConnection();
      if (!ok) return { available: false, reason: 'connect-failed' };
      connected = true;
    }
    const products = await queryProducts();
    return products.length > 0
      ? { available: true, reason: 'ready' }
      : { available: false, reason: 'no-products-listed' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return {
      available: false,
      reason: message.includes('platform') ? 'unsupported-platform' : 'connect-failed',
    };
  }
}

/** Store-localized product metadata. Empty means the listing is not reachable/configured. */
export async function queryProducts(
  skus: readonly string[] = SUBSCRIPTION_PRODUCT_IDS,
): Promise<ProductSubscription[]> {
  try {
    const products = await fetchProducts({ skus: [...skus], type: 'subs' });
    if (!Array.isArray(products)) return [];
    return (products as ProductSubscription[]).filter(
      (product) =>
        product.type === 'subs' &&
        (product.platform !== 'android' || product.productStatusAndroid !== 'not-found') &&
        SUBSCRIPTION_PRODUCT_IDS.includes(product.id),
    );
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
 * Start one Plus/Pro subscription. Android receives the store-returned base-plan offer token;
 * an existing Plus token is supplied when upgrading to Pro so Play replaces rather than stacks
 * subscriptions.
 */
export function purchase(
  productId: string,
  product: ProductSubscription,
  replacement?: SubscriptionReplacement,
): Promise<PurchaseOutcome> {
  if (!SUBSCRIPTION_PRODUCT_IDS.includes(productId) || product.id !== productId) {
    return Promise.resolve({ status: 'failed', message: 'This Melo plan is not available.' });
  }
  const offerToken = androidBasePlanOfferToken(product);
  if (product.platform === 'android' && offerToken === null) {
    return Promise.resolve({
      status: 'failed',
      message: 'Google Play returned no eligible offer for this plan.',
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(
      () => settle({ status: 'failed', message: 'The store took too long to respond.' }),
      120_000,
    );
    const settle = (outcome: PurchaseOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      updatedSub.remove();
      errorSub.remove();
      resolve(outcome);
    };

    const updatedSub = purchaseUpdatedListener((candidate) => {
      if (candidate.productId !== productId) return;
      if (candidate.purchaseState === 'pending') settle({ status: 'pending' });
      else if (candidate.purchaseState === 'purchased') {
        settle({ status: 'purchased', purchase: candidate });
      }
    });
    const errorSub = purchaseErrorListener((error) => {
      if (error.code === 'user-cancelled') settle({ status: 'cancelled' });
      else settle({ status: 'failed', message: error.message });
    });

    const googleRequest = {
      skus: [productId],
      ...(offerToken === null ? {} : { subscriptionOffers: [{ sku: productId, offerToken }] }),
      ...(replacement === undefined
        ? {}
        : {
            purchaseToken: replacement.purchaseToken,
            subscriptionProductReplacementParams: {
              oldProductId: replacement.oldProductId,
              replacementMode: 'with-time-proration' as const,
            },
          }),
    };
    requestPurchase({
      request: {
        apple: { sku: productId },
        google: googleRequest,
      },
      type: 'subs',
    }).catch((error: unknown) => {
      settle({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Purchase could not be started.',
      });
    });
  });
}

/** Finish only after signed server verification succeeds. Re-delivery is safe if this fails. */
export async function finishPurchase(purchaseToFinish: Purchase): Promise<void> {
  try {
    await finishTransaction({ purchase: purchaseToFinish, isConsumable: false });
  } catch {
    // The platform will re-deliver an unfinished transaction on the next restore/connection.
  }
}

export type RestorePurchasesOutcome =
  | Readonly<{ status: 'ok'; purchases: readonly Purchase[] }>
  | Readonly<{ status: 'unavailable'; message: string }>;

/**
 * Query currently owned Melo products without confusing a store/network failure with "you own
 * nothing". That distinction is essential for both honest Restore copy and Plus-to-Pro replacement:
 * proceeding without the old purchase token can accidentally leave two subscriptions active.
 */
export async function restoreWithStatus(): Promise<RestorePurchasesOutcome> {
  try {
    const all = await getAvailablePurchases();
    return {
      status: 'ok',
      purchases: all.filter((purchaseToRestore) =>
        SUBSCRIPTION_PRODUCT_IDS.includes(purchaseToRestore.productId),
      ),
    };
  } catch {
    return {
      status: 'unavailable',
      message: 'The store could not check your purchases. Try again when the store is available.',
    };
  }
}

/** Compatibility helper for non-UI callers that intentionally treat unavailable as empty. */
export async function restore(): Promise<Purchase[]> {
  const outcome = await restoreWithStatus();
  return outcome.status === 'ok' ? [...outcome.purchases] : [];
}

export async function closeConnection(): Promise<void> {
  try {
    await endConnection();
  } catch {
    // Nothing to close.
  } finally {
    connected = false;
  }
}

function androidBasePlanOfferToken(product: ProductSubscription): string | null {
  if (product.platform !== 'android') return null;
  const basePlan =
    product.subscriptionOfferDetailsAndroid.find((offer) => offer.offerId == null) ??
    product.subscriptionOfferDetailsAndroid[0];
  return basePlan?.offerToken ?? null;
}
