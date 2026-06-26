# Folio V2 Recovery Replay + Melo Compression + iOS Readiness Report

Date: 2026-06-23

Scope honored: no Business UI, cloud sync, Open Banking, AI gateway, billing, OCR pipeline, final Melo runtime, visual redesign or new navigation architecture.

## 1. Files Changed

Code:

- `apps/mobile/src/local/localMeloPolicyAdapter.ts`
- `apps/mobile/src/local/localMeloPolicyAdapter.test.ts`
- `apps/mobile/src/local/androidRecoveryReplayEvidence.test.ts`
- `apps/mobile/src/local/iosReadinessEvidence.test.ts`
- `apps/mobile/src/surfaces/compactMeloNoteSurface.tsx`
- `apps/mobile/src/surfaces/firstMinuteSurface.tsx`
- `apps/mobile/src/surfaces/timelineSurface.tsx`
- `apps/mobile/src/surfaces/importReviewSurface.tsx`
- `apps/mobile/src/surfaces/recoverySurface.tsx`
- `apps/mobile/src/surfaces/dataControlSurface.tsx`
- `apps/mobile/src/surfaces/mobileShell.tsx`
- `apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts`

Evidence:

- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/android-recovery-replay/`
- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/android-recovery-replay/ANDROID_RECOVERY_REPLAY_MANIFEST_2026-06-23.md`
- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/ios-readiness/IOS_EVIDENCE_CHECKLIST_2026-06-23.md`
- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/melo-compression/MELO_COMPRESSION_NOTES_2026-06-23.md`
- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/RUNTIME_COMMANDS_2026-06-23.md`
- This report.

## 2. Summary Of What Was Implemented

- Added shared `buildCompactMeloNote()` with policy gating and line compaction.
- Added `CompactMeloNoteSurface`.
- Applied compact Melo notes to First Minute, Today, Timeline, Import Review, Recovery and Data Control.
- Added evidence-only rejected-import Melo copy path in Data Control.
- Reworked Recovery's Melo panel to show preview consequence and user control without implying saved reality.
- Captured Android accepted Recovery replay from live native UI.
- Added iOS readiness checklist and static evidence test.
- Added Android replay evidence test.

No schema, domain model, storage or canonical repository changes were made.

## 3. Recovery Replay Evidence

The Android replay created a quick-estimate route, opened Recovery, previewed a `Repair` spend, accepted it with `Record locally`, then captured downstream surfaces.

Evidence proves:

- Preview before acceptance displayed `preview only`, `Source: hypothetical`, `Scenario preview`, `1 draft`, and `Nothing is saved yet`.
- Acceptance required a visible `Record locally` tap.
- After acceptance, Today showed `4 changes are visible` and no-shame wording: `not a verdict`.
- Timeline showed `Repair recorded from recovery preview`, `Scenario decision recorded`, and `hypothetical - accepted`.
- Plans showed `Protect Rent` with `2 linked local records`.
- Calendar showed `Repair` as a `Money event`.
- Data Control showed `3 records`, `2 audit items`, `recovery recorded`, and accepted `Repair`.

## 4. Screenshot/XML Paths

Root:

- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/android-recovery-replay/screenshots/`
- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/android-recovery-replay/xml/`

Most important captures:

- `08-recovery-preview-before-input`
- `09-recovery-preview-filled-before-acceptance`
- `10-recovery-preview-impact-before-acceptance`
- `12-recovery-record-locally-button-visible`
- `13-today-after-accepted-recovery`
- `14-timeline-after-accepted-recovery`
- `15-plans-after-accepted-recovery`
- `17-calendar-agenda-after-accepted-recovery`
- `19-data-control-after-accepted-recovery`
- `22-data-control-record-rows-after-accepted-recovery`

Full manifest:

- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/android-recovery-replay/ANDROID_RECOVERY_REPLAY_MANIFEST_2026-06-23.md`

## 5. Melo Copy Changes

Implemented pattern:

- `Melo noticed: ...`
- `Why it matters: ...`
- `Your control: ...`

Changed surfaces:

- First Minute
- Today
- Timeline
- Import Review
- Recovery
- Data Control
- Rejected import state through Data Control evidence-only copy

Melo remains interpretive only. No Melo surface was given authority to write records directly.

Notes:

- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/melo-compression/MELO_COMPRESSION_NOTES_2026-06-23.md`

## 6. Policy Tests

Added/updated:

- `localMeloPolicyAdapter.test.ts`: compact note labels, shortening, review/source path, unsafe fallback.
- `androidRecoveryReplayEvidence.test.ts`: native replay evidence and no shame/advice/fake-score wording.
- `iosReadinessEvidence.test.ts`: iOS checklist honesty and static source hooks.
- `mobileSurfaceExtraction.test.ts`: compact Melo labels and updated Recovery copy.

Existing canonical Recovery tests still prove scenario preview non-mutation and accepted recovery decision/audit behavior.

## 7. iOS Checklist

Checklist path:

- `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23/ios-readiness/IOS_EVIDENCE_CHECKLIST_2026-06-23.md`

Result:

- iOS runtime evidence was not collected.
- Windows host cannot run `expo run:ios`; command failed with: `iOS apps can only be built on macOS devices. Use eas build -p ios to build in the cloud.`
- Static readiness exists for Expo iOS config, root `SafeAreaView`, automatic content inset, document picker, local export and reduced motion handling.
- iOS behavior is not proven.

## 8. Tests Added/Updated

Added:

- `apps/mobile/src/local/androidRecoveryReplayEvidence.test.ts`
- `apps/mobile/src/local/iosReadinessEvidence.test.ts`
- `apps/mobile/src/surfaces/compactMeloNoteSurface.tsx`

Updated:

- `apps/mobile/src/local/localMeloPolicyAdapter.test.ts`
- `apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts`
- Surface files listed above.

Focused test result:

- 5 test files passed.
- 27 tests passed.

## 9. CI Result

Final command:

```powershell
pnpm run ci
```

Final result: pass.

Details:

- Lint passed.
- Typecheck passed.
- Prettier passed.
- Vitest passed: 57 files, 510 tests.
- Contract validation passed.

Existing gates still report non-failing release/readiness blockers:

- Operations readiness blocked.
- Store declarations blocked.
- Public release gate blocked.

Those blockers are known product/release readiness gaps, not failures introduced by this pass.

## 10. Remaining Recovery Gaps

- Android emulator replay is proven; physical Android device replay is still not captured.
- The replay uses a quick-estimate route, not a large real ledger.
- Recovery does not yet have a dedicated post-acceptance Recovery success screen; it returns to Today.
- Calendar shows accepted Repair and route impact, but richer recovery follow-up scheduling remains limited to existing calendar output.

## 11. Remaining Melo Gaps

- This is not the final Melo character runtime.
- Calendar still has older one-line Melo copy rather than the full compact note component.
- Sample Briefing still uses its existing example-only Melo note.
- Compact notes are deterministic UI copy; they are not a conversational memory/runtime system.

## 12. Remaining iOS Gaps

- No iOS simulator/device launch evidence.
- No iOS screenshots.
- No iOS VoiceOver traversal.
- No iOS Dynamic Type / large text proof.
- No iOS safe-area/notch/Dynamic Island proof.
- No iOS document picker return proof.
- No iOS export/share-sheet proof.
- No iOS persistence-after-restart proof.
- No iOS reduced-motion runtime proof.

## 13. Canonical Conflicts Found

None found in this pass.

The changes align with the canonical model:

- Melo interprets and explains; it does not become authority.
- Preview remains hypothetical until user acceptance.
- User acceptance creates saved local reality.
- Data remains local/user-owned.
- No shame/advice/fake-score wording was introduced.
- Personal workspace remains the only live mobile workspace.

## 14. Recommended Next Pass

Run the iOS evidence pass on macOS/Xcode or an iOS device:

- Install and launch the current app on iOS.
- Capture the same Recovery replay on iOS.
- Verify safe areas, bottom inset, VoiceOver, Dynamic Type, document picker return, export behavior, restart persistence, clear/export behavior and reduced motion.
