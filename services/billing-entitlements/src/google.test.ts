import { describe, expect, it } from 'vitest';

import { googlePlayProvider, BillingProviderError } from './google';
import type { RuntimeEnv } from './types';

const baseEnv: RuntimeEnv = {
  PACKAGE_NAME: 'com.folio.v2.greenfield',
  GOOGLE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'billing@example.iam.gserviceaccount.com',
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
    '-----BEGIN PRIVATE KEY-----\ninvalid\n-----END PRIVATE KEY-----',
  ENTITLEMENT_ISSUER: 'https://billing.example.test',
  ENTITLEMENT_AUDIENCE: 'com.folio.v2.greenfield',
  ENTITLEMENT_SIGNING_KEY_ID: 'key',
};

describe('Google Play provider boundary', () => {
  it('does not treat an arbitrary token endpoint as configured', async () => {
    const provider = googlePlayProvider({
      ...baseEnv,
      GOOGLE_TOKEN_URI: 'https://attacker.example/token',
    });

    expect(provider.configured).toBe(false);
    await expect(provider.verify('folio.full', 'play-token-123')).rejects.toEqual(
      expect.objectContaining<Partial<BillingProviderError>>({
        code: 'provider_not_configured',
        status: 503,
      }),
    );
  });

  it('requires the canonical Google token endpoint even when credentials exist', () => {
    expect(
      googlePlayProvider({
        ...baseEnv,
        GOOGLE_TOKEN_URI: 'http://oauth2.googleapis.com/token',
      }).configured,
    ).toBe(false);
  });
});
