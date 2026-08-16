# Phase E.2 evidence

Status: Android native runtime proof completed with one documented correction-journey limitation.

Starting commit:

```text
1f4f082c0ba002e5a926719937207e9ca846e883
```

Runtime/build commits:

```text
466e39a chore(android): establish managed build validation
b8bb846 fix(mobile): surface material changes in timeline
```

## What changed

- Added `.easignore` so managed EAS uploads exclude `.git`, artifacts, docs, generated native output and scratch folders.
- Fixed Timeline material-change visibility after native evidence showed the material-change journey could look empty.
- Added a focused regression test for Timeline visibility.
- Produced and installed a current-branch Android emulator APK from `b8bb846`.
- Captured Android emulator screenshots, XML where possible, build logs and logcat.

## Tests run

Passed:

```powershell
pnpm test -- timelineVisibility --reporter=dot
```

Result:

- 1 test file passed
- 2 tests passed

Passed:

```powershell
pnpm test -- trustedSafeRange canonicalStateProjection decisionLedger whatChanged criticalJourneys store.test.ts timelineVisibility recoveryPreview persistRecovery androidRecoveryReplayEvidence recoveryMeloCompletion --reporter=dot
```

Result:

- 14 test files passed
- 465 tests passed

Passed:

```powershell
pnpm --filter @folio/mobile typecheck
pnpm --filter @folio/mobile exec expo config --type public --json
pnpm --filter @folio/mobile build
pnpm typecheck
pnpm test -- --reporter=dot
git diff --check
```

Full test result:

- 234 test files passed
- 2702 tests passed

`git diff --check` emitted only CRLF conversion warnings; no whitespace errors were reported.

## Phase E.2 acceptance

| Criterion | Result |
| --- | --- |
| Current-branch Android artifact produced | Passed |
| Artifact traceable to source commit | Passed: `b8bb846` |
| Installs and launches on emulator | Passed |
| No fatal runtime error in tested journeys | Passed |
| Six Trusted Core journeys exercised | Passed with correction caveat |
| Relaunch persistence demonstrated | Passed |
| Dark mode captured | Passed |
| Large text captured | Passed |
| Decision History and Receipt demonstrated | Passed |
| Material-change causality demonstrated | Passed after Timeline fix |
| Recovery bundle behaviour demonstrated | Passed |
| Payday accountability demonstrated | Passed |
| Correction/recalculation demonstrated | Partial native, source-tested |
| Evidence labelled emulator evidence | Passed |
| Runtime-discovered blocker corrected and tested | Passed |
| Full automated tests pass | Passed |
| Typecheck passes | Passed |
| Mobile build passes | Passed |
| No Phase F work started | Passed |

Correction caveat:

- Native runtime demonstrates recalculation/material-change visibility and the Correct affordance.
- Direct native edit/save correction through `EditTxnSheet` was not exercised because the deterministic fixture did not include an ordinary transaction row.
- Immutable correction write remains covered by `apps/mobile/src/folio/sheets/editTxnSave.test.ts` and Phase E correction engine tests.
- Phase F/pre-release validation should add a small transaction fixture and capture Timeline row -> EditTxnSheet -> Save.

## Evidence documents

- `MELO_PHASE_E2_ANDROID_BUILD_PATH.md`
- `MELO_PHASE_E2_BUILD_LOG.md`
- `MELO_PHASE_E2_ARTIFACT_IDENTITY.md`
- `MELO_PHASE_E2_RUNTIME_JOURNEYS.md`
- `MELO_PHASE_E2_ACCESSIBILITY_EVIDENCE.md`
- `MELO_PHASE_E2_RUNTIME_DEFECTS.md`
- `MELO_PHASE_E2_ANDROID_EVIDENCE.md`

## Exact next starting point

Phase F must not start until explicitly approved.

Recommended starting commit for any next phase after this evidence is committed: the final Phase E.2 docs commit, not the APK build commit.
