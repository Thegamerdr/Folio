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

OTA policy:

- OTA/native update delivery remains disabled or tightly gated until release builds prove
  native-module/schema compatibility on both platforms.
- Any native module, database schema, migration, SQLCipher, OP-SQLite or recovery-key change must
  update this ADR, the compatibility matrix and matching release evidence.

## Consequences

Android database risk is retired for the Phase 2/3 architecture path. The database spike proved
SQLCipher, wrong-key rejection, FTS5 and WAL in the live emulator development build.

The stack is not yet sufficient for Phase 4 vault/mobile release claims. These blockers remain:

- iOS build/install/launch evidence requires macOS/Xcode or EAS iOS signing credentials.
- Keychain/Keystore wrapping and biometric unlock are not proven.
- Argon2id recovery wrapping is not benchmarked.
- Encrypted document-file handling and plaintext-residue checks are not proven.
- iOS Vision and Android ML Kit OCR are not proven.
- Local notification scheduling/update/cancel/restart proof is not captured.
- Manual TalkBack/VoiceOver, large text and reduced-motion proof is not captured.

## Evidence

- `apps/mobile/package.json`
- `apps/mobile/src/spikes/nativeStorageSpike.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C1-native-risk-spikes.md`
- `docs/release-evidence/android-live-preview-phase1.png`
- `docs/release-evidence/android-window.xml`
- `docs/release-compatibility-matrix.md`
