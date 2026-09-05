# Melo Android review candidate — 5 September 2026

Status: signed local review candidate installed and launched on Galaxy S9. **Not approved for public release or store submission.** This supersedes September 1 as the current local Android candidate, not as production/provider certification.

## Exact build

- Source: `516ee6b4ede45c1edca565314c77f577032ba1f8` on `codex/melo-native-true-parity-2026-08-25`.
- APK: `release-artifacts/melo-0.0.1-2026-09-05-reviewed-516ee6b/melo-0.0.1-1-arm64-review.apk`
- APK SHA-256: `DBE8943D034086218F45A25E529690E0A1345AC88B00A52BFA79D48D86D16A5A`
- AAB: `release-artifacts/melo-0.0.1-2026-09-05-reviewed-516ee6b/melo-0.0.1-1-review.aab`
- AAB SHA-256: `3C6E9C42BC434FA178FDA16AB842002C633CF3D2F30038B6D8F23141608CDCE6`
- Identity: `com.folio.v2.greenfield`, version `0.0.1`, code `1`, arm64-v8a, min SDK 24 / target 36. Version/code were preserved; a future store submission needs the appropriate store version decision.
- Upload certificate SHA-256: `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488` — matches the previous S9 installation.
- Embedded runtime fingerprint, present in both archives: `51cab0b9e1f441348c5dc22d52db333f06e37022`.

Build: `:app:assembleRelease :app:bundleRelease -PreactNativeArchitectures=arm64-v8a`, Java 21 / Gradle 9.3.1. Final build succeeded in 3m50s. `EXPO_PUBLIC_MELO_PARITY_CAPTURE=false`, `NODE_ENV=production`, `SENTRY_DISABLE_AUTO_UPLOAD=true`; Sentry upload was skipped. No service deployment, OTA publication or store upload occurred. Inactive fixture-related strings may remain in compiled modules; capture initialization is disabled, not represented as physically removed from the binary.

APK signature verification and Bundletool 1.18.3 AAB validation passed. Jarsigner reported `jar verified`, with self-signed-chain/no-timestamp/POSIX-attribute and JarInputStream ZIP-order warnings. These local checks are not Play Console acceptance or a declaration review.

## S9 evidence

The final APK was installed using `adb install -r`, never uninstall/clear. On-device `sha256sum` matches the exact APK above. Original first-install time remains **2026-08-14 07:05:02**; final update time **2026-09-05 17:25:02**. No financial records, accounts or balances were added, edited or deleted for this smoke check. This proves an in-place update, not an exhaustive before/after data comparison.

- App launches into the existing first-run/sample workspace; no owner numbers were invented to populate it.
- Today, Plan, Review and More opened during the S9 pass. Search is a real native search screen.
- Final Search finds Transfer and Refund; tapping each opens its real prerequisite sheet, dismissing the keyboard. No transfer/refund was committed.
- Final onboarding input, Next, Skip and Close remain below the top system safe area with the keyboard open; overflowing copy remains scrollable.
- Melo chat's typed composer and enabled Send remained visible above the Samsung keyboard. The test draft was not sent. Hardware Back dismissed keyboard and then chat.
- Current final process `32139` had no AndroidRuntime or ReactNativeJS error entries during the checked flows. Earlier crash entries belong to the rejected build below, not this process.

Screenshots remain private under `apps/mobile/.expo/` (`s9-final-onboarding-keyboard.png`, `s9-final-search.png`, `s9-final-transfer.png`, `s9-final-refund.png`, plus the earlier same-session screen/chat captures). They were not uploaded to Lovable or committed. Voice recognition was not started without the owner's readiness response; a human-spoken transcript/proposal is still unverified.

## Review and rejected build

One consolidated Lovable review used 34 synthetic light/dark screenshots plus full-stack/source context; it returned 15 corrections for one credit. `a8e05e02` implements their disposition, with root light/dark composition checks and 27 targeted cases. `516ee6b` adds the device follow-up (Calendar jump coordinate/retry, sheet shrink, searchable transfer/refund); nine additional focused cases and final mobile no-emit passed. See `docs/ui-review/2026-09-05-lovable/06-correction-disposition.md`. No second Lovable review or final independent sign-off is claimed.

The earlier `reviewed-a8e05e02` archive is **REJECTED**: stale Expo-generated resources omitted `assets/fingerprint`, causing a native startup crash. `400aa4b` makes the prebuild-owned metadata task regenerate on native builds. The bad archive is retained with `REJECTED.md`; it is not a deliverable. A replacement launched before the final UI follow-up was built, so S9 was not left on the broken candidate.

## What remains

The audit disposition is in `MELO_AUDIT_CLOSURE_2026-09-05.md`; local/device gaps stay open rather than being recategorized as secrets. Outstanding work includes broader populated/Business/large-text/permission/date-boundary and actual speech checks; deploying approved cloud/banking/billing revisions and migrations; configured Clerk/deletion, two-device sync/recovery, TrueLayer consent/import/deletion and licensed Play/Apple lifecycle proofs; iOS build/device evidence; and security/privacy/accessibility/store review. The new service revisions have not been deployed, although older endpoints exist. Public release remains blocked. Secrets alone do not close these checks.
