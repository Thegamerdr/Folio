# AI provider data boundary

Status: implemented in the mobile app and deployed at the AI gateway.
Last updated: 2026-07-15.

## What no longer leaves the phone

- PDF statement bytes;
- statement image bytes;
- OCR text;
- typed Melo questions and conversation history;
- names, merchants, account identifiers, subscription names and pot names;
- transaction rows and rich financial snapshots.

`statementReaderClient.ts` is a fail-closed compatibility shim. PDF/photo extraction uses the native
on-device path. `MeloChatSheet.tsx` uses `localMeloTurn.ts`; financial reasoning and completed-event
proposal parsing are deterministic and local. `meloSnapshot.ts` exposes aggregate integer-minor-unit
totals only and excludes seed/sample money from user truth.

## Optional future provider use

The AI Worker no longer accepts OpenAI chat-completion or document payloads. Those routes return
`410`. `/v1/phrase` accepts an enum-only envelope consisting of intent, tone, outcome and approved
placeholder tokens. Unknown fields—including prompts, messages, snapshots, files and images—are
rejected before any provider call. Provider output is rejected if it contains numbers, currency,
URLs, email-like text or unapproved placeholder tokens.

Encryption protects data in transit and at rest; it does not hide plaintext from an inference
provider. The design therefore removes user data from provider inference instead of relying on an
encryption claim that cannot be true during ordinary cloud inference.

## Production cutoff

The fail-closed Worker was deployed on 2026-07-15 as Cloudflare version
`808c7532-8c58-4501-b622-5bd0e7d99930` at
`https://folio-ai-gateway.tgdroppin.workers.dev`.

External probes after deployment returned:

- `GET /` → `200`, mode `abstract-phrasing-only`;
- `POST /v1/chat/completions` → `410`;
- `POST /melo` → `410`.

This closes the raw-data route for both rebuilt and previously installed app versions. The current
mobile build also contains no gateway URL/token and does not import a runtime AI transport.

## Open Banking is a different boundary

TrueLayer must see the selected bank data to provide Account Information Services. Melo minimises
scope and uses a server isolation layer: credentials never ship in the app, provider identifiers are
AES-256-GCM encrypted before storage, the Melo user key is SHA-256-derived, fetched transaction rows
are not persisted by the Worker, and imported rows stay review-only on the device. Provider/legal
terms and the live DPIA remain release gates.

## Verification

- statement compatibility tests assert `fetch` is never called;
- local Melo tests cover purchase, subscription, monthly-summary and review-only logging turns;
- snapshot tests assert rich identity/transaction keys are absent and sample money is excluded;
- Worker contract tests reject raw prompt, snapshot, message, PDF and image fields;
- bounded streaming tests prove length-less oversized request/provider bodies are cancelled;
- Wrangler generated-binding checks and the production dry run pass;
- public post-deployment probes prove both retired raw routes return `410`;
- Worker and mobile TypeScript checks run in CI.
