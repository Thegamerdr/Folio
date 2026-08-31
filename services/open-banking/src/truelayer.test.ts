import { afterEach, describe, expect, it, vi } from 'vitest';

import { trueLayerGateway, ProviderError } from './truelayer';
import type { RuntimeEnv } from './types';

const KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, index) => index + 1)));

const baseEnv: RuntimeEnv = {
  CLERK_ISSUER: 'https://clerk.test',
  CLERK_JWKS_URL: 'https://clerk.test/jwks.json',
  ALLOWED_ORIGINS: '',
  PUBLIC_BASE_URL: 'https://banking.test',
  APP_RETURN_URI: 'folio://open-banking',
  TRUELAYER_ENVIRONMENT: 'sandbox',
  TRUELAYER_AUTH_BASE_URL: 'https://auth.truelayer-sandbox.com',
  TRUELAYER_API_BASE_URL: 'https://api.truelayer-sandbox.com',
  TRUELAYER_CLIENT_ID: 'client',
  TRUELAYER_CLIENT_SECRET: 'secret',
  CONNECTION_ENCRYPTION_KEY: KEY,
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

  it('requires a valid 32-byte encryption key before reporting configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const gateway = trueLayerGateway({ ...baseEnv, CONNECTION_ENCRYPTION_KEY: 'not-a-key' });

    expect(gateway.configurationValid).toBe(true);
    expect(gateway.configured).toBe(false);
    await expect(gateway.listAccounts('connection')).rejects.toMatchObject({
      code: 'provider_not_configured',
      status: 503,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('turns malformed provider JSON into a generic response error without provider text', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const gateway = trueLayerGateway({ ...baseEnv, TRUELAYER_CLIENT_ID: 'malformed-client' });
    // The token response is accepted, but the account response is deliberately malformed.
    fetchSpy.mockResolvedValueOnce(new Response('{"access_token":"token"}', { status: 200 }));
    fetchSpy.mockResolvedValueOnce(
      new Response('{"detail":"account number 123456"}', { status: 200 }),
    );

    try {
      await gateway.listAccounts('connection');
      throw new Error('expected provider response rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ code: 'invalid_provider_response', status: 502 });
      expect(String(error)).not.toContain('123456');
    }
  });

  it('matches the Data v3 hosted contract and forwards only the verified end-user IP field', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      Response.json({ access_token: 'token-contract', expires_in: 3600 }),
    );
    fetchSpy.mockResolvedValueOnce(
      Response.json({
        id: 'provider-connection-id',
        hosted_page: { uri: 'https://app.truelayer-sandbox.com/data/connection-id' },
      }),
    );
    const gateway = trueLayerGateway({ ...baseEnv, TRUELAYER_CLIENT_ID: 'contract-client' });

    const result = await gateway.createConnection({
      displayName: 'Melo Tester',
      email: 'tester@example.com',
      returnUri: 'https://banking.test/v1/callback?state=opaque',
      localConnectionId: '11111111-1111-4111-8111-111111111111',
      endUserIp: '203.0.113.42',
    });

    expect(result.authorizationUrl).toBe('https://app.truelayer-sandbox.com/data/connection-id');
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://auth.truelayer-sandbox.com/connect/token',
      expect.objectContaining({ method: 'POST' }),
    );
    const providerRequest = fetchSpy.mock.calls[1];
    expect(providerRequest?.[0]).toBe('https://api.truelayer-sandbox.com/v3/data-connections');
    const init = providerRequest?.[1] as RequestInit;
    expect(new Headers(init.headers).get('Tl-User-IP')).toBe('203.0.113.42');
    expect(JSON.parse(String(init.body))).toMatchObject({
      scopes: ['accounts', 'transactions'],
      provider_selection: {
        type: 'user_selected',
        filter: { countries: ['GB'], release_channel: 'general_availability' },
      },
      user_consent: { type: 'authorization_flow_captured' },
      hosted_page: {
        type: 'authorization_flow',
        return_uri: 'https://banking.test/v1/callback?state=opaque',
      },
      data_access_type: 'recurring',
    });
  });

  it('rejects an unexpected hosted-page origin instead of returning a phishing URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(Response.json({ access_token: 'token-host', expires_in: 3600 }));
    fetchSpy.mockResolvedValueOnce(
      Response.json({
        id: 'provider-connection-id',
        hosted_page: { uri: 'https://example.invalid/imitated-bank-flow' },
      }),
    );
    const gateway = trueLayerGateway({ ...baseEnv, TRUELAYER_CLIENT_ID: 'host-client' });

    await expect(
      gateway.createConnection({
        displayName: 'Melo Tester',
        email: 'tester@example.com',
        returnUri: 'https://banking.test/v1/callback?state=opaque',
        localConnectionId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({ code: 'invalid_provider_response', status: 502 });
  });
});
