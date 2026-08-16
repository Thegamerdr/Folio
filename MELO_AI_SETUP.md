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

The app reads two public Expo env vars: `EXPO_PUBLIC_MELO_GATEWAY_URL` and
`EXPO_PUBLIC_MELO_GATEWAY_TOKEN`. Their values are:

```bash
# The deployed Worker URL from step (c), with the /v1 path so the client posts to
# {url}/chat/completions. (The Worker also accepts the bare URL + /melo.)
EXPO_PUBLIC_MELO_GATEWAY_URL=https://folio-ai-gateway.<your-subdomain>.workers.dev/v1

# The SAME token you set as GATEWAY_TOKEN in step (b). Omit only if you did not set GATEWAY_TOKEN.
EXPO_PUBLIC_MELO_GATEWAY_TOKEN=<the-random-token-from-step-b>
```

**For EAS builds (the shipped APK), set these as EAS env vars/secrets — this is required, or
the release build ships with no gateway and Melo stays in its "isn't configured yet" state even
after you deploy the Worker.** The build profiles in `apps/mobile/eas.json`
(`preview`, `tester`, `production`) already reference these by name via their `env` blocks
(`"$EXPO_PUBLIC_MELO_GATEWAY_URL"` / `"$EXPO_PUBLIC_MELO_GATEWAY_TOKEN"`), so EAS only needs the
values registered once:

```bash
cd apps/mobile

# Register the values on EAS (run once; pick the environments you build for).
# These are PUBLIC, keyless values — the URL and a weak shared token — so visibility "plaintext"
# is fine; the real OpenRouter key never leaves the Worker (step b).
eas env:create --name EXPO_PUBLIC_MELO_GATEWAY_URL   --value "https://folio-ai-gateway.<your-subdomain>.workers.dev/v1" --visibility plaintext --environment production --environment preview
eas env:create --name EXPO_PUBLIC_MELO_GATEWAY_TOKEN --value "<the-random-token-from-step-b>"                          --visibility plaintext --environment production --environment preview
```

(Older EAS CLIs use `eas secret:create --scope project --name <NAME> --value <VALUE>` instead;
either way the names must match the two `EXPO_PUBLIC_MELO_GATEWAY_*` vars above.)

For a **local** debug/prebuild build, set the same two vars in a `.env` file under `apps/mobile`
or export them in your shell before building — `app.config.ts` reads them from `process.env`.

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

> Update (2026-06-30, commits eb6e0a0/3783c9c/a3f81c9): the app now splits models by cost. **Chat**
> pins the cheap text model `google/gemini-2.5-flash-lite` (`apps/mobile/src/local/meloAiClient.ts`);
> **vision** — PDF/photo statement extraction — uses the more capable `google/gemini-2.5-flash`
> (`apps/mobile/src/local/statementReaderClient.ts`). The gateway enforces a **model allow-list**
> (`OPENROUTER_ALLOWED_MODELS`, default `google/gemini-2.5-flash-lite,google/gemini-2.5-flash` in
> `services/ai-gateway/src/index.ts`): any model outside that set is rejected with a 400, so a leaked
> weak token cannot bill a costlier (frontier) model. The gateway's own `OPENROUTER_MODEL` default
> (`services/ai-gateway/wrangler.toml`) is now `google/gemini-2.5-flash`. Activating this still needs
> a `wrangler deploy` plus an OpenRouter spend cap (see step (a) and the security note above).

The gateway default is `google/gemini-2.5-flash` (vision + PDF capable); chat pins the cheaper
`google/gemini-2.5-flash-lite` from the app (see "Cost split + gateway model allow-list" below).
Any model you set via `OPENROUTER_MODEL` (or `wrangler secret put OPENROUTER_MODEL`) must also be in
the gateway allow-list (`OPENROUTER_ALLOWED_MODELS`) or the gateway rejects it. Inexpensive Gemini
options on OpenRouter:

- `google/gemini-2.5-flash` (gateway default — vision/PDF capable)
- `google/gemini-2.5-flash-lite` (chat default — cheapest)

Check current pricing at https://openrouter.ai/models before picking. Changing the model is a
gateway config change only — no app rebuild required (the app sends no model).

### Cost split + gateway model allow-list (2026-06-30, `eb6e0a0`)

The app now splits AI work across two tiers to keep cost down:

- **Chat** pins the cheap `gemini-2.5-flash-lite`.
- **Vision** (PDF / photo statement extraction) reserves the costlier `gemini-2.5-flash`.

The gateway enforces a **model allow-list** and **rejects models outside it**, so a misconfigured or
costlier model can't be billed through the key. Take this live with `wrangler deploy`, and keep an
**OpenRouter spend cap** on the key as the hard cost ceiling (see step (a)).

## Files involved

- `services/ai-gateway/` — the standalone Worker (proxy + key holder). See its `README.md`.
- `apps/mobile/src/local/meloAiClient.ts` — the keyless RN client that calls the gateway.
- `apps/mobile/app.config.ts` — surfaces the two `EXPO_PUBLIC_MELO_GATEWAY_*` vars to the app.
