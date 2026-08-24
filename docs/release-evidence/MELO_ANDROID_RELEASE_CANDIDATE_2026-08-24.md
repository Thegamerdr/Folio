# Melo Android release candidate evidence — 2026-08-24

## Candidate identity

| Field                      | Verified value                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Source checkpoint          | `8e305291a87947d7765cda6db08f6ce9550e5a06`                                                                       |
| Artifact                   | `C:\dev\melo-native-today-batch1-2026-08-24\release-artifacts\melo-0.0.1-2026-08-24\melo-0.0.1-1-production.aab` |
| Size                       | `63,997,776` bytes                                                                                               |
| SHA-256                    | `6023B1A455907739B5EB6D7ABEA26B19212ADABF308170510ED2A50EB3E2A999`                                               |
| Package                    | `com.folio.v2.greenfield`                                                                                        |
| Version                    | `0.0.1`                                                                                                          |
| versionCode                | `1`                                                                                                              |
| minSdk / targetSdk         | `24` / `36`                                                                                                      |
| Native ABI                 | `arm64-v8a` only                                                                                                 |
| Upload certificate SHA-256 | `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488`                                               |

The production AAB was produced in the clean detached worktree
`C:\dev\melo-release-sdk56-build-2026-08-24`. `bundletool 1.18.3 validate` passed, the base manifest
dump matched the values above, and `jarsigner -verify -verbose -certs` returned `jar verified`.
Signing material remained outside the repository and no secret value was printed.

Expo Doctor first identified SDK 56 patch/minor mismatches, so those dependencies were aligned and
the candidate was rebuilt from the updated frozen lockfile. The accepted packaging runs set
`SENTRY_DISABLE_AUTO_UPLOAD=true` and a 1024 MiB Gradle metaspace limit. The arm64 `bundleRelease`
plus `assembleRelease` build and the matching x86_64 `assembleRelease` build both completed with
`BUILD SUCCESSFUL` and exit code zero. Local Hermes and ProGuard mapping outputs were produced; this
candidate does not claim a Sentry source-map upload.

## Matching tester APK

The production arm64 APK was preserved before creating a separately named x86_64 tester APK from
the same source checkpoint and release signing configuration.

| Artifact                         |         Size | SHA-256                                                            | ABI         |
| -------------------------------- | -----------: | ------------------------------------------------------------------ | ----------- |
| `melo-0.0.1-1-arm64-release.apk` | `90,108,105` | `63D08B93A8D97D17D67A2A1D2D1D5C10F95E4CB44B930B4E7D8398CACC079A88` | `arm64-v8a` |
| `melo-0.0.1-1-x86_64-tester.apk` | `95,304,633` | `0A1E2BFA2DB260787EDD4F3A2870941AC24B7D2F34AD7ECF851215721A295F4A` | `x86_64`    |

`apksigner verify --verbose --print-certs` passed for both release APKs using APK Signature Scheme
v2 and the same upload-certificate digest as the AAB. `aapt2 dump badging` matched the package,
version, versionCode, SDK levels and stated ABI.

## Binary inspection

- Bundletool reported one base feature module and only `base/lib/arm64-v8a` native libraries.
- The manifest contains the expected network, biometric, billing, camera, notifications and
  launcher-badge permissions. `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, broad external-storage access,
  advertising ID and tracking permissions are absent.
- No keystore, private-key, environment, mobile-provision or credential-named entry is present.
  `BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map` is the expected Play
  deobfuscation mapping, not application source.
- Scans of `app.config`, `app.manifest` and the bundled JavaScript found no private-key marker,
  bearer token or common secret assignment. Plain-HTTP matches in framework code were development
  placeholders such as `localhost`, `react-native-fake-base-url`, `hostname` and W3C identifiers;
  no configured provider endpoint used plain HTTP.

## Signed-candidate runtime smoke

The x86_64 tester was installed cleanly on authorized `emulator-5570`. Android reported
`primaryCpuAbi=x86_64`, version `0.0.1`, versionCode `1`, minSdk 24 and targetSdk 36. The following
release-mode scenarios completed without `AndroidRuntime` or `ReactNativeJS` fatal/error lines:

- cold launch and complete first-use onboarding with synthetic values;
- main Today screen, persisted local state and navigation to More;
- force-stop/cold restart (PID changed), background/foreground and hardware Back/relaunch;
- 200% Android font scale on Today and More;
- reduced motion with window, transition and animator scales all set to zero;
- real Google TalkBack service enabled and active, with accessibility focus exposed on the Today
  date/payday summary.

Captured evidence:

- `android-runtime/cold-start.png`
- `android-runtime/main.png`
- `android-runtime/restart.png`
- `android-runtime/large-text-200-percent.png`
- `android-runtime/large-text-more-200-percent.png`
- `android-runtime/reduced-motion.png`
- `android-runtime/talkback-focus.png`

After the pass, the emulator was restored to accessibility off, no enabled accessibility service,
font scale `1.0`, and animation scales `1,1,1`.

## Honest boundary

The attached physical Android device `2af26a2c19017ece` remained `adb unauthorized`, so this record
does not claim physical-device secure-key, biometric, notification, picker/share or destructive
recovery proof. Play Console has not received this AAB: developer identity-document and contact-
phone verification currently disable app creation. Independent security/accessibility review and
all iOS artifact/runtime evidence remain external.
