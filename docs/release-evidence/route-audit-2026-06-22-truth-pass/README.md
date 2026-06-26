# Route Truth Pass 2026-06-22

Scope: installed Android release APK on `emulator-5554` after the Huashu/product-truth follow-up.

Evidence:

- `emulator-after-truth-pass.png` / `.xml`: rebuilt APK open on Today after the full-route headline
  and import duplicate-skip fixes.
- `emulator-after-chart-label-fix.png` / `.xml`: final rebuilt APK open on Today after chart axis
  labels were compacted. The one-point route shows a single readable `Today` label instead of
  overlapping duplicate labels.

Final artifact:

- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- APK SHA256: `9DF1FC5B3F6A07BFEC69DE8E7E5A4672ED93FE26A5DDAB1C9B97063DAED0C45B`
- Release JS bundle SHA256: `F89D2F4C4751A8D5804DD67C48F7124676E78D483ACDAC4EBAFB2431EA6860D8`

Verification:

- `pnpm run ci`: passed.
- `pnpm test`: passed, 38 files and 380 tests.
- `:app:assembleRelease`: passed.
- `adb install -r`: passed.
- `monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1`: launched the app.
