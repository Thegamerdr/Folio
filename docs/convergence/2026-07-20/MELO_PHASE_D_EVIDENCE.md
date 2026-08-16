# Phase D evidence

Status: Phase D implementation and Phase D.1 accessibility closure evidence captured on 2026-07-20.

## Phase D.1 closure summary

The previous full-suite blocker was the dark-mode contrast gate in:

- `apps/mobile/src/surfaces/pressureMap/darkModeFoundation.test.ts`

Root cause:

- `t.inverse` is literal white and had been used as generic filled-control text.
- White on accent fails AA normal text in both palettes.
- White on dark-mode `ink` fails because dark-mode `ink` is a light token.

Resolution:

- accent fills now use `t.accentInk`
- calmStrong fills now use `t.canvas`
- ink / selected chip / knockout fills now use `t.canvas`
- the gate now bans app UI `color: t.inverse` text foregrounds entirely

Evidence docs:

- `docs/convergence/2026-07-20/MELO_PHASE_D_ACCESSIBILITY_CLOSURE.md`
- `docs/convergence/2026-07-20/MELO_DARK_MODE_CONTRAST_EVIDENCE.md`
- `docs/convergence/2026-07-20/MELO_PHASE_D_DEVICE_EVIDENCE.md`

## Automated verification

Passed:

- `pnpm exec vitest run apps/mobile/src/surfaces/pressureMap/darkModeFoundation.test.ts --reporter=dot`
  - Result: passed.
  - Coverage: 1 test file, 9 tests.
- Phase C/D focused regression suite:
  - Command:
    `pnpm exec vitest run apps/mobile/src/surfaces/pressureMap/darkModeFoundation.test.ts tooling/phaseCArchitecture.test.ts apps/mobile/src/folio/lib/trustedSafeRange.test.ts tooling/phaseDArchitecture.test.ts apps/mobile/src/folio/lib/decisionLedger.test.ts packages/domain/test/trusted-core.test.ts packages/storage/test/migrations-schema.test.ts packages/storage/test/canonical-sqlite-repository.test.ts apps/mobile/src/folio/lib/export.test.ts apps/mobile/src/folio/lib/typedCommandBridge.wiring.test.ts apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/appStateAuthorityManifest.test.ts --reporter=dot --passWithNoTests`
  - Result: passed.
  - Coverage: 12 test files, 421 tests.
- `pnpm test -- --reporter=dot`
  - Result: passed.
  - Coverage: 232 test files, 2684 tests.
- `pnpm typecheck`
  - Result: passed.
  - Notes: includes packages plus `@folio/ai-gateway`, `@melo/cloud-vault`,
    `@melo/open-banking-service`, `@melo/billing-entitlements` and
    `@melo/public-site`.
- `pnpm --filter @folio/mobile build`
  - Result: passed.
  - Notes: mobile build script runs `tsc -b --pretty false`.

## Formatter / diff evidence

Phase D.1 does not include a repo-wide formatting rewrite.

Passed:

- touched-file Prettier check:
  `.\node_modules\.bin\prettier.cmd --check <Phase D.1 touched files>`
- `git diff --check`

Repo-wide known baseline:

- `pnpm format:check` previously reported existing repo-wide Prettier drift across 1222 files.
- D.1 does not mass-format unrelated files.

## Device evidence

Android:

- Android SDK exists at `C:\Users\User\AppData\Local\Android\Sdk`.
- `adb.exe` exists at `C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe`.
- `adb` is not on PATH, so absolute path is required.
- Emulator binary exists.
- AVD `CloseLedger_Phone` exists.
- Emulator attached successfully as `emulator-5554`.
- Expo CLI is available: `56.1.20`.

Current-branch screenshot/recording evidence:

- Not captured.
- Not claimed.

Reason:

- installed Android packages on the emulator predate Phase D.1
- no current-branch Android binary/dev client is available
- `apps/mobile/android` is not checked in
- `expo run:android` would create native project files, which is outside D.1 without explicit human approval

iOS:

- Still blocked separately because the native iOS project/account setup is not available/in scope for Phase D.

## Phase D acceptance status

Accepted for:

- Decision Ledger implementation evidence
- automated accessibility gate closure
- typecheck
- mobile build
- full test suite

Remaining documented blocker:

- current-branch Android device evidence requires a safe current-branch runtime artifact or explicit approval to create/run the native Android project.

No Phase E work has begun.
