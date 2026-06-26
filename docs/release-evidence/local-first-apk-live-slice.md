# Local-First APK Live Slice

Date: 2026-06-21

## Scope

This note records the current Android testable product slice. It is not a public-store release claim and it is not a claim that the full Folio vision is complete.

## APK

- Standalone local tester APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- APK size: 48,125,341 bytes.
- Build result: Gradle `:app:assembleRelease` succeeded on Windows with Android Studio JBR and Android SDK paths exported.
- Installed package: `com.folio.v2.greenfield`
- Release bundle: `apps/mobile/android/app/build/generated/assets/react/release/index.android.bundle`, 3,467,552 bytes.
- Release logcat scan: no `Metro`, `DevLauncher`, `DevMenu`, `Unable to load script`, `expo-dev`, `FATAL EXCEPTION` or `ReactNativeJS: Error` markers in the latest 2,000 lines after launch.

Earlier debug/dev-client evidence remains in this folder for history, but the current tester artifact is the standalone release APK above. It does not require Metro for the bundled JavaScript path.

## What works locally now

- First-minute onboarding lands on the real product route, not the Phase 0 evidence list.
- Today view computes live breathing room from local ledger state.
- Money view supports local what-if spending and manual spend entry.
- Sources sheet is live from the ledger and route math rather than static sample rows.
- Import review stages statement-like text as local drafts before confirmation.
- Melo is local guidance from the current ledger snapshot, with no provider call for this tester APK.
- Melo can suggest an import label while keeping the row in review before saving.
- Local ledger state is stored through the native SQLite snapshot plus normalized local rows.
- More shows the local vault row summary and data version from app state.

## Evidence files

| Evidence                                                                   | What it proves                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `docs/release-evidence/android-standalone-release-root.png`                | Standalone release APK opens to the product first-minute screen.                |
| `docs/release-evidence/android-standalone-release-playable-moved.png`      | The first-minute route reacts before anything is saved.                         |
| `docs/release-evidence/android-standalone-release-first-answer.png`        | Import discovery produces a first answer before perfect data.                   |
| `docs/release-evidence/android-standalone-release-today-main.png`          | Today route shows computed breathing room, confidence and local route events.   |
| `docs/release-evidence/android-standalone-release-more-vault.png`          | Local vault row counts and data version are visible in the installed APK.       |
| `docs/release-evidence/android-standalone-release-import-melo-suggest.png` | Melo suggests a label but keeps the import row in review before saving.         |
| `docs/release-evidence/android-standalone-release-whatif.png`              | Bad-month route recovery shows protected bills, moved buffer and route rebuild. |

## Huashu/UI outcome

The current patch addresses the largest Huashu product-function issues found in the emulator audit:

- removed the static Phase 0 evidence route from the primary user path;
- made source explanations live and traceable;
- made the horizon label react to actual ledger changes;
- softened developer-facing import copy into a review-first user flow;
- changed visible Melo language away from "Local Melo AI" toward plain product language;
- added local Melo import suggestions without automatic ledger mutation;
- added a local vault status panel so persistence is visible to testers.

Remaining UI caveat: the route/horizon should still move to a true curved vector treatment before a final public release visual bar.

## Not complete yet

- Real bank connection or production Open Banking aggregation.
- Real OCR/file picker import from PDFs, images or bank exports.
- Production vault/key-wrapping model for user financial data.
- Cloud AI gateway/provider integration for optional AI functions.
- Production-signed Android release AAB and store packaging.
- iOS native proof, which is blocked on macOS/Xcode or EAS signing credentials.

## Current conclusion

The local-first Android slice is now honest and testable as a standalone APK: it can onboard, show money state, answer basic local Melo prompts, review imports, expose local vault rows and show bad-month recovery. It is still not a public-store candidate or a complete 10/10 Folio product.
