# Android typed-command persistence bridge - 16 July 2026

> Historical checkpoint. Typed coverage now includes pots/ledger, subscriptions/preferences,
> cycles and unlinked debts; current artifacts and the expanded boundary are recorded in
> `ANDROID_CANONICAL_CORE_AUTHORITY_2026-07-16.md`.

## Verdict

Mapped shipping mutations now enter a workspace-scoped typed-command queue before the updated
AppState is published. The exact AppState generation, its mapped canonical projection and the
privacy-minimal audit receipt commit inside one SQLCipher transaction. The native path reads the
stored audit row back and verifies its checksum proof before commit; any exact-state, canonical or
audit mismatch rolls the whole transaction back.

This closes the typed-write checkpoint for the currently mapped account, balance, accepted
transaction, review-proposal and Open Banking-history surfaces. It does **not** make canonical SQL
the shipping read authority and does not claim that every legacy AppState domain is normalized.
Exact encrypted AppState remains the lossless read authority until the remaining fields and query
projections can move without dropping shipping-only semantics.

## Shipping mutations covered

The bridge emits versioned commands for:

- current balance changes, account creation, account rename and account balance changes;
- single and batch transaction recording, removal and correction;
- review proposal enqueue, accept, ignore, link, clear and expiry;
- Open Banking history deletion; and
- account-linked debt and credit-card payment balance changes.

Manual and corrected input is attributed to `user`, Melo actions to `melo`, statement/OCR evidence
to `import`, bank-originated input to `sync`, and explicitly seeded/test-only origins to `system`.
The receipt retains command metadata, entity references, changed field names and SHA-256-style
checksums. It does not retain raw merchant names, balance values, categories or other field values.

Pots, subscriptions, unlinked debts and the other unsupported AppState-only domains remain exact-
state only. Migration/debug paths and persistence metadata are not misrepresented as completed
domain commands.

## Durability and interruption semantics

- The pending queue is isolated by workspace.
- Persistence takes a stable receipt snapshot alongside the exact serialized state.
- Commands arriving while that asynchronous native save is running remain queued for the next
  generation.
- A failed native save acknowledges nothing.
- A successful native transaction acknowledges only the exact receipt IDs included in that save.
- A later canonical snapshot refresh preserves typed audit rows; it removes only projection-owned
  canonical audit rows.
- Local reset clears the pending bridge as well as the persisted local data.

Automated rollback tests cover exact-state/canonical/audit commit, tampered audit readback, failed
save retention, exact-snapshot acknowledgement, a mutation arriving during save, and audit survival
through later canonical refresh. Store-level wiring tests exercise the real shipping mutation
functions and assert both command type/actor attribution and absence of raw financial values.

## Repository verification

The complete repository gate passed after the bridge was implemented:

- 202 test files and 2,460 tests;
- all TypeScript targets and Worker types;
- dependency boundaries and 620 V2 runtime/package files checked against 859 V1 hashes;
- synthetic-data, product-constitution and canonical-product gates;
- formatting; and
- the 75-file source package with all 14 consistency cases.

Mobile type checking and `git diff --check` also passed. No commit, push or deployment was made.

## Release-built emulator proof

The final dual-ABI release APK was installed only on `emulator-5554`. The normal onboarding UI was
used to enter the controlled name `Audit` and balance `£980`; no pot, transaction or fixture row was
added. Completing onboarding exercised `folio.balance.set_current.v1`. A force-stop and cold launch
restored both controlled values from the encrypted shipping path.

A one-off counts-only helper then ran under the app UID and queried the Personal database through
the same bundled SQLCipher library as the app. It returned:

- SQLCipher `4.14.0 community` and `PRAGMA quick_check = ok`;
- canonical schema version 4;
- three retained exact workspace generations;
- one workspace, account, balance observation, current balance and available-position snapshot;
- zero transactions;
- one audit row, exactly one `folio.balance.set_current.v1` row;
- actor `user`; and
- `privacy_minimal_delta = true` for a delta limited to the `balance` field and valid checksums.

Key material was never printed, passed as a command-line argument or written to disk. The derived
database key existed only in helper memory and the child process's stdin. The helper source,
compiled files, copied encrypted SecureStore XML and temporary native libraries were removed and
checked absent from both host and emulator.

The app's own three-stage **Clear local data** flow then removed the controlled name and balance.
The exact APK was force-stopped and cold-launched into `Your first picture`, with no `Audit` or
`£980` value. The sentence saying Melo will not pretend sample numbers are the user's is empty-state
copy, not a sample record.

Evidence:

- `ANDROID_TYPED_COMMAND_COUNTS_2026-07-16.json`
- `melo-android-typed-command-final-2026-07-16.png`
- `melo-android-typed-command-final-2026-07-16.xml`

The physical Galaxy S9 `2af26a2c19017ece` was not targeted or modified.

That counts-only SQLCipher drill used the immediately preceding signed release build. The current
artifact below adds fail-closed canonical account/balance/transaction inverse-query parity without
changing or bypassing the typed-command bridge; the full repository gate was rerun afterward.

## Current Android artifacts

### Upload-signed APK

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
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

## Remaining authority boundary

Canonical reads must not be enabled by back-projecting unsupported domains into AppState. Current
balance, accounts, transaction category/source/timestamp/evidence metadata and future expectations
now pass an inverse-query parity gate before native commit. Pots, subscriptions, debt and other
shipping-only fields still require their own typed mappings, interruption proof and parity gates
before reads move domain by domain.

The remaining import/restore/endurance matrix, iOS parity, production providers, public account
deletion, independent security/privacy/accessibility review, store submissions and operations
drills remain release blockers.
