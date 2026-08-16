# Phase E.2 Android emulator evidence

Evidence label: Android emulator evidence. This is not physical-device evidence.

## Final tested artifact

- Source commit: `b8bb84697a0634c1bc442a86ae38ed9fed18db96`
- Package: `com.melomoney.app`
- Version: `1.0.0`
- Version code: `1`
- ABI: `x86_64`
- Build classification: local standalone release APK for emulator proof, signed with the generated debug keystore in the disposable prebuild worktree.
- Artifact path outside this repo: `C:\dev\melo-e2-local-android-1f4f082\apps\mobile\android\app\build\outputs\apk\release\app-release.apk`
- SHA-256: `45811A0847A2695C15B59A7876A986D930306F4783162FEE401B628D162B6E49`
- Size: `143,823,637` bytes

## Key files

- `local-release-b8bb846-gradle.log` — final local release build log.
- `b8bb846-startup-logcat.txt` — startup logcat after installing the fixed APK.
- `b8bb846-launch.png` — fixed APK launch into persisted Today state.
- `b8bb846-timeline-material-change-fixed.png` — Timeline material-change card after the runtime fix.
- `b8bb846-recovery-open.png` — Recovery entry from Today CTA.
- `b8bb846-recovery-pause-selected.png` — one selected recovery move.
- `b8bb846-recovery-two-selected.png` — multiple selected recovery moves.
- `b8bb846-recovery-rebuild-button.png` — enabled Rebuild CTA.
- `b8bb846-recovery-committed-today.png` — Recovery commit returned to Today-after state.
- `b8bb846-recovery-persistence-after-relaunch.png` — force-stop/relaunch persistence after Recovery commit.
- `b8bb846-decision-history-after-recovery.png` — recovery receipt in Decision History.

Earlier `startup-logcat.txt`, `startup-x86-logcat.txt`, and `startup-release-logcat.txt` capture the build-route investigation: wrong ABI crash, debug Metro requirement, and first local release launch.
