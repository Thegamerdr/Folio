# Privacy Policy — Melo (engineering-current draft)

_Last reconciled 31 August 2026 · Product: Melo · Android package/iOS bundle:
`com.folio.v2.greenfield` · version `0.0.1`._

This document is the engineering-current privacy source for the store package. It is not legal
approval or a published policy. The owner must provide the legal entity, contact route, public URL
and legal/privacy sign-off before store submission.

## The short version

Melo is local-first. Your money records, calculations, review state and retained statement sources
stay on your device in encrypted storage unless you explicitly choose an external feature. Melo's
current mobile core does not send raw statements, images, OCR text, transaction rows, exact values,
typed chat or conversation history to an AI provider. There is no advertising, ad identifier,
behavioural analytics or session replay.

## What is stored locally

Balances, accounts, transactions, bills, subscriptions, pots, plans, debts, settings, review state
and local companion memory are stored in the encrypted local database. Retained statement originals
are encrypted separately with workspace-bound AES-256-GCM. Device secure storage protects the local
data key; the app fails closed rather than writing money state to an unencrypted fallback.

The local Start fresh flow removes the encrypted database family, recovery generations, retained
sources, local exports and temporary viewer files. Export is user-controlled and preserves exact
stored values; CSV output neutralises spreadsheet formulas.

## Optional external features

### Sign-in and encrypted Cloud Vault backup

If you sign in, Clerk processes the identifier and session data required for authentication. If you
choose backup, Melo encrypts the state on-device before sending an opaque envelope and operational
metadata to the Cloud Vault Worker. The Worker must not receive plaintext money data or an unwrapped
recovery key. Cloud backup is optional; local use continues when sign-in, the service or network is
unavailable.

Signed-in account deletion purges Cloud Vault generations and the Open Banking adapter's indexed
records before requesting Clerk identity deletion. Identity deletion is fail-closed when a remote
purge fails so it can be retried. Production provider configuration, public web deletion route and
signed end-to-end evidence remain release gates.

### Store purchases

Google Play (and Apple if an iOS listing is later created) processes payment details. Melo receives
only product IDs and purchase proof needed to verify an entitlement. The current product model is
`folio.full` (one-time Full) plus `folio.live.monthly` and `folio.live.yearly` (Live subscriptions).
Legacy `folio.plus.*`/`folio.pro.*` IDs are restore-only compatibility IDs and are not sold by Melo.
Melo does not receive card details. The listing, sandbox purchase, restore, expiry/cancellation and
production verification still require store-console evidence.

### Open Banking

Open Banking is **disabled in the current release candidate**. The mobile build does not expose the
bank-connection surface or send provider data. A future approved build may enable a provider-isolated
adapter behind an explicit build flag; that build would require provider contract, consent, DPIA,
deletion and store re-review. Provider credentials remain server-side, and returned rows would be
staged as review candidates rather than becoming financial truth automatically.

### Crash diagnostics

Sentry may receive exception type, source stack, severity and technical app/device context. Melo
removes user, request, extra and breadcrumb fields and disables PII, screenshots, view hierarchy,
performance traces and session replay. Diagnostic failures do not block local use.

### AI/provider boundary

Raw document, image, OCR, transaction, exact-value and chat transport is retired. The optional
gateway accepts only approved intent/tone/outcome enums and placeholder tokens if a future feature is
explicitly enabled; the current mobile core does not call it. Raw routes return `410`, and local
deterministic reasoning remains available if any provider route is unavailable.

## What Melo does not do

- No advertising, ad identifiers, data sale or behavioural profiling.
- No background upload of financial records.
- No raw financial/document/chat data sent to an AI/model provider by the current mobile core.
- No provider key, bank credential or recovery secret embedded in the app.
- No payment initiation, money custody, investment/product recommendation or direct HMRC filing.
- No transaction becomes financial truth merely because a parser, OCR component or provider found it;
  you review it first.

## Children and retention

Melo is intended for users aged 18 and over. Local records and retained sources remain until the user
exports, deletes or wipes them. Cloud and provider retention is limited to the encrypted backup /
connection lifecycle and provider terms; exact legal retention exceptions require owner/legal review.

## Contact and publication fields

- Legal entity: `OWNER INPUT REQUIRED: confirm legal entity`
- Privacy/security contact: `OWNER INPUT REQUIRED: choose/confirm contact route`
- Public policy URL: `OWNER INPUT REQUIRED: choose/confirm owned URL`
- Postal address: `OWNER INPUT REQUIRED: confirm if legally required`

Store declarations, processor inventory and the hosted policy must match the exact submitted binary.
