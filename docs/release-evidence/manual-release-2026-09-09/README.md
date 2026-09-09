# Melo manual release evidence — 9 September 2026

## Git baseline (G0)

Authoritative native worktree: `C:\dev\melo-native-today-batch1-2026-08-24`.
Git common repository: `C:\dev\folio-v2-greenfield\.git`.
Original branch: `codex/melo-native-true-parity-2026-08-25`.
Pre-change HEAD: `0ff5d9c3a0af64f7b44f0be4b5e9711d8dfd94a5`.
Remote: `origin`, `https://github.com/Thegamerdr/Folio.git`.
After fetch, original branch tracked its remote at zero ahead / zero behind.
The previously reported `4693c9ae7dd54a7e03ae1f420ad38decb69f53c4` exists locally
and in remote branch history; 186 later commits supersede it, through 5 September.

Safety reference: `safety/melo-pre-manual-release-2026-09-09`, at the pre-change HEAD.
Implementation branch: `codex/melo-manual-release-2026-09-09`.
No reset, stash drop, branch deletion, or history rewrite was performed.
Pre-existing documentation/evidence changes remain in place. See the captured status,
branches, worktrees and graph beside this file. Old dirty worktrees were preserved.
The older native-ux worktree has 224 dirty entries and is not today's source authority.
One existing stash, `4323c879` (capture-resume-tooling-duplicate), was preserved.
No unpushed commits were found on the authoritative original branch; separate historical
local refs and dirty worktrees remain recorded, not silently discarded or merged.

G0: PASS.

## Focused baseline (G1)

User requested bounded verification rather than running thousands of tests. Before
implementation, these six existing Vitest files produced **119 pass, 6 fail (125 total)**:

- `apps/mobile/src/folio/shell/registryCoverage.test.ts`
- `apps/mobile/src/folio/sheets/onboardingComplete.test.ts`
- `apps/mobile/src/folio/lib/modes/safeZone.test.ts`
- `apps/mobile/src/folio/lib/debt.test.ts`
- `apps/mobile/src/local/localMeloTurn.test.ts`
- `apps/mobile/src/folio/lib/persistRecovery.test.ts`

Three registry failures pre-exist: the test/document expect 54 screens while the shipped
union has 56, including Debts and Search. Three persistence failures pre-exist in expected
native save call arguments. These require inspection before calling them stale tests.
Review confirmed both contracts were stale; the corrected registry and persistence files
pass in the final selected suite. Production persistence was not changed to satisfy old arguments.
All four other files passed. Runtime parity is not proven by these assertions.

Mobile TypeScript no-emit baseline: PASS (`--composite false --incremental false`),
with output captured in `baseline-typecheck.txt`. An initial invocation was rejected by
TypeScript because composite mode requires incremental compilation; the corrected
invocation above is the baseline result.

The full pre-change screen/sheet union is preserved in `shell-types-before.txt`.
G1: PASS for the bounded baseline and inventory; this is not a full-suite claim.

## Device/build baseline

Android emulator `emulator-5554` is attached; no physical phone was attached at baseline.
Existing application packages and owner profile are preserved. The existing signed
5 September candidate and its public-release limitations are documented in
`../MELO_ANDROID_REVIEW_CANDIDATE_2026-09-05.md`.

See `RELEASE_REPORT.md` for final gates and subsystems, `ARTIFACT.json` for the signed APK,
`BEHAVIOR_COVERAGE.md` for exact scenario assertions, and `PERFORMANCE_REVIEW.md` for the
bounded Timeline and import assessment. Earlier intermediate failure logs are retained
to distinguish resolved review findings from final results.
