import { exportJWK, exportPKCS8, generateKeyPair, decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';

import { canonicalEpochSeconds, entitlementSigner } from './signing';
import type { RuntimeEnv } from './types';

describe('entitlement signing timestamps', () => {
  it('canonicalizes provider milliseconds to the JWT whole-second boundary', () => {
    expect(canonicalEpochSeconds('2026-09-08T12:00:00.123Z')).toBe(1788868800);
  });

  it('emits a real signed grant with canonical exp for the mobile verifier', async () => {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA', { extractable: true });
    const publicJwk = await exportJWK(publicKey);
    const env: RuntimeEnv = {
      PACKAGE_NAME: 'com.folio.v2.greenfield',
      GOOGLE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
      ENTITLEMENT_ISSUER: 'https://billing.example.test',
      ENTITLEMENT_AUDIENCE: 'com.folio.v2.greenfield',
      ENTITLEMENT_SIGNING_KEY_ID: 'test-key',
      ENTITLEMENT_SIGNING_PUBLIC_JWK: JSON.stringify(publicJwk),
      ENTITLEMENT_SIGNING_PRIVATE_KEY: await exportPKCS8(privateKey),
    };
    const token = await entitlementSigner(env).sign({
      v: 1,
      platform: 'google-play',
      tier: 'live',
      productId: 'folio.live.yearly',
      tokenHash: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
      providerState: 'SUBSCRIPTION_STATE_ACTIVE',
      expiresAt: '2026-09-08T12:00:00.456Z',
      refreshAfter: '2026-09-06T12:00:00.789Z',
      graceUntil: '2026-09-08T12:00:00.123Z',
      test: false,
    });
    expect(decodeJwt(token).exp).toBe(canonicalEpochSeconds('2026-09-08T12:00:00.123Z'));
    expect(token.split('.')).toHaveLength(3);
  });
});
