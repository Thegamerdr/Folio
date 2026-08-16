# Plan 006: Use workspace-local calendar dates at every financial “today” boundary

> **Executor instructions**: Execute after plan 005. Classify date conversions; do not blindly replace
> every `toISOString()` because some UTC conversions implement deliberate date-only arithmetic. Run
> every verification gate and update `advisor-plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- packages/domain/src/index.ts packages/domain/test/core-domain.test.ts apps/mobile/src/folio/store.ts apps/mobile/src/folio/lib apps/mobile/src/folio/screens apps/mobile/src/folio/sheets packages/finance-engine/src/index.ts packages/finance-engine/test`
> Plans 002–005 are expected to touch `store.ts` and intake files. Stop if workspace timezone is no
> longer available from `PersistedWorkspace.timeZone`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `advisor-plans/005-preserve-legitimate-repeated-transactions.md`
- **Category**: correctness
- **Planned at**: commit `f7b91c7`, 2026-08-16

## Why this matters

`new Date().toISOString().slice(0, 10)` returns the UTC day, not the user's financial calendar day.
Between 00:00 and 00:59 during British Summer Time, Melo can default renewals, invoices, payments,
dividends, filings and history cycles to yesterday. Both Personal and Business workspaces already
declare `Europe/London`; current-day decisions must use that workspace timezone while date-only
arithmetic remains timezone-immune.

## Current state

- `apps/mobile/src/folio/lib/workspaceRoot.ts:44-68` creates both workspaces with timezone
  `Europe/London`.
- `packages/domain/src/index.ts:1413-1425` validates branded timezone IDs but has no shared
  instant-to-local-date helper.
- `apps/mobile/src/folio/store.ts:1924-1927`, `:2102-2106`, and `:5641-5647` derive “today” by UTC
  slicing; additional current-day defaults occur in invoice/payment/dividend methods near lines
  8713, 8809 and 8933.
- `apps/mobile/src/folio/screens/business/BusinessFilingScreens.tsx:176` initializes submission date
  with the UTC day.
- `apps/mobile/src/folio/lib/storeRoute.ts:48-73` already explains the BST bug and locally implements
  an `isoDayLocal` workaround. That behavior is the test/convention exemplar, not a second helper to
  preserve.
- Some UTC slices intentionally convert date-only arithmetic or a UTC-normalized intermediate. Those
  must be retained or replaced with `addDaysToLocalDate`, not host-local conversion.

## Commands you will need

| Purpose            | Command                                                                                                                       | Expected on success |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Domain dates       | `pnpm exec vitest run packages/domain/test/core-domain.test.ts apps/mobile/src/folio/lib/localDate.test.ts --passWithNoTests` | exit 0              |
| Mobile/store dates | `pnpm exec vitest run apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/storeRoute.test.ts --passWithNoTests`     | exit 0              |
| Finance engine     | `pnpm exec vitest run packages/finance-engine/test --passWithNoTests`                                                         | exit 0              |
| Typecheck          | `pnpm typecheck`                                                                                                              | exit 0              |
| Full tests         | `pnpm test`                                                                                                                   | exit 0              |

## Scope

**In scope**:

- `packages/domain/src/index.ts`
- `packages/domain/test/core-domain.test.ts`
- Create `apps/mobile/src/folio/lib/localDate.test.ts` only if mobile adapter tests are needed
- `apps/mobile/src/folio/store.ts`
- `apps/mobile/src/folio/lib/storeRoute.ts`
- `apps/mobile/src/folio/lib/storeRoute.test.ts`
- `apps/mobile/src/folio/lib/calendarEvents.ts`
- `apps/mobile/src/folio/lib/canonicalAppStateReadProjection.ts`
- `apps/mobile/src/folio/lib/income.ts`
- `apps/mobile/src/folio/lib/melo/checkIn.ts`
- `apps/mobile/src/folio/screens/AddEntryScreen.tsx`
- `apps/mobile/src/folio/screens/InsightsScreen.tsx`
- `apps/mobile/src/folio/screens/PaydayRitualScreen.tsx`
- `apps/mobile/src/folio/screens/ReviewScreen.tsx`
- `apps/mobile/src/folio/screens/TodayScreen.tsx`
- `apps/mobile/src/folio/screens/business/BusinessFilingScreens.tsx`
- `apps/mobile/src/folio/screens/business/BusinessLtdScreens.tsx`
- `apps/mobile/src/folio/screens/business/BusinessMoneyScreens.tsx`
- `apps/mobile/src/folio/sheets/AddPlanSheet.tsx`
- `apps/mobile/src/folio/sheets/BillCaughtSheet.tsx`
- `apps/mobile/src/folio/sheets/SubCaughtSheet.tsx`
- `packages/finance-engine/src/index.ts`
- Relevant existing tests adjacent to the changed functions.

**Out of scope**:

- Changing stored instants or converting timestamps to local time.
- Replacing deliberate UTC date-only arithmetic with host-local arithmetic.
- Supporting user-selectable timezones; use the existing workspace timezone.
- A calendar-engine rewrite or recurrence redesign.
- Splitting `store.ts`.

## Git workflow

- Branch: `advisor/006-workspace-local-dates`.
- Commit example: `fix(dates): use workspace local financial day`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add one domain helper for instant-to-local-date

In `packages/domain/src/index.ts`, add a pure exported helper that accepts a `Date`/instant and a
validated `TimeZoneId`, uses `Intl.DateTimeFormat(...).formatToParts`, and returns a branded
`LocalDate`. Do not construct the result from locale-formatted free text. Reject invalid dates.

Test at minimum:

- `2026-08-16T23:30:00Z` -> `2026-08-17` in `Europe/London` (BST);
- `2026-08-16T00:30:00Z` -> `2026-08-16` in London;
- winter GMT boundary;
- leap day;
- a timezone west of UTC to prove the helper is not London-hardcoded;
- invalid instant/timezone failure.

**Verify**:
`pnpm exec vitest run packages/domain/test/core-domain.test.ts --passWithNoTests`
→ exit 0.

### Step 2: Replace duplicated “today” helpers with workspace-local conversion

Use the domain helper wherever a runtime instant becomes the current financial date. In store-level
functions, resolve the active/data workspace timezone from state and fall back only to the canonical
Personal timezone when state is not yet hydrated. Preserve injected `today`/`now` parameters for pure
tests.

Replace the duplicated `isoDayLocal` implementation in `storeRoute.ts` with the shared helper while
keeping its route/calendar alignment tests.

Do not modify conversions that start from an already-normalized `YYYY-MM-DD` solely to add days; use
existing `addDaysToLocalDate` for those when clarification is worthwhile.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/storeRoute.test.ts --passWithNoTests`
→ exit 0.

### Step 3: Correct user-entry defaults and financial grouping

Update the in-scope screens/sheets and helpers where UTC slices mean:

- default issued/paid/declared/submitted/closed date;
- “today” for renewal, review, check-in or history-cycle logic;
- transaction grouping by the workspace calendar day;
- a current reporting cutoff.

Thread the workspace timezone where the component already has workspace state. Otherwise use the
canonical London timezone explicitly and leave a short comment explaining why. Avoid reading global
store state inside pure engine functions; pass `asOf`/timezone from the adapter.

Add focused tests with injected instants on both sides of the BST midnight boundary for at least:

- subscription auto-resume/reanchor;
- history-cycle synchronization;
- Business invoice/payment/dividend or filing default;
- transaction day grouping.

**Verify**: run the adjacent changed test files with `pnpm exec vitest run ... --passWithNoTests` → exit 0.

### Step 4: Remove unsafe defaulting from the finance engine

`packages/finance-engine/src/index.ts:430` defaults `asOf` from the UTC day. Prefer requiring `asOf`
from the adapter. If API compatibility demands a default, add a timezone parameter and use the shared
helper. Do not make a pure financial engine depend on host timezone implicitly.

Add a regression test showing the same injected instant produces the London date regardless of the
test process timezone.

**Verify**: `pnpm exec vitest run packages/finance-engine/test --passWithNoTests` → exit 0.

### Step 5: Audit remaining UTC slices by semantics

Run:

`rg -n "toISOString\(\)\.slice\(0, 10\)" apps/mobile/src/folio packages/finance-engine`

For each remaining production match, classify it in the code comment or PR notes as either:

- deliberate UTC conversion of a date-only arithmetic intermediate; or
- a bug still requiring the workspace-local helper.

There must be no remaining `new Date().toISOString().slice(0, 10)` used as financial “today”. Do not
change test fixture helpers that intentionally construct UTC dates.

**Verify**: the search returns no unclassified current-day use.

### Step 6: Run full correctness gates

Run domain/mobile/finance focused tests, full tests and typecheck. Do not mass-format unrelated files.

**Verify**: `pnpm test` and `pnpm typecheck` → exit 0.

## Test plan

- Domain helper boundary tests across BST, GMT, leap day and a non-UK timezone.
- Store tests with injected instants around midnight.
- Business form/default tests for issued, paid, declared and submitted dates.
- Grouping test proving a transaction lands on the workspace-local day.
- Existing date-only arithmetic tests must remain unchanged to catch accidental host-time coupling.

## Done criteria

- [x] One domain helper converts instants to workspace-local `LocalDate`.
- [x] No shipping financial “today” uses a UTC ISO slice.
- [x] BST/GMT midnight regression tests pass.
- [x] Pure date-only arithmetic remains timezone-immune.
- [x] Finance engine no longer silently defaults from UTC day.
- [x] Focused tests, full tests and typecheck pass.

## Execution evidence

- Completed on branch `codex/melo-one-app-convergence-2026-08-15` after plan 005.
- `localDateFromInstant` now performs one explicit IANA-timezone conversion in the domain package,
  rejects invalid instants and revalidates branded timezone input at runtime. Workspace adapters use
  the data-owning workspace timezone with the canonical Personal timezone only as pre-hydration
  fallback.
- Store hydration, subscription resume/reanchor, history-cycle synchronization, Business financial
  defaults, entry sheets, reporting cutoffs, transaction grouping, route/widget/trusted calculations
  and canonical projection now share the workspace financial day.
- BST, GMT, leap-day and west-of-UTC domain boundaries are covered. Store regressions cover
  after-midnight subscription behavior, the August-to-September history boundary and Business
  invoice/payment/dividend defaults. Historical transaction grouping is covered at BST midnight.
- `evaluateOverdueObligation` now requires an explicit `asOf`; the finance engine no longer reads the
  clock or host timezone for that decision.
- Remaining production UTC slices are classified date-only arithmetic intermediates: normalized
  calendar stepping, signal cadence math, money-path indexing, Business quarter/year boundaries and
  Business stage date generation. None converts a runtime instant into financial “today”.
- Focused verification passed 13 files and 443 tests. `pnpm test` passed 237 Vitest files / 2,755
  tests and the 45-test companion suite; `pnpm typecheck` and `git diff --check` passed.

## STOP conditions

- The platform runtime lacks required `Intl.DateTimeFormat` timezone support.
- A call site cannot distinguish an instant from a date-only value.
- The proposed change alters stored instant semantics or existing transaction timestamps.
- Fixing a call site requires user-selectable timezone/product work.
- The executor is tempted to replace all UTC slices mechanically.

## Maintenance notes

All engines should accept explicit `asOf` values; adapters own clock/timezone conversion. Reviewers
should ask whether a `Date -> YYYY-MM-DD` conversion means UTC date arithmetic or a user's calendar
day—those are different operations and must remain visibly different in code.
