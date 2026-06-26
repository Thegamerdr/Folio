# Android Install For Owner

Canonical install guide: `ANDROID_INSTALL_FOR_OWNER.md` at the repository root.

Fast path:

```powershell
pnpm --filter @folio/mobile native:apk:android
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
```

Clear app data:

```powershell
adb shell pm clear com.folio.v2.greenfield
```

Dogfood reset inside the app:

```text
More -> Dogfood mode -> Reset local data
```

Diagnostic export:

```text
More -> Dogfood mode -> Export diagnostic
```
