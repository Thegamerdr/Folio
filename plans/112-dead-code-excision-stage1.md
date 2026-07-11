# Plan 112: Dead-code excision, stage 1 — the unambiguous ~39k lines

> **Executor instructions**: Follow step by step; verify each step; STOP conditions binding.
> Do NOT update `plans/README.md`. THIS PLAN DELETES FILES — delete ONLY what is enumerated;
> if a deletion breaks something not predicted here, STOP.
>
> **Drift check (run first)**: confirm `apps/mobile/app/` contains exactly `index.tsx` and
> `_layout.tsx`, and that `grep -rn "pressureMap/index" apps/mobile/src/folio apps/mobile/app`
> returns nothing. Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (large deletion; fully gated by typecheck + full suite)
- **Depends on**: ALL other night-mode plans merged first (109 touches FolioShell; this plan
  edits its imports) — run LAST.
- **Category**: tech-debt
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

A verified import-graph audit (BFS from the real entry points `app/index.tsx`,
`app/_layout.tsx`, and the widget task handler; type-only edges excluded) found 96 dead
source files (43,518 lines) + 52 dead test files (9,320 lines) still swept by tsconfig and
vitest. Every typecheck compiles them; ~25% of the app's test cases exercise code no user
can reach; and future sessions keep "fixing" the wrong implementations (a superseded
statement reader, two dead UI generations). Stage 1 removes only the sets whose deadness is
corroborated by the repo's own docs (ARCHIVE.md, CONSOLIDATION.md, PORT_PROGRAM.md).

**HELD BACK (do NOT delete, owner decision pending)**: the `src/local/` canonical-ledger
cluster (`localLedger.ts`, `canonicalLedger*.ts`, `local*Adapter.ts`, `nativeLedgerStore.ts`,
`nativeSqliteDriver.ts`, `nativeLedgerSnapshotBlob.ts`, `dogfoodMode.ts`,
`productExperience*.ts`, `nativeDataExport.ts`, `nativeDogfoodDiagnosticExport.ts`,
`nativeFileViewer.ts`, `nativeLocalSecurity.ts`, `local/calendarEvents.ts`,
`local/calendarIcs.ts`, `localLedgerVault.ts` + their tests) — comments in live code
reference a "BUILD_PLAN §3" plan to wire this layer later; the doc doesn't exist, but the
intent signal stands until the owner rules. EXCEPTION: the three superseded statement files
listed in Step 4 ARE deleted (their replacement is live and wired).

## Current state — the load-bearing dependencies you must preserve

LIVE files inside otherwise-dead trees (verified; deleting any of these breaks the app):
- `src/surfaces/pressureMap/`: `kit.tsx`, `kitTheme.tsx`, `Sheet.tsx`, `MoneyPath.tsx`,
  `secondaryKit.tsx`, `useCountUp.ts`, `money.ts`, `routeMath.ts`,
  `melo/MeloFigure.tsx`, `melo/MeloPresence.tsx`, `melo/index.ts`, `melo/meloStates.ts`
  (all reached via the `src/folio/theme.ts` barrel + FolioShell/app imports).
- `src/local/` live nine: `deviceId.ts`, `meloAiClient.ts`, `pdfChunkSplitter.ts`,
  `statementReaderClient.ts`, `statementReaderParse.ts`, `statementReaderDedup.ts`,
  `nativeDocumentImport.ts`, `nativeImageIntake.ts`, `nativeTextExtraction.ts` (+ their tests).

Type-only edges that must be re-homed BEFORE deleting their source (all erased at runtime,
but typecheck breaks without them):
- `ProductScreen` from `src/surfaces/mobileShell.tsx` → consumed type-only by
  `src/surfaces/pressureMap/kit.tsx:59` and `src/folio/shell/FolioShell.tsx:41`.
- `todayTypes.ts` types re-exported by the LIVE `MoneyPath.tsx` — `todayTypes.ts` therefore
  stays (treat as live; it is in the Gen-2 list below ONLY if MoneyPath does not import it —
  VERIFY: `grep -n "todayTypes" apps/mobile/src/surfaces/pressureMap/MoneyPath.tsx`; if it
  imports, keep the file and remove it from the delete list).
- (`LocalDocumentStageInput`/`LocalRoutePoint`/`LocalRouteSummary` from `localLedger.ts` are
  consumed type-only by live files — NOT a problem for stage 1 since localLedger is held back.)

## Commands

From repo root; pnpm broken — direct binaries:
full suite `node node_modules/vitest/vitest.mjs run`;
typecheck from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`.
Baseline first: run both BEFORE deleting and record the passing test count.

## Scope

**In scope (deletions, enumerated)**: Steps 2–6 lists only. **In scope (edits)**:
`src/folio/shell/FolioShell.tsx` + `src/surfaces/pressureMap/kit.tsx` (ProductScreen import
swap), a new `src/surfaces/pressureMap/productScreen.ts` (type home),
`apps/mobile/app/index.tsx` (one stale comment), `tooling/scripts/render-mobile-shell-evidence.ts`
(delete — dead script with value imports into held-back code; deleting it removes the
false-positive consumer).
**Out of scope**: everything in the HELD BACK list; tsconfig/vitest configs (no glob
changes — deletion alone shrinks the sweep); `package.json` (op-sqlite removal waits for
the held-back decision); `CONSOLIDATION.md`/`ARCHIVE.md` (annotate later, not here).

## Git workflow

Conventional commit: `chore: excise dead legacy code, stage 1 (~39k lines)`. No push.

## Steps

1. **Baseline**: full suite + typecheck green; record test count.
2. **Re-home `ProductScreen`**: create `src/surfaces/pressureMap/productScreen.ts` exporting
   the `ProductScreen` type (copy its definition from `mobileShell.tsx` — find
   `export type ProductScreen`); update the two type-import sites (kit.tsx, FolioShell.tsx)
   to import from the new file. Verify: typecheck exit 0.
3. **Delete Gen-1 surfaces** (14 files): `src/surfaces/mobileShell.tsx`, `northstar.tsx`,
   `brandMark.tsx`, `calendarSurface.tsx`, `compactMeloNoteSurface.tsx`,
   `firstMinuteSurface.tsx`, `importReviewSurface.tsx`, `meloSurface.tsx`,
   `plansSurface.tsx`, `recoverySurface.tsx`, `sampleBriefingSurface.tsx`,
   `timelineSurface.tsx`, `todaySurface.tsx`, `manualPathSurface.tsx` — plus dead
   surface-level tests: `coreSliceGapClosure.test.ts`, `tenOutOfTenExperienceStandard.test.ts`,
   `uiTrustReviewCopy.test.ts` (source-scans four deleted files — verify its readFileSync
   targets are all in the delete set before deleting the test). KEEP `darkModeFoundation.test.ts`
   (scans LIVE kit files). Verify: typecheck + full suite green.
4. **Delete Gen-2 pressureMap** (the dead barrel + its cluster): `pressureMap/index.ts`,
   `calendar.tsx`, `pots.tsx`, `subscriptions.tsx`, `reviewDecision.tsx`,
   `sheets/onboarding.tsx`, `sheets/meloChat.tsx`, `sheets/calendarAddEvent.tsx`,
   `sheets/calendarExport.tsx`, `sheets/calendarConnect.tsx`, `todayPath.tsx`,
   `insights.tsx`, `whatIf.tsx`, `foundItems.tsx`, `fileWorkbench.tsx`, `paydayRitual.tsx`,
   `moreHub.tsx`, `plans.tsx`, `startScreen.tsx`, `roughFirstAnswer.tsx`, `timeline.tsx`,
   `calendarMonth.tsx`, `shortfall.tsx`, `todayAfter.tsx`, `todayNudges.tsx`,
   `todayRecentTxns.tsx`, `todaySpendStrip.tsx`, `todayWeekTiles.tsx`, `meloCompanion.tsx`,
   `meloPressure.ts`, `paydayRitualLogic.ts`, `timelinePresentation.ts` — (`todayTypes.ts`
   per the verification in Current state) — plus dead tests:
   `pressureMap/lovableImplementation.test.ts`, `pressureMap/ownerFileIntake.test.ts`,
   `pressureMap/paydayRitual.test.ts`, `pressureMap/timelinePresentation.test.ts`,
   `pressureMap/meloMoodMonotonic.test.ts`. ALSO delete the superseded statement trio in
   local/: `statementExtraction.ts`, `statementIntake.ts`, `statementIntakeRouting.ts` +
   `statementExtraction.test.ts`, `statementIntake.test.ts` (+ `statementIntakeRouting.test.ts`
   if present). Verify: typecheck + full suite green.
5. **Delete phase dirs + strays**: `src/phase4` … `src/phase14` (11 dirs, whole), `src/spikes/`,
   `src/bootstrap/`, `src/folio/lib/modes/strategies/_base.ts`,
   `tooling/scripts/render-mobile-shell-evidence.ts`. Before deleting phase dirs:
   `grep -rn "phase[0-9]" package.json apps/mobile/package.json .github 2>nul` → no hits
   (STOP if any). Verify: typecheck + full suite green.
6. **Stale comment**: in `apps/mobile/app/index.tsx`, fix the header comment claiming the
   legacy app lives at `app/home.tsx` (deleted 07-05) — one line stating the legacy surfaces
   were excised.
7. **Final gates**: full suite green (expect roughly 350–410 fewer test cases than baseline —
   record exact numbers in NOTES); typecheck exit 0;
   `git status` shows only enumerated deletions + the small edits.

## Done criteria

- [ ] Typecheck exit 0; full suite green.
- [ ] Every file in Steps 3–5 lists is gone; nothing in the HELD BACK or LIVE lists was touched.
- [ ] `ProductScreen` resolves from its new home (grep both consumers).
- [ ] Test-count delta recorded in NOTES.

## STOP conditions

- Any deletion produces a typecheck error pointing at a LIVE file not predicted here
  (report the exact import chain — the map may have missed an edge).
- `todayTypes.ts` verification is ambiguous.
- The full suite loses MORE tests than the dead-test inventory predicts (±10%).

## Maintenance notes

- Stage 2 (owner-gated): the held-back `local/` canonical layer + op-sqlite dependency +
  `CONSOLIDATION.md` correction. The owner question, verbatim: "Is the local/ canonical
  ledger layer (i) dead weight to delete, or (ii) a deliberately staged future migration
  target? BUILD_PLAN.md referenced in code doesn't exist."
