# Folio V2 Recovery + Melo Completion Pass

Date: 2026-06-23

## Summary

Completed the scoped Recovery + Melo pass without adding broad product scope. Calendar now uses the compact policy-gated Melo note pattern. Recovery now shows a dedicated post-acceptance confirmation state after a successful local write, with what changed, what remains protected, decision/audit evidence, and next review context.

## Files Changed

- `apps/mobile/app/index.tsx`
- `apps/mobile/src/surfaces/mobileShell.tsx`
- `apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts`
- `apps/mobile/src/surfaces/recoveryMeloCompletionSurface.test.ts`
- `apps/mobile/src/local/recoveryMeloCompletion.test.ts`
- `apps/mobile/src/local/androidRecoveryMeloCompletionEvidence.test.ts`
- `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23/android/screenshots/*.png`
- `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23/android/xml/*.xml`

## Behaviour Added

- Calendar compact Melo note:
  - evidence-aware
  - policy-gated through `buildCompactMeloNote`
  - no advice, shame, fake certainty, or score language
  - shows tightest route point, why it matters, and user control
- Recovery accepted confirmation:
  - appears only after `onRecordRecoverySpend` returns success
  - shows `Recovery saved`
  - shows `Your reviewed update is now part of the plan.`
  - shows what changed
  - shows what remains protected
  - shows where to inspect decision/audit evidence
  - shows next review date context
  - does not auto-return to Today
  - resets the main scroll view to the confirmation headline after acceptance
- Android evidence:
  - preview-only Recovery before acceptance
  - filled Recovery preview before acceptance
  - record action visible
  - accepted Recovery confirmation
  - Today after accepted Recovery
  - Calendar with compact Melo
  - Timeline decision/audit after accepted Recovery

## Evidence Used By Tests

- `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23/android/xml/23-recovery-preview-patched.xml`
- `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23/android/xml/26-recovery-filled-patched.xml`
- `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23/android/xml/29-recovery-record-button-patched.xml`
- `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23/android/xml/30-recovery-accepted-confirmation-patched.xml`
- `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23/android/xml/31-today-after-recovery-patched.xml`
- `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23/android/xml/34-calendar-compact-melo-note-patched.xml`
- `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23/android/xml/35-timeline-decision-audit-patched.xml`

## Tests Added Or Updated

- Added `apps/mobile/src/local/androidRecoveryMeloCompletionEvidence.test.ts`
- Added `apps/mobile/src/local/recoveryMeloCompletion.test.ts`
- Added `apps/mobile/src/surfaces/recoveryMeloCompletionSurface.test.ts`
- Updated `apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts`

Focused suite:

- `pnpm vitest run apps/mobile/src/surfaces/recoveryMeloCompletionSurface.test.ts apps/mobile/src/local/recoveryMeloCompletion.test.ts apps/mobile/src/local/androidRecoveryMeloCompletionEvidence.test.ts apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts apps/mobile/src/local/localMeloPolicyAdapter.test.ts --passWithNoTests`
- Result: 5 files passed, 22 tests passed.

Full CI:

- `pnpm run ci`
- Result: passed.
- Tests: 60 files passed, 520 tests passed.
- Also passed lint gates, typecheck, formatting, and contract validation.

## Remaining Gaps

- iOS Simulator was not installed because this host is Windows. Apple iOS Simulator is bundled with Xcode and is macOS-only.
- Android evidence was captured from a clean local baseline. The deterministic tests cover plan-linked accepted recovery, canonical decision/audit creation, Today, Timeline, Calendar, and Melo policy.
- Business UI, cloud sync, Open Banking, AI gateway, final Melo character runtime, billing, OCR pipeline, and visual redesign remain intentionally out of scope.

## Canonical Conflicts Found

None in this scoped pass.
