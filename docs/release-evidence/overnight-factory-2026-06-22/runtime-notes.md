# Runtime Notes

## Runtime Attempts

| Target                  | Result  | Evidence                                                                                                                    |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Android emulator/device | Blocked | `adb` was not on PATH. `emulator` was not on PATH.                                                                          |
| iOS simulator           | Blocked | `xcrun` was not on PATH on this Windows host.                                                                               |
| Expo project health     | Passed  | `pnpm --filter @folio/mobile doctor` passed 21/21 checks.                                                                   |
| Expo app config         | Passed  | `pnpm --filter @folio/mobile exec expo config --json` returned the current iOS/Android config.                              |
| Web fallback            | Passed  | Expo web export completed. Generated bundle was removed after recording the result to avoid committing generated artifacts. |

## Screenshot Status

No fresh native screenshots were captured in this pass. Route/surface evidence is used instead and is backed by automated tests.

## Web Export Output Observed

The successful export output listed:

- `index.html`
- `metadata.json`
- `_expo/static/js/web/entry-*.js`
- Expo Router web assets

Those generated files are not retained in this pack. The retained evidence is the command result plus deterministic route/surface evidence.

## Device Verification Still Needed

- Android install and launch.
- iOS install and launch.
- Native document picker interaction.
- Native local export write.
- Device app lock behavior.
- Screen reader traversal on TalkBack and VoiceOver.
- Small-screen screenshots without Expo development overlay.
