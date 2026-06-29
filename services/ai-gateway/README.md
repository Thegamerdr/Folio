# @folio/ai-gateway

A standalone [Cloudflare Worker](https://developers.cloudflare.com/workers/) that powers Folio's
**Melo** chat. It is a thin, OpenAI-compatible proxy in front of
[OpenRouter](https://openrouter.ai/).

```
RN Melo chat ──HTTPS──▶ folio-ai-gateway (Worker) ──Bearer key──▶ OpenRouter ──▶ Gemini model
```

The Worker holds the OpenRouter API key as a Cloudflare **secret** (server-side). The Folio app
ships **no provider key** — it only knows this Worker's URL and a weak shared token. That keeps
the real key out of the APK, where any `EXPO_PUBLIC_*` value would otherwise be extractable.

The Melo persona and the `melo-suggest` block protocol live in the RN client
(`apps/mobile/src/local/meloAiClient.ts`), **not** here. This Worker is deliberately dumb
plumbing: inject the key, forward, return the response.

## Endpoints

| Method | Path                    | Purpose                                                        |
| ------ | ----------------------- | ------------------------------------------------------------- |
| `GET`  | `/`                     | Unauthenticated health check → `{ "ok": true, ... }`.         |
| `POST` | `/v1/chat/completions`  | OpenAI-shaped chat request. Forwarded to OpenRouter.          |
| `POST` | `/melo`                 | Alias for the chat path (same behaviour).                     |
| `OPTIONS` | any                  | CORS preflight.                                               |

The RN client points its OpenAI base URL at the Worker, so its existing
`POST {baseUrl}/chat/completions` call works unchanged.

## Request / response contract

The Worker accepts the standard OpenAI Chat Completions JSON body and returns OpenRouter's
response **verbatim** (same status, same body). If `model` is omitted, the Worker injects the
default from `OPENROUTER_MODEL` (or `google/gemini-2.5-flash`).

```jsonc
// POST /v1/chat/completions
// headers: Content-Type: application/json, x-folio-gateway-token: <token>
{
  "messages": [
    { "role": "system", "content": "You are Melo, ..." },
    { "role": "user", "content": "how am i doing this month?" }
  ],
  "temperature": 0.6,
  "stream": false
  // "model" optional — injected if absent
}
```

The response is OpenRouter's `chat.completion` object (`choices[0].message.content`, etc.),
which the RN client already knows how to parse.

## Environment variables

| Name                  | Kind            | Default                          | Notes                                                                 |
| --------------------- | --------------- | -------------------------------- | --------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`  | **secret**      | _(required)_                     | Set with `wrangler secret put`. Never a literal, never logged.        |
| `OPENROUTER_BASE_URL` | var             | `https://openrouter.ai/api/v1`   | Override to point at another OpenAI-compatible base.                  |
| `OPENROUTER_MODEL`    | var             | `google/gemini-2.5-flash`    | Default model injected when the request omits `model`.                |
| `GATEWAY_TOKEN`       | secret (or var) | _(unset)_                        | When set, requests must send a matching `x-folio-gateway-token`.      |

The non-secret vars are declared in `wrangler.toml`. The secrets are set with the CLI below.

## Deploy

```bash
cd services/ai-gateway

# 1. Set the OpenRouter key as a secret (you'll be prompted to paste it; it is never echoed).
wrangler secret put OPENROUTER_API_KEY

# 2. (Recommended) Set the shared app<->gateway token as a secret too.
wrangler secret put GATEWAY_TOKEN

# 3. (Optional) Pin a different model without redeploying code.
#    Either edit wrangler.toml [vars], or:
wrangler secret put OPENROUTER_MODEL   # if you'd rather keep it out of source

# 4. Deploy. Wrangler prints the worker URL (https://folio-ai-gateway.<subdomain>.workers.dev).
wrangler deploy
```

Then point the app at the deployed URL — see `MELO_AI_SETUP.md` at the repo root.

## Security notes

- The `x-folio-gateway-token` check is a **weak** guard: the token is embedded in the app, so a
  determined attacker can extract it. It only deters casual abuse. The real backstops are:
  Cloudflare's per-Worker rate limits, and an **OpenRouter spend cap** on the key.
- The OpenRouter key exists only as a Worker secret. It is never in source, never in the APK,
  never logged, and never returned to the caller.

## Local development

```bash
wrangler dev          # runs the Worker locally; you'll still need the secret set
pnpm run typecheck    # tsc --noEmit
```
