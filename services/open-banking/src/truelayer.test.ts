import { afterEach, describe, expect, it, vi } from 'vitest';

import { trueLayerGateway, ProviderError } from './truelayer';
import type { RuntimeEnv } from './types';

const baseEnv: RuntimeEnv = {
  CLERK_ISSUER: 'https://clerk.test',
  CLERK_JWKS_URL: 'https://clerk.test/jwks.json',
  ALLOWED_ORIGINS: '',
  PUBLIC_BASE_URL: 'https://banking.test',
  APP_RETURN_URI: 'folio://open-banking',
  TRUELAYER_ENVIRONMENT: 'sandbox',
  TRUELAYER_AUTH_BASE_URL: 'https://auth.test',
  TRUELAYER_API_BASE_URL: 'https://api.test',
  TRUELAYER_CLIENT_ID: 'client',
  TRUELAYER_CLIENT_SECRET: 'secret',
  CONNECTION_ENCRYPTION_KEY: 'key',
};

afterEach(() => vi.restoreAllMocks());

describe('TrueLayer transport boundary', () => {
  it('rejects plaintext or credential-bearing provider URLs before any request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const gateway = trueLayerGateway({
      ...baseEnv,
      TRUELAYER_AUTH_BASE_URL: 'http://auth.test',
      TRUELAYER_API_BASE_URL: 'https://user:password@api.test',
    });

    expect(gateway.configured).toBe(false);
    await expect(gateway.listAccounts('connection')).rejects.toMatchObject({
      code: 'provider_not_configured',
      status: 503,
    } satisfies Partial<ProviderError>);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('turns malformed provider JSON into a generic response error without provider text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"access_token":"token"}', { status: 200 }),
    );
    const gateway = trueLayerGateway(baseEnv);
    // The token response is accepted, but the account response is deliberately malformed.
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('{"access_token":"token"}', { status: 200 }),
    );
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('{"detail":"account number 123456"}', { status: 200 }),
    );

    await expect(gateway.listAccounts('connection')).rejects.toMatchObject({
      code: 'invalid_provider_response',
      status: 502,
    });
    try {
      await gateway.listAccounts('connection');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect(String(error)).not.toContain('123456');
    }
  });
});
