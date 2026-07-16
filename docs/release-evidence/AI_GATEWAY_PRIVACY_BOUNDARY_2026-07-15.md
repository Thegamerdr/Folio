# AI gateway privacy boundary deployment evidence

Date: 2026-07-15  
Service: `folio-ai-gateway`  
Public endpoint: `https://folio-ai-gateway.tgdroppin.workers.dev`  
Cloudflare version: `808c7532-8c58-4501-b622-5bd0e7d99930`

## Deployment result

Wrangler `4.105.0` authenticated to the owner Cloudflare account. Both required secrets were
present by name (`GATEWAY_TOKEN`, `OPENROUTER_API_KEY`), and the configured `METER_KV` binding
resolved during the production dry run. Deployment completed with a 4 ms reported startup time.
No secret values were read, logged or changed.

## Enforced boundary

- The Worker is no longer an OpenAI-compatible proxy.
- `/v1/chat/completions` and `/melo` return `410` before authentication or provider access.
- `/v1/phrase` accepts only versioned intent/tone/outcome enums and allow-listed placeholder tokens.
- Unknown fields such as `prompt`, `messages`, `snapshot`, `file_data` and `image_url` fail closed.
- Request and provider bodies are read as bounded streams; length-less oversized bodies are
  cancelled before they can be fully buffered.
- Provider output containing numbers, currency, URLs, email-like text or unapproved placeholders is
  rejected.

## External post-deployment probes

| Probe                       | Result | Response                                       |
| --------------------------- | ------ | ---------------------------------------------- |
| `GET /`                     | `200`  | `mode: abstract-phrasing-only`                 |
| `POST /v1/chat/completions` | `410`  | `Raw chat and document inference are retired.` |
| `POST /melo`                | `410`  | `Raw chat and document inference are retired.` |

The probes used synthetic text only. No user financial data was transmitted during validation.

## Local verification

- `pnpm typecheck` in `services/ai-gateway`: passed, including generated binding drift check.
- `services/ai-gateway/src/index.test.ts`: 11/11 passed.
- `wrangler deploy --dry-run`: passed with the intended KV and non-secret bindings.
- Production deployment: passed.

## What this evidence does not claim

This deployment does not activate a remote companion. The current mobile companion remains local.
It also does not prove the separate Open Banking, cloud backup, mobile-binary or store-release gates.
