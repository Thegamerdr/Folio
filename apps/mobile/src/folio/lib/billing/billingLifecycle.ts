import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type { Purchase } from 'expo-iap';

import {
  ensurePurchaseListeners,
  finishPurchase,
  probeAvailability,
  restore,
  subscribeToPurchaseUpdates,
} from './iap';
import { verifyGooglePurchase, type BillingVerificationOutcome } from './billingVerification';
import {
  reconcileEntitlements,
  saveVerifiedEntitlement,
  loadActiveEntitlements,
} from './entitlements';

type AcceptedPurchase = BillingVerificationOutcome & { finished?: boolean };
let reconciliation: Promise<void> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let mounted = false;
const processing = new Map<string, Promise<AcceptedPurchase>>();
const entitlementListeners = new Set<() => void>();

export function subscribeToBillingEntitlements(listener: () => void): () => void {
  entitlementListeners.add(listener);
  return () => {
    entitlementListeners.delete(listener);
  };
}

/** Paywall, restore and native events share one verification and durable write per proof. */
export function acceptVerifiedPurchase(purchase: Purchase): Promise<AcceptedPurchase> {
  const key = [
    purchase.productId,
    purchase.purchaseState,
    purchase.purchaseToken ?? purchase.transactionId ?? 'unknown',
  ].join(':');
  const existing = processing.get(key);
  if (existing) return existing;
  const work = (async (): Promise<AcceptedPurchase> => {
    const result = await verifyGooglePurchase(purchase);
    if (result.status !== 'verified') return result;
    if ((await saveVerifiedEntitlement(result.grant)) === null) {
      return {
        status: 'unavailable',
        message:
          'Melo could not safely save the signed store entitlement. Restore purchases to retry.',
      };
    }
    // A failed finish leaves Play's durable queue intact, without erasing verified ownership.
    const finished = await finishPurchase(purchase);
    await reconcileEntitlements();
    entitlementListeners.forEach((listener) => listener());
    return { ...result, finished };
  })()
    .catch(
      (): AcceptedPurchase => ({
        status: 'unavailable',
        message: 'Store verification is temporarily unavailable. Try Restore purchases shortly.',
      }),
    )
    .finally(() => {
      processing.delete(key);
    });
  processing.set(key, work);
  return work;
}

/** Past-due refresh hints back off. Canonical JWT expiry takes precedence over retry delay. */
export function billingRefreshDelay(
  records: readonly { refreshAfter?: string; graceUntil?: string }[],
  now: number,
  retry = false,
): number | null {
  const times: number[] = [];
  for (const record of records) {
    const refresh = Date.parse(record.refreshAfter ?? '');
    if (Number.isFinite(refresh)) {
      if (refresh <= now) retry = true;
      else times.push(refresh);
    }
    const grace = Math.floor(Date.parse(record.graceUntil ?? '') / 1000) * 1000;
    if (Number.isFinite(grace) && grace > now) times.push(grace);
  }
  if (retry) times.push(now + 5 * 60_000);
  if (!times.length) return null;
  return Math.min(Math.max(Math.min(...times) - now, 1), 2_000_000_000);
}

async function refreshLocalEntitlements(retry: boolean): Promise<void> {
  await reconcileEntitlements();
  entitlementListeners.forEach((listener) => listener());
  const records = await loadActiveEntitlements();
  if (!mounted) return;
  if (refreshTimer !== null) clearTimeout(refreshTimer);
  refreshTimer = null;
  const delay = billingRefreshDelay(records, Date.now(), retry);
  if (delay !== null)
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      // Local expiry is independent of an already-running provider query.
      void refreshLocalEntitlements(true).catch(() => undefined);
      void reconcileBillingPurchases();
    }, delay);
}

export async function reconcileBillingPurchases(): Promise<void> {
  if (reconciliation !== null) return reconciliation;
  reconciliation = (async () => {
    let retry = false;
    try {
      // Offline time bounds run before any potentially failing native/network operation.
      await refreshLocalEntitlements(false);
      if (Platform.OS !== 'android') return;
      ensurePurchaseListeners();
      const availability = await probeAvailability();
      retry = !availability.available;
      const purchases = await restore();
      for (const purchase of purchases) {
        const result = await acceptVerifiedPurchase(purchase);
        if (result.status !== 'verified' || result.finished === false) retry = true;
      }
    } catch {
      retry = true;
    } finally {
      await refreshLocalEntitlements(retry).catch(() => undefined);
    }
  })().finally(() => {
    reconciliation = null;
  });
  return reconciliation;
}

/** Mount once, after workspace hydration. No screen owns the store event subscription. */
export function useBillingLifecycle(): void {
  useEffect(() => {
    mounted = true;
    const unsubscribe = subscribeToPurchaseUpdates((purchase) => {
      void acceptVerifiedPurchase(purchase)
        .then((result) =>
          refreshLocalEntitlements(result.status !== 'verified' || result.finished === false),
        )
        .catch(() => undefined);
    });
    void reconcileBillingPurchases();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void reconcileBillingPurchases();
    });
    return () => {
      mounted = false;
      unsubscribe();
      subscription.remove();
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      refreshTimer = null;
    };
  }, []);
}
