import { ed25519 } from '@noble/curves/ed25519';
import { describe, expect, it } from 'vitest';

import { verifyEntitlementGrant, type GrantVerificationConfig } from './entitlementGrant';

const privateKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const publicKey = ed25519.getPublicKey(privateKey);
const config: GrantVerificationConfig = {
  issuer: 'https://melo-billing-entitlements.tgdroppin.workers.dev',
  audience: 'com.folio.v2.greenfield',
  keyId: 'melo-billing-ed25519-2026-07',
  publicKey: base64Url(publicKey),
};
const now = new Date('2026-07-14T12:00:00.000Z');

function grant(
  overrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {},
): string {
  const header = base64UrlText(
    JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: config.keyId, ...headerOverrides }),
  );
  const payload = base64UrlText(
    JSON.stringify({
      v: 1,
      platform: 'google-play',
      tier: 'full',
      productId: 'folio.full',
      tokenHash: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
      providerState: 'PURCHASED',
      expiresAt: null,
      refreshAfter: '2026-10-12T12:00:00.000Z',
      graceUntil: null,
      test: false,
      iss: config.issuer,
      aud: config.audience,
      iat: Math.floor(now.getTime() / 1000),
      jti: 'grant-1',
      ...overrides,
    }),
  );
  const signature = ed25519.sign(ascii(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${base64Url(signature)}`;
}

describe('verifyEntitlementGrant', () => {
  it('accepts a correctly signed Full ownership grant', () => {
    expect(verifyEntitlementGrant(grant(), config, now, 'folio.full')).toMatchObject({
      tier: 'full',
      productId: 'folio.full',
      expiresAt: null,
    });
  });

  it('accepts Live through its bounded offline grace', () => {
    const grace = '2026-08-17T12:00:00.123Z';
    const token = grant({
      tier: 'live',
      productId: 'folio.live.monthly',
      providerState: 'SUBSCRIPTION_STATE_ACTIVE',
      expiresAt: '2026-08-14T12:00:00.000Z',
      graceUntil: grace,
      refreshAfter: '2026-07-15T12:00:00.000Z',
      exp: Math.floor(Date.parse(grace) / 1000),
    });
    expect(
      verifyEntitlementGrant(token, config, new Date('2026-08-16T12:00:00.000Z')),
    ).toMatchObject({
      tier: 'live',
    });
  });

  it('accepts provider timestamps with fractional milliseconds at the canonical JWT-second boundary', () => {
    const grace = '2026-08-17T12:00:00.123Z';
    const token = grant({
      tier: 'live',
      productId: 'folio.live.yearly',
      providerState: 'SUBSCRIPTION_STATE_ACTIVE',
      expiresAt: '2026-08-14T12:00:00.456Z',
      graceUntil: grace,
      exp: Math.floor(Date.parse(grace) / 1000),
    });
    expect(
      verifyEntitlementGrant(token, config, new Date('2026-08-16T12:00:00.000Z')),
    ).not.toBeNull();
    expect(
      verifyEntitlementGrant(token, config, new Date('2026-08-17T11:59:59.999Z')),
    ).not.toBeNull();
    expect(verifyEntitlementGrant(token, config, new Date('2026-08-17T12:00:00.000Z'))).toBeNull();
  });

  it('rejects a tampered payload and wrong expected product', () => {
    const token = grant();
    const parts = token.split('.');
    const tampered = `${parts[0]}.${base64UrlText('{}')}.${parts[2]}`;
    expect(verifyEntitlementGrant(tampered, config, now)).toBeNull();
    expect(verifyEntitlementGrant(token, config, now, 'folio.live.monthly')).toBeNull();
  });

  it('rejects expired Live grants and unsigned local tier labels', () => {
    const grace = '2026-07-13T12:00:00.000Z';
    const token = grant({
      tier: 'live',
      productId: 'folio.live.yearly',
      expiresAt: '2026-07-10T12:00:00.000Z',
      graceUntil: grace,
      exp: Date.parse(grace) / 1000,
    });
    expect(verifyEntitlementGrant(token, config, now)).toBeNull();
    expect(verifyEntitlementGrant('{"tier":"full"}', config, now)).toBeNull();
  });
});

function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function base64UrlText(value: string): string {
  return base64Url(ascii(value));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
