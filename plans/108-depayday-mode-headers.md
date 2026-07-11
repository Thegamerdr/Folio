# Plan 108: Mode-aware Today headers and shortfall nudge (de-payday the modes whose own voice bans it)

> **Executor instructions**: Follow step by step; verify each step; STOP conditions binding.
> Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/src/folio/screens/TodayScreen.tsx apps/mobile/src/folio/screens/TodayModeScreen.tsx apps/mobile/src/folio/screens/TodayStabilityScreen.tsx apps/mobile/src/folio/screens/today/TodayNudges.tsx`
> Plans 106/107 also touch these files (TrialEndedRow mount; nudge rounding) — those hunks
> are EXPECTED. Any change to the header strings or the shortfall nudge = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (copy + conditional render; the copy lint gates wording)
- **Depends on**: 106 and 107 must be DONE first (same files — avoid merge conflicts)
- **Category**: bug (voice-contract violation) — also delivers owner decision D2's "reframe"
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

Each money-mode strategy declares a VOICE contract; several explicitly ban payday framing —
irregular.ts: "Speak in runway (weeks covered), not days-to-payday"; growth.ts: "Speak in
months and cadence, not days"; lowVis.ts: "Never state numbers as fact". Yet the shared
Today header renders `{daysToPayday} days to payday →` unconditionally for ALL 10 modes,
and the shared shortfall nudge says "You won't make it to payday as things stand" — with
"make it" phrasing stability.ts's own voice bans. The chrome contradicts the product's core
promise (the mode reshapes the app's voice). This also implements the owner-approved D2
decision: reframe Survival-era chrome, don't rename the mode.

## Current state

- Header sites (byte-identical string in three files):
  - `apps/mobile/src/folio/screens/TodayScreen.tsx:~487` (Survival) — KEEP payday framing.
  - `apps/mobile/src/folio/screens/TodayStabilityScreen.tsx:~162` (Stability) — KEEP.
  - `apps/mobile/src/folio/screens/TodayModeScreen.tsx:~984` (serves the other 8 modes) —
    the fix site: `{daysToPayday} days to payday →` (a Pressable routing to 'ritual').
- Nudge: `apps/mobile/src/folio/screens/today/TodayNudges.tsx:~161` — shortfall copy
  "You won't make it to payday as things stand." rendered on all modes.
- Voice contracts to honor (read each strategy's VOICE block):
  `apps/mobile/src/folio/lib/modes/strategies/{irregular,growth,lowVis,household,optimizer,planning,reset,debt}.ts`.
- Copy lint: `copyLint.test.ts` + `sourceVoiceLint.test.ts` — banned: the word "again",
  shouting caps. Stability's voice additionally bans "run out"/"survive"/"make it"/"tight"
  (not lint-enforced — honor it manually).
- Mode ids: `MoneyMode` union in `apps/mobile/src/folio/lib/modes` — survival, stability,
  growth, debt, irregular, household, planning, optimizer, reset, lowVis.

## Commands

From repo root; pnpm broken — direct binaries:
full suite `node node_modules/vitest/vitest.mjs run`;
typecheck from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`.

## Scope

**In scope**: `apps/mobile/src/folio/screens/TodayModeScreen.tsx`,
`apps/mobile/src/folio/screens/today/TodayNudges.tsx`,
`apps/mobile/src/folio/lib/modes/headerFraming.ts` (create) +
`apps/mobile/src/folio/lib/modes/headerFraming.test.ts` (create).
**Out of scope**: TodayScreen/TodayStabilityScreen headers (payday framing is CORRECT for
Survival/Stability), the strategies themselves, copy.ts's global tagline (unrendered today;
owner surface), PaydayRitualScreen/Calendar (payday-native surfaces).

## Git workflow

Conventional commit: `feat: mode-aware Today header + shortfall framing (D2 reframe)`. No push.

## Steps

1. Create pure `headerFraming.ts`: `headerLineFor(mode: MoneyMode, daysToPayday: number): string`
   returning per-mode framing:
   - debt, reset: keep `${daysToPayday} days to payday →` (payday IS their anchor).
   - growth, optimizer, planning, household: `This month →` (cadence framing, no day count).
   - irregular: `Your runway →` (no payday).
   - lowVis: `Getting a picture →` (no numbers as fact).
   (survival/stability included in the map for totality but unused by TodayModeScreen.)
   Unit-test the map (one assertion per mode; assert NO banned words appear in any output:
   loop the values through a local list ['again','payday'-allowed-only-for(debt,reset,survival,stability)]).
2. TodayModeScreen: replace the literal with `headerLineFor(moneyMode, daysToPayday)`. The
   Pressable still routes to 'ritual' (unchanged — the ritual is payday-anchored, that's
   fine; the LABEL was the violation).
3. TodayNudges shortfall copy: make it mode-aware with the smallest branch —
   survival/debt/reset keep the current line; stability gets
   `The plan does not hold to payday as things stand.` (no "make it"); all other modes get
   `The next stretch does not hold as things stand.` (no payday). The nudge receives the
   mode already or add a `moneyMode` prop threaded from each Today screen — check its
   current props first and take the smallest path.
4. Full suite + typecheck green (voice lint sweeps the new strings).

## Done criteria

- [ ] Typecheck exit 0; full suite green incl. new headerFraming tests.
- [ ] `grep -n "days to payday" apps/mobile/src/folio/screens/TodayModeScreen.tsx` → no literal match (routed through headerLineFor).
- [ ] Shortfall nudge has the three framings.
- [ ] Only in-scope files modified.

## STOP conditions

- TodayNudges' props make mode-threading require touching >3 call sites (report the shape).
- Copy lint fails twice after wording adjustment.
- Excerpt/site mismatch (drift).

## Maintenance notes

- Follow-up (deferred): a lint rule checking shared-chrome strings against each mode's
  voice bans; owner may also want tagline dePaydaying in copy.ts (unrendered today).
- Reviewer: read every new string aloud against the mode's VOICE block.
