# Phase E Android evidence

Status: exact current-branch Android artifact blocker documented.

## Current repository state

- Branch: `codex/melo-trusted-core-convergence-2026-07-20`
- Starting commit: `8f33622c2ad4b4c17f2954999c955d3836f70ba8`
- `apps/mobile/android`: absent.
- Local APK script exists but requires `apps/mobile/android`:
  - `pnpm --filter @folio/mobile native:apk:android`
  - underlying command: `cd android && gradlew.bat :app:assembleRelease`
- Expo run scripts exist:
  - `expo run:android`
  - `expo prebuild`
- EAS profiles exist in `apps/mobile/eas.json`:
  - `development`
  - `tester`

## Blocker

A current local Android artifact requires native project generation (`expo prebuild` / `expo run:android`) or a remote EAS build. Phase E instructions forbid destructive native regeneration and require inspecting/documenting prebuild impact before proceeding. The repository currently has no checked-in Android project to build without that generation step.

## Not done

- No stale installed build used as evidence.
- No native project generated.
- No Android files overwritten.
- No physical-device evidence claimed.

## Exact next command if approved

Inspect impact first:

`pnpm --filter @folio/mobile exec expo prebuild --no-install`

Then build/install from the generated project or run EAS tester profile. This remains blocked pending explicit approval to generate native files or use EAS credentials.
