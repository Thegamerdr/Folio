# Phase E.1 evidence

## Automated verification

Passed:

`pnpm vitest run apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/criticalJourneys.test.ts --reporter=dot`

Result:

- 2 test files passed
- 285 tests passed

Passed:

`pnpm --filter @folio/mobile typecheck`

Passed:

`pnpm test -- --reporter=dot`

Result:

- 233 test files passed
- 2700 tests passed

Passed:

`pnpm typecheck`

Passed:

`pnpm --filter @folio/mobile build`

## Tests added or extended

- Material transaction write creates one causal material change.
- Non-moving writer no-op creates none.
- Explicit backup restore creates a review-required material change that survives relaunch without duplicate cold-load restore events.
- Recovery bundle can apply a spend-hold move without creating a second per-move receipt.

## Files added

- `apps/mobile/src/folio/screens/FirstAnswerScreen.tsx`
- `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`

## Files materially changed

- `apps/mobile/src/folio/store.ts`
- `apps/mobile/src/folio/store.test.ts`
- `apps/mobile/src/folio/lib/restoreNative.ts`
- `apps/mobile/src/folio/screens/StartScreen.tsx`
- `apps/mobile/src/folio/screens/TodayScreen.tsx`
- `apps/mobile/src/folio/screens/MoreScreen.tsx`
- `apps/mobile/src/folio/shell/FolioShell.tsx`
- `apps/mobile/src/folio/types.ts`
- `apps/mobile/src/folio/screens/WhatIfScreen.tsx`
- `apps/mobile/src/folio/screens/RecoveryScreen.tsx`
- `apps/mobile/src/folio/screens/PaydayRitualScreen.tsx`
- `apps/mobile/src/folio/screens/DecisionHistoryScreen.tsx`
- `apps/mobile/src/folio/screens/TimelineScreen.tsx`

## Runtime evidence

Android artifact and emulator evidence are tracked in:

- `MELO_PHASE_E1_ANDROID_BUILD.md`
- `MELO_PHASE_E1_ANDROID_EVIDENCE.md`

Current status: blocked in this environment. Local Android SDK/JDK tools are absent, and the authenticated EAS tester build command timed out before creating a build.
