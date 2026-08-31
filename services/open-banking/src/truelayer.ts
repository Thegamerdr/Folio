import type {
  CreateProviderConnectionInput,
  ProviderAccount,
  ProviderGateway,
  ProviderTransaction,
  RuntimeEnv,
  TransactionsPage,
} from './types';
import { isValidEncryptionKey } from './crypto';

type CachedToken = { clientId: string; accessToken: string; expiresAt: number };
let cachedToken: CachedToken | null = null;
const PROVIDER_TIMEOUT_MS = 15_000;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

export class ProviderError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message = 'Open Banking provider request failed.') {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
  }
}

export function trueLayerGateway(env: RuntimeEnv): ProviderGateway {
  // TrueLayer credentials must never be sent to an arbitrary HTTPS origin. Pin each
  // environment to the documented TrueLayer hosts as well as requiring TLS.
  const bases = trueLayerBases(env);
  const configurationValid = bases !== null;
  const configured =
    nonEmpty(env.TRUELAYER_CLIENT_ID) &&
    nonEmpty(env.TRUELAYER_CLIENT_SECRET) &&
    isValidEncryptionKey(env.CONNECTION_ENCRYPTION_KEY) &&
    configurationValid;

  const token = async (): Promise<string> => {
    if (!configured) throw new ProviderError('provider_not_configured', 503);
    const clientId = env.TRUELAYER_CLIENT_ID as string;
    if (
      cachedToken !== null &&
      cachedToken.clientId === clientId &&
      cachedToken.expiresAt > Date.now() + 60_000
    ) {
      return cachedToken.accessToken;
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: env.TRUELAYER_CLIENT_SECRET as string,
      scope: 'data',
    });
    const response = await timedFetch(`${bases!.authBase}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = await readJson(response);
    if (!response.ok) throw providerError(response, payload);
    const accessToken = stringField(payload, 'access_token');
    const expiresIn = numberField(payload, 'expires_in') ?? 3600;
    if (accessToken === null) throw new ProviderError('invalid_provider_response', 502);
    cachedToken = {
      clientId,
      accessToken,
      expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
    };
    return accessToken;
  };

  const providerFetch = async (
    path: string,
    init: RequestInit = {},
    providerConnectionId?: string,
    endUserIp?: string,
  ): Promise<{ response: Response; payload: unknown }> => {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Bearer ${await token()}`);
    if (providerConnectionId !== undefined) headers.set('Connection-Id', providerConnectionId);
    if (endUserIp !== undefined) headers.set('Tl-User-IP', endUserIp);
    const response = await timedFetch(`${bases!.apiBase}${path}`, { ...init, headers });
    const payload = await readJson(response);
    if (!response.ok) throw providerError(response, payload);
    return { response, payload };
  };

  return {
    configured,
    configurationValid,
    environment: env.TRUELAYER_ENVIRONMENT,
    createConnection: async (input: CreateProviderConnectionInput) => {
      const { payload } = await providerFetch(
        '/v3/data-connections',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scopes: ['accounts', 'transactions'],
            provider_selection: {
              type: 'user_selected',
              filter: {
                countries: ['GB'],
                release_channel: 'general_availability',
                customer_segments: ['retail', 'business'],
              },
            },
            user: { name: input.displayName, email: input.email },
            metadata: { melo_connection_id: input.localConnectionId },
            user_consent: { type: 'authorization_flow_captured' },
            hosted_page: {
              type: 'authorization_flow',
              return_uri: input.returnUri,
              country_code: 'GB',
              language_code: 'en',
            },
            data_access_type: 'recurring',
          }),
        },
        undefined,
        input.endUserIp,
      );
      const providerConnectionId = stringField(payload, 'id');
      const rawAuthorizationUrl = nestedStringField(payload, ['hosted_page', 'uri']);
      const authorizationUrl = validHostedPageUrl(rawAuthorizationUrl, env.TRUELAYER_ENVIRONMENT);
      if (providerConnectionId === null || authorizationUrl === null) {
        throw new ProviderError('invalid_provider_response', 502);
      }
      return { providerConnectionId, authorizationUrl };
    },
    listAccounts: async (providerConnectionId, context) => {
      const { payload } = await providerFetch(
        '/v3/connected-accounts',
        {},
        providerConnectionId,
        context?.endUserIp,
      );
      const items = arrayField(payload, 'items');
      if (items === null) throw new ProviderError('invalid_provider_response', 502);
      return items.map(parseAccount).filter((item): item is ProviderAccount => item !== null);
    },
    createTransactionsRequest: async (providerConnectionId, providerAccountId, input, context) => {
      const body: Record<string, unknown> = {
        from: input.from,
        to: input.to,
        page_size: 500,
      };
      if (input.cursor !== undefined) body['cursor'] = input.cursor;
      const { payload } = await providerFetch(
        `/v3/connected-accounts/${encodeURIComponent(providerAccountId)}/transactions/requests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        providerConnectionId,
        context?.endUserIp,
      );
      const requestId = stringField(payload, 'id');
      if (requestId === null) throw new ProviderError('invalid_provider_response', 502);
      return { requestId };
    },
    getTransactionsRequest: async (
      providerConnectionId,
      providerAccountId,
      requestId,
      context,
    ): Promise<TransactionsPage> => {
      const { payload } = await providerFetch(
        `/v3/connected-accounts/${encodeURIComponent(providerAccountId)}/transactions/requests/${encodeURIComponent(requestId)}`,
        {},
        providerConnectionId,
        context?.endUserIp,
      );
      const status = stringField(payload, 'status');
      if (status === 'pending') return { status, requestId };
      if (status === 'failed') {
        return {
          status,
          requestId,
          reason: stringField(payload, 'failure_reason') ?? 'provider_error',
        };
      }
      if (status !== 'completed') throw new ProviderError('invalid_provider_response', 502);
      const rawItems = nestedArrayField(payload, ['result', 'items']);
      if (rawItems === null) throw new ProviderError('invalid_provider_response', 502);
      const items = rawItems
        .map(parseTransaction)
        .filter((item): item is ProviderTransaction => item !== null);
      return {
        status,
        requestId,
        items,
        nextCursor: nestedStringField(payload, ['result', 'pagination', 'next_cursor']),
      };
    },
  };
}

function parseAccount(value: unknown): ProviderAccount | null {
  if (!isRecord(value)) return null;
  const id = stringField(value, 'id');
  const type = stringField(value, 'type');
  const accountType = stringField(value, 'account_type');
  const customerSegment = stringField(value, 'customer_segment');
  const currency = stringField(value, 'currency');
  if (id === null || currency === null || (type !== 'account' && type !== 'card')) return null;
  return {
    id,
    type,
    accountType: type === 'card' ? 'card' : accountType === 'savings' ? 'savings' : 'current',
    customerSegment: customerSegment === 'business' ? 'business' : 'retail',
    currency,
  };
}

function parseTransaction(value: unknown): ProviderTransaction | null {
  if (!isRecord(value)) return null;
  const id = stringField(value, 'id');
  const timestamp = stringField(value, 'timestamp');
  const description = stringField(value, 'description');
  const currency = stringField(value, 'currency');
  const amountInMinor = numberField(value, 'amount_in_minor');
  const status = stringField(value, 'status');
  if (
    id === null ||
    timestamp === null ||
    description === null ||
    currency === null ||
    amountInMinor === null ||
    !Number.isInteger(amountInMinor) ||
    (status !== 'pending' && status !== 'settled')
  ) {
    return null;
  }
  return { id, timestamp, description, currency, amountInMinor, status };
}

function providerError(response: Response, payload: unknown): ProviderError {
  const detail = isRecord(payload) ? stringField(payload, 'detail') : null;
  const type = isRecord(payload) ? stringField(payload, 'type') : null;
  const code = safeProviderCode(type ?? detail ?? `provider_http_${response.status}`);
  return new ProviderError(code, response.status);
}

function safeProviderCode(value: string): string {
  const tail = value.split(/[\/#]/u).filter(Boolean).at(-1) ?? 'provider_error';
  return (
    tail
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gu, '_')
      .slice(0, 80) || 'provider_error'
  );
}

async function readJson(response: Response): Promise<unknown> {
  const contentLength = Number.parseInt(response.headers.get('Content-Length') ?? '0', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new ProviderError('invalid_provider_response', 502);
  }
  const text = await readBoundedText(response, MAX_PROVIDER_RESPONSE_BYTES);
  if (text.length === 0) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderError('invalid_provider_response', 502);
  }
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (reason: unknown) {
    if (controller.signal.aborted) throw new ProviderError('provider_timeout', 504);
    throw new ProviderError('provider_unavailable', 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('provider response exceeded limit');
        throw new ProviderError('invalid_provider_response', 502);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function nonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function secureBaseUrl(value: string | undefined): string | null {
  if (!nonEmpty(value)) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function trueLayerBases(
  env: Pick<
    RuntimeEnv,
    'TRUELAYER_ENVIRONMENT' | 'TRUELAYER_AUTH_BASE_URL' | 'TRUELAYER_API_BASE_URL'
  >,
): Readonly<{ authBase: string; apiBase: string }> | null {
  const authBase = secureBaseUrl(env.TRUELAYER_AUTH_BASE_URL);
  const apiBase = secureBaseUrl(env.TRUELAYER_API_BASE_URL);
  const expected =
    env.TRUELAYER_ENVIRONMENT === 'sandbox'
      ? {
          authBase: 'https://auth.truelayer-sandbox.com',
          apiBase: 'https://api.truelayer-sandbox.com',
        }
      : env.TRUELAYER_ENVIRONMENT === 'live'
        ? { authBase: 'https://auth.truelayer.com', apiBase: 'https://api.truelayer.com' }
        : null;
  return expected !== null && authBase === expected.authBase && apiBase === expected.apiBase
    ? expected
    : null;
}

function validHostedPageUrl(value: string | null, environment: string): string | null {
  if (value === null) return null;
  try {
    const parsed = new URL(value);
    const expectedHost =
      environment === 'sandbox' ? 'app.truelayer-sandbox.com' : 'app.truelayer.com';
    return parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      parsed.hostname === expectedHost
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === 'string' && field.length > 0 ? field : null;
}

function numberField(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : null;
}

function arrayField(value: unknown, key: string): readonly unknown[] | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return Array.isArray(field) ? field : null;
}

function nestedStringField(value: unknown, keys: readonly string[]): string | null {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === 'string' && current.length > 0 ? current : null;
}

function nestedArrayField(value: unknown, keys: readonly string[]): readonly unknown[] | null {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return Array.isArray(current) ? current : null;
}
