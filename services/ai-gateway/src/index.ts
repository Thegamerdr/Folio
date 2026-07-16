/**
 * Melo abstract-phrasing gateway.
 *
 * This Worker is intentionally not a chat proxy. It accepts only a small enum-only envelope and
 * asks the provider to phrase an abstract result using placeholder tokens. Raw prompts, documents,
 * images, account data, names, transaction rows and exact money values are rejected before any
 * provider call. The mobile app currently answers locally; this endpoint is a future optional
 * wording layer, not a financial-reasoning boundary.
 */

export type RuntimeEnv = CloudflareBindings & {
  OPENROUTER_API_KEY?: string;
  GATEWAY_TOKEN?: string;
};

const PHRASE_PATH = '/v1/phrase';
const RETIRED_PATHS = new Set(['/v1/chat/completions', '/melo']);
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const OPENROUTER_REFERER = 'https://folio.app';
const OPENROUTER_TITLE = 'Melo abstract phrasing';
const MAX_REQUEST_BYTES = 2_048;
const MAX_UPSTREAM_BYTES = 20_000;
const DAY_TTL_SECONDS = 3 * 24 * 60 * 60;

const INTENTS = [
  'check_purchase',
  'explain_position',
  'review_subscriptions',
  'summarise_month',
  'review_import',
  'plan_recovery',
  'clarify',
] as const;
const TONES = ['calm', 'honest', 'dry', 'coachy'] as const;
const OUTCOMES = [
  'fits',
  'does_not_fit',
  'needs_amount',
  'needs_setup',
  'ready_to_review',
  'summary_ready',
  'needs_context',
] as const;
const PLACEHOLDERS = [
  '<AMOUNT>',
  '<AVAILABLE>',
  '<TIGHTEST_DAY>',
  '<TIGHTEST_BALANCE>',
  '<SUBSCRIPTION_COUNT>',
  '<SUBSCRIPTION_TOTAL>',
  '<MONTHLY_IN>',
  '<MONTHLY_OUT>',
] as const;

type SafeIntent = (typeof INTENTS)[number];
type SafeTone = (typeof TONES)[number];
type SafeOutcome = (typeof OUTCOMES)[number];
type SafePlaceholder = (typeof PLACEHOLDERS)[number];

export type SafePhraseEnvelope = Readonly<{
  version: 'melo-phrase-v1';
  intent: SafeIntent;
  tone: SafeTone;
  outcome: SafeOutcome;
  placeholders: readonly SafePlaceholder[];
}>;

type ParseResult =
  | Readonly<{ ok: true; value: SafePhraseEnvelope }>
  | Readonly<{ ok: false; error: string }>;

const ALLOWED_KEYS = new Set(['version', 'intent', 'tone', 'outcome', 'placeholders']);

function isEnumValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

/** Exported for contract tests. No coercion: unexpected or free-text fields fail closed. */
export function parseSafePhraseEnvelope(value: unknown): ParseResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: 'Request body must be an object.' };
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) {
    return { ok: false, error: 'Request contains unsupported fields.' };
  }
  if (record['version'] !== 'melo-phrase-v1') {
    return { ok: false, error: 'Unsupported envelope version.' };
  }
  if (!isEnumValue(INTENTS, record['intent'])) {
    return { ok: false, error: 'Unsupported intent.' };
  }
  if (!isEnumValue(TONES, record['tone'])) {
    return { ok: false, error: 'Unsupported tone.' };
  }
  if (!isEnumValue(OUTCOMES, record['outcome'])) {
    return { ok: false, error: 'Unsupported outcome.' };
  }
  if (!Array.isArray(record['placeholders']) || record['placeholders'].length > 8) {
    return { ok: false, error: 'Invalid placeholders.' };
  }
  const placeholders = record['placeholders'];
  if (!placeholders.every((entry) => isEnumValue(PLACEHOLDERS, entry))) {
    return { ok: false, error: 'Unsupported placeholder.' };
  }
  if (new Set(placeholders).size !== placeholders.length) {
    return { ok: false, error: 'Duplicate placeholders are not allowed.' };
  }
  return {
    ok: true,
    value: {
      version: 'melo-phrase-v1',
      intent: record['intent'],
      tone: record['tone'],
      outcome: record['outcome'],
      placeholders,
    },
  };
}

/** Provider input contains controlled vocabulary only; it cannot contain a user's source text. */
export function buildProviderRequest(envelope: SafePhraseEnvelope, model: string): unknown {
  const tokens = envelope.placeholders.length > 0 ? envelope.placeholders.join(', ') : 'none';
  return {
    model,
    temperature: 0.4,
    max_tokens: 80,
    stream: false,
    messages: [
      {
        role: 'system',
        content:
          'Write one calm financial-companion sentence, maximum thirty-five words. Use only the supplied placeholder tokens verbatim. Never add numbers, names, institutions, URLs, advice, or facts. Return sentence text only.',
      },
      {
        role: 'user',
        content: `intent=${envelope.intent}; tone=${envelope.tone}; outcome=${envelope.outcome}; allowed_placeholders=${tokens}`,
      },
    ],
  };
}

export default {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'folio-ai-gateway', mode: 'abstract-phrasing-only' }, 200);
    }
    if (RETIRED_PATHS.has(url.pathname)) {
      return json({ error: 'Raw chat and document inference are retired.' }, 410);
    }
    if (request.method !== 'POST' || url.pathname !== PHRASE_PATH) {
      return json({ error: `POST ${PHRASE_PATH}.` }, request.method === 'POST' ? 404 : 405);
    }

    const configuredToken = env.GATEWAY_TOKEN?.trim();
    if (configuredToken === undefined || configuredToken.length === 0) {
      return json({ error: 'Gateway authentication is not configured.' }, 503);
    }
    const presentedToken = request.headers.get('x-folio-gateway-token') ?? '';
    if (!timingSafeEqual(presentedToken, configuredToken)) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    const apiKey = env.OPENROUTER_API_KEY?.trim();
    if (apiKey === undefined || apiKey.length === 0) {
      return json({ error: 'Provider is not configured.' }, 503);
    }
    if (env.METER_KV === undefined) {
      return json({ error: 'Gateway metering is not configured.' }, 503);
    }

    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return json({ error: 'Request is too large.' }, 413);
    }

    const requestBody = await readUtf8BodyWithinLimit(request.body, MAX_REQUEST_BYTES);
    if (!requestBody.ok && requestBody.reason === 'too-large') {
      return json({ error: 'Request is too large.' }, 413);
    }
    if (!requestBody.ok) {
      return json({ error: 'Could not read request.' }, 400);
    }
    const rawBody = requestBody.text;
    if (rawBody.length === 0) {
      return json({ error: 'Request is empty.' }, 400);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400);
    }
    const parsed = parseSafePhraseEnvelope(parsedJson);
    if (!parsed.ok) return json({ error: parsed.error }, 422);

    const dailyCap = positiveInt(env.PHRASE_DAILY_CAP, 2_000);
    try {
      const allowed = await bumpWithinCap(
        env.METER_KV,
        `phrase:all:${new Date().toISOString().slice(0, 10)}`,
        dailyCap,
        DAY_TTL_SECONDS,
      );
      if (!allowed) return json({ error: 'Phrasing is at capacity for today.' }, 429);
    } catch {
      return json({ error: 'Gateway metering is unavailable.' }, 503);
    }

    const model = env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
    if (model !== DEFAULT_MODEL) {
      return json({ error: 'Configured model is not permitted.' }, 503);
    }
    const providerBody = buildProviderRequest(parsed.value, model);
    const baseUrl = stripTrailingSlash(env.OPENROUTER_BASE_URL?.trim() || DEFAULT_BASE_URL);

    let upstream: Response;
    try {
      upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': OPENROUTER_REFERER,
          'X-Title': OPENROUTER_TITLE,
        },
        body: JSON.stringify(providerBody),
      });
    } catch {
      return json({ error: 'Could not reach the phrasing provider.' }, 502);
    }
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return json({ error: 'Phrasing provider failed.' }, 502);
    }

    const upstreamLength = Number(upstream.headers.get('content-length') ?? '0');
    if (Number.isFinite(upstreamLength) && upstreamLength > MAX_UPSTREAM_BYTES) {
      await upstream.body?.cancel();
      return json({ error: 'Phrasing provider response was too large.' }, 502);
    }

    const providerResponse = await readUtf8BodyWithinLimit(upstream.body, MAX_UPSTREAM_BYTES);
    if (!providerResponse.ok && providerResponse.reason === 'too-large') {
      return json({ error: 'Phrasing provider response was too large.' }, 502);
    }
    if (!providerResponse.ok) {
      return json({ error: 'Could not read phrasing provider response.' }, 502);
    }
    const upstreamText = providerResponse.text;
    const phrase = extractSafePhrase(upstreamText, parsed.value.placeholders);
    if (phrase === null) {
      return json({ error: 'Phrasing provider returned an unsafe response.' }, 502);
    }
    return json({ phrase }, 200);
  },
} satisfies ExportedHandler<RuntimeEnv>;

type BoundedBodyRead =
  | Readonly<{ ok: true; text: string }>
  | Readonly<{ ok: false; reason: 'too-large' | 'unreadable' }>;

/** Read a request/provider body without ever buffering beyond the permitted byte envelope. */
async function readUtf8BodyWithinLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BoundedBodyRead> {
  if (body === null) return { ok: true, text: '' };
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      totalBytes += next.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel('body-too-large');
        return { ok: false, reason: 'too-large' };
      }
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text };
  } catch {
    try {
      await reader.cancel('body-read-failed');
    } catch {
      // The stream may already be errored or closed.
    }
    return { ok: false, reason: 'unreadable' };
  } finally {
    reader.releaseLock();
  }
}

function extractSafePhrase(
  rawJson: string,
  allowedPlaceholders: readonly SafePlaceholder[],
): string | null {
  let value: unknown;
  try {
    value = JSON.parse(rawJson);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const phrase = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
  if (typeof phrase !== 'string') return null;
  const trimmed = phrase.trim();
  if (trimmed.length === 0 || trimmed.length > 300) return null;
  if (/[0-9£$€]|https?:|www\.|@/i.test(trimmed)) return null;
  const tokens = trimmed.match(/<[A-Z_]+>/g) ?? [];
  if (tokens.some((token) => !allowedPlaceholders.includes(token as SafePlaceholder))) return null;
  return trimmed;
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-folio-gateway-token',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
  };
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function bumpWithinCap(
  kv: KVNamespace,
  key: string,
  cap: number,
  ttlSeconds: number,
): Promise<boolean> {
  const current = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0;
  if (current >= cap) return false;
  await kv.put(key, String(current + 1), { expirationTtl: ttlSeconds });
  return true;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
