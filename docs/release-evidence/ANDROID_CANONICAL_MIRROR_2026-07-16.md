# Android canonical ledger mirror - 16 July 2026

## Verdict

The shipping Android persistence path now writes a normalized canonical ledger projection in the
same SQLCipher transaction as each exact AppState generation. The native store reads both results
back before commit and rolls the entire transaction back if either the exact generation or the
canonical projection is missing, invalid or different from the input projection.

This closes the previously missing transactional canonical-mirror checkpoint for the AppState
fields that are currently mapped. A later same-day tranche also routes the mapped shipping
mutations through privacy-minimal typed commands and verifies their audit rows inside this same
transaction. It does **not** make the canonical tables Melo's read authority and does not normalize
every AppState field. Exact encrypted AppState remains the current lossless read authority.

## What changed

- The shipping Personal and Business persistence paths derive the projection from the exact
  serialized payload that is being saved, so the exact generation and canonical mirror cannot be
  computed from different in-memory states.
- The projection preserves multiple user accounts, account-scoped balances, accepted transactions,
  accepted Open Banking rows and unresolved review candidates without relabelling Open Banking as
  CSV import data.
- Decimal major-unit UI values are validated and converted to integer minor units before canonical
  storage. Cross-workspace references, duplicate accounts, unknown transaction accounts, currency
  mismatches and invalid minor units fail closed.
- Credit and loan balances remain account observations but are excluded from the available-cash
  position. A multi-account aggregate mismatch is retained as an explicit estimated unallocated
  reconciliation row instead of silently changing an account balance.
- Review-queue and spillover rows remain proposals/import drafts; they are not promoted to accepted
  financial truth.

The adapter intentionally does not invent normalized representations for every legacy AppState
shape. Pots, subscriptions, debts and other currently unsupported fields remain preserved in the
lossless exact AppState only until their typed canonical mappings are designed and migrated.

## Atomicity and automated proof

`saveNativeWorkspaceStateGeneration` now performs these operations inside one outer SQL
transaction:

1. insert and read back the exact encrypted state generation;
2. migrate the canonical repository snapshot;
3. read back the canonical SQL snapshot;
4. compare a stable normalized fingerprint with the requested projection;
5. write and exact-readback-verify every pending typed-command audit receipt; and
6. prune old exact generations only after all three representations verify.

The native-store tests use a rollback-capable fake transaction and prove that a canonical migration
exception, canonical readback mismatch or tampered typed-audit readback also removes the exact
generation written earlier in that transaction. Persistence tests also prove failed-save receipt
retention, exact-snapshot acknowledgement and preservation of a command arriving while a save is
in flight.

The complete repository CI was rerun after this implementation and passed 202 files / 2,460 tests,
all TypeScript targets, formatting, dependency boundaries, policy gates, contracts and source
package validation.

## Release-built emulator proof

The fresh dual-ABI release APK was installed only on `emulator-5554`. A real Quiet Mode toggle
forced the shipping save path, after which the Personal SQLCipher database grew from 28,672 bytes
to 532,480 bytes as the canonical schema and mirror were allocated. The setting was then returned
to off and the app was cold-started into the honest empty `Your first picture` doorway.

The app-private database was queried with the same bundled native SQLCipher library used by the
application. The proof returned `cipher_version` 4.14.0 community, `PRAGMA quick_check = ok`, schema
version 4, one Personal workspace, one canonical account and its balance/available-position rows.
It correctly returned zero transactions and zero import drafts because no sample or user money
data was added. The machine-readable counts are in
`ANDROID_CANONICAL_MIRROR_COUNTS_2026-07-16.json`.

Evidence:

- `melo-android-canonical-mirror-2026-07-16.png`
- `melo-android-canonical-mirror-final-2026-07-16.png`
- `melo-android-canonical-mirror-final-2026-07-16.xml`
- `ANDROID_CANONICAL_MIRROR_COUNTS_2026-07-16.json`
- `ANDROID_TYPED_COMMAND_BRIDGE_2026-07-16.md`
- `ANDROID_TYPED_COMMAND_COUNTS_2026-07-16.json`
- `ANDROID_CANONICAL_READ_PARITY_2026-07-16.md`
- `ANDROID_CANONICAL_READ_PARITY_COUNTS_2026-07-16.json`
- `melo-android-typed-command-final-2026-07-16.png`
- `melo-android-typed-command-final-2026-07-16.xml`

The one-off proof helper ran under the emulator app UID, emitted counts only and never printed or
exported key material. Its local and emulator files, copied encrypted SecureStore XML and temporary
native libraries were removed and checked absent afterward. The physical Galaxy S9
`2af26a2c19017ece` was not modified.

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
- Signer: `CN=Folio, OU=Folio, O=Folio, L=Verona, C=IT`

## Remaining boundary

The next storage-authority work is not another UI rebuild. Mapped shipping mutations now pass
through typed commands, and current balance/account/transaction inverse-query parity is enforced
before commit. The remaining work is to map unsupported AppState domains deliberately, prove their
own lossless queries plus interruption recovery, and only then move reads from exact AppState to
canonical repository views domain by domain.
The remaining import/restore/endurance matrix, production services, iOS release evidence and
external security/privacy/accessibility review also remain release blockers.
