# 1:1 PORT PROGRAM — Lovable → RN (goal-locked 2026-07-05)

Owner goal: finish the app, 1:1 with the Lovable build. Complete, fully working, ready to go.
UI/UX absolutely equal to Lovable. Remove+archive what's dead. Reuse engines. Sonnet fleets.

## Decisions (owner-answered)
- Target branch: `claude/melo-mvp` (this worktree) — becomes THE app branch.
- Archive: (1) /melo parallel surface, (2) old SVG rigs/forms/wardrobe, (3) legacy /home
  pressure-map route. Delete from branch + ARCHIVE.md manifest; git history preserves.
- Native trio: JS-complete first; native follow-up after owner flips LongPathsEnabled.
- Backend: local-first + live ai-gateway. CHECK Lovable for anything more (account,
  payments, open-banking) → do if needed; report open-banking/account completeness plan.

## Sources of truth
- Design repo (READ-ONLY): `C:\dev\folio-melo\.claude\worktrees\design-main` @ origin/main
  (~30 screens src/components/folio/screens/, 24 sheets .../sheets/, 17 root docs + docs/).
- Port rules: RN_PORT.md + @rn-screen/@rn-sheet headers per file (FROZEN copy, tokens, motion).
- RN app surface: `apps/mobile/src/folio/` (FolioShell) — THE app. Melo engines/phoenix/chat
  from `packages/melo-engine` + `src/melo/*` get REUSED into it, then /melo route archived.

## Phases
1. RECON→FILES (running): agents write PORT_BIBLE.md (docs digest), GAP_MAP.md (screen/sheet
   diff Lovable vs RN src/folio), BACKEND_FINDINGS.md. Agents return 1-line status only.
2. PORT WAVES: sonnet agents batch-port screens/sheets per GAP_MAP (disjoint files, follow
   PORT_BIBLE + @rn-screen headers). Nav/shell wiring last, by orchestrator.
3. ABSORB+ARCHIVE: phoenix/lenses/chat into folio surface per Lovable structure; delete
   /melo route, old rigs, /home; write ARCHIVE.md.
4. QA: typecheck/tests/copy-lint sweep + device walk on phone 2af26a2c19017ece + ship.

## Toolchain (agents)
Worktree: C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp — absolute paths, no pnpm/git.
tsc: ./node_modules/.bin/tsc -b apps/mobile --pretty false | grep <file>. vitest for engine.
Voice: calm/no-shame/no "again"-negative/max one "!". Kit: '@/surfaces/pressureMap/kit'.

## Status log (append)
- 07-05: program started; phase 1 launched.
- 07-05: phase 1 DONE (PORT_BIBLE/GAP_MAP/BACKEND_FINDINGS written; RN base 26/29 screens 11/22 sheets; backend=gateway-only, openbanking=phase-later). Phase 2 launched wf_d3113c89 (batch1 shell alone, then 2-7 parallel).
- 07-05: phase 2 COMPLETE (waves + lens engine + wiring; tsc 0, 357 tests). Phase 3 archive launched.
- 07-05: phase 3 DONE (archive 36 files + ARCHIVE.md; phoenix restored into folio/melo after over-deletion catch). Device QA next.
- 07-05: PROGRAM SHIPPED eb34425 — device-verified (Today money-path + phoenix header, Melo screen w/ sprite phoenix + moods). Remaining honest list in final report: ReviewScreen ignore hookup, trial toast, kit token drift + Inter Tight font, folio-store data fresh-start note, native trio (registry), open-banking = phase-later per BACKEND_FINDINGS.
- 07-05: FINAL WAVE SHIPPED (batched 3-wide after two rate-limit kills): toast system + household/trial confirms, HiddenReview accent split, ReviewScreen inline edit, Timeline verb-states (store v6 + lib/timelineEvents.ts), audit fixes (SafeZone 44px, LensPicker straight quotes, Shelf 80px, TodayAfter 10-mode verdict tables, TodayNudges collapsed-chip + ritual/shelf nudges + verbatim melo copy, TodayRecentTxns week-bar + row edit). Post-wave orchestrator: shortfall nudge wired (tightestSpare band), reviewQueue vertical agent running. Verify: tsc 0, 909 mobile + 357 engine tests. See PARITY_GAPS.md final-wave table.
- 07-05 evening: FINALIZATION SHIPPED — native lanes (clerk/billing/notifications/widget) + final parity wave + persisted reviewQueue + brand pack/app icon, commits cbb4517 + bd029fe, 934 mobile + 357 engine tests, tsc 0. RELEASE APK (68MB, arm64, debug-keystore-signed) built via subst X: workaround + installed on phone 2af26a2c19017ece; widget provider registered; first-run onboarding verified live. Data note: melo blob was FVE1-encrypted; pm clear destroyed the vault key -> unrecoverable; owner restarts fresh via onboarding (import path exercised + latch verified). Remaining owner gates: side-by-side walk vs Lovable, Play Console listing (billing E2E), 2 extra phoenix poses optional.
