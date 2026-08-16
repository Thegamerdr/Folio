# Phase E.2 runtime defects

## Fixed during E.2

| Defect | Class | Evidence | Fix |
| --- | --- | --- | --- |
| EAS archive was too large and could be killed before submission | Runtime build blocker | archive inspection: 5.94 GB before ignore rules | `466e39a` added `.easignore`; upload dropped to source-only size and EAS returned build ID |
| Timeline hid material-change cards when no transaction rows existed | Journey blocker | `timeline-material-change.png` showed empty Timeline after material change | `b8bb846` added `shouldShowTimelineEmptyState`; `b8bb846-timeline-material-change-fixed.png` proves native fix |

## Not fixed in E.2, documented

| Issue | Class | Current behaviour | Recommendation |
| --- | --- | --- | --- |
| EAS build remains queued | External/cloud queue | Build ID `642baa36-a055-4094-a0e9-b8e23dc25cab`, latest status `IN_QUEUE` | Poll later or let EAS complete outside Phase E.2 |
| Default local ABI is `arm64-v8a` | Emulator build-route trap | arm64 APK crashes on x86_64 emulator with missing native library | Use EAS for real devices; use `-PreactNativeArchitectures=x86_64` only for emulator proof |
| Debug APK requires Metro | Build-route limitation | Debug artifact installs but cannot standalone launch | Do not use debug APK as Phase E.2 runtime proof |
| Local release Sentry upload lacks local org/project/auth | Local environment gap | Local proof disables Sentry upload | Configure Sentry env in CI/cloud release path |
| Expo public config still prints `android.permissions` with `RECORD_AUDIO` | Config clarity issue | Generated manifest removes it via blocked permissions | Tighten config so public config and generated manifest read the same |
| Multiple URI schemes warning | Non-blocking polish | Runtime warns it uses `melo` and ignores `folio`, `com.melomoney.app` | Choose one preferred Linking scheme before release hardening |
| Native correction edit/save not exercised in emulator fixture | Evidence gap | Correct affordance visible; immutable correction write source-tested | Add a small transaction fixture and run Timeline row -> EditTxnSheet -> Save in Phase F/pre-release validation |
| Material-change writes are not SQL-atomic | Architecture risk | Adjacent store commands write financial state and material-change records | Phase F storage migration should make these one durable transaction |

## Cleared suspicion

Early Recovery card taps looked unresponsive. Retesting from the Today `Open Recovery` CTA on the fixed APK proved:

- one selected move: `b8bb846-recovery-pause-selected.png`
- multiple selected moves: `b8bb846-recovery-two-selected.png`
- commit: `b8bb846-recovery-committed-today.png`
- recovery receipt: `b8bb846-decision-history-after-recovery.png`

So Recovery selection was not a source defect.
