# Android canonical AppState money read parity - 16 July 2026

> Historical checkpoint. Pots/ledger, subscriptions/preferences, cycles and debts plus the
> generation-bound boot adoption gate are completed in
> `ANDROID_CANONICAL_CORE_AUTHORITY_2026-07-16.md`; artifact hashes below belong to this earlier
> checkpoint.

## Verdict

The canonical repository can now reconstruct the shipping AppState `currentBalance`, `accounts`
and `transactions` slice without silently changing user-visible meaning. Every persistence
projection runs this inverse query and compares it with a normalized view of the exact serialized
AppState before the native SQLCipher transaction starts. Any missing field, duplicate identity,
unsupported source/category, unsafe minor-unit conversion or value mismatch rejects the save.

This is a parity gate, not a premature authority switch. The UI still reads the exact encrypted
AppState generation. Pots, subscriptions, debts and other unmapped domains still remain exact-only
until their own typed canonical projections and parity tests exist.

## Losses closed

- Canonical accounts retain the exact source account ID, creation instant and an explicit role:
  source, synthesized default, unresolved reference, aggregate reconciliation or canonical
  baseline.
- The legacy workspace aggregate balance is retained separately from named account balances. Its
  reconciliation row is written even when the difference is zero because it also carries the exact
  aggregate timestamp, source variant and confidence.
- Balance provenance retains `statement`, `pdf-derived`, `ocr-derived`, `corrected`,
  `user-entered` and `sample` instead of collapsing those details into a broad source kind.
- Accepted transactions retain exact source ID, source order, booked timestamp, category, Melo vs
  manual vs Open Banking vs migration source, account, encrypted evidence ID, provider-neutral
  external ID and local connection ID.
- Future-dated AppState rows remain canonical expectations rather than being mislabeled posted
  facts, while retaining enough source metadata for the inverse query to reconstruct them exactly
  and restore their original order beside posted rows.
- The inverse query fails closed when exact aggregate provenance or any required source field is
  missing. It does not invent a category, timestamp, account or balance source.

## Automated proof

The parity cases cover bank, savings and credit-card accounts; a non-zero aggregate
reconciliation; exact `pdf-derived` / `statement-derived` balance provenance; Melo, manual and
Open Banking transactions; a future expectation; Unicode and punctuated source IDs; evidence,
external and connection IDs; exact transaction ordering; and a deliberate fractional-minor-unit
mismatch that must reject the canonical commit.

Final repository verification passed:

- 202 test files and 2,460 tests;
- all TypeScript and Worker typechecks;
- formatting and dependency boundaries;
- 620 V2 runtime/package files checked against 859 V1 hashes;
- synthetic-data, constitution and canonical-product gates; and
- the 75-file source package plus all 14 fixture-consistency cases.

## Current Android artifacts

### Upload-signed APK

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Package: `com.folio.v2.greenfield` `0.0.1` (`1`)
- ABIs: `arm64-v8a`, `x86_64`
- Size: `108,954,283` bytes
- SHA-256: `4244DBDDAD9CBE8A5BA70603869F7AFC411C91D77459845AB1159DF3F22E7A67`
- APK Signature Scheme v2: passed
- Signer certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`

### Upload-signed App Bundle

- Path: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
- ABIs: `arm64-v8a`, `x86_64`
- Size: `76,926,853` bytes
- SHA-256: `176B1A9EA53C47068EFCD4600986A5D91BCAFABC578EA80DF20FEF56BFF3C99F`
- Bundletool 1.18.3 validation: passed with exit code 0

### Release JavaScript bundle

- Path: `apps/mobile/android/app/build/intermediates/assets/release/mergeReleaseAssets/index.android.bundle`
- Size: `7,843,960` bytes
- SHA-256: `4FBEAB6A1F5BC322EDCB04817A4E1FB6D772790BB1357E89DB0C37CA561F377D`

## Release-emulator proof

The exact APK above installed only on `emulator-5554`, then force-stopped and cold-launched into the
honest `Your first picture` state. Visual and UI-tree inspection found no controlled `Audit` name,
no `980` value, no sample balance or transaction, and only the intentional sentence explaining
that Melo does not pretend sample numbers belong to the user. `/sdcard/melo-*` returned to zero.

Evidence:

- `melo-android-canonical-read-parity-final-2026-07-16.png`
- `melo-android-canonical-read-parity-final-2026-07-16.xml`
- `ANDROID_CANONICAL_READ_PARITY_COUNTS_2026-07-16.json`

The connected Galaxy S9 `2af26a2c19017ece` was not targeted or modified. The temporary bundletool
validator was removed after the App Bundle passed.

## Remaining authority boundary

Do not read pots, subscriptions, debts, billing, companion memories or other unmapped domains from
canonical rows yet. The next safe work is domain-by-domain typed mapping and inverse-query parity,
followed by interruption/restart proof for each candidate read. External provider, iOS, security,
accessibility, store and operations blockers remain unchanged.
