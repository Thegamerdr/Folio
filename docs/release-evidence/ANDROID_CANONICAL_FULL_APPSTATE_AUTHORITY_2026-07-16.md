# Android canonical full AppState authority - 16 July 2026

## Verdict

The Android shipping persistence path now has a generation-bound canonical SQLCipher read candidate
for every durable field in the current 48-field AppState contract. Forty-four persisted fields are
represented by the workspace root or first-class canonical records; the remaining four fields are
deliberately transient navigation/reader staging state. No durable AppState field remains solely
under the exact encrypted-envelope authority.

This is a storage-authority milestone, not a public-release completion claim. The exact encrypted
AppState generation remains the lossless recovery envelope. Boot adopts the canonical projection
only when the selected exact generation, SHA-256 snapshot binding, canonical fingerprint and
lossless inverse parity all agree. Missing, duplicate, corrupt, stale or semantically different
canonical data fails closed to the exact encrypted generation.

## Canonical schema v8

| Authority slice          | AppState fields | Canonical representation                                                                            |
| ------------------------ | --------------: | --------------------------------------------------------------------------------------------------- |
| Workspace root           |               4 | schema/workspace manifest                                                                           |
| Ledger/container         |              10 | balances, accounts, transactions, pots/ledger, subscriptions, cycles and debts                      |
| Financial context        |               8 | onboarding, route inputs, Money Mode and household settings                                         |
| Route/planning           |               3 | calendar events, plans and income schedules                                                         |
| Transaction intelligence |              13 | corrections, ignore/dismissal state, merchant memory, imports, evidence, timeline and review queues |
| Companion runtime        |               6 | AI reads/cache, what-changed state, entitlement/lens, Melo and tiny wins                            |
| Exact-encrypted-only     |               0 | none                                                                                                |
| Transient/not persisted  |               4 | calendar focus, route focus and unreviewed reader staging                                           |
| **Total contract**       |          **48** | **44 durable + 4 transient**                                                                        |

Schema v8 adds two workspace-scoped canonical records rather than a catch-all JSON escape hatch:

- `transaction_intelligence_states` preserves correction history, ignored review/bank identifiers,
  signal dismissals, merchant-category memory, statement-import metadata, evidence metadata,
  timeline events, review queue and spillover exactly;
- `companion_runtime_states` preserves AI-read accounting/cache, what-changed state, entitlement and
  trial state, Melo preferences/memory and tiny wins exactly.

The prior schema-v7 route/planning slice also preserves source calendar times separately from
normalized canonical times and retains deterministic plan provenance. Awkward round-trip fixtures
cover Unicode, private labels and identifiers, correction history, signal state, merchant memory,
statement/evidence metadata, AI closing balances, entitlement, Melo memory, wins, timeline and both
review queues.

## Mutation and privacy boundary

Shipping user, import and system mutation paths for these domains now emit typed semantic receipts
inside the verified persistence transaction. Coverage includes route/planning, corrections and
ignore state, signal decisions, merchant memory, imports/evidence, queue maintenance, AI/cache,
entitlement/lens, Melo preferences and tiny wins, in addition to the earlier ledger commands.

Receipts contain only command type, workspace-scoped opaque entity references, provenance and
checksums. The wiring suite verifies that raw merchant names, filenames, private IDs, amounts and
other user values do not appear in serialized pending receipts. Per-keystroke drafts and transient
reader/navigation state intentionally do not create audit noise.

## Verification

- `pnpm typecheck`: passed.
- `pnpm format:check`: passed before this evidence-only documentation update.
- `pnpm test`: 203 files and 2,474 tests passed.
- Release build: `:app:assembleRelease :app:bundleRelease` passed for `arm64-v8a,x86_64`.
- APK signature: v2 verified with signer certificate SHA-256
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`.
- AAB: JAR verification passed. Expected self-signed/no-timestamp and modern bundle-entry warnings
  do not invalidate the local upload-candidate verification.

| Artifact                                                                            |       Bytes | SHA-256                                                            |
| ----------------------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------ |
| `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`                 | 109,030,815 | `B746CF1CB0CAB30038F3EC1FB0A5F92B4006A515B0D144D8E7E4504687B81F20` |
| `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`              |  76,956,279 | `C2A7B68DB3D1967F05E08B51B87CB72BF77286B2A0981896C844F94F62E6884B` |
| `apps/mobile/android/app/build/generated/assets/react/release/index.android.bundle` |   7,920,492 | `FDC4CB008F32A6CB0082B8B196B19A006DFCA883EB2DBC515A880409AECC15C7` |

## Emulator-only release proof

Every ADB command explicitly targeted `emulator-5554`. The Galaxy S9 was not targeted.

- `adb -s emulator-5554 install -r`: passed.
- Installed package: `com.folio.v2.greenfield`; primary CPU ABI: `x86_64`.
- Repeated cold launch: status `ok`, launch state `COLD`, total time 6,988 ms, wait time 7,313 ms,
  PID 8551.
- Fatal/application-database matches: 0.
- The installed release opened into the honest `Your first picture` doorway with Melo present,
  `Add my numbers`, `Add a statement instead`, and no fabricated balances or records.
- UI XML scan: zero placeholder matches. The only sample-language match was the explanatory copy
  `without pretending sample numbers are yours`; it is not sample data.
- Remote cleanup: `/sdcard/melo-*` count returned 0.

Visual and semantic evidence:

- `melo-canonical-full-authority-final-2026-07-16.png`
- `melo-canonical-full-authority-final-2026-07-16.xml`
- `ANDROID_CANONICAL_FULL_APPSTATE_AUTHORITY_2026-07-16.json`

## Still open

This proof does not close the remaining import/restore/endurance matrix, production account
deletion and provider integrations, iOS build/storage parity, independent security/privacy/legal
review, manual accessibility and cross-device usability evidence, store-console submissions,
production billing, support/operations drills or controlled launch evidence. Those remain governed
by `RELEASE_BLOCKER_REGISTER.md` and `tooling/config/release-blockers.json`.
