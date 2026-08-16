# Plan 107: Truth micro-fixes — Reset caption math, unrounded money in nudges, paywall guard formula, safeZone input clamp

> **Executor instructions**: Follow step by step; verify each step; STOP conditions binding.
> Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/src/folio/screens/today/TodayNudges.tsx apps/mobile/src/folio/screens/TodayModeScreen.tsx apps/mobile/src/folio/screens/PaywallScreen.tsx apps/mobile/src/folio/lib/modes/safeZone.ts`
> On changes, compare excerpts; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED (4 small independent fixes; the safeZone clamp is the only one that
  shifts numbers users see)
- **Depends on**: none (do NOT run concurrently with plans 106/108 — shared files)
- **Category**: bug (honesty/display correctness)
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

Four small, independently-verified places where a displayed number lies or garbles:
(A) Reset mode's "N days of essentials" and its own "~£X/day" caption come from two
different formulas, so days × £/day matches nothing real. (B) A nudge interpolates an
UNROUNDED float into visible copy and into the Melo AI chat prefill (`£45.230000000000004`).
(C) The paywall's never-sell-in-a-bad-moment guard feeds on a home-rolled "safe zone" number
(balance − pots, no bills/buffer) more generous than the canonical `safeZoneMath` — it can
allow selling exactly when the user's real safe zone is ≤ 0. (D) `safeZoneMath` clamps its
INPUT balance to ≥0, so an overdrawn account computes shield math against a fictional £0 —
the widget then shows "£0 safe" with no crisis context.

DELIBERATE NON-FIX (do not "improve"): the Today hero displays floor at £0 by design (calm
doctrine — the verdict copy carries the crisis, the giant number never shows a minus).

## Current state

- (A) `apps/mobile/src/folio/lib/modes/strategies/reset.ts:28` —
  `essentialsPerDay = Math.max(5, (onboarding.monthlyIncome * 0.4) / 30)` produces the day
  count; `apps/mobile/src/folio/screens/TodayModeScreen.tsx:614-617` recomputes a DIFFERENT
  caption denominator: `dailyEssentials = Math.max(15, c.monthlyOut / 30)`.
- (B) `apps/mobile/src/folio/screens/today/TodayNudges.tsx:~219-227` —
  `const gapToFind = tightPointGoal - tightestSpare;` interpolated raw into the label
  (`Melo sees £${gapToFind} ...`) and the chat prefill (`Help me find £${gapToFind} ...`).
  Sibling nudges in the same array use `.toFixed(...)`.
- (C) `apps/mobile/src/folio/screens/PaywallScreen.tsx:~238-241` —
  `safeZoneTotal = currentBalance.amount - pots.reduce(...)` (memo) feeding
  `canShowUpsell`/`upsellSuppressionReason` guardInputs.
- (D) `apps/mobile/src/folio/lib/modes/safeZone.ts:~94` — `safeZoneMath` floors the input:
  `Math.max(0, inputs.currentBalance?.amount ?? 0)`; output total also floored (~116).
  `SafeZoneSheet.tsx` already styles `zone.total <= 0` distinctly; the widget snapshot
  (`lib/widgetSnapshot.ts:~83-92`) consumes the same math.
- Existing tests: `apps/mobile/src/folio/lib/modes/safeZone.test.ts` pins current behavior —
  UPDATE deliberately where the clamp changes, per Step 4.

## Commands

From repo root; pnpm broken — direct binaries:
tests `node node_modules/vitest/vitest.mjs run` (all pass);
typecheck from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json` (exit 0);
format `node_modules\.bin\prettier.cmd --write <files>`.

## Scope

**In scope**: the four files in the drift check + `apps/mobile/src/folio/lib/modes/safeZone.test.ts`

- `apps/mobile/src/folio/lib/modes/strategies/reset.ts` (only if exposing essentialsPerDay
  requires it) + `apps/mobile/src/folio/lib/widgetSnapshot.ts` (only if its types/tests need
  the negative-total case) + `apps/mobile/src/folio/lib/widgetSnapshot.test.ts` (same).
  **Out of scope**: the Today hero £0 floors in survival.ts/stability.ts/debt.ts/TodayScreen
  (deliberate design — see above); `lensPaywall.ts` (guard logic itself unchanged — only its
  input changes); any other screen.

## Git workflow

Conventional commit: `fix: four honesty micro-fixes (reset caption, nudge rounding, guard formula, safeZone input)`. No push.

## Steps

### Step 1 (B): Round the nudge figure

`TodayNudges.tsx`: `const gapToFind = Math.round(tightPointGoal - tightestSpare);`
**Verify**: typecheck exit 0.

### Step 2 (A): One denominator for Reset's caption

Read `reset.ts` and `TodayModeScreen.tsx`'s Reset hero. Make the caption use THE SAME
per-day figure the day count divides by. Smallest true fix: compute
`essentialsPerDay` in the hero from the same inputs the strategy uses
(`Math.max(5, (onboarding.monthlyIncome * 0.4) / 30)`) is DUPLICATION — instead check
whether the strategy already exposes it (e.g. on its returned state/formula fields); if
not, export a tiny pure `resetEssentialsPerDay(monthlyIncome: number)` from `reset.ts` and
call it from both places.
**Verify**: `node node_modules/vitest/vitest.mjs run apps/mobile/src/folio/lib/modes` → pass.

### Step 3 (C): Canonical guard input on the paywall

Replace PaywallScreen's inline `safeZoneTotal` memo with the canonical math. The screen
already builds mode inputs for `deriveModeState` — reuse those fields to call `safeZoneMath`
(import from `@/folio/lib/modes/safeZone`; read its signature first) and pass `.total` into
guardInputs. Keep the variable name.
**Verify**: typecheck exit 0; full suite passes (ctaMode/lensPaywall tests must stay green).

### Step 4 (D): Unclamp safeZoneMath's INPUT balance

In `safeZone.ts`, remove the `Math.max(0, ...)` on the input balance so shield math runs on
the true (possibly negative) figure. DECISION MADE FOR YOU: keep the OUTPUT `total` clamp
REMOVED as well ONLY for the value consumed by SafeZoneSheet/widget IF AND ONLY IF both
consumers already render a ≤0 state safely — verify: SafeZoneSheet branches on
`zone.total <= 0` (read it), and the widget snapshot must not crash on a negative
(read `widgetSnapshot.ts` + `SafeZoneWidget.tsx`'s formatting). If the widget formats
negatives badly (e.g. `£-40`), fix its formatting to `-£40` in `widgetSnapshot.ts`/widget
render. Update `safeZone.test.ts` expectations for the overdrawn case deliberately (add a
new test: balance −40, one shielded bill 20 → total −60) and note the change in NOTES.
If ANY consumer turns out to assume non-negative in a way you cannot fix inside scope —
STOP and report which.
**Verify**: full suite → all pass (with the deliberately-updated safeZone tests).

## Test plan

- New: overdrawn-input test in `safeZone.test.ts` (Step 4).
- New: `resetEssentialsPerDay` unit test if the helper is created (same file as reset's
  existing tests if any; else inline in `safeZone.test.ts`'s sibling pattern under
  `lib/modes/`).
- All existing tests green except the deliberately-updated clamp expectations.

## Done criteria

- [ ] Typecheck exit 0; full suite green.
- [ ] `grep -n "Math.round(tightPointGoal" apps/mobile/src/folio/screens/today/TodayNudges.tsx` → match.
- [ ] PaywallScreen no longer computes balance−pots inline (grep `pots.reduce` in that file → no match in the guard-input path).
- [ ] safeZone.ts no longer clamps the input balance.
- [ ] Only in-scope files modified.

## STOP conditions

- Any excerpt mismatch (drift).
- Step 4's consumer check finds an unfixable non-negative assumption (report which file:line).
- Verification fails twice.

## Maintenance notes

- The four-accountings unification (route vs safeZoneMath vs stability vs paywall) is a
  bigger owner-gated decision — this plan only makes the GUARD use the canonical number.
- Reviewer: scrutinize Step 4's widget formatting for negative totals on the sample screenshot path.
