# Melo Android release candidate evidence — 2026-09-01

Status: **built, signed, verified and installed; not approved for public release.**

## Exact artifacts

The candidate was produced after a clean Expo Android prebuild from the current working source. R8
required an 8 GiB Gradle heap; `bundleRelease assembleRelease` then completed successfully.

| Artifact                                                                 |      Bytes | SHA-256                                                            |
| ------------------------------------------------------------------------ | ---------: | ------------------------------------------------------------------ |
| `release-artifacts/melo-0.0.1-2026-09-01/melo-0.0.1-1-production.aab`    | 62,630,678 | `D1995267DB79078367983119CB2DC3B461740A522972CB35671BFBA40BCF03CB` |
| `release-artifacts/melo-0.0.1-2026-09-01/melo-0.0.1-1-arm64-release.apk` | 88,736,412 | `5763D05B50F4BA47B3DBA8F7266C265AF1C2B3F4ADE5777A1E87140C918FAF1D` |
| `release-artifacts/melo-0.0.1-2026-09-01/mapping.txt`                    | 79,875,688 | `D3208BCC4326876EA0D142A877A941C8F79AFDE963E7EA1F7F415406F48E34A7` |
| `release-artifacts/melo-0.0.1-2026-09-01/native-debug-symbols.zip`       | 11,886,725 | `CE5FB103C1A659B87B4223174941321B6F3ED60899C8170D583CF86650C4D8A2` |

These local binary artifacts are intentionally excluded from Git; their hashes are the durable
identity used by the review and store records.

## Package and signature checks

- `bundletool 1.18.3 validate` passed for the AAB.
- `jarsigner -verify` passed for the AAB. The upload certificate expires 27 June 2056.
- `apksigner verify --verbose --print-certs` passed for the APK with APK Signature Scheme v2.
- Signer DN: `CN=Folio`; certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`.
- `aapt2 dump badging` reported package `com.folio.v2.greenfield`, version name `0.0.1`, version
  code `1`, minimum SDK 24 and target SDK 36.
- The manifest contains `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` for explicit native speech
  recognition. It contains no background-audio permission.

## Galaxy S9 install and runtime

The matching APK was installed with `adb install -r` on authorized device
`2af26a2c19017ece` (`Samsung SM-G960F`, Android 10) without uninstalling the app or clearing its
data. Android recorded package update time `2026-09-01 10:40:29` and kept the original install time.
The main activity launched in the foreground and filtered `ReactNativeJS`, `AndroidRuntime` and
`libc` fatal logs were empty.

The native voice entry, per-use off-device speech-provider disclosure and first-use Android
microphone permission were physically verified. Runtime permission was granted only after **Start
voice**; after the session ended, the audio service showed no active Melo recording. See
`T107_NATIVE_VOICE_TO_PROPOSAL_IMPLEMENTATION_2026-09-01.md` and its three S9 screenshots.

## Scope still outside this evidence

This record does not claim public-release approval. Human-spoken transcript review/proposal proof,
TalkBack coverage of the new flow, destructive/key-loss tests, clean-install privacy checks, Play
Console upload/billing proof, production Clerk/Cloud Vault deletion and multi-device recovery,
independent reviews and all iOS build/device evidence remain open. Open Banking is disabled in this
candidate pending TrueLayer credentials, callback approval and the provider/legal rollout gates.
