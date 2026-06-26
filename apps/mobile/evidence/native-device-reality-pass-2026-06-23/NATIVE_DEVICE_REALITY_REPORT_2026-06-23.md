# Folio V2 Native Device Reality Report

Date: 2026-06-23
Workspace: C:\dev\folio-v2-greenfield
Evidence folder: apps/mobile/evidence/native-device-reality-pass-2026-06-23

## Executive Verdict

Folio V2 is now proven to run on an Android native development runtime after fixing one real native bundling blocker.

The personal/local-first loop is product-real enough for an internal Android tester pass: First Minute, sample briefing, manual entry, Today, Timeline, Calendar, Plans, Melo, Recovery, Data Control export, and guarded clear all rendered and were exercised on the emulator.

It is not release-ready. iOS was unavailable on this Windows host, no physical Android device was available, release APK assembly timed out, import accept/reject was not proven through native UI, TalkBack/large-text/reduced-motion were not audited, and repo readiness checks still list operations, store, privacy, security, billing, accessibility, and public-release blockers.

No new product scope was added. No Business UI, cloud sync, Open Banking, AI gateway, final Melo character runtime, or visual redesign was built.

## Runtime And Device

- Android runtime used: Android emulator.
- AVD: CloseLedger_Phone.
- Device reported by adb: emulator-5554, product sdk_gphone64_x86_64, model sdk_gphone64_x86_64, Android 15 class emulator.
- Screen: 1080 x 2400, density 420.
- Metro: running on 127.0.0.1:8081 with adb reverse tcp:8081 tcp:8081.
- Physical Android device: not available in this pass.
- iOS: not available on this Windows host. `expo run:ios` failed because iOS native builds require macOS/Xcode.
- Expo Doctor: 21/21 checks passed.
- Android debug runtime: installed and launched through `expo run:android --variant debug`, although the command timed out after a long Gradle/dev-server run.
- Android release APK: attempted with `native:apk:android`; command timed out and did not produce fresh release evidence.

## Commands Attempted

- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo run:android --variant debug`: installed/launched debug runtime, command exceeded timeout.
- `adb reverse tcp:8081 tcp:8081`: applied for Metro dev runtime.
- `pnpm --filter @folio/mobile native:apk:android`: timed out, no fresh release APK evidence.
- `pnpm --filter @folio/mobile ios` / `expo run:ios`: failed on Windows because iOS build requires macOS.
- `pnpm --filter @folio/storage test`: passed, 6 files / 33 tests.
- `pnpm test -- apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts`: passed, 1 file / 7 tests.
- `pnpm run ci`: passed with exit code 0, including lint, typecheck, tests, and source package validation. Non-gating readiness checks still reported blockers.

## Files Changed

Implementation files:

- packages/storage/src/checksum.ts
- packages/storage/test/migrations-schema.test.ts
- apps/mobile/src/surfaces/mobileShell.tsx
- apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts

Generated build outputs:

- packages/storage/dist/src/checksum.js
- packages/storage/dist/src/checksum.d.ts.map
- packages/storage/dist/test/migrations-schema.test.js
- packages/storage/dist/test/migrations-schema.test.d.ts.map

Evidence/report files:

- apps/mobile/evidence/native-device-reality-pass-2026-06-23/screenshots/00-current-android.png through 60-today-after-clear.png
- apps/mobile/evidence/native-device-reality-pass-2026-06-23/logs/\*.xml and runtime logs
- apps/mobile/evidence/native-device-reality-pass-2026-06-23/NATIVE_DEVICE_REALITY_REPORT_2026-06-23.md

## What Was Implemented

1. Native storage checksum fix.
   - Problem observed: native Metro redbox failed to resolve `node:crypto` from @folio/storage.
   - Fix: replaced Node crypto dependency with a pure TypeScript SHA-256 implementation in packages/storage/src/checksum.ts.
   - Evidence: native app progressed past the redbox after rebuild, screenshots 02 through 08.
   - Tests: packages/storage/test/migrations-schema.test.ts now verifies the known SHA-256 digest for `abc` and CRLF normalization.

2. Timeline duplicate-key fix.
   - Problem observed: Timeline produced duplicate React key warnings after manual route creation.
   - Fix: Timeline rows now use `timelineEventKey(group.id, event, eventIndex)` including group, date, kind, title, amount, and index.
   - Evidence: screenshot 33 and screenshot 47 show Timeline without the duplicate-key LogBox after the fix.
   - Tests: apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts asserts the key helper and usage remain present.

3. Android layout fixes.
   - Problem observed: Timeline day labels wrapped badly, and recovery primary action collided with the bottom nav/safe area.
   - Fix: content bottom padding increased to 184, Timeline day column widened to 58, and day text constrained with `numberOfLines={1}`.
   - Evidence: screenshot 47 shows the Timeline day label fixed; screenshot 48 shows `Record locally` fully reachable above the bottom nav.
   - Tests: mobile surface extraction test now asserts those layout fixes remain in source.

## Schema And Domain Changes

No schema changes were made in this pass.

No new domain objects were added.

No product direction was changed.

## Functional Evidence

### First Launch / Empty State

State: working after checksum fix.

Evidence:

- screenshots/02-empty-first-launch.png
- screenshots/03-empty-first-launch-clean.png
- screenshots/08-empty-first-launch-displayed.png

Findings:

- App launches without cloud, AI, Open Banking, or auth gates.
- First Minute positions the product as local-first and relief-first.
- Early dev-runtime captures showed temporary black/blank states during Metro rebuilds.

### Sample Briefing

State: working.

Evidence:

- screenshots/09-sample-briefing.png
- logs/09-sample-briefing.xml

Findings:

- Sample mode is clearly labelled as example-only and not user data.
- No persistence mutation was observed from sample flow.

### Import Review

State: partial.

Evidence:

- screenshots/10-staged-import-review.png
- screenshots/11-staged-import-review-actions.png
- screenshots/12-import-entry-paste-panel.png
- screenshots/13-import-entry-pasted-text.png
- screenshots/52-import-review-open-for-multiline-attempt.png
- screenshots/53-import-paste-panel-before-multiline-attempt.png
- screenshots/54-import-multiline-adb-input-result.png

Findings:

- Import Review surface renders.
- Review-first copy is present: accept/edit/reject consequences are visible.
- Native multiline text entry through adb was unreliable in this pass. Android shell clipboard support was unavailable and `adb input text` did not successfully stage a multiline statement.
- Accept/reject through native UI was not proven.
- Underlying import adapters and fixture tests pass in CI, but native user acceptance/rejection remains a runtime gap.
- One attempt ended on More controls due coordinate/tap drift; screenshot 54 should be treated as failed attempt evidence, not a successful import test.

### Manual Entry / Quick Estimate

State: working with input rough edge.

Evidence:

- screenshots/20-quick-estimate-manual-path.png
- screenshots/21-quick-estimate-filled.png
- screenshots/22-quick-estimate-save-visible.png
- screenshots/23-first-real-today-briefing.png
- screenshots/25-today-after-restart-displayed.png

Findings:

- Manual facts can create a local route.
- Today after restart showed persistence.
- adb text entry appended into existing/default field text, producing corrupted labels such as `Next obligRentation`. This is partly a test-input artifact, but it exposes a real mobile input-risk area: default text should be selected or cleared more predictably.

### Today

State: working.

Evidence:

- screenshots/23-first-real-today-briefing.png
- screenshots/25-today-after-restart-displayed.png
- screenshots/49-accepted-recovery-today.png
- screenshots/50-accepted-recovery-today-top.png
- screenshots/60-today-after-clear.png

Findings:

- Today reflects manual route state.
- Today reflects accepted recovery spend.
- Today after clear returns to GBP 0 and 0 known records, but retains a generated/opening zero route point. That may be technically harmless, but the provenance wording should be reviewed because it can read like a user-confirmed manual record even after clearing.

### Timeline

State: working after fixes.

Evidence:

- screenshots/33-timeline-after-key-fix.png
- screenshots/47-timeline-after-day-pill-fix.png
- screenshots/51-timeline-after-accepted-recovery.png

Findings:

- Timeline shows canonical route history and upcoming commitments.
- Accepted recovery appears as a fact with provenance and plan impact.
- Duplicate-key warning was fixed.
- Day label wrapping was fixed.
- Timeline remains text-dense and fairly technical because provenance/canonical language is surfaced directly.

### Calendar

State: working.

Evidence:

- screenshots/17-calendar-empty.png
- screenshots/34-calendar-after-key-fix.png

Findings:

- Calendar renders money-aware upcoming dates.
- Lower content/action spacing improved indirectly through bottom padding, but deep Calendar interaction was not exhaustively tested.

### Plans

State: working for visible plan movement, partial for full plan lifecycle.

Evidence:

- screenshots/35-plans-after-key-fix.png
- screenshots/51-timeline-after-accepted-recovery.png

Findings:

- Plans surface reflects user-owned plan movement from current route data.
- Recovery impact appears connected to plan review.
- Full creation/edit/pause/complete plan lifecycle was not exercised in this native pass.

### Recovery

State: working after fixes.

Evidence:

- screenshots/41-recovery-preview-entry.png
- screenshots/43-recovery-preview-filled-no-back.png
- screenshots/48-recovery-action-after-inset-fix-refilled.png
- screenshots/49-accepted-recovery-today.png
- screenshots/51-timeline-after-accepted-recovery.png

Findings:

- Preview state shows consequences before saving.
- Preview did not mutate reality before acceptance.
- `Record locally` became reachable after inset fix.
- Accepted recovery updated Today and Timeline.
- Android Back while a text input was focused navigated away instead of simply dismissing/blurring input during one attempt; this should be retested manually.
- Rejected recovery/back-without-save was partially evidenced by unchanged preview state but not fully proven after the accepted recovery commit.

### Melo

State: working as policy surface, not final character runtime.

Evidence:

- screenshots/36-melo-surface-after-key-fix.png
- screenshots/46-main-shell-reentered-via-melo.png

Findings:

- Melo is presented as interpreter, not authority.
- Copy says changes still need user action.
- No direct plan mutation by Melo was observed.
- No shame/advice/fake-score language was observed in sampled UI.
- Some lower answer content can sit below the fold and requires scroll; readability is acceptable but not fully polished.

### Data Control

State: working.

Evidence:

- screenshots/38-data-control.png
- screenshots/39-data-control-export-prepared.png
- screenshots/55-data-control-after-accepted-recovery.png
- screenshots/56-data-control-export-after-recovery.png
- screenshots/57-data-control-clear-controls.png
- screenshots/58-data-control-clear-armed.png
- screenshots/59-data-control-after-clear.png
- screenshots/60-today-after-clear.png

Findings:

- Data Control distinguishes local, staged, accepted, and rejected records.
- Export prepare works and reports a local export file name/size.
- Accepted recovery updated Data Control counts to 3 visible rows / 3 accepted records.
- Clear is guarded: `Clear records` is disabled until `Arm clear`.
- Clear executed and reset local records.
- After clear, Today shows GBP 0 / 0 known with a generated zero route point.

## Accessibility Reality

Observed through UIAutomator XML and visual inspection:

- Major tabs have accessibility descriptions: Today, Timeline, Calendar, Plans, Melo, Money, More.
- Main buttons are focusable and have content descriptions, for example Prepare export file, Arm clear, Clear records, Record locally.
- Major surfaces expose screen descriptions such as Today screen, Data control screen, Recovery screen.
- Most visible action targets are large enough on the emulator.
- Disabled state is represented for guarded Clear records before arming.

Not proven:

- TalkBack spoken-order walkthrough.
- Large text / dynamic font scaling.
- Reduced motion.
- Color contrast audit.
- VoiceOver on iOS.
- Hardware keyboard or switch-control navigation.

Accessibility concern:

- Some UIAutomator bounds in scrolled states report clipped/offscreen text with inverted or collapsed coordinates. Visually the screens are usable, but this needs real assistive-tech testing before claiming accessibility readiness.

## UX Scoring

Scores are audit-only, not product scores.

| Surface         | Works   | Readable | Touch | Emotional fit | Folio fit | Notes                                                              |
| --------------- | ------- | -------: | ----: | ------------: | --------: | ------------------------------------------------------------------ |
| First Minute    | Yes     |        8 |     8 |             8 |         9 | Strong local-first entry.                                          |
| Sample Briefing | Yes     |        8 |     8 |             8 |         8 | Clear example-only framing.                                        |
| Import Review   | Partial |        6 |     6 |             6 |         7 | Consequence copy works; native accept/reject unproven.             |
| Manual Entry    | Yes     |        7 |     7 |             7 |         8 | Functional; field replacement behavior needs polish.               |
| Today           | Yes     |        8 |     8 |             8 |         9 | Strongest everyday surface.                                        |
| Timeline        | Yes     |        7 |     7 |             7 |         8 | Better after fixes; still technical/text-heavy.                    |
| Calendar        | Yes     |        7 |     7 |             7 |         8 | Money-aware shape is present, deeper interaction not fully tested. |
| Plans           | Partial |        8 |     8 |             8 |         8 | Movement visible; full lifecycle not exercised.                    |
| Recovery        | Yes     |        8 |     7 |             8 |         9 | No-shame preview/accept loop is strong.                            |
| Data Control    | Yes     |        8 |     8 |             8 |         9 | Export and guarded clear are convincing.                           |
| Melo            | Yes     |        8 |     8 |             8 |         9 | Policy-aligned; answer area can require scroll.                    |

## Issues Fixed In This Pass

- Native bundling blocker: removed `node:crypto` from @folio/storage checksum code.
- Timeline duplicate-key warning: added stable event keys that include event index.
- Timeline day label wrapping: widened day pill and constrained label to one line.
- Bottom nav collision: increased content bottom padding so primary lower actions remain reachable.

## Remaining Gaps

- Native iOS install/launch not tested on this host.
- Physical Android device not tested.
- Release APK build timed out.
- Import accepted/rejected flow not proven through native UI.
- Full plan lifecycle not exercised natively.
- Full Calendar interaction not exercised natively.
- Rejected recovery leaves reality unchanged was not fully exercised after accepted recovery.
- TalkBack, large text, reduced motion, contrast, and iOS VoiceOver were not audited.
- Android Back behavior around focused text inputs needs manual retest.
- Text input clearing/replacement needs manual retest because shell input appended into default text.
- Dev runtime first fresh paint can be slow and black/blank during Metro rebuilds.
- App lock was unavailable on the emulator; native secure-key/app-lock proof remains blocked.
- Some copy is still too technical for final user comfort, especially provenance/canonical wording.

## Canonical Model Conflicts Or Risks Found

No hard contradiction to the canonical model was introduced by this pass.

Aligned observations:

- Local-first loop works without cloud, AI, Open Banking, or auth.
- Melo is interpretation-layer copy, not authority.
- Recovery preview does not mutate reality before user acceptance.
- Accepted recovery creates visible reality changes in Today/Timeline/Data Control.
- Data export and clear are user-controlled.
- No fake confidence percentages or product score UI was observed.
- No shame language was observed.

Risks/tensions:

- Import Review can sound more certain than the empty staged state deserves. The surface should avoid implying enough data was found when no rows are staged.
- After clear, Today still has a zero opening route point with provenance-like wording. That may be an implementation convenience, but it risks confusing "cleared local records" with "a user-confirmed opening balance still exists."
- Timeline and Data Control expose implementation/provenance language directly. It is truthful, but not always calm or user-native.

## CI Result

Focused checks:

- `pnpm --filter @folio/storage test`: pass, 6 files / 33 tests.
- `pnpm test -- apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts`: pass, 1 file / 7 tests.
- `pnpm --filter @folio/mobile doctor`: pass, 21/21 checks.

Full CI:

- `pnpm run ci`: pass, exit code 0.
- Vitest: 54 files / 496 tests passed.
- Typecheck: passed.
- Formatting: passed.
- Contract validation: passed.

Non-gating readiness output inside CI:

- Operations readiness: BLOCKED.
- Store declarations: BLOCKED.
- Public release gate: BLOCKED.

Key reported blockers include iOS native smoke evidence, secure key/app-lock proof, native documents/OCR proof, vault-backed real-data/offline drills, independent security review, DPIA/legal/privacy signoff, independent accessibility audit, account deletion routes, store declarations, and native billing proof.

## Readiness Assessment

Internal Android dev tester readiness: close, with import UI caveat.

Public release readiness: no.

Native release hardening readiness: no.

The strongest proven loop is: local manual facts -> Today -> Timeline/Calendar/Plans -> Recovery preview -> accepted recovery -> Today/Timeline/Data Control -> export/clear.

The weakest proven loop is import review through native text/file input. Underlying tests are green, but the runtime UI path still needs a clean real-device/manual-input pass.
