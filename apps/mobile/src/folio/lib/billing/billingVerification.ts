import Constants from 'expo-constants';
import type { Purchase } from 'expo-iap';

import {
  verifyEntitlementGrant,
  type GrantVerificationConfig,
  type VerifiedEntitlementGrant,
} from './entitlementGrant';

const DEFAULT_BILLING_URL = 'https://melo-billing-entitlements.tgdroppin.workers.dev';
const ISSUER = DEFAULT_BILLING_URL;
const AUDIENCE = 'com.folio.v2.greenfield';
const KEY_ID = 'melo-billing-ed25519-2026-07';

export type BillingVerificationOutcome =
  | { status: 'verified'; grant: string; entitlement: VerifiedEntitlementGrant }
  | { status: 'pending' }
  | { status: 'unavailable'; message: string }
  | { status: 'rejected'; message: string };

export async function verifyGooglePurchase(
  purchase: Purchase,
): Promise<BillingVerificationOutcome> {
  if (purchase.purchaseState === 'pending') return { status: 'pending' };
  if (purchase.purchaseState !== 'purchased') {
    return { status: 'rejected', message: 'Google Play has not completed this purchase.' };
  }
  const purchaseToken = purchase.purchaseToken;
  if (typeof purchaseToken !== 'string' || purchaseToken.length === 0) {
    return { status: 'rejected', message: 'Google Play returned no purchase proof.' };
  }
  const config = billingVerificationConfig();
  if (config === null) {
    return {
      status: 'unavailable',
      message: 'Store verification is not configured for this Melo build yet.',
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${billingUrl()}/v1/google/verify`, {
      signal: controller.signal,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: purchase.productId, purchaseToken }),
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const code = typeof body?.['code'] === 'string' ? body['code'] : '';
      if (code === 'purchase_pending') return { status: 'pending' };
      const message =
        typeof body?.['error'] === 'string'
          ? body['error']
          : 'Google Play could not confirm this purchase.';
      return response.status >= 500
        ? { status: 'unavailable', message }
        : { status: 'rejected', message };
    }
    const grant = typeof body?.['grant'] === 'string' ? body['grant'] : '';
    const entitlement = verifyEntitlementGrant(grant, config, new Date(), purchase.productId);
    if (entitlement === null) {
      return {
        status: 'rejected',
        message: 'Melo could not validate the signed store entitlement.',
      };
    }
    return { status: 'verified', grant, entitlement };
  } catch {
    return {
      status: 'unavailable',
      message: 'Store verification is temporarily unavailable. Try Restore purchases shortly.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function billingVerificationConfig(): GrantVerificationConfig | null {
  const publicKey = publicValue('EXPO_PUBLIC_MELO_BILLING_ENTITLEMENT_PUBLIC_KEY');
  if (publicKey === null) return null;
  return { issuer: ISSUER, audience: AUDIENCE, keyId: KEY_ID, publicKey };
}

function billingUrl(): string {
  return (publicValue('EXPO_PUBLIC_MELO_BILLING_URL') ?? DEFAULT_BILLING_URL).replace(/\/$/, '');
}

function publicValue(key: string): string | null {
  const fromEnv = process.env[key];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim();
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[key];
  return typeof fromExtra === 'string' && fromExtra.trim().length > 0 ? fromExtra.trim() : null;
}
