# Android canonical core authority - 16 July 2026

> Historical schema-v5 checkpoint. The current schema-v8 authority boundary, artifacts, hashes and
> emulator proof are recorded in
> `ANDROID_CANONICAL_FULL_APPSTATE_AUTHORITY_2026-07-16.md`.

## Verdict

Android now has a generation-bound canonical read path for the shipping ledger/container core:

- current balance, accounts and accepted transactions;
- pots and the pot borrow/deposit/repay ledger;
- subscriptions, pause state and renewal overrides;
- lived and reconstructed cycle records; and
- standalone and account-linked debts.

The exact encrypted AppState generation remains the lossless recovery envelope. A native save now
commits that exact generation, its canonical SQLCipher snapshot and a SHA-256 binding for the
snapshot in one transaction. On boot, the app may adopt a canonical core projection only when the
binding belongs to the exact selected generation, the current canonical snapshot reproduces that
binding, and the inverse projection is parity-equal to the normalized exact state. An unbound old
generation, rollback generation, corrupt/missing canonical row, fingerprint mismatch, duplicate
identity, unsafe money conversion or semantic mismatch keeps the exact AppState in authority.

This is not a claim that every route input or AppState field is normalized. Onboarding/income,
calendar commitments, plans/recovery, money-mode settings, companion state, billing, evidence/
import metadata, cloud state and other remaining slices still read from exact encrypted AppState
until each has its own lossless projection and interruption proof.

## Schema v5

Canonical schema v5 adds first-class workspace-scoped JSON tables for:

- `pots`;
- `pot_ledger_entries`;
- `subscriptions`;
- `subscription_preferences`;
- `cycle_records`; and
- `debts`.

These are separate entities rather than lossy fields forced through the older local-ledger blob.
The projection retains source ids/order, exact money values, cadence variants, renewal anchors and
periods, false/zero/orphan subscription preferences, original cycle close values and reconstruction
state, debt linkage and timestamps. Real SQLite integration tests cover migration and round-trip of
all six tables.

## Typed mutation coverage

The shipping store now emits transactionally persisted, privacy-minimal commands for the mapped
container actions as well as the previously covered account/balance/transaction/review/Open
Banking paths. Covered actions include:

- replace/edit pots, deposit, borrow, repay and overdraft-policy change;
- replace/add/edit/remove subscriptions, mark used, pause/resume one or many, nudge and reset;
- close and reconstruct cycles, plus automatic renewal re-anchoring/override expiry; and
- add/remove debts, add card payoff details, record/reverse payments and linked card payments.

User actions are attributed to `user`, automatic maintenance to `system`, bank-originated work to
`sync`, document ingestion to `import`, and Melo corrections to `melo`. Subscription names and
user-chosen pot ids are replaced by stable workspace-scoped opaque references before persistence.
Audit deltas retain changed field names and checksums, never raw labels, notes, sources or monetary
values. A legacy Melo data transfer is explicitly an `import`, not misrepresented as a user edit.

## Automated proof

Final repository verification passed after the schema, inverse projection and write coverage were
implemented:

- 203 test files and 2,471 tests;
- focused store/persistence/read-authority regression: 4 files and 304 tests;
- all package, mobile and Worker TypeScript targets;
- Prettier format check; and
- APK diff/whitespace check for the touched runtime and evidence files.

Tests cover current-generation binding, rollback-generation mismatch, pre-binding compatibility,
canonical adoption only after exact parity, canonical corruption fallback, awkward Unicode and
punctuated source ids, cadence/renewal variants, false/zero/orphan preferences, exact ordering,
fractional-minor-unit rejection, absence of private labels/amounts from typed receipts and an
exhaustive 48-field authority manifest that fails compilation when a new AppState field is not
classified.

## Current Android artifacts

### Upload-signed APK

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Package: `com.folio.v2.greenfield` `0.0.1` (`1`)
- ABIs: `arm64-v8a`, `x86_64`
- Size: `108,988,531` bytes
- SHA-256: `479245004607BE032D192665C3A6936D50B333CF61F980AC3E889CB0FBAF5F5D`
- APK Signature Scheme v2: passed
- Signer certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`

### Upload-signed App Bundle

- Path: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
- ABIs: `arm64-v8a`, `x86_64`
- Size: `76,940,634` bytes
- SHA-256: `525D40E4FB01BE6B48F071B293413E6966583A1BBEA38A7B27A49EB0B5BE7B7F`
- `:app:bundleRelease` and release lint/package tasks: passed

### Release JavaScript bundle

- Path: `apps/mobile/android/app/build/intermediates/assets/release/mergeReleaseAssets/index.android.bundle`
- Size: `7,878,208` bytes
- SHA-256: `FFB23BF85AB2BEAECE619B0E1E30E6EC73A32C3B6FECA466B5BF76431B1232C1`

## Release-emulator proof

The exact APK above was installed in place only on `emulator-5554`, preserving the preceding
encrypted database so startup exercised the schema-v5 upgrade path. `am start -W` reported a cold
launch of `com.folio.v2.greenfield/.MainActivity` in 6,762 ms. The app process remained alive and
its log contained no app fatal, React Native fatal, SQLite exception, SQLCipher failure or local
vault failure. Expo Updates logged a background network lookup failure, then correctly used the
embedded release bundle.

The UI opened into the honest `Your first picture` state. UI-tree inspection confirmed `Add my
numbers`, `Nothing counts until you review it.` and `Personal workspace`; it found no controlled
`Audit`/`980` values and no shipped sample subscription, pot, balance or transaction record. The
sentence explaining that Melo does not pretend sample numbers are the user's is empty-state copy,
not data. `/sdcard/melo-*` returned to zero.

Evidence:

- `melo-canonical-core-authority-final-2026-07-16.png`;
- `melo-canonical-core-authority-final-2026-07-16.xml`; and
- `ANDROID_CANONICAL_CORE_AUTHORITY_2026-07-16.json`.

The connected Galaxy S9 `2af26a2c19017ece` was not installed to, cleared, launched or otherwise
targeted by this candidate.

## Remaining boundary

The next internal migration is the remaining exact-only AppState surface, domain by domain,
starting with route-affecting financial context rather than caches or transient UI bridges. Public release
also remains blocked by production Open Banking/billing/cloud providers, iOS build and device
parity, independent security/privacy/accessibility review, remaining interruption/low-storage/
endurance drills, store declarations, incident operations and launch approval.
