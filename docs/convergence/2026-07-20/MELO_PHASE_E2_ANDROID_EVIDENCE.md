# Phase E.2 Android evidence

Evidence label: Android emulator evidence. This is not physical-device evidence.

## Emulator

| Field | Value |
| --- | --- |
| AVD | `CloseLedger_Phone` |
| Device ID | `emulator-5554` |
| Model | `sdk_gphone64_x86_64` |
| ABI | `x86_64` |
| App package | `com.melomoney.app` |
| Final APK source | `b8bb84697a0634c1bc442a86ae38ed9fed18db96` |

## Evidence directory

```text
artifacts/phase-e2-android-emulator-20260721/
```

## Startup

| Evidence | Result |
| --- | --- |
| `b8bb846-startup-logcat.txt` | `ReactNativeJS: Running "main"` observed |
| Fatal JS/native errors | None observed for `com.melomoney.app` process during final startup |
| Non-blocking warnings | Firebase default options absent, Expo Linking multiple schemes, RN bridgeless warnings, emulator graphics warnings |

## Native behaviour

| Behaviour | Evidence | Result |
| --- | --- | --- |
| Install and launch | `INSTALL_LOG.md`, `b8bb846-launch.png` | Passed |
| Bottom navigation | journey screenshots | Passed |
| Back handling | Timeline/Recovery/Decision History captures | Passed smoke |
| Sheets/modals | `recovery-talk-link-attempt.png`, `workspace-sheet-personal-isolation-2.png` | Passed smoke |
| Keyboard/money/date inputs | First Answer and Add Bill captures | Passed smoke |
| Dark mode | `dark-mode-today.png` | Passed |
| Large text | `large-text-dark-today.png` | Passed |
| Reduced motion/offline | `offline-reduced-motion-large-dark-today.png` | Passed |
| Relaunch persistence | `relaunch-persistence-today.png`, `b8bb846-recovery-persistence-after-relaunch.png` | Passed |
| No Business data leakage | `workspace-sheet-personal-isolation-2.png` | Passed |
| No generic blank-screen failure | launch/post-wait captures | Passed after transient system-overlay return |

## Final proof screenshots

- `b8bb846-launch.png`
- `b8bb846-timeline-material-change-fixed.png`
- `b8bb846-recovery-open.png`
- `b8bb846-recovery-pause-selected.png`
- `b8bb846-recovery-two-selected.png`
- `b8bb846-recovery-rebuild-button.png`
- `b8bb846-recovery-committed-today.png`
- `b8bb846-recovery-persistence-after-relaunch.png`
- `b8bb846-decision-history-after-recovery.png`

## Earlier route-investigation evidence

- `startup-logcat.txt` — arm64 APK on x86_64 emulator crashed with missing `libreactnative.so`.
- `startup-x86-logcat.txt` — x86_64 debug APK reached runtime but required Metro.
- `startup-release-logcat.txt` — first local x86_64 release APK launched from `1f4f082`.

These are retained because they explain the final build route.
