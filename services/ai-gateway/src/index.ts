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
   *  backstops are the Worker's platform rate limits + an OpenRouter spend cap. */
  GATEWAY_TOKEN?: string;
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-folio-gateway-token',
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
