# Plan 103: Keep a card-linked Debt and its Account in sync when a payment is logged

> **Executor instructions**: Follow step by step; verify each step. STOP conditions are
> binding. Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/src/folio/store.ts apps/mobile/src/folio/store.test.ts`
> On changes, compare "Current state" excerpts to live code; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but do NOT run concurrently with plans 101/104 — same file)
- **Category**: bug (data-model divergence)
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

A credit-card `Account` is mirrored by a linked `Debt` row (id `debt-for-<accountId>`); the
`Debt.linkedAccountId` doc says balance changes "should" route through the account — but
`logDebtPayment`/`undoDebtPayment` (reachable from LogPaymentSheet, which lists ALL debts)
edit the Debt row alone. Result: the Debt-lens payoff figure and the account/net-worth
figure disagree immediately after logging a payment, and the next statement import
(`syncCardDebt`) silently erases the payment from the Debt row. Root-cause fix: the shared
mutators sync the linked account too — one guard where all callers route through.

## Current state

- `apps/mobile/src/folio/store.ts:2361-2381` (verbatim today):
  ```ts
  export function logDebtPayment(id: string, amount: number) {
    if (!(amount > 0)) return;
    setPartial({
      debts: (state.debts ?? []).map((d) =>
        d.id === id ? { ...d, balance: Math.max(0, d.balance - amount) } : d,
      ),
    });
  }
  export function undoDebtPayment(id: string, amount: number) {
    if (!(amount > 0)) return;
    setPartial({
      debts: (state.debts ?? []).map((d) =>
        d.id === id ? { ...d, balance: d.balance + amount } : d,
      ),
    });
  }
  ```
- `store.ts:1834-1845` `syncCardDebt(accountId, balanceMinor)` — account→debt direction:
  sets the linked Debt's `balance` to `Math.max(0, balanceMinor)`.
- UNIT TRAP: despite the name, `Account.balanceMinor` carries the SAME unit as
  `Debt.balance` and `currentBalance.amount` (£ floats) — see `setCurrentBalance`
  (store.ts:1778-1797) mirroring `next.amount` (pounds) straight into `balanceMinor`, and
  `syncCardDebt` assigning `balanceMinor` into `Debt.balance` with no conversion. Do NOT
  multiply/divide by 100 anywhere in this plan.
- The correct atomic exemplar: `payCreditCardFromBank` (store.ts:~2406) updates
  `Account.balanceMinor` and the linked `Debt.balance` in ONE `setPartial`.

## Commands

From repo root; pnpm broken — direct binaries:
tests `node node_modules/vitest/vitest.mjs run` (all pass);
typecheck from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json` (exit 0);
format `node_modules\.bin\prettier.cmd --write <files>`.

## Scope

**In scope**: `apps/mobile/src/folio/store.ts` (the two functions above only),
`apps/mobile/src/folio/store.test.ts` (new tests).
**Out of scope**: `LogPaymentSheet.tsx` (no UI change), `syncCardDebt`,
`payCreditCardFromBank`, `totalDebtMinor`, any other store function.

## Git workflow

Conventional commit on your worktree branch:
`fix(store): logDebtPayment syncs a card-linked debt's account balance`. No push.

## Steps

### Step 1: Sync the linked account in both mutators

In `logDebtPayment`, after computing the debts map, when the target debt has a
`linkedAccountId`, ALSO update that account in the same `setPartial`:

```ts
export function logDebtPayment(id: string, amount: number) {
  if (!(amount > 0)) return;
  const target = (state.debts ?? []).find((d) => d.id === id);
  if (target === undefined) return;
  const nextDebts = (state.debts ?? []).map((d) =>
    d.id === id ? { ...d, balance: Math.max(0, d.balance - amount) } : d,
  );
  // A card-linked Debt mirrors an Account (see Debt.linkedAccountId's doc) — a payment
  // must land on BOTH in one write, or the next syncCardDebt erases it.
  const linkedId = target.linkedAccountId;
  if (linkedId !== undefined) {
    const accounts = (state.accounts ?? []).map((a) =>
      a.id === linkedId
        ? { ...a, balanceMinor: Math.max(0, a.balanceMinor - amount), balanceAsOfISO: new Date().toISOString() }
        : a,
    );
    setPartial({ debts: nextDebts, accounts });
    return;
  }
  setPartial({ debts: nextDebts });
}
```

Mirror the same shape in `undoDebtPayment` (adding `amount` back to both; no
`Math.max(0, ...)` on the undo add-back for the debt — preserve current behavior — but DO
clamp the account at… no: undo adds, no clamp needed on either).

NOTE: read the `Account` type first to confirm the exact field names
(`balanceMinor`, `balanceAsOfISO`) — they appear in `setAccountBalance` (store.ts:1955-1985).

**Verify**: typecheck exit 0.

### Step 2: Tests

In `store.test.ts`, new describe `logDebtPayment — card-linked debt/account sync`:
1. Arrange: create a credit-card account + linked debt (use the existing helpers/mutators
   the current card tests use — search `store.test.ts` for `addCardPayoffDetails` or
   `syncCardDebt` usage as the arrange pattern; if none exists, build state via
   `setPartial` with an account `{ id: 'acc-1', kind: 'credit-card', isLiability: true,
   balanceMinor: 200, ... }` matching the Account type, plus a debt with
   `linkedAccountId: 'acc-1'`, `id` from `cardDebtId` if exported or literal
   `'debt-for-acc-1'`).
2. `logDebtPayment(debtId, 50)` → debt.balance 150 AND account.balanceMinor 150.
3. `undoDebtPayment(debtId, 50)` → both back to 200.
4. Unlinked debt: payment changes only the debt; accounts untouched (deep-equal before/after).
5. Existing `logDebtPayment` tests stay green.

**Verify**: `node node_modules/vitest/vitest.mjs run apps/mobile/src/folio/store.test.ts` → all pass.

## Done criteria

- [ ] Typecheck exit 0; full suite passes with the 4 new tests.
- [ ] Both mutators handle `linkedAccountId` in a single `setPartial`.
- [ ] Only the two in-scope files modified.

## STOP conditions

- The two functions don't match the excerpts (drift).
- The Account type's balance field is genuinely minor-units somewhere this plan touches
  (contradicting the UNIT TRAP note) — report, don't guess.
- Verification fails twice.

## Maintenance notes

- Follow-up (deferred): LogPaymentSheet could offer "pay from account" (payCreditCardFromBank)
  for linked debts — product call, not this plan.
- Reviewer: confirm no double-write when a payment is logged via payCreditCardFromBank
  (that path doesn't call logDebtPayment — verified at planning time; re-verify).
