# Android canonical financial-context authority - 16 July 2026

> Historical schema-v6 checkpoint. The current schema-v8 authority boundary, artifacts, hashes and
> emulator proof are recorded in
> `ANDROID_CANONICAL_FULL_APPSTATE_AUTHORITY_2026-07-16.md`.

## Verdict

Android's generation-bound canonical SQLCipher read candidate now covers the route-affecting
financial context as well as the previously accepted ledger/container core. The newly canonical
fields are:

- onboarding completion, name, payday and monthly-income baseline;
- the next-cycle note and tight-point hold goal;
- the honest dropped-transaction retention count;
- Money Mode, safety-buffer amount and per-mode declared amounts; and
- household partner, default share and per-subscription share overrides.

The exact encrypted AppState generation remains the lossless recovery envelope. The app adopts
these values from canonical SQLCipher only when the selected exact generation, its SHA-256
snapshot binding, the current canonical fingerprint and lossless inverse parity all agree. Missing,
duplicate, corrupt, stale or semantically different financial-context data fails closed to exact
AppState.

This does not claim full AppState normalization. Calendar/planning, income-source schedules,
correction history, evidence/import metadata, companion preferences and memories, entitlement and
AI/cache domains remain exact-authority work. The review/timeline sidecars remain exact-authority
mirrors, while read-once navigation and reader staging fields remain deliberately transient.

## Canonical schema v6

Schema v6 adds `financial_contexts`, with exactly one workspace-scoped record in each current
AppState projection. Keeping the declarations together preserves their actual product meaning:
they are the inputs that shape the user's route, safety floor and lens, not independent money
events.

The record uses integer minor units for every monetary value, retains zero, null, blank and false
states without substituting defaults, preserves household override keys and numeric shares, and
stores a deterministic entity version. Projection rejects unsafe numeric values or unsupported
modes. The inverse query requires exactly one context record for the requested workspace.

Real in-memory and SQLite repository tests cover migration 1 through 6 and exact round-trip. The
AppState parity fixture covers a non-default payday, fractional monthly income, Unicode/private
names, a next-cycle note, a fractional tight-point goal, nonzero retention count, household mode,
mode extras and subscription-share overrides.

## Typed mutation coverage

Committed financial-context actions now emit privacy-minimal typed receipts for:

- onboarding completion or declaration changes;
- tight-point hold-goal changes;
- Money Mode selection;
- safety-buffer changes;
- per-mode onboarding amounts; and
- household setup and subscription-share set/remove actions.

Receipts are workspace-scoped to one non-private financial-context reference. Their audit deltas
retain field names and checksums, never names, notes, subscription labels or monetary values. The
payday ritual intentionally persists `nextYouNote` on every keystroke for leave/return recovery but
does not create an audit receipt per keystroke. The retention count changes through the already
typed transaction/batch paths and is captured atomically in the canonical context snapshot.

## Automated proof

Final verification after the schema and runtime changes:

- complete repository suite: 203 test files and 2,472 tests;
- focused store, typed-command, SQLite, inverse-read and recovery suite: 5 files and 313 tests;
- all package, mobile and Worker TypeScript targets passed;
- repository-wide Prettier check passed; and
- release APK/AAB build passed with `NODE_ENV=production` and explicit
  `arm64-v8a,x86_64` native architectures.

The exhaustive 48-field authority manifest now classifies 10 ledger/container fields, 8 canonical
financial-context fields, 3 canonical sidecar mirrors, 19 remaining exact-encrypted fields and 4
transient fields. Adding an unclassified AppState field fails compilation.

## Current Android artifacts

### Upload-signed APK

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Package: `com.folio.v2.greenfield` `0.0.1` (`1`)
- ABIs: `arm64-v8a`, `x86_64`
- Size: `108,995,223` bytes
- SHA-256: `7313101ED0565B2A73D5127BC8E2EF29B1D39080FDBB411CC22790174075F44F`
- APK Signature Scheme v2: passed
- Signer certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`

### Upload-signed App Bundle

- Path: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
- ABIs: `arm64-v8a`, `x86_64`
- Size: `76,943,003` bytes
- SHA-256: `771E710226BFB4D66C65F02DA68799D0D8022CF3B68010992D10331CC411B550`
- `jarsigner -verify`: `jar verified` (upload certificate is intentionally self-signed).

### Release JavaScript bundle

- Path: `apps/mobile/android/app/build/generated/assets/react/release/index.android.bundle`
- Size: `7,884,900` bytes
- SHA-256: `6428A7BF9B64C650C7AD363ADB248749FE2E56E09AD71C02A8199C39987289F6`

## Release-emulator proof

The exact dual-ABI APK above was installed in place only on `emulator-5554`, retaining the existing
encrypted app data. A forced cold launch of `com.folio.v2.greenfield/.MainActivity` completed in
4,514 ms. Android selected `primaryCpuAbi=x86_64`; React Native, Hermes and OP-SQLite loaded from
the embedded x86_64 libraries; the app process remained alive; and the captured log contained no
app fatal or database fatal.

The real UI returned to the honest `Your first picture` doorway with `Add my numbers`, statement
intake and the review-before-truth message. Visual and UI-tree inspection found no fabricated
balance, subscription, debt, pot or transaction record. The word “sample” appears only in the
sentence promising not to pretend sample numbers belong to the user. `/sdcard/melo-*` returned to
zero.

Evidence:

- `melo-financial-context-authority-final-2026-07-16.png`;
- `melo-financial-context-authority-final-2026-07-16.xml`; and
- `ANDROID_CANONICAL_FINANCIAL_CONTEXT_AUTHORITY_2026-07-16.json`.

The connected Galaxy S9 `2af26a2c19017ece` was enumerated for safety but was not installed to,
cleared, launched or otherwise targeted.

## Remaining boundary

The next normalization slice should cover the calendar/income/planning domains that still affect
route and recovery decisions, then correction/evidence metadata and companion/entitlement state.
Public release remains blocked by the registered production-provider, iOS, independent security,
privacy, accessibility, store, resilience and operational gates; this checkpoint does not close
those external requirements.
