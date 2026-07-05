# Archive — parallel Melo surface removal (1:1 port cleanup)

Owner decision: the faithful Folio port (`apps/mobile/src/folio/**`, mounted at route `/`) is
THE app. The parallel `/melo` dogfooding surface, the old SVG mascot rigs, and the legacy
pressure-map `/home` route are dead weight and were deleted outright. Nothing here was moved —
plain deletion. Full content is recoverable via git history on branch `claude/melo-mvp`
(pre-deletion HEAD: `06ce40df26d33094365c3cf3027d5d2f906e29e5`).

## Deleted

### Routes

- `apps/mobile/app/melo.tsx` — the parallel `/melo` route (MELO_PHASE2_PLAN.md §3 dogfooding
  surface). Confirmed unreferenced by any other route, nav call, or config (`_layout.tsx` uses
  file-based `<Stack>` with no explicit screen list; no `router.push('/melo')` anywhere else).
- `apps/mobile/app/home.tsx` — the legacy pressure-map route (`/home`). Confirmed unreferenced
  elsewhere; it did NOT import from `src/melo/**` (it used `src/local` + `src/surfaces/pressureMap`
  directly), so its removal has zero blast radius on the pressure-map kit.

### `apps/mobile/src/melo/**` (entire tree — only reachable via the deleted `/melo` route)

- `components/` — BrandPreviews.tsx, MoneyModeSelector.tsx, NextBestActionCard.tsx,
  RunwayStrip.tsx, StateViews.tsx, WeatherSky.tsx, WhatChangedCard.tsx
- `mascot/` — MeloMascot.tsx, MeloPhoenix.tsx, fenice.tsx, wardrobe.tsx, `assets/` (5 PNG phoenix
  sprites), `forms/` (cat.tsx, fox.tsx, gecko.tsx, ghost.tsx, index.ts) — the old SVG mascot rigs
- `screens/` — BillsShield.tsx, GrowthDebt.tsx, MeloChat.tsx, MeloGlance.tsx, MeloImport.tsx,
  MeloOnboarding.tsx, MeloReview.tsx, MeloRitual.tsx, MeloSettings.tsx, MoneyCalendar.tsx,
  Premium.tsx, RecoveryWalkthrough.tsx, Transactions.tsx
- `shell/` — AppShell.tsx, BottomNavigation.tsx
- `state/` — demoStates.ts, derive.ts, meloStore.tsx, presets.ts
- `theme/` — weather.ts

Verified via grep gate: no file outside `src/melo/**` imported any path under `src/melo/`
(checked `@/melo/*`, relative `../melo/*`, and bare `src/melo` substrings across `app/` and `src/`).
The only inbound reference was `app/melo.tsx` itself, which is deleted alongside it. Internally,
`MeloMascot.tsx` was the sole consumer of `MeloPhoenix.tsx` — both are gone together, so no
repoint was needed.

## Kept / reused (not touched)

- **`apps/mobile/src/folio/melo/`** (`Melo.tsx`, `MeloLine.tsx`) — a _separate_ directory, part of
  the kept Folio port, unrelated to the deleted `src/melo/`. `src/folio/lib/modes/strategies/*.ts`
  and `src/folio/lib/modes/types.ts` import `MeloMood`/`MeloPose` types from here. Untouched.
- **`apps/mobile/src/surfaces/pressureMap/**`** — the pressure-map kit (including its own
`melo/`subfolder:`MeloFigure.tsx`, `MeloPresence.tsx`, `meloStates.ts`, `meloCompanion.tsx`,
`meloPressure.ts`) is imported app-wide (`app/\_layout.tsx`pulls`ThemeProvider`/`useTheme`/
`useIsDark`from`src/surfaces/pressureMap/kit`, and `app/index.tsx`uses the same). Fully
independent of the deleted`src/melo/\*\*` tree — different directory, different purpose (in-app
  companion figure inside the ported Folio UI, not the standalone dogfood surface).
- **`packages/melo-engine`** — the shared engine package stays whole per instructions. It is a
  separate workspace package; its only consumers in `apps/mobile` were files under the now-deleted
  `src/melo/**`. The package itself was not touched, and its own test suite (`packages/melo-engine`,
  357 tests) still passes untouched.
- **`packages/melo-policy`** — untouched, unrelated to this cleanup.
- **`src/local/meloAiClient.ts`** and its consumers (`statementExtraction.ts`,
  `statementReaderClient.ts`) — unrelated "Melo AI" statement-reading client, not part of the
  deleted dogfood surface. Untouched.

## Verification

- `./node_modules/.bin/tsc -b apps/mobile --pretty false` → zero errors outside `src/local`
  (pre-existing, out of scope).
- `./node_modules/.bin/vitest run packages/melo-engine` → 18 files, 357 tests, all green
  (engine package untouched, as expected).

Recovery: `git log --all --diff-filter=D -- apps/mobile/app/melo.tsx apps/mobile/app/home.tsx
apps/mobile/src/melo` on `claude/melo-mvp` will show this deletion commit; `git checkout
<pre-delete-sha> -- apps/mobile/src/melo` restores the tree if ever needed.

## Correction (post-archive) — the phoenix sprites were restored INTO `src/folio/melo/`

The verification section above was wrong on one point: it treated `apps/mobile/src/folio/melo/`
(`Melo.tsx`, `MeloLine.tsx`) as an untouched, unrelated directory because at the time it still
rendered the OLD vector/SVG folded-document Melo. That vector rig was never the owner's locked
brand mark — the PNG-sprite phoenix (`phoenix-hero`/`phoenix-protect`/`phoenix-celebrate`/
`phoenix-think`/`phoenix-concern`, deleted above alongside the rest of `src/melo/mascot/`) is.
Deleting the sprite tree while leaving `src/folio/melo/Melo.tsx` on the vector renderer meant the
app's actual Melo (imported everywhere via `src/folio/melo/Melo.tsx`) silently regressed to the
wrong character.

Fixed by recovering the 5 sprites from the pre-deletion commit (`git show
06ce40df26d33094365c3cf3027d5d2f906e29e5:apps/mobile/src/melo/mascot/assets/<name>.png`) into
`apps/mobile/src/folio/melo/assets/`, then rewriting `Melo.tsx`'s rendering internals only —
adapted from the same commit's RN `MeloPhoenix.tsx` (halo → embers → cross-fading sprite body →
ground pool), with the mood table (`calm/curious/cheer/concern/celebrate`) mapped onto the 5 pose
sprites exactly as the web source of truth
(`folio-melo/.claude/worktrees/design-main/src/components/folio/MeloPhoenix.tsx`'s `MOOD` map)
does. `MeloMood`, `MeloPose`, `MeloProps`, and the `Melo`/`MeloLine` export names and prop
signatures are unchanged, so every existing call site (`src/folio/lib/modes/strategies/*.ts`,
`src/folio/lib/modes/types.ts`, and every `src/folio/screens/*.tsx` that imports `Melo`) needed
zero changes. `MeloLine.tsx` was inspected and only re-exports through `Melo`/`MeloMood` — no
direct vector coupling, so it was left as-is.

Verified: `grep -rn "phoenix-hero" apps/mobile/src/folio` hits inside the new `Melo.tsx`;
`./node_modules/.bin/tsc -b apps/mobile --pretty false` → zero errors outside `src/local`
(pre-existing, out of scope); `Melo.tsx` reformatted with `./node_modules/.bin/prettier --write`.

## 07-05 addendum: archived evidence tests

12 test files pinning the deleted legacy /home route + pre-port app shape (dogfoodMode, iosReadinessEvidence, routeSurfaceTruth, 9 surfaces/\* UX-evidence suites) removed with the surface they tested; recoverable from git history. Stale apps/mobile/dist build output dropped.
Also: androidRecoveryMeloCompletionEvidence.test.ts + releaseBlockerFoundation.test.ts (evidence suites statically reading the archived test files).

## Deleted (copy-honesty lane) — dead legacy Data & privacy surfaces

Two dead, unimported legacy "Data & privacy" screens deleted outright (plain deletion, no move;
recoverable via git history):

- `apps/mobile/src/surfaces/pressureMap/trustControl.tsx` — the pressure-map kit's own
  `DataControlScreen` (Editorial Ledger layout). Not imported by any live route — the app's actual
  Data & privacy surface is `mobileShell.tsx`'s local `DataControlScreen` function (line ~4072,
  exported at line ~8473), a separate implementation. `trustControl.tsx` was only reachable through
  `surfaces/pressureMap/index.ts`'s re-export, which itself had no importer.
- `apps/mobile/src/surfaces/dataControlSurface.tsx` — `DataControlOwnershipSurface`, an older
  ownership-tile-grid take on the same screen. Confirmed unimported anywhere (`grep -rn
"DataControlOwnershipSurface|dataControlSurface"` outside test files hit nothing).

Fixed up the test files that read these two dead files' source as text (source-grep style guards,
common in this codebase) so the suite stays green without the dead files:

- `surfaces/pressureMap/index.ts` — dropped the `export { DataControlScreen } from './trustControl'`
  re-export line.
- `surfaces/uiTrustReviewCopy.test.ts` — dropped `dataControlSurface.tsx` from `surfaceFiles`; also
  dropped one now-orphaned assertion (`toContain('Added to your money')`) whose only source was the
  deleted file's `OwnershipTile` label — nowhere else in the live surface tree.
- `surfaces/pressureMap/lovableImplementation.test.ts` — dropped `trustControl.tsx` from
  `SURFACE_FILES`; removed the `trust`-specific assertions in the `'the words people read are the
accepted ones'` test (they existed solely to pin `trustControl.tsx`'s privacy-hero copy).
- `surfaces/pressureMap/darkModeFoundation.test.ts` — removed the whole `'dark-mode foundation —
Appearance control'` describe block; the System/Light/Dark selector it tested lived only in the
  dead `trustControl.tsx` (confirmed no live equivalent — `mobileShell.tsx` has no `Appearance` /
  `useThemeMode` usage at all).
- `surfaces/pressureMap/melo/melo.test.ts` — dropped the `data: read('../trustControl.tsx')` entry
  from `coreScreens` (used only by the "Melo appears across the core slice" check).
- `surfaces/pressureMap/kit.tsx` — a stale comment referencing `trustControl` (illustrative only,
  not a test dependency) reworded to not point at a deleted file.
- `local/productExperienceEvidence.ts` — inspected; NOT changed. Its two `"DataControlScreen"` /
  `dataControlTrustCopy` references are a plain descriptive string label and an import from
  `productExperienceLoop.js` respectively — neither imports from either deleted file, so this was a
  false positive in the original task brief.

Verification: `./node_modules/.bin/tsc -b apps/mobile --pretty false` → zero errors.
`./node_modules/.bin/vitest run apps/mobile` → 92/93 files green, 946/947 tests green. The one
failure is `folio/copy/sourceVoiceLint.test.ts` (new file, see below) correctly catching a real
pre-existing "try again" violation in `sheets/SignInSheet.tsx`, a file outside this lane's scope.

## Added — `folio/copy/sourceVoiceLint.test.ts`

New source-level voice-lint test covering the 5 shipped-today user-facing files (`ui/Toast.tsx`,
`sheets/SignInSheet.tsx`, `widget/SafeZoneWidget.tsx`, `screens/today/TodayNudges.tsx`,
`screens/PrivacyScreen.tsx`): reads each file's raw source, strips comments, extracts string
literals, and asserts none trip `BANNED_PATTERNS` reused from `@folio/melo-engine` (no re-derived
list, so this gate can't drift from the engine's canonical banned-voice rules). Currently reports
one real finding — `SignInSheet.tsx` has four "try again" instances that hit the engine's absolute
`again-negative` pattern (`/\bagain\b/i`, banned unconditionally per the engine's own comment). Left
failing rather than silently weakened, since fixing that file's copy is outside this lane
(`screens/PrivacyScreen.tsx`, the dead surfaces, this file, and `ARCHIVE.md` only).
