# Security And Key Proof Checklist

Date: 2026-06-23

This is a security proof foundation, not a claim that security is complete.

## Current Storage Method

- Local financial state is stored on device through `apps/mobile/src/local/nativeLedgerStore.ts`.
- Native storage uses `@op-engineering/op-sqlite`.
- Canonical snapshots are migrated into SQLite-backed canonical tables.
- Compatibility local ledger tables are still maintained for mobile surface hydration.

## SQLite / SQLCipher State

- `package.json` and `apps/mobile/package.json` configure `op-sqlite` with `sqlcipher: true`.
- The native driver opens `folio_local_ledger.sqlite` with an encryption key.
- Physical Android SQLCipher behavior still needs device proof.
- iOS SQLCipher behavior still needs macOS/Xcode or EAS proof.

## Key Source

- `nativeLocalSecurity.ts` generates 32 random bytes with `expo-crypto`.
- The key is stored with `expo-secure-store` using `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- If SecureStore is unavailable, the app uses a session-only fallback and treats records as memory-only.

## Hardcoded Keys / Secrets

- No production provider key or cloud secret should exist in the mobile bundle.
- The web fallback key is a disabled-storage sentinel, not a production data path.
- Static checks should continue scanning for obvious keys, tokens and provider secrets.

## Logs And Diagnostics

- Dogfood diagnostics are redacted by default.
- Diagnostic bundles include counts, state and metadata, not raw financial rows.
- `nativeDogfoodDiagnosticExport.ts` writes local files only.
- Logcat capture may contain runtime library noise and must be reviewed before sharing.

## Exports

- User data export can include user-entered financial records because it is a user export action.
- Dogfood diagnostic export must not include raw source rows, account details or personal identifiers.
- The difference between diagnostic export and user data export must remain visible in copy.

## Clear/Delete

- Dogfood reset and Data Control clear reset local canonical state to an empty baseline.
- Empty baseline must not be described as a confirmed zero bank balance.
- Physical-device evidence must prove restart after clear does not resurrect local rows.

## Static Checks Added Or Existing

- No obvious upload path in Dogfood diagnostics: `apps/mobile/src/local/dogfoodMode.test.ts`.
- Diagnostic export redaction: `apps/mobile/src/local/dogfoodMode.test.ts`.
- Sample/dogfood data synthetic marking: `apps/mobile/src/local/dogfoodMode.test.ts`.
- Synthetic-data policy gate: `tooling/scripts/check-synthetic-data.mjs`.
- Release foundation document gate: `tooling/scripts/check-release-foundation.mjs`.

## Manual Review Needed

- Inspect the final Android APK for unexpected secrets before external beta.
- Review logcat output for raw financial data leakage.
- Confirm SecureStore behavior on physical Android.
- Confirm SQLCipher encrypted database cannot be read without the key.
- Confirm app lock timeout and fallback behavior on physical Android.
- Confirm iOS keychain behavior on macOS/Xcode or EAS path.
- Commission independent security review before public release.
