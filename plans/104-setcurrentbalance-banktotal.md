# Plan 104: setCurrentBalance recomputes the bank total instead of overwriting it

> **Executor instructions**: Follow step by step; verify each step; STOP conditions binding.
> Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/src/folio/store.ts apps/mobile/src/folio/store.test.ts`
> Plans 101/103 also touch store.ts (load()'s guards; logDebtPayment) — those hunks are
> EXPECTED. Any change to `setCurrentBalance` itself = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED (widely-called legacy path; single-account behavior must stay byte-identical)
- **Depends on**: none (but do NOT run concurrently with 101/103 — same file)
- **Category**: bug (data-model divergence)
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

`setCurrentBalance` (the legacy write path still used by GuidedCheckInScreen and
OnboardingSheet) writes its raw input as BOTH the app-wide `currentBalance.amount` and the
default account's balance — it never sums other accounts. A user who created a second bank
account via the statement-import picker (live UI today) then does a guided check-in ends up
with `currentBalance.amount` ≠ sum of accounts: Safe Zone/route (which read the per-account
sum via `selectBankBalanceMinor`) and Calendar/Account/Paywall (which read
`currentBalance.amount`) show two different "how much do I have" numbers at once.

## Current state

- `apps/mobile/src/folio/store.ts:1778-1797` (verbatim):
  ```ts
  export function setCurrentBalance(next: Omit<CurrentBalance, 'setAt'>) {
    const setAt = new Date().toISOString();
    // ...long comment: legacy path keeps DEFAULT_ACCOUNT_ID in sync; P3 note...
    const accounts = state.accounts ?? [];
    const nextAccounts = accounts.map((a) =>
      a.id === DEFAULT_ACCOUNT_ID && !a.isLiability
        ? { ...a, balanceMinor: next.amount, balanceAsOfISO: setAt }
        : a,
    );
    setPartial({ currentBalance: { ...next, setAt }, accounts: nextAccounts });
  }
  ```
- The correct pattern (mirror it): `setAccountBalance` (store.ts:1955-1985) — after mapping
  the account update it recomputes
  `bankTotal = nextAccounts.filter(a => !a.isLiability).reduce((s,a) => s + a.balanceMinor, 0)`
  and writes THAT as `currentBalance.amount`.
- SEMANTICS DECISION (made for you): `next.amount` remains the DEFAULT ACCOUNT's new
  balance (unchanged from today); `currentBalance.amount` becomes the recomputed
  `bankTotal`. On a single-account install, bankTotal === next.amount → byte-identical.
- UNIT NOTE: `balanceMinor` carries POUNDS in this codebase despite its name (see
  setAccountBalance summing it straight into `currentBalance.amount`). No conversions.
- Existing test to keep green: store.test.ts ~745-751 "keeps the default bank account in
  sync" (single-account).

## Commands

From repo root; pnpm broken — direct binaries:
tests `node node_modules/vitest/vitest.mjs run apps/mobile/src/folio/store.test.ts`; full
suite `node node_modules/vitest/vitest.mjs run`;
typecheck from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`.

## Scope

**In scope**: `apps/mobile/src/folio/store.ts` (`setCurrentBalance` only),
`apps/mobile/src/folio/store.test.ts`.
**Out of scope**: setAccountBalance, addAccount, callers (GuidedCheckInScreen /
OnboardingSheet / BulkStatementLanding), `selectBankBalanceMinor`.

## Git workflow

Conventional commit: `fix(store): setCurrentBalance recomputes the bank total across accounts`. No push.

## Steps

1. Rewrite the tail of `setCurrentBalance`: after building `nextAccounts`, compute
   `bankTotal` exactly like setAccountBalance does, then
   `setPartial({ currentBalance: { ...next, amount: bankTotal, setAt }, accounts: nextAccounts })`.
   Edge: when `accounts` is empty (pre-P1 shapes), `bankTotal` would be 0 — in that case
   keep `next.amount` verbatim (guard: `accounts.length === 0 ? next.amount : bankTotal`).
   Also handle: default account missing from the list (same guard applies — if no
   non-liability accounts exist at all, fall back to `next.amount`). Update the long
   comment to describe the new invariant in one added sentence.
   Verify: typecheck exit 0.
2. Tests — new describe `setCurrentBalance — multi-account bank total`:
   a. Single account: behavior identical (existing test green + assert amount === input).
   b. Two bank accounts (default 500 + savings 300 via the store's own account mutators):
      `setCurrentBalance({ amount: 1000, ... })` → default account 1000, savings 300,
      `currentBalance.amount === 1300`.
   c. No accounts array: `currentBalance.amount === input` (fallback).
   Verify: full suite green.

## Done criteria

- [ ] Typecheck exit 0; full suite green incl. 3 new tests and the existing single-account test.
- [ ] `setCurrentBalance` contains a `bankTotal` reduce mirroring setAccountBalance.
- [ ] Only in-scope files modified.

## STOP conditions

- setCurrentBalance's body doesn't match the excerpt (drift).
- Any existing test depends on the OLD divergent multi-account behavior (report it — that
  test was pinning the bug).

## Maintenance notes

- The real P3 migration (callers move to setAccountBalance) supersedes this; this makes the
  interim honest. Reviewer: check GuidedCheckIn's UX assumption ("set my balance to X")
  still reads sensibly when X lands on the default account only.
