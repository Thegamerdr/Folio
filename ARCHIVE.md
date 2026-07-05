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

- **`apps/mobile/src/folio/melo/`** (`Melo.tsx`, `MeloLine.tsx`) — a *separate* directory, part of
  the kept Folio port, unrelated to the deleted `src/melo/`. `src/folio/lib/modes/strategies/*.ts`
  and `src/folio/lib/modes/types.ts` import `MeloMood`/`MeloPose` types from here. Untouched.
- **`apps/mobile/src/surfaces/pressureMap/**`** — the pressure-map kit (including its own
  `melo/` subfolder: `MeloFigure.tsx`, `MeloPresence.tsx`, `meloStates.ts`, `meloCompanion.tsx`,
  `meloPressure.ts`) is imported app-wide (`app/_layout.tsx` pulls `ThemeProvider`/`useTheme`/
  `useIsDark` from `src/surfaces/pressureMap/kit`, and `app/index.tsx` uses the same). Fully
  independent of the deleted `src/melo/**` tree — different directory, different purpose (in-app
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
