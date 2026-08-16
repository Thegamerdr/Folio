import { ed25519 } from '@noble/curves/ed25519';
import { describe, expect, it } from 'vitest';

import { verifyEntitlementGrant, type GrantVerificationConfig } from './entitlementGrant';

const privateKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const publicKey = ed25519.getPublicKey(privateKey);
const config: GrantVerificationConfig = {
  issuer: 'https://melo-billing-entitlements.tgdroppin.workers.dev',
  audience: 'com.melomoney.app',
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
      tier: 'plus',
      productId: 'melo_plus_monthly',
      tokenHash: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
      providerState: 'SUBSCRIPTION_STATE_ACTIVE',
      expiresAt: '2026-08-14T12:00:00.000Z',
      refreshAfter: '2026-07-15T12:00:00.000Z',
      graceUntil: '2026-08-17T12:00:00.000Z',
      exp: Date.parse('2026-08-17T12:00:00.000Z') / 1000,
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
  it('accepts a correctly signed Plus subscription grant', () => {
    expect(verifyEntitlementGrant(grant(), config, now, 'melo_plus_monthly')).toMatchObject({
      tier: 'plus',
      productId: 'melo_plus_monthly',
      expiresAt: '2026-08-14T12:00:00.000Z',
    });
  });

  it('accepts Pro through its bounded offline grace', () => {
    const grace = '2026-08-17T12:00:00.000Z';
    const token = grant({
      tier: 'pro',
      productId: 'melo_pro_monthly',
      providerState: 'SUBSCRIPTION_STATE_ACTIVE',
      expiresAt: '2026-08-14T12:00:00.000Z',
      graceUntil: grace,
      refreshAfter: '2026-07-15T12:00:00.000Z',
      exp: Date.parse(grace) / 1000,
    });
    expect(
      verifyEntitlementGrant(token, config, new Date('2026-08-16T12:00:00.000Z')),
    ).toMatchObject({
      tier: 'pro',
    });
  });

  it('rejects a tampered payload and wrong expected product', () => {
    const token = grant();
    const parts = token.split('.');
    const tampered = `${parts[0]}.${base64UrlText('{}')}.${parts[2]}`;
    expect(verifyEntitlementGrant(tampered, config, now)).toBeNull();
    expect(verifyEntitlementGrant(token, config, now, 'melo_pro_monthly')).toBeNull();
  });

  it('rejects expired subscription grants and unsigned local tier labels', () => {
    const grace = '2026-07-13T12:00:00.000Z';
    const token = grant({
      tier: 'pro',
      productId: 'melo_pro_yearly',
      expiresAt: '2026-07-10T12:00:00.000Z',
      graceUntil: grace,
      exp: Date.parse(grace) / 1000,
    });
    expect(verifyEntitlementGrant(token, config, now)).toBeNull();
    expect(verifyEntitlementGrant('{"tier":"pro"}', config, now)).toBeNull();
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
