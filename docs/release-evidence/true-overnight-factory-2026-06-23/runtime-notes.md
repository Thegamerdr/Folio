# Runtime Notes

| Runtime                 | Result  | Evidence                                                                                                                     |
| ----------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Android emulator/device | Blocked | `adb` was not on PATH. `emulator` was not on PATH.                                                                           |
| iOS simulator           | Blocked | `xcrun` was not on PATH on this Windows host.                                                                                |
| Expo doctor             | Passed  | `pnpm --filter @folio/mobile doctor` completed 21/21 checks.                                                                 |
| Expo config             | Passed  | `pnpm --filter @folio/mobile exec expo config --json` returned iOS/Android app config.                                       |
| Web fallback            | Passed  | Expo web export completed after the implementation changes. Generated bundle was removed after recording the command result. |

## Screenshots

No fresh native screenshots were captured because Android and iOS runtime tools were unavailable.

Substitute evidence:

- focused route/source tests;
- web export bundle success;
- deterministic route evidence from `apps/mobile/src/local/productExperienceEvidence.ts`;
- implementation evidence in this pack.
