# ADR 0004: Production Native Stack

Date: 2026-06-20

Status: Accepted with explicit blockers

## Context

Folio V2 is local-first and needs a native stack for encrypted storage, search, files,
notifications, optional system-calendar handoff, OCR and accessibility evidence. Phase 0 proved
the Expo development-build shell on Android and blocked iOS on Windows. Phase 1 then needed to
retire the most important native storage risk before pure engines and storage work could proceed.

## Decision

Use Expo SDK 56 development builds as the native runtime boundary and use OP-SQLite behind the
`DatabaseDriver` abstraction for production database work, with SQLCipher, FTS5 and WAL enabled.

Configuration rules:

- `@op-engineering/op-sqlite@17.0.0` is installed only in `apps/mobile`.
- OP-SQLite config is declared in `apps/mobile/package.json` because Android Gradle reads the
  nearest app package file.
- The root `package.json` mirrors the OP-SQLite config for workspace visibility only.
- Runtime packages must call storage through abstractions, not direct V1 imports or direct donor
  file copies.

Android state authority as of 2026-07-16:

- The exact current schema-v11 workspace partition is stored as hash-verified generations inside
  that workspace's opaque SQLCipher database.
- The Personal SQLCipher database also stores the hash-verified workspace-root manifest. Reads and
  commits are SQLCipher-first; authenticated AES-GCM files remain migration/rollback copies.
- `modules/folio-local-vault` is the narrowly scoped Android bridge for corrupt-database recovery.
  It accepts only the opaque database-name pattern, copies and SHA-256 verifies the database family
  before removing live bytes, and retains the parked copy until explicit local deletion.
- This is a lossless authority bridge for the current UI state. Canonical schema v8 contains
  first-class representations for all 44 durable fields in the 48-field AppState contract: the
  workspace root; ledger/container core; route-affecting financial context; calendar, plans and
  income schedules; transaction intelligence, evidence/import metadata, timeline and review queues;
  and companion runtime state including entitlement/lens, AI/cache, Melo and tiny wins. The other
  four fields are deliberately transient navigation/reader staging state. Each exact AppState
  generation is committed with a SHA-256 canonical-snapshot binding. Boot adopts the canonical
  projection only when the selected generation, binding and lossless inverse parity all agree;
  otherwise exact encrypted AppState remains authoritative as the recovery envelope. Mapped
  semantic actions emit privacy-minimal typed commands inside the same verified native transaction.
  Per-keystroke drafts and transient staging remain outside audit receipts by design.

OTA policy:

- OTA/native update delivery remains disabled or tightly gated until release builds prove
  native-module/schema compatibility on both platforms.
- Any native module, database schema, migration, SQLCipher, OP-SQLite or recovery-key change must
  update this ADR, the compatibility matrix and matching release evidence.

## Consequences

Android database risk is retired for the Phase 2/3 architecture path. The original spike proved
SQLCipher, wrong-key rejection, FTS5 and WAL. The release-built 2026-07-16 drill additionally proved
legacy-to-SQL migration, rollback-free SQL-only cold start, corrupt-family byte-preserving
quarantine, file recovery, SQL rebuild, rebuilt-SQL-only cold start, mapped typed-command audit
readback and product-level local clear. The schema-v8 pass additionally proves generation-bound,
inverse-parity adoption for all durable AppState fields plus first-class awkward-value round trips
through real SQLite tests.

The stack is not yet sufficient for Phase 4 vault/mobile release claims. These blockers remain:

- iOS build/install/launch evidence requires macOS/Xcode or EAS iOS signing credentials.
- Keychain/Keystore wrapping and biometric unlock are not proven.
- Argon2id recovery wrapping is not benchmarked.
- Encrypted document-file handling and plaintext-residue checks are not proven.
- Android bundled ML Kit image OCR is live-proven in the release APK; iOS Vision and the Android
  multi-page PDF/real-device corpus remain unproven.
- Android local notification scheduling is implemented with `expo-notifications`: reminders use
  absolute local dates, privacy-safe default copy, dedicated quiet channels, owned-alarm
  replacement and persisted fatigue/runtime state. The release APK proved explicit permission,
  an exact `RTC_WAKEUP` alarm, survival across a killed/relaunched app process and privacy-safe
  foreground delivery on 2026-07-14. iOS notification delivery and a wider real-device matrix
  remain unproven.
- Manual TalkBack/VoiceOver, large text and reduced-motion proof is not captured.

## Evidence

- `apps/mobile/package.json`
- `apps/mobile/src/spikes/nativeStorageSpike.ts`
- `apps/mobile/modules/folio-reader`
- `apps/mobile/modules/folio-local-vault`
- `apps/mobile/src/local/nativeWorkspaceStateStore.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C1-native-risk-spikes.md`
- `docs/release-evidence/C5-import-review-indexing.md`
- `docs/release-evidence/C6-today-timeline-calendar-transactions.md`
- `docs/release-evidence/ANDROID_PERSISTENCE_FAILURE_RECOVERY_2026-07-16.md`
- `docs/release-evidence/ANDROID_TYPED_COMMAND_BRIDGE_2026-07-16.md`
- `docs/release-evidence/ANDROID_CANONICAL_READ_PARITY_2026-07-16.md`
- `docs/release-evidence/ANDROID_CANONICAL_CORE_AUTHORITY_2026-07-16.md`
- `docs/release-evidence/ANDROID_CANONICAL_FINANCIAL_CONTEXT_AUTHORITY_2026-07-16.md`
- `docs/release-evidence/ANDROID_CANONICAL_FULL_APPSTATE_AUTHORITY_2026-07-16.md`
- `docs/release-evidence/android-live-preview-phase1.png`
- `docs/release-evidence/android-window.xml`
- `docs/release-compatibility-matrix.md`
