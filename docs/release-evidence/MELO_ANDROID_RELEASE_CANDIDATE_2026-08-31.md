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
install, destructive recovery, secure-key loss, biometric lock, notification, file-picker, share,
TalkBack or large-text result on this physical device. The earlier signed-candidate emulator record
retains its own onboarding, restart/background/Back, 200% text, reduced-motion and TalkBack evidence;
it is not substituted for physical-device or independent review.

## Release boundary

Open Banking remains disabled and provider-unconfigured in this candidate. Google Play billing
provider credentials/products and license-test lifecycle proof remain external. Production
Clerk/Cloud Vault account deletion, Play Console submission, independent security/accessibility/
privacy review and all iOS build/runtime evidence also remain external.
