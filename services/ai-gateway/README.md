# @folio/ai-gateway

A Cloudflare Worker for optional abstract Melo phrasing. It is not a chat proxy and does not accept
raw prompts, conversation history, financial snapshots, PDFs or images.

The shipping mobile companion currently answers locally. A future client may submit only the
enum-only `/v1/phrase` contract. The Worker builds a provider prompt from controlled vocabulary and
placeholder tokens; the app substitutes real values locally after the response.

## Endpoints

| Method    | Path                   | Behaviour                                 |
| --------- | ---------------------- | ----------------------------------------- |
| `GET`     | `/`                    | Health and `abstract-phrasing-only` mode. |
| `POST`    | `/v1/phrase`           | Strict enum-only phrasing envelope.       |
| `POST`    | `/v1/chat/completions` | Retired; returns `410`.                   |
| `POST`    | `/melo`                | Retired; returns `410`.                   |
| `OPTIONS` | any                    | CORS preflight.                           |

## Safe request contract

```json
{
  "version": "melo-phrase-v1",
  "intent": "check_purchase",
  "tone": "calm",
  "outcome": "fits",
  "placeholders": ["<AMOUNT>", "<AVAILABLE>"]
}
```

Unknown fields fail with `422`. That includes `prompt`, `messages`, `snapshot`, `file_data` and
`image_url`. Exact values are never valid request fields. Provider output is rejected when it adds
numbers, currency, URLs, email-like text or unapproved placeholder tokens.

## Required configuration

| Name                  | Kind          | Purpose                                                       |
| --------------------- | ------------- | ------------------------------------------------------------- |
| `OPENROUTER_API_KEY`  | Worker secret | Provider credential; never shipped to the app.                |
| `GATEWAY_TOKEN`       | Worker secret | Required request guard. Missing configuration fails closed.   |
| `METER_KV`            | KV binding    | Required global daily metering. Missing binding fails closed. |
| `OPENROUTER_BASE_URL` | var           | Defaults to `https://openrouter.ai/api/v1`.                   |
| `OPENROUTER_MODEL`    | var           | Must be `google/gemini-2.5-flash-lite`.                       |
| `PHRASE_DAILY_CAP`    | var           | Global UTC-day cap; defaults to `2000`.                       |

KV errors fail closed. Responses use `Cache-Control: no-store`, upstream errors are not echoed, and
request/response bodies have hard size limits.

## Deploy

```bash
cd services/ai-gateway
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GATEWAY_TOKEN
wrangler deploy
```

The revised Worker must be deployed before treating the production endpoint as hardened. Run
`pnpm typecheck:gateway` and the root test suite first.
