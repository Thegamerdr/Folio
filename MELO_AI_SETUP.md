# Melo AI setup (owner guide)

Melo's chat is powered by a **standalone Cloudflare Worker** in this monorepo
(`services/ai-gateway`) that proxies to [OpenRouter](https://openrouter.ai/). The Worker holds
the OpenRouter API key as a server-side secret. The Folio app ships **no key** — it only knows
the Worker's URL and a weak shared token.

```
Folio app (Melo chat) ──HTTPS──▶ folio-ai-gateway (your Cloudflare Worker) ──key──▶ OpenRouter ──▶ Gemini
```

This means: **the OpenRouter key lives only as a Worker secret — never in the app, never in the
APK — and the app depends on no Lovable infrastructure.** Everything below is self-hosted by you.

## Security property (read this)

- The real provider key (OpenRouter) is set with `wrangler secret put` and stored encrypted by
  Cloudflare. It is never in source, never bundled into the JS, never extractable from the APK.
- The app sends a shared token (`EXPO_PUBLIC_MELO_GATEWAY_TOKEN`) in the
  `x-folio-gateway-token` header. This token **is** in the app, so treat it as **weak** — it only
  deters casual abuse, not a determined attacker who unpacks the APK.
- The real backstops against abuse/cost are: (1) Cloudflare's per-Worker rate limits, and
  (2) an **OpenRouter spend cap** on the key. Set the spend cap — that is the cost ceiling.

## One-time setup

### (a) Get an OpenRouter key and set a spend cap

1. Create an account at https://openrouter.ai and add a small amount of credit.
2. Create an API key (Keys → Create Key).
3. **Set a spend / credit cap on the key** (or on the account). This is your hard cost ceiling.

### (b) Set the secret(s) on the Worker

```bash
cd services/ai-gateway

# Required — paste the OpenRouter key when prompted (it is never echoed).
wrangler secret put OPENROUTER_API_KEY

# Recommended — a shared app<->gateway token. Generate any random string and use the SAME value
# for EXPO_PUBLIC_MELO_GATEWAY_TOKEN in step (d).
wrangler secret put GATEWAY_TOKEN

# Optional — pin a model without editing source (otherwise the wrangler.toml default is used).
wrangler secret put OPENROUTER_MODEL
```

The non-secret defaults (`OPENROUTER_BASE_URL`, `OPENROUTER_MODEL`) live in
`services/ai-gateway/wrangler.toml` and can be edited there instead.

### (c) Deploy the Worker

```bash
cd services/ai-gateway
wrangler deploy
```

Wrangler prints the deployed URL, e.g. `https://folio-ai-gateway.<your-subdomain>.workers.dev`.
Smoke-test it: `curl https://folio-ai-gateway.<your-subdomain>.workers.dev/` should return
`{"ok":true,"service":"folio-ai-gateway"}`.

### (d) Point the app at the gateway

Set these public Expo env vars for the build (in your `.env`, EAS build profile, or shell):

```bash
# The deployed Worker URL from step (c), with the /v1 path so the client posts to
# {url}/chat/completions. (The Worker also accepts the bare URL + /melo.)
EXPO_PUBLIC_MELO_GATEWAY_URL=https://folio-ai-gateway.<your-subdomain>.workers.dev/v1

# The SAME token you set as GATEWAY_TOKEN in step (b). Omit only if you did not set GATEWAY_TOKEN.
EXPO_PUBLIC_MELO_GATEWAY_TOKEN=<the-random-token-from-step-b>
```

If `EXPO_PUBLIC_MELO_GATEWAY_URL` is unset, Melo shows a calm "isn't configured yet" state
instead of crashing.

### (e) Rebuild the APK

Rebuild so the new env vars are inlined:

```bash
pnpm mobile:prebuild
pnpm mobile:apk:android
# or your EAS build profile, e.g. pnpm --filter @folio/mobile run eas:android:tester
```

## Choosing a model

The default is `google/gemini-2.0-flash-001` — cheap and fast. Other inexpensive Gemini options
on OpenRouter you can set via `OPENROUTER_MODEL` (or `wrangler secret put OPENROUTER_MODEL`):

- `google/gemini-2.0-flash-001` (default — fast, low cost)
- `google/gemini-2.0-flash-lite-001` (cheapest, lower quality)
- `google/gemini-flash-1.5` (older, very cheap)

Check current pricing at https://openrouter.ai/models before picking. Changing the model is a
gateway config change only — no app rebuild required (the app sends no model).

## Files involved

- `services/ai-gateway/` — the standalone Worker (proxy + key holder). See its `README.md`.
- `apps/mobile/src/local/meloAiClient.ts` — the keyless RN client that calls the gateway.
- `apps/mobile/app.config.ts` — surfaces the two `EXPO_PUBLIC_MELO_GATEWAY_*` vars to the app.
