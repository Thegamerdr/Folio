# Maestro E2E flows

CLI on this machine: `%USERPROFILE%\.maestro-cli\maestro\bin\maestro.bat` (needs
`JAVA_HOME=C:\Program Files\Android\Android Studio\jbr` on PATH-less shells). Device must be
adb-connected.

- `smoke.yaml` — safe anywhere: launch, Today renders, all four tabs respond. Run this after
  every APK install.
- `first-run.DESTRUCTIVE.yaml` — wipes app data (clearState) to test onboarding. Emulator/CI
  only; NEVER on a phone holding real numbers.

Run: `maestro.bat test apps/mobile/.maestro/smoke.yaml`
