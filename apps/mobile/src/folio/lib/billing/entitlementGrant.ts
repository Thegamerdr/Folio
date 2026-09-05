import { ed25519 } from '@noble/curves/ed25519';

export type VerifiedEntitlementGrant = Readonly<{
  v: 1;
  platform: 'google-play';
  tier: 'full' | 'live';
  productId: string;
  tokenHash: string;
  providerState: string;
  expiresAt: string | null;
  refreshAfter: string;
  graceUntil: string | null;
  test: boolean;
  issuer: string;
  audience: string;
  issuedAt: number;
  id: string;
}>;

export type GrantVerificationConfig = Readonly<{
  issuer: string;
  audience: string;
  keyId: string;
  publicKey: string;
}>;

const PRODUCT_TIERS = new Map<string, 'full' | 'live'>([
  ['folio.full', 'full'],
  ['folio.live.monthly', 'live'],
  ['folio.live.yearly', 'live'],
  ['folio.plus.monthly', 'full'],
  ['folio.plus.yearly', 'full'],
  ['folio.pro.monthly', 'full'],
  ['folio.pro.yearly', 'full'],
]);
const CLOCK_SKEW_SECONDS = 5 * 60;

/**
 * Verify a server-issued Ed25519 entitlement grant entirely on-device. No claim is trusted until
 * its compact-JWS signature, issuer, audience, key id, product/tier mapping and time bounds pass.
 */
export function verifyEntitlementGrant(
  grant: string,
  config: GrantVerificationConfig,
  now: Date,
  expectedProductId?: string,
): VerifiedEntitlementGrant | null {
  try {
    if (config.publicKey.length === 0) return null;
    const parts = grant.split('.');
    if (parts.length !== 3) return null;
    const encodedHeader = parts[0];
    const encodedPayload = parts[1];
    const encodedSignature = parts[2];
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
    const header = jsonObject(base64UrlText(encodedHeader));
    const payload = jsonObject(base64UrlText(encodedPayload));
    if (header['alg'] !== 'EdDSA' || header['typ'] !== 'JWT' || header['kid'] !== config.keyId) {
      return null;
    }
    const signature = base64UrlBytes(encodedSignature);
    const publicKey = base64UrlBytes(config.publicKey);
    const signed = asciiBytes(`${encodedHeader}.${encodedPayload}`);
    if (
      publicKey.length !== 32 ||
      signature.length !== 64 ||
      !ed25519.verify(signature, signed, publicKey)
    ) {
      return null;
    }
    const tier = payload['tier'];
    const productId = payload['productId'];
    const expectedTier = typeof productId === 'string' ? PRODUCT_TIERS.get(productId) : undefined;
    if (
      payload['v'] !== 1 ||
      payload['platform'] !== 'google-play' ||
      (tier !== 'full' && tier !== 'live') ||
      typeof productId !== 'string' ||
      expectedTier !== tier ||
      (expectedProductId !== undefined && productId !== expectedProductId) ||
      payload['iss'] !== config.issuer ||
      payload['aud'] !== config.audience ||
      typeof payload['tokenHash'] !== 'string' ||
      payload['tokenHash'].length < 32 ||
      typeof payload['providerState'] !== 'string' ||
      typeof payload['refreshAfter'] !== 'string' ||
      typeof payload['test'] !== 'boolean' ||
      typeof payload['iat'] !== 'number' ||
      typeof payload['jti'] !== 'string'
    ) {
      return null;
    }
    const nowMs = now.getTime();
    if (!Number.isFinite(nowMs) || payload['iat'] * 1000 > nowMs + CLOCK_SKEW_SECONDS * 1000) {
      return null;
    }
    const refreshMs = Date.parse(payload['refreshAfter']);
    if (!Number.isFinite(refreshMs)) return null;
    const expiresAt = payload['expiresAt'];
    const graceUntil = payload['graceUntil'];
    if (tier === 'full') {
      if (expiresAt !== null || graceUntil !== null) return null;
    } else {
      if (typeof expiresAt !== 'string' || typeof graceUntil !== 'string') return null;
      const expiresMs = Date.parse(expiresAt);
      const graceMs = Date.parse(graceUntil);
      if (!Number.isFinite(expiresMs) || !Number.isFinite(graceMs) || graceMs < expiresMs)
        return null;
      // JWT exp is whole epoch seconds. Google returns RFC3339 values that may carry fractional
      // milliseconds, so compare against the canonical second boundary without rejecting a
      // correctly signed backend grant merely because JSON preserved those milliseconds.
      if (typeof payload['exp'] !== 'number' || payload['exp'] !== Math.floor(graceMs / 1000))
        return null;
      if (nowMs >= payload['exp'] * 1000) return null;
    }
    return {
      v: 1,
      platform: 'google-play',
      tier,
      productId,
      tokenHash: payload['tokenHash'],
      providerState: payload['providerState'],
      expiresAt: tier === 'live' ? (expiresAt as string) : null,
      refreshAfter: payload['refreshAfter'],
      graceUntil: tier === 'live' ? (graceUntil as string) : null,
      test: payload['test'],
      issuer: config.issuer,
      audience: config.audience,
      issuedAt: payload['iat'],
      id: payload['jti'],
    };
  } catch {
    return null;
  }
}

function jsonObject(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected JSON object.');
  }
  return value as Record<string, unknown>;
}

function base64UrlText(value: string): string {
  const bytes = base64UrlBytes(value);
  let encoded = '';
  for (const byte of bytes) encoded += `%${byte.toString(16).padStart(2, '0')}`;
  return decodeURIComponent(encoded);
}

function base64UrlBytes(value: string): Uint8Array {
  const padded = `${value.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}
