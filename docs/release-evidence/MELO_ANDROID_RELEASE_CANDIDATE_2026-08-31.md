# Melo Android release candidate evidence — 2026-08-31

## Candidate identity

| Field                      | Verified value                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Source checkpoint          | `d1ba2bb148a90138c837d8d3572cf415b0ffd8d5`                                                                          |
| AAB                        | `C:\dev\melo-native-today-batch1-2026-08-24\release-artifacts\melo-0.0.1-2026-08-31\melo-0.0.1-1-production.aab`    |
| AAB size                   | `62,324,086` bytes                                                                                                  |
| AAB SHA-256                | `3170EE26762A72645680BFBA316BF0670936065182BE4946A6C36CC0F1AF71FD`                                                  |
| APK                        | `C:\dev\melo-native-today-batch1-2026-08-24\release-artifacts\melo-0.0.1-2026-08-31\melo-0.0.1-1-arm64-release.apk` |
| APK size                   | `88,488,750` bytes                                                                                                  |
| APK SHA-256                | `3CC02938B079A753BF3E9BD90A939C8EC24EA49AE99C9314F152EC8B2DAB3437`                                                  |
| Package                    | `com.folio.v2.greenfield`                                                                                           |
| Version / versionCode      | `0.0.1` / `1`                                                                                                       |
| minSdk / targetSdk         | `24` / `36`                                                                                                         |
| Native ABI                 | `arm64-v8a` only                                                                                                    |
| Upload certificate SHA-256 | `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488`                                                  |

The production `bundleRelease` and matching `assembleRelease` builds completed with
`NODE_ENV=production` and `SENTRY_DISABLE_AUTO_UPLOAD=true`. Sentry source-map upload was disabled
because the production Sentry organisation/project credentials were not available; this record does
not claim that source maps were uploaded. Signing material remained outside the repository and no
secret value was printed.

## Artifact verification

- Official `bundletool 1.18.3 validate` completed successfully for the AAB.
- `bundletool dump manifest` confirmed the package, version, versionCode, SDK levels and single
  `arm64-v8a` ABI above.
- `jarsigner -verify -verbose -certs` passed for the AAB.
- `apksigner verify --verbose --print-certs` passed for the APK using APK Signature Scheme v2 and
  the same upload-certificate digest as the AAB.
- `aapt2 dump badging` confirmed the APK package, version, versionCode, SDK levels and ABI.

## Physical Galaxy S9 smoke

The signed arm64 APK was installed with `adb install -r` on authorized device
`2af26a2c19017ece` (`Samsung SM-G960F`, product `starltexx`). Android reported version `0.0.1`,
versionCode `1`, minSdk 24, targetSdk 36 and the arm64 ABI. The following non-destructive release
smoke completed:

- cold launch succeeded with PID `5764`;
- background/foreground and hardware Back/relaunch retained PID `5764`;
- force-stop/relaunch succeeded with a new PID, `16269`;
- the filtered `AndroidRuntime:E` / `ReactNativeJS:E` logcat contained no error entries.

The install used `-r` and preserved existing application data. This pass does not claim a clean
install, destructive recovery, secure-key loss, calendar/voice integration, TalkBack or large-text
result on this physical device. The earlier signed-candidate emulator record retains its own
onboarding, restart/background/Back, 200% text, reduced-motion and TalkBack evidence; it is not
substituted for physical-device or independent review.

## Locked-device security inspection — 2026-09-01

ADB revalidation while the S9 was at its secure keyguard confirmed the following without unlocking
the device or reading application data:

- Android reported a secure, showing and non-occluded keyguard; fingerprint hardware was present and
  its service reported a passing module/calibration state.
- SELinux was `Enforcing`.
- The release package did not carry the debuggable flag; `run-as com.folio.v2.greenfield id` was
  rejected with `package not debuggable`.
- Android granted the normal biometric/fingerprint permissions declared by the package, while the
  runtime camera permission remained denied.

These observations strengthen the device/sandbox boundary but do not prove the hardware-backed key
lifecycle. No attempt was made to infer or bypass the owner's credential.

## Interactive S9 privacy and Android integration proof — 2026-09-01

With the owner present to satisfy every Samsung Knox device-authentication prompt, the same signed
candidate completed the following non-destructive checks:

- App Lock was enabled from **Data and privacy** using the device's fingerprint/PIN boundary. The UI
  then reported `ON` and `locks whenever Melo leaves the screen`.
- Sending Melo to Home and launching it again opened Samsung's `Unlock Melo` credential activity
  before app content was available. Authentication returned to Melo without a fatal native or
  React Native error.
- Leaving Melo for Android's share chooser also caused App Lock to re-engage on return, matching the
  promised every-background-transition behaviour.
- App Lock was disabled through the authenticated `Turn off Melo app lock` prompt after testing, and
  the Privacy screen was visually rechecked at `OFF`, restoring the device's starting preference.
- Enabling reminders created the `melo`, `melo-reminders` and `melo-updates` Android channels; the
  toggle was then returned to OFF. The channels were silent (`sound=null`), without vibration or a
  badge, and the filtered fatal log contained no entries. Because this was a preserved-data upgrade
  install and Android channel attributes are immutable after creation, this pass does not claim a
  clean-install lock-screen visibility result.
- **Export my data** produced `melo-personal-export.json` and opened Android's system share chooser.
  The chooser was cancelled; no destination was selected.
- **Restore from an export** opened `com.android.documentsui/.picker.PickActivity`. The picker was
  cancelled without selecting a file, and Melo resumed normally. No restore or local-data mutation
  was performed.
- Filtered `AndroidRuntime:E` and `ReactNativeJS:E` logcat checks were empty for the notification,
  App Lock, share and picker transitions.

The interactive App Lock, notification-channel creation and picker/share launch gaps are therefore
closed for this Galaxy S9 candidate. Clean-install notification-channel privacy, hardware-backed key
loss/recovery, destructive restore, the supported Android-device matrix and equivalent iOS evidence
remain external release work.

## Release boundary

Open Banking remains disabled and provider-unconfigured in this candidate. Google Play billing
provider credentials/products and license-test lifecycle proof remain external. Production
Clerk/Cloud Vault account deletion, Play Console submission, independent security/accessibility/
privacy review and all iOS build/runtime evidence also remain external.
