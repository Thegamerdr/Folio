# Privacy Policy — Melo (working product name)

_Last updated: 16 July 2026 · Draft pending final legal review, company identity, contact address
and hosted policy URL._

## The short version

Your money data lives on your device, encrypted, under your control. Statement PDFs, images, OCR
text, transaction rows, exact values and Melo conversations are not sent to an AI provider. Melo's
current companion and statement-reading paths run on the device.

The release build contains no advertising or behavioural-analytics SDK. Limited data can leave the
device only for a feature that needs an external service: optional sign-in/encrypted backup, a store
purchase, an Open Banking connection if that service is activated, or a scrubbed crash report. The
sections below describe those boundaries.

## Data stored on your device

Balances, accounts, transactions, bills, subscriptions, pots, plans, debts, settings, review state
and companion memory are stored in an encrypted SQLCipher database. A separate authenticated,
encrypted recovery generation protects migration and recovery. Statement originals you choose to
retain are encrypted separately with workspace-bound AES-256-GCM before the app records their
metadata. Picker/cache paths and source bytes are not written into AppState.

The device data key is held through the operating system's secure storage. The current Android
release fails closed rather than writing money state to an unencrypted fallback. Using Melo's full
local-data deletion removes the encrypted database family, recovery generations, retained source
files, local exports and temporary viewer files.

## Statement reading and Melo

**Statement reading stays local.** PDF text extraction and image recognition use bundled on-device
components. CSV, TSV, TXT and pasted rows are parsed locally. The retired cloud statement-reader
functions do not read the selected URI and do not call the network. Every extracted row remains a
candidate until you review it.

**Melo currently stays local.** The shipping companion uses deterministic local reasoning. Remote
chat transport is disabled, so typed questions, conversation history and financial snapshots are
not uploaded.

The separate AI gateway is restricted to an optional future wording task. It accepts only approved
intent/tone/outcome enums and placeholder names such as `<AMOUNT>`; it rejects prompts, messages,
documents, images, names, transaction rows and exact values before contacting a model provider. The
current mobile app does not call this route.

## Other data that can leave the device

**Crash diagnostics.** The release build can send a crash event to Sentry so failures can be fixed.
Events retain exception type, source stack, severity and technical app/device context. Before
transmission, Melo removes user, request, extra and breadcrumb fields and replaces free-text
messages. Default PII, screenshots, view hierarchy, performance traces and session replay are
disabled. Crash-free session counting can be enabled; it is not tied to a Melo user identity.

**Sign-in and encrypted backup (optional, when configured).** If you choose to sign in, the
authentication provider processes the sign-in identifier and session data needed for that request.
If encrypted backup is enabled, financial state is encrypted on the device before upload; the
backup service receives ciphertext and operational metadata, not the plaintext financial state.
Production identity, deletion and clean-device restore remain release-gated until their end-to-end
evidence is complete.

**Purchases (when a listed product is available).** Google Play processes the purchase and payment
details. Melo receives the product identifier and purchase proof needed for server verification and
stores the resulting signed entitlement. Melo does not receive card details. Store products and
production verification remain disabled unless the exact release binary is matched to a live
listing.

**Open Banking (not active in the current release candidate).** If activated later and you
explicitly connect a bank, the selected regulated provider must process the account/transaction
data required for the consented Account Information service. Provider credentials stay out of the
mobile app, imported rows remain review-only, and disconnect/account deletion must revoke access
and remove Melo's encrypted provider identifiers. Provider contracts, DPIA, production consent and
deletion evidence are release gates.

## What we do not do

- No advertising, ad identifiers, data sale or behavioural profiling.
- No background upload of financial records.
- No raw statement, image, OCR text, chat history, merchant name or exact financial value sent to
  an AI/model provider.
- No provider key or bank credential embedded in the mobile app.
- No transaction becomes financial truth merely because a parser, OCR component or provider found
  it; you review it first.

## Your controls

- **Export:** create a complete JSON copy and per-surface CSV files. CSV string cells are neutralised
  against spreadsheet-formula execution; JSON preserves the exact stored value.
- **Retained sources:** open or remove an encrypted statement original without deleting confirmed
  transactions. Removing a source clears its references atomically.
- **Local deletion:** use the deliberate multi-step Start fresh flow to remove local financial
  data and app-owned artifacts.
- **Bank connection, cloud backup and account deletion:** these controls appear only when the
  corresponding external service is configured and must complete their server-side revoke/purge
  path before public release.

## Children

Melo is a personal-finance product intended for users aged 18 and over.

## Changes

This policy will be updated when a data flow changes. Store declarations, processor inventory and
the hosted policy must match the exact submitted binary before public release.

## Contact

_[Owner: add legal entity, contact email, postal address and hosted URL before store submission.]_
