# Runtime Notes

Date: 2026-06-23

## Runtime Summary

Runtime was available on Android emulator `emulator-5554`. The local standalone release APK was
installed, launched, exercised and cleared.

## Results

| Check                           | Result | Evidence                                                       |
| ------------------------------- | ------ | -------------------------------------------------------------- |
| Clean launch                    | Passed | `01-clean-first-launch`                                        |
| No account/cloud/AI gate        | Passed | `01-clean-first-launch.xml`                                    |
| Manual path opens               | Passed | `02-quick-estimate-empty`                                      |
| Manual route preview            | Passed | `04-quick-estimate-save-visible`                               |
| Save local estimate             | Passed | `06-today-after-save`                                          |
| Persistence after restart       | Passed | `07-after-restart-persistence`                                 |
| Data Control overview           | Passed | `09-data-control`                                              |
| Export prepare                  | Passed | `11-data-control-export-prepared`                              |
| Clear requires arming           | Passed | `14-data-control-clear-buttons`, `15-data-control-clear-armed` |
| Clear local data                | Passed | `16-data-control-after-clear`                                  |
| Empty baseline not zero balance | Passed | `16-data-control-after-clear.xml`                              |
| Offline local Today             | Passed | `17-offline-today-after-clear`                                 |

## Notable Observations

- The release APK launches without Metro.
- The clean first launch states no account, cloud or AI is required.
- The manual seed route persisted after force-stop/relaunch.
- Data Control prepared a local JSON export filename:

```text
folio-local-export-2026-06-23.json
```

- Clear is two-step: arm first, then clear records.
- After clear, Folio says the workspace is empty and explicitly does not treat the baseline as a
  confirmed zero bank balance.
- Emulator text injection appended placeholder text in two quick-estimate title fields during
  automated input. Owner manual typing should not use ADB text injection as the quality signal.

## Launch Log Scan

No matches found in the clean-launch logcat scan for:

- `FATAL EXCEPTION`
- `ReactNativeJS: Error`
- `Unable to load script`
- `Metro`
- `DevLauncher`
- `DevMenu`
- `ANR`
