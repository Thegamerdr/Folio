# Phase E.2 install log

## Final fixed artifact

```powershell
C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe -s emulator-5554 install -r C:\dev\melo-e2-local-android-1f4f082\apps\mobile\android\app\build\outputs\apk\release\app-release.apk
```

Observed output:

```text
Performing Streamed Install
Success
```

Launch:

```powershell
C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe -s emulator-5554 shell am force-stop com.melomoney.app
C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe -s emulator-5554 shell am start -n com.melomoney.app/.MainActivity
```

Observed package metadata:

```text
versionCode=1 minSdk=29 targetSdk=36
versionName=1.0.0
lastUpdateTime=2026-07-21 21:55:43
```

Observed runtime process:

```text
emulator-5554
package: com.melomoney.app
process ABI: x86_64
focused activity: com.melomoney.app/.MainActivity
```
