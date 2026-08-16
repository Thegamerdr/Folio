# AI and provider egress boundary - 16 July 2026

## Verdict

The current mobile app does not send raw statements, statement images, OCR text, typed Melo chat,
conversation history, merchant names, transaction rows or exact financial values to an AI/model
provider. This is achieved by removing the raw-data routes, not by claiming that ordinary transport
encryption hides inference plaintext from a provider.

## Enforced paths

- `apps/mobile/src/local/statementReaderClient.ts` is a fail-closed compatibility shim. Its PDF,
  image and chunked functions return `no-provider`; they do not read the URI, create Base64 or call
  `fetch`.
- The shipping intake uses bundled on-device PDF text extraction and image recognition, plus local
  CSV/TSV/TXT/paste parsing. Every result remains review-only.
- `apps/mobile/src/local/meloAiClient.ts` has no runtime provider configuration or network
  transport. `sendMeloChat` returns `no-provider`; the companion uses local deterministic turns.
- `services/ai-gateway/src/index.ts` is not a chat/document proxy. `/v1/chat/completions` and `/melo`
  are retired. `/v1/phrase` accepts only version, intent, tone, outcome and approved placeholder
  enums. Unknown/free-text fields are rejected before provider egress.
- Provider output is rejected if it contains numbers, currencies, URLs, email-like text or an
  unapproved placeholder.
- The mobile source/config contains no OpenRouter/Gemini provider key or active AI-gateway URL.

## Adjacent provider protections

- Release Sentry events disable default PII, screenshots, view hierarchy, tracing and breadcrumbs.
  A `beforeSend` sanitizer removes user/request/extra/breadcrumb fields and replaces free-text event
  and exception messages while retaining stack/type/device diagnostics.
- CSV export prefixes formula-like string cells before quoting, preventing imported merchant or
  filename text from executing when opened in a spreadsheet. The complete JSON export retains the
  exact stored values.

## Verification

- Statement reader, retired Melo transport and parser boundary: 43 tests passed.
- AI gateway ingress/egress contract: 11 tests passed.
- Sentry privacy configuration/sanitizer: 4 tests passed.
- CSV export boundary: 34 tests passed.
- Mobile and complete-repository TypeScript checks passed after the boundary changes.
- The complete repository passed 205 test files and 2,510 tests.

The tests explicitly stub global `fetch` for PDF, image and chunked statement reads and verify zero
calls. Gateway tests reject raw prompt, snapshot, message, PDF and image fields before the provider
mock can run.

The production dual-ABI APK containing these boundaries has SHA-256
`08D73315D240EB9996D1C4D14D73A327D7468A0367B9F8B37A5D2AEE0D16FA72`; its release JS bundle has
SHA-256 `4C7BFAC2512C5BFD62EB672F8E26E2806ECC421A29020F5FF9C364FE27CBA629`. The APK installed and
cold-launched only on `emulator-5554` with no fatal Android/React match. Artifact and rendered-screen
details are recorded in `ANDROID_IMPORT_CORPUS_AND_CRASH_RECOVERY_2026-07-16.md`.

## Remaining release work

This source/test proof does not replace the external processor inventory, DPIA, legal review,
production Sentry event inspection or independent mobile/cloud security review. Open Banking is a
separate consented provider boundary and remains inactive until its production/legal gates close.
