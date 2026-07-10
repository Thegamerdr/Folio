// Folio Melo AI gateway — a standalone Cloudflare Worker.
//
// WHAT THIS IS. A thin, OpenAI-compatible proxy that sits between the Folio mobile app and
// OpenRouter. The RN Melo chat already speaks the OpenAI Chat Completions shape; this Worker
// accepts that exact request, injects the OpenRouter API key (held as a Cloudflare *secret*,
// never bundled in the APK), forwards it to OpenRouter, and returns the response verbatim.
//
// WHY IT EXISTS. EXPO_PUBLIC_* env vars are inlined into the JS bundle, so any key shipped in
// the app is extractable from the APK. Moving the key server-side into this Worker is the only
// way to keep a real provider key out of users' hands. The app holds no provider key at all —
// it only knows this Worker's URL and a weak shared token (see the abuse-guard note below).
//
// WHAT IT IS NOT. No streaming, no persona, no tool logic. The Melo persona and the
// `melo-suggest` block protocol stay in the RN client (src/local/meloAiClient.ts) — this Worker
// is deliberately dumb plumbing so it stays small, auditable, and provider-swappable.

export interface Env {
  /** OpenRouter API key. A Cloudflare SECRET — set via `wrangler secret put OPENROUTER_API_KEY`.
   *  NEVER hard-coded, never logged, never returned to the caller. */
  OPENROUTER_API_KEY?: string;
  /** OpenRouter-compatible base URL. Defaults to OpenRouter. A plain var, not a secret. */
  OPENROUTER_BASE_URL?: string;
  /** Default model id injected when the request omits one. A plain var, not a secret. */
  OPENROUTER_MODEL?: string;
  /** Comma-separated allow-list of models this gateway will proxy. A leaked weak token therefore
   *  cannot bill a costlier model than these. Overrides DEFAULT_ALLOWED_MODELS. A plain var, not a secret. */
  OPENROUTER_ALLOWED_MODELS?: string;
  /** Optional shared token the app sends in `x-folio-gateway-token`. When set, requests without
   *  a matching token are rejected with 401. A weak guard (it lives in the app) — the real
   *  backstops are the metering below + an OpenRouter spend cap. */
  GATEWAY_TOKEN?: string;
  /** OPTIONAL metering store (Workers KV). When bound, the gateway enforces the abuse caps below;
   *  when absent the gateway runs exactly as before (deploy-safe without a namespace). Create +
   *  bind per the wrangler.toml [[kv_namespaces]] block. */
  METER_KV?: KVNamespace;
  /** Per-device statement reads per calendar month (default 40). This is an ABUSE BACKSTOP, set
   *  deliberately ABOVE every client-side product allowance (Free 3 / Full 10 — see the app's
   *  lib/billing/readAllowance.ts): honest users never touch it, a tampered client can't run the
   *  bill up. Per-tier server enforcement is the later accounts/billing step. */
  READS_PER_MONTH_CAP?: string;
  /** ALL devices' statement reads per UTC day (default 500) — bounds the worst case of a leaked
   *  shared token to one day's ceiling. */
  GLOBAL_DAILY_READ_CAP?: string;
  /** ALL devices' chat requests per UTC day (default 2000). Chat rides the cheap -lite tier so
   *  the ceiling is higher; this exists so a leak can't loop chat unbounded either. */
  GLOBAL_DAILY_CHAT_CAP?: string;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
// Cost guard: the ONLY models this gateway will proxy. Chat rides the cheap `-lite` tier; PDF/photo
// extraction uses the vision-capable `flash`. A leaked weak token cannot run the bill up on a frontier
// model — anything outside this set is rejected (400). Override via OPENROUTER_ALLOWED_MODELS.
const DEFAULT_ALLOWED_MODELS = 'google/gemini-2.5-flash-lite,google/gemini-2.5-flash';

// Headers OpenRouter recommends so traffic is attributable to this app.
const OPENROUTER_REFERER = 'https://folio.app';
const OPENROUTER_TITLE = 'Folio Melo';

// The single chat path. Mirrors the OpenAI shape so the RN client's existing
// `POST {baseUrl}/chat/completions` call works unchanged when baseUrl points here.
const CHAT_PATH = '/v1/chat/completions';
// Convenience alias so the app can also be pointed at `${workerUrl}/melo`.
const MELO_ALIAS_PATH = '/melo';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight — answer before anything else.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    // A tiny unauthenticated health check so a deploy can be smoke-tested without a token.
    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'folio-ai-gateway' }, 200);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed. POST a chat completion request.' }, 405);
    }

    if (url.pathname !== CHAT_PATH && url.pathname !== MELO_ALIAS_PATH) {
      return json({ error: `Unknown path. POST to ${CHAT_PATH} or ${MELO_ALIAS_PATH}.` }, 404);
    }

    // Abuse guard: when GATEWAY_TOKEN is configured, require a matching header. When it is unset
    // the gateway is open (acceptable for local testing; set it before shipping an APK).
    if (typeof env.GATEWAY_TOKEN === 'string' && env.GATEWAY_TOKEN.length > 0) {
      const presented = request.headers.get('x-folio-gateway-token') ?? '';
      if (!timingSafeEqual(presented, env.GATEWAY_TOKEN)) {
        return json({ error: 'Unauthorized.' }, 401);
      }
    }

    // The OpenRouter key must be present, and only as a secret. Fail loud and clear if it isn't.
    const apiKey = env.OPENROUTER_API_KEY?.trim();
    if (apiKey === undefined || apiKey.length === 0) {
      return json(
        {
          error:
            'Gateway misconfigured: OPENROUTER_API_KEY secret is not set. ' +
            'Run `wrangler secret put OPENROUTER_API_KEY`.',
        },
        500,
      );
    }

    // Parse the incoming OpenAI-shaped body.
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return json({ error: 'Request body must be a JSON object.' }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400);
    }

    // Inject the default model when the caller omitted one.
    if (typeof body['model'] !== 'string' || (body['model'] as string).trim().length === 0) {
      body['model'] = env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
    }

    // Cost guard: only proxy approved models, so a leaked weak token can't bill a costlier model.
    const allowedModels = (env.OPENROUTER_ALLOWED_MODELS?.trim() || DEFAULT_ALLOWED_MODELS)
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
    const requestedModel = (body['model'] as string).trim();
    if (!allowedModels.includes(requestedModel)) {
      return json({ error: `Model "${requestedModel}" is not permitted by this gateway.` }, 400);
    }

    // Metering (only when METER_KV is bound — see Env.METER_KV). A "read" is any request whose
    // message content carries a file/image part (the expensive multimodal statement reads); plain
    // text bodies are chat. Reads are capped per device per month + globally per day; chat only
    // globally per day. KV increments are read-modify-write (not atomic) — fine for an abuse
    // backstop where being off by a handful under race is irrelevant.
    if (env.METER_KV !== undefined) {
      const isRead = requestCarriesFileParts(body);
      const deviceKey = deviceKeyFor(request);
      const now = new Date();
      try {
        if (isRead) {
          const monthCap = intVar(env.READS_PER_MONTH_CAP, 40);
          const monthKey = `read:${deviceKey}:${utcMonth(now)}`;
          if (!(await bumpWithinCap(env.METER_KV, monthKey, monthCap, MONTH_TTL_SECONDS))) {
            return json(
              {
                error:
                  'This device has hit its monthly statement-read ceiling. It resets next month.',
              },
              429,
            );
          }
          const dayCap = intVar(env.GLOBAL_DAILY_READ_CAP, 500);
          const dayKey = `read:all:${utcDay(now)}`;
          if (!(await bumpWithinCap(env.METER_KV, dayKey, dayCap, DAY_TTL_SECONDS))) {
            return json({ error: 'The reader is at capacity for today. Try tomorrow.' }, 429);
          }
        } else {
          const chatCap = intVar(env.GLOBAL_DAILY_CHAT_CAP, 2000);
          const chatKey = `chat:all:${utcDay(now)}`;
          if (!(await bumpWithinCap(env.METER_KV, chatKey, chatCap, DAY_TTL_SECONDS))) {
            return json({ error: 'Chat is at capacity for today. Try tomorrow.' }, 429);
          }
        }
      } catch {
        // KV trouble must never take the product down — metering fails OPEN (the OpenRouter
        // spend cap remains the hard financial backstop).
      }
    }

    const baseUrl = stripTrailingSlash(env.OPENROUTER_BASE_URL?.trim() || DEFAULT_BASE_URL);

    // Forward to OpenRouter with the key + recommended attribution headers.
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
        body: JSON.stringify(body),
      });
    } catch (error: unknown) {
      return json({ error: `Could not reach the upstream provider. ${errorMessage(error)}` }, 502);
    }

    // Return OpenRouter's response (status + body) to the caller, adding CORS. We pass the body
    // through untouched so the RN client parses the same OpenAI shape it already expects.
    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
        ...corsHeaders(),
      },
    });
  },
} satisfies ExportedHandler<Env>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, x-folio-gateway-token, x-folio-device',
    'Access-Control-Max-Age': '86400',
  };
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error.';
}

// ---------------------------------------------------------------------------
// Metering helpers (only used when METER_KV is bound)
// ---------------------------------------------------------------------------

/** Monthly read counters outlive their month by a margin, then self-delete. */
const MONTH_TTL_SECONDS = 45 * 24 * 60 * 60;
/** Daily global counters self-delete shortly after their day. */
const DAY_TTL_SECONDS = 3 * 24 * 60 * 60;

/** Whether any message's content array carries a file or image part — the expensive multimodal
 *  statement reads. Plain string contents (chat) never match. Defensive against odd shapes:
 *  anything unparseable simply reads as "not a file request". */
function requestCarriesFileParts(body: Record<string, unknown>): boolean {
  const messages = body['messages'];
  if (!Array.isArray(messages)) return false;
  for (const message of messages) {
    if (typeof message !== 'object' || message === null) continue;
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue;
      const type = (part as { type?: unknown }).type;
      if (type === 'file' || type === 'image_url') return true;
    }
  }
  return false;
}

/** The per-device metering key: the app's anonymous install id (`x-folio-device`) when present,
 *  else the connecting IP — coarse, but it means a client that strips the header still gets
 *  backstopped rather than exempted. */
function deviceKeyFor(request: Request): string {
  const device = request.headers.get('x-folio-device')?.trim();
  if (device !== undefined && device.length > 0 && device.length <= 64) return device;
  return `ip:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`;
}

/** Increment a KV counter and report whether it is still within `cap`. Read-modify-write — not
 *  atomic, acceptable for an abuse backstop (see call site). */
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

function intVar(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function utcMonth(now: Date): string {
  return now.toISOString().slice(0, 7); // YYYY-MM
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Constant-time-ish string compare so the token check doesn't leak length/content via timing.
 *  Lengths are compared first (unavoidable), then every byte, without early exit. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
