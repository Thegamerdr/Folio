# Phase E.2 artifact identity

## Final emulator artifact

| Field | Value |
| --- | --- |
| Artifact | `C:\dev\melo-e2-local-android-1f4f082\apps\mobile\android\app\build\outputs\apk\release\app-release.apk` |
| Source commit | `b8bb84697a0634c1bc442a86ae38ed9fed18db96` |
| Source commit role | Phase E.2 runtime fix commit |
| App package | `com.melomoney.app` |
| App version | `1.0.0` |
| Version code | `1` |
| Min SDK | `29` |
| Target SDK | `36` |
| ABI | `x86_64` |
| Size | `143,823,637` bytes |
| SHA-256 | `45811A0847A2695C15B59A7876A986D930306F4783162FEE401B628D162B6E49` |
| Classification | Local standalone release APK for Android emulator evidence |
| Signing | Generated debug keystore in disposable worktree |
| Store-ready? | No; emulator proof only |

The APK is intentionally not committed. Evidence logs and screenshots are committed under:

```text
artifacts/phase-e2-android-emulator-20260721/
```

## Installed package proof

Observed after install:

```text
versionCode=1 minSdk=29 targetSdk=36
versionName=1.0.0
lastUpdateTime=2026-07-21 21:55:43
```

Focused app process:

```text
mCurrentFocus=Window{... com.melomoney.app/com.melomoney.app.MainActivity}
mFocusedApp=ActivityRecord{... com.melomoney.app/.MainActivity ...}
process ABI=x86_64
```

## EAS cloud build identity

| Field | Value |
| --- | --- |
| Build ID | `642baa36-a055-4094-a0e9-b8e23dc25cab` |
| Status at latest poll | `IN_QUEUE` |
| Source commit | `1f4f082c0ba002e5a926719937207e9ca846e883` |
| Fingerprint | `87b31268a2641b15ee29a6cb126c714a8c5ceb24` |
| Build profile | `tester` |
| Distribution | `INTERNAL` |
| Channel | `tester` |

The final emulator proof is from `b8bb846`, not from the queued EAS build.
