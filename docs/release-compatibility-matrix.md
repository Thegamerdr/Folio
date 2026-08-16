# Release Compatibility Matrix

## Baseline

| Area               | Current decision                                                          | Evidence                                                                                  | Status                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js            | 24.x LTS family                                                           | Local toolchain: `v24.16.0`                                                               | Accepted for Phase 0                                                                                                                            |
| pnpm               | 11.x                                                                      | Local toolchain: `11.5.2`                                                                 | Accepted for Phase 0                                                                                                                            |
| TypeScript         | 5.9.x frozen in lockfile                                                  | `package.json`, `pnpm-lock.yaml`                                                          | Accepted for Phase 0                                                                                                                            |
| Mobile runtime     | Expo SDK 56 development/release build, not Expo Go                        | ADR 0003, `docs/release-evidence/C14-store-billing-operations-release.md`                 | Clean release install verified on emulator and preserved-data update verified on Galaxy S9                                                      |
| Figma evidence     | Design evidence mirrors repo tokens/screens; repo remains source of truth | `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=18-2`                        | Accepted through Phase 13 review evidence                                                                                                       |
| Database           | OP-SQLite 17.0.0 with SQLCipher, FTS5 and WAL behind `DatabaseDriver`     | ADR 0004, `docs/release-evidence/ANDROID_CANONICAL_FULL_APPSTATE_AUTHORITY_2026-07-16.md` | Android lossless authority and schema-v8 generation-bound reads for all 44 durable AppState fields accepted; iOS and endurance matrices blocked |
| Storage layer      | Pure `@folio/storage` abstractions before native driver binding           | `docs/release-evidence/C3-storage-foundation.md`                                          | Accepted for Phase 3                                                                                                                            |
| First-minute shell | Pure `@folio/first-minute` model rendered by Expo development build       | ADR 0005, `docs/release-evidence/C4-mobile-first-60-seconds.md`                           | Accepted for first value; vault security blocked                                                                                                |
| Import engine      | Pure parser/review contracts plus Android local OCR-to-Review adapter     | ADR 0006, `docs/release-evidence/ANDROID_IMPORT_CORPUS_AND_CRASH_RECOVERY_2026-07-16.md`  | Android OCR, encrypted retention, common structured/unstructured formats and 100k parser endurance proven; release-device/iOS matrix blocked    |
| Import commit      | Storage command-bus evidence for search/jobs/audit atomicity              | ADR 0006, `packages/storage/test/import-commit.test.ts`                                   | Accepted as evidence; real vault row writes blocked                                                                                             |
| Daily loop         | Pure engine plus real local calendar and Android reminder adapter         | ADR 0007, `docs/release-evidence/C6-today-timeline-calendar-transactions.md`              | Android local scheduling/restart accepted; iOS/manual a11y/external sync blocked                                                                |
| Local search       | Pure `@folio/search-engine` workspace-scoped index/query contract         | ADR 0007, `packages/search-engine/test/search-engine.test.ts`                             | Accepted as deterministic local contract                                                                                                        |
| Melo policy        | Pure `@folio/melo-policy` deterministic intent/proposal/language contract | ADR 0008, `docs/release-evidence/C7-melo-deterministic-system.md`                         | Model-off core accepted; voice/vault/legal/manual a11y blocked                                                                                  |
| Plans/recovery     | Pure `@folio/plan-engine` deterministic plan/rebase/fun contracts         | ADR 0009, `docs/release-evidence/C8-plans-progress-fun-recovery.md`                       | Pure/shell contracts accepted; vault/native/manual a11y blocked                                                                                 |
| Release readiness  | Contracts plus encrypted Android state, app lock, export and local clear  | ADR 0010, `docs/release-evidence/C9-security-export-local-launch-readiness.md`            | Android foundation accepted; independent review/drills/beta blocked                                                                             |
| Cloud account      | Optional Clerk account plus client-encrypted backup/restore/purge Worker  | ADR 0011, `docs/release-evidence/C10-cloud-account-encrypted-backup-sync.md`              | Local foundation accepted; production/web/E2E/review/operations blocked                                                                         |
| Optional AI        | Pure `@folio/ai-contracts` registry/gateway/context/quota/eval contracts  | ADR 0012, `docs/release-evidence/C11-optional-ai.md`                                      | Pure/shell contracts accepted; provider/gateway/privacy/eval/beta blocked                                                                       |
| Open Banking       | Provider-neutral package, isolated Worker and native Review staging       | ADR 0013, `docs/release-evidence/C12-open-banking.md`                                     | Runtime foundation accepted; provider/legal/pilot/rollout blocked                                                                               |
| Business workspace | Pure `@folio/business-workspace` clients/invoices/tax/export contracts    | ADR 0014, `docs/release-evidence/C13-business-workspace.md`                               | Pure/shell contracts accepted; tax/legal/entitlement/support/beta blocked                                                                       |
| Store release      | Expo IAP seam plus server-verified Ed25519 entitlement Worker             | ADR 0015, `docs/release-evidence/C14-store-billing-operations-release.md`                 | Folio-signed dual-ABI APK/AAB validated; Play listing, credentials and native purchase proof blocked                                            |
| Release gate       | Pure `@folio/release-gate` blocker register and public-release guard      | ADR 0016, `docs/release-evidence/R0-public-release-blocker-gate.md`                       | Implementation backlog complete; public release intentionally blocked                                                                           |
| OTA policy         | Disabled or tightly gated until native/schema compatibility is proven     | ADR 0004                                                                                  | Accepted as disabled/gated for Phase 1                                                                                                          |

## Rule

No OTA, schema, database, crypto or native-module change can ship without updating this matrix and the matching ADR/evidence record.

## Android release-candidate verification — 2026-07-15

The current arm64 APK is v2-signed with the Folio upload certificate and passes 16 KiB alignment.
The current arm64 AAB passes `bundletool 1.18.3 validate`. A clean release install passed on the
emulator, and the current code was also exercised on a physical Samsung Galaxy S9 without uninstalling
the existing app. The physical-device update required a separately labelled debug-signed test copy
because the old local installation used the Android debug certificate; that test copy is not a release
artifact. The Folio-signed APK/AAB above remain the only distribution candidates.

Runtime verification includes intended font rendering, signed-out/no-key startup, an empty first-use
state, Today/Review/Melo/More navigation and the guarded local-data clear flow. Public release remains
blocked by the release-gate register rather than by local Android packaging.

## Android SQLCipher authority verification — 2026-07-16

> Historical foundational checkpoint. The current schema-v8 authority boundary is recorded under
> Android canonical full-AppState verification below.

The final dual-ABI release app migrated a real serializer-produced schema-v11 Personal partition
into SQLCipher and restored it after every authenticated state/manifest rollback file was removed.
The opaque database header was not a SQLite header and the known fixture marker was absent from the
database family. A deliberately corrupt live database was copied and SHA-256 verified into the
private parked family before deletion; the exact corrupt hash was retained while a new encrypted
database was built from the authenticated rollback. Removing rollback files again and cold-starting
proved the rebuilt SQL database independently. The three-confirmation product clear then removed
the parked family and cold-started into the real no-sample-data doorway.

This accepted Android SQLCipher as the lossless current UI-state and workspace-root authority at
that checkpoint. The
mapped account, balance, accepted-transaction, review and Open Banking-history mutations also have
transactionally verified privacy-minimal typed-command writes. Current balance, account, posted
transaction and future-expectation rows also pass a fail-closed inverse-query parity gate before
commit. Later sections supersede its then-open normalization boundary. It did not accept iOS storage
parity or the remaining import/endurance matrix.

## Android canonical core verification — 2026-07-16 (historical checkpoint)

Canonical schema v5 adds first-class pots/ledger, subscriptions/preferences, cycles and debts to
the existing account/balance/transaction projection. A SHA-256 snapshot binding is committed with
each exact AppState generation, and boot adopts the canonical ledger/container core only when that generation,
binding and inverse parity all agree. The rebuilt dual-ABI release installed in place and cold-
launched on `emulator-5554` into the clean no-sample-data doorway without app/database fatal errors.
The Galaxy S9 was not targeted by this candidate. Non-money AppState domains and iOS remain blocked.

## Android canonical financial-context verification — 2026-07-16 (historical checkpoint)

Canonical schema v6 adds one workspace-scoped `financial_contexts` record containing onboarding,
payday/monthly-income baseline, next-cycle note, tight-point goal, retention count, Money Mode,
safety buffer, per-mode amounts and household allocation settings. The same generation binding and
inverse-parity gate now makes these eight AppState fields canonical read candidates. Semantic
setting actions emit privacy-minimal typed receipts; the every-keystroke next-cycle draft does not
create audit-log noise. The fresh dual-ABI release installed in place and cold-launched on
`emulator-5554` in 4,514 ms into the clean no-fabricated-data doorway with no app/database fatal.
The Galaxy S9 was enumerated but not targeted. Calendar/planning/income-source, companion,
entitlement, evidence/import and remaining exact-state domains, plus iOS and external release gates,
remain blocked.

## Android canonical full-AppState verification — 2026-07-16

Canonical schema v8 represents all 44 durable fields in the 48-field shipping AppState contract
through the workspace root and first-class ledger/container, financial-context, route/planning,
transaction-intelligence and companion-runtime records. The remaining four fields are deliberately
transient navigation and unreviewed-reader staging; no durable field remains exact-envelope-only.
The encrypted exact generation remains the lossless recovery envelope, while canonical reads are
adopted only when generation binding, snapshot fingerprint and inverse parity agree.

The fresh dual-ABI release passed 203 test files and 2,474 tests, installed only on
`emulator-5554`, and cold-launched in 6,988 ms with zero app/database fatal matches. The clean
first-use doorway showed Melo and no fabricated financial records. The Galaxy S9 was not targeted.
This accepts the Android durable AppState authority boundary. It does not accept the remaining
import/restore/endurance matrix, iOS parity, independent reviews, provider production readiness,
store submissions or operational launch evidence.

## Android import, privacy and recovery verification - 2026-07-16

The source after the full-AppState checkpoint adds unstructured clipboard/TXT fallback, split
debit/credit CSV support, formula-safe CSV exports, automatic encrypted-import orphan cleanup,
explicit encrypted-source promotion/delete failure behavior, a 47-case persistence matrix and a
fail-closed raw AI/provider boundary. Complete TypeScript checks, formatting, 205 test files and
2,510 tests passed; the final CI 100,000-row shipping-parser run completed in 822 ms.

The fresh production APK and AAB contain `arm64-v8a` and `x86_64`. The APK is `109,035,615` bytes
with SHA-256 `08D73315D240EB9996D1C4D14D73A327D7468A0367B9F8B37A5D2AEE0D16FA72`; the AAB is
`76,959,006` bytes with SHA-256
`50E1952891C137D2F98899F314A4BB24CB4700510A6A6DB8A9644DEE0E1D5532`. Both signatures verified
against the established Folio certificate. The APK installed only on `emulator-5554` and
cold-launched empty in 8,124 ms with no fatal match. Release-built CSV review showed the actual
source, retained filename and row count instead of the inherited one-page-PDF label. The first-use
doorway was empty and displayed Melo after the drill;
the Galaxy S9 was not targeted by this candidate.

This accepts the current local Android implementation/build boundary. It does not accept iOS,
production provider/legal/store/operations readiness, independent reviews or the remaining
release-device import/restore drills.
