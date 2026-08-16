# CONSOLIDATION.md — dead/parallel-stack findings not acted on (night audit, 2026-07-06)

Written per this pass's instructions: only category (a)/(b) items (provably dead, zero import
sites from any live entry point) were deleted tonight — see `ARCHIVE.md` for that entry. Everything
below is category (c) — ambiguous, structurally significant, or requiring a deliberate decision
outside a night run's scope — logged here with full import-map evidence instead of touched.

Live entry points used as the reachability root for every claim below: `apps/mobile/app/index.tsx`
(mounts `FolioShell`), `apps/mobile/app/_layout.tsx` (root layout, registers the widget task
handler), `apps/mobile/src/folio/**` (the live spine per `DATA_INTELLIGENCE.md` §0), and
`apps/mobile/src/folio/widget/widgetTaskHandler.tsx` (the headless widget entry, registered at
`_layout.tsx` module scope).

---

## 1. The five "second-stack" packages — CONFIRMED still reference-only, no change from DATA_INTELLIGENCE.md §0

`packages/finance-engine`, `today-engine`, `calendar-engine`, `import-engine`, `storage` are each a
declared `workspace:*` dep in `apps/mobile/package.json` (lines 37, 48, 35, 39, 45) and each has real
consumers — but **only inside `apps/mobile/src/local/*`**, a large canonical-repository adapter
layer (`localLedger.ts` 3061 lines, `localTodayAdapter.ts` 1059 lines, `localCalendarAdapter.ts` 319
lines, `canonicalLedgerStore.ts` + siblings) that the live spine (`src/folio/**`, `app/*`) does
**not** import at runtime.

The only two touch points from a live file into this stack are both **type-only** (erased at
compile, zero runtime footprint):

```
apps/mobile/src/local/nativeDocumentImport.ts:5   import type { LocalDocumentStageInput } from './localLedger';
apps/mobile/src/local/nativeImageIntake.ts:15     import type { LocalDocumentStageInput } from './localLedger';
```

`nativeDocumentImport.ts` and `nativeImageIntake.ts` are themselves live (imported by
`src/folio/screens/IntakeScreen.tsx`), but their only reference to `localLedger.ts` is a type import
— `grep -rn "localLedger"` across `src/folio` and `app/` returns zero hits. `localLedger.ts` itself
has module-top-level **value** imports (`buildForecast` from `@folio/finance-engine`,
`expandBoundedRecurrence` from `@folio/calendar-engine`) that would execute if anything imported a
value from it — nothing does.

Confirmed via direct grep this pass (repeatable):

```
grep -rl "@folio/finance-engine"  apps/mobile/src apps/mobile/app  → local/localLedger.ts only
grep -rl "@folio/today-engine"    apps/mobile/src apps/mobile/app  → local/localTodayAdapter.ts only
grep -rl "@folio/calendar-engine" apps/mobile/src apps/mobile/app  → local/localLedger.ts, local/localCalendarAdapter.ts
grep -rl "@folio/import-engine"   apps/mobile/src apps/mobile/app  → local/localLedger.ts, local/nativeTextExtraction.ts, phase5/importReviewAdapter.ts(+test)
grep -rl "@folio/storage"         apps/mobile/src apps/mobile/app  → 15 files, all under local/* (canonicalLedgerStore, canonicalLedgerRepository, dogfoodMode, nativeLedgerStore, localTimelineAdapter, localTodayAdapter, localCalendarAdapter, localLedger, + their .test.ts siblings) plus two COMMENT-ONLY mentions in folio/store.ts and folio/sheets/MeloChatSheet.tsx (both read "wire @folio/storage later" — not an actual import)
```

**No change recommended tonight.** This matches the decision already recorded in
`DATA_INTELLIGENCE.md` §0 verbatim — "any roadmap work should target the real stack [`src/local`+
canonical `storage`], not `melo-engine`, unless the plan is explicitly to retire the dead stack or
wire it in." Nothing this pass changes that calculus; re-confirmed rather than re-litigated.

---

## 2. `packages/melo-engine` — status updated (was "zero import sites", now partially live)

`DATA_INTELLIGENCE.md` (written 2026-07-05, before phases 6/7 landed per the Status Log) states
melo-engine has "zero import sites anywhere in `apps/mobile/src`." **This is now stale.** Phase 6/7
work wired the notification path through it:

```
apps/mobile/src/folio/lib/notifications.ts:17     import type { PlannedNotification } from '@folio/melo-engine';
apps/mobile/src/folio/lib/notifyScheduler.ts:18   import { planNotification } from '@folio/melo-engine';       ← real value import
apps/mobile/src/folio/lib/notifyScheduler.ts:19   import type { PlannedNotification } from '@folio/melo-engine';
apps/mobile/src/folio/lib/notifyState.ts:42       import type { LadderState, NotifyContext, NotifyInputs, StateView } from '@folio/melo-engine';
apps/mobile/src/folio/copy/sourceVoiceLint.test.ts:17  import { BANNED_PATTERNS } from '@folio/melo-engine';   ← test-only value import
```

Traced the one real production value import (`planNotification`, from `notify.ts`) — its own
imports are type-only (`CopyContext` from `copy.ts`, `StateView` from `states.ts`), so no other
melo-engine module executes at runtime from this path. Net effect: **`notify.ts` is live** (via
`notifyScheduler.ts`, started from `app/index.tsx`'s `startNotificationScheduler()` call); every
other melo-engine module (`moneyMode.ts`, `statement.ts`, `dangerDate.ts`, `spend.ts`, `safeZone.ts`,
`cycles.ts`, `smartMoves.ts`, `wins.ts`, `review.ts`, `chatContext.ts`, `affordImpact.ts`,
`whatChanged.ts`, `nextBestAction.ts`, `calendarRows.ts`, `unsafe.ts`, `states.ts` at the value
level, `copy.ts` at the value level) remains unreached in production, same as before.

**No change recommended.** The package can't be deleted (notify.ts is live) and per ARCHIVE.md's
existing precedent ("the shared engine package stays whole per instructions... its own test suite
still passes untouched") individual dead files inside a partially-live workspace package are not
something a night-audit pass should split apart. Flagging the _staleness of the DATA_INTELLIGENCE.md
claim_ here so the next phase-② or phase-⑥ session doesn't re-read "zero import sites" as still true.

---

## 3. NEW discovery: a second, much larger dead surface tree — `mobileShell.tsx` + legacy `pressureMap/*` screens

Not named in tonight's brief, found while tracing the `storage`/`calendar-engine` consumer chain.
**Bigger than the whole `melo-engine` question** — flagging per the "standing discovery lane"
convention in `DATA_INTELLIGENCE.md` §1, logged rather than pulled on tonight.

### What's live vs dead inside `apps/mobile/src/surfaces/`

Per `ARCHIVE.md`'s existing "Kept / reused" section, `src/surfaces/pressureMap/**` is described as
"imported app-wide" — true only for `kit.tsx` (ThemeProvider/useTheme/useIsDark) and `Sheet.tsx`
(the shared sheet primitive), both confirmed live from `app/_layout.tsx`, `app/index.tsx`, and
`FolioShell.tsx`. The rest of the directory is a much larger legacy pre-port app that appears to
have gone dead when `app/home.tsx` (the route that used to mount it) was deleted in an earlier pass
— but was never itself cleaned up:

```
apps/mobile/src/surfaces/mobileShell.tsx                 8506 lines — ZERO runtime importers.
  Its only inbound references anywhere:
    - src/bootstrap/greenfieldBoundary.ts:4   defines mobileShellBoundary — itself imported by NOBODY
    - src/folio/shell/FolioShell.tsx:31        import type { ProductScreen } — TYPE-ONLY, erased
    - src/surfaces/pressureMap/kit.tsx:60      import type { ProductScreen } — TYPE-ONLY, erased
    - src/surfaces/pressureMap/moreHub.tsx:22  import type { PersistenceStatus } — TYPE-ONLY, and
                                                 moreHub.tsx itself has ZERO importers (dead)
    - src/surfaces/pressureMap/roughFirstAnswer.tsx:12  import { currentLocalIsoDate } — REAL value
                                                 import, but roughFirstAnswer.tsx itself has ZERO
                                                 importers (dead) — so this edge is dead-to-dead
    - 3 test files that read its file contents as a source-grep evidence string
      (coreSliceGapClosure.test.ts, tenOutOfTenExperienceStandard.test.ts,
       uiTrustReviewCopy.test.ts) — same pattern ARCHIVE.md already used for the
      trustControl.tsx/dataControlSurface.tsx cleanup (07-05 "copy-honesty lane" entry)

apps/mobile/src/surfaces/pressureMap/calendarMonth.tsx     305 lines — ZERO importers anywhere
apps/mobile/src/surfaces/pressureMap/moreHub.tsx           273 lines — ZERO importers anywhere
apps/mobile/src/surfaces/pressureMap/plans.tsx             250 lines — ZERO importers anywhere
apps/mobile/src/surfaces/pressureMap/roughFirstAnswer.tsx  348 lines — ZERO importers anywhere

apps/mobile/src/surfaces/brandMark.tsx                  86 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/calendarSurface.tsx            58 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/compactMeloNoteSurface.tsx     63 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/firstMinuteSurface.tsx        305 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/importReviewSurface.tsx       200 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/manualPathSurface.tsx          82 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/meloSurface.tsx                50 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/northstar.tsx                 644 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/plansSurface.tsx               97 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/recoverySurface.tsx             6 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/sampleBriefingSurface.tsx     278 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/timelineSurface.tsx           202 lines  — ZERO importers anywhere
apps/mobile/src/surfaces/todaySurface.tsx              225 lines  — ZERO importers anywhere
```

Total: roughly **11,000+ lines** of unreachable-from-any-live-entry-point React/TS across 17 files,
none named in this pass's brief.

### Why this was NOT deleted tonight

1. **Scope discipline** — tonight's brief named exactly 6 items (melo-engine + 4 sibling packages +
   storage + the two recurring-charge detectors). This tree is a distinct, much larger finding.
2. **Test coupling is nontrivial, not mechanical.** Unlike the `recurringChargeDetection`/`subCaught`
   pair (clean deletion, no test rewiring beyond removing the pair's own test), removing
   `mobileShell.tsx` requires editing 3 test files that assert on its _source text_ as an evidence
   gate (`coreSliceGapClosure.test.ts`, `tenOutOfTenExperienceStandard.test.ts`,
   `uiTrustReviewCopy.test.ts`) — the same shape as the `trustControl.tsx` cleanup in ARCHIVE.md's
   07-05 entry, but at 8506 lines instead of a few hundred, with more assertions to re-home or drop.
   That is exactly the kind of "confirm whether it still ships before deciding" call
   `DATA_INTELLIGENCE.md` §6 already flags for the sibling `pressureMap/sheets/subCaught.tsx` case —
   applies here at a larger scale.
3. **`greenfieldBoundary.ts` is itself dead** (zero importers) — deleting it is free, but it's a
   1-line signal of a larger "boundary/migration marker" pattern that may be intentionally scaffolded
   for a future re-integration; worth a deliberate look, not a drive-by deletion.

### Recommendation for a future consolidation pass

Confirm with a source-grep (same technique as ARCHIVE.md's existing cleanups) whether any of the 3
evidence test files still serve a purpose beyond pinning dead source, then delete the whole
`mobileShell.tsx` + the 4 dead `pressureMap/*` screens + the 12 dead `surfaces/*Surface.tsx` files +
`greenfieldBoundary.ts` in one dedicated pass, rewriting/dropping the 3 affected test files the same
way the 07-05 "copy-honesty lane" entry in `ARCHIVE.md` already did for `trustControl.tsx`. This is
a bigger, well-precedented cleanup, not a research gap — evidence above is sufficient to act on
whenever it's prioritized.

---

## 4. Duplicate-detector pairing — RESOLVED this pass (see ARCHIVE.md)

`apps/mobile/src/local/recurringChargeDetection.ts` (+ test) and its sole consumer
`apps/mobile/src/surfaces/pressureMap/sheets/subCaught.tsx` were confirmed dead (zero import sites
from any live entry point — `subCaught.tsx` had no importers of its own, so even its edge from
`mobileShell.tsx`'s legacy tree was moot) and deleted. See `ARCHIVE.md`'s "07-06 night audit" entry
for full detail and verification numbers. The live detector path
(`subSignals.ts`→`caughtSubs.ts`/`caughtBills.ts`/`caughtIncome.ts`/`caughtAnnual.ts`/`caughtDrift.ts`)
was untouched and re-confirmed live.

---

## Verification (this pass)

- `./node_modules/.bin/tsc -b apps/mobile --pretty false` → zero errors, both before and after the
  deletion (ignoring `src/local` per this pass's standing instruction).
- `./node_modules/.bin/vitest run apps/mobile` → 120 files / 1335 tests green (down from 1344 —
  delta is `recurringChargeDetection.test.ts`'s own 9 tests, removed with its subject).
- `./node_modules/.bin/vitest run packages/melo-engine` → 18 files / 357 tests green, unchanged.
