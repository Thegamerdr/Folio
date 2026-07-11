# Plan 105: Show the reconciliation mismatch on the closing-balance offer card

> **Executor instructions**: Follow step by step; verify each step; STOP conditions binding.
> Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/src/folio/ui/BulkStatementLanding.tsx apps/mobile/src/folio/lib/bulkLanding.ts`
> On changes, compare excerpts; mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (additive UI)
- **Depends on**: none
- **Category**: bug (honesty at the commit point)
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

After a statement import, the app offers the statement's closing balance ("£X — use it?").
The store already COMPUTES a reconciliation self-check (do the imported rows add up to that
balance?) and shows a mismatch warning on the PRE-add preview — but the post-add offer card
(the actual moment of commitment) renders without it. A user can tap "Use it" on a balance
the engine already proved contradicts the rows just landed, with no warning in sight.

## Current state

- `apps/mobile/src/folio/ui/BulkStatementLanding.tsx:297-303` — the offer card:
  ```tsx
  const closingBalanceOffer =
    currentOffer === 'closing-balance' ? (summary?.closingBalanceOffer ?? null) : null;
  if (closingBalanceOffer !== null) {
    const offer = closingBalanceOffer;
    ...
    <Text ...>{closingBalanceOfferLine(offer)}</Text>
  ```
- `BulkStatementLanding.tsx:400-416` — the PRE-add preview already renders
  `previewReconciliation.status === 'mismatch' ? <Text ...>{previewReconciliation.message}</Text>` —
  copy the exact styling of that warning line.
- `summary` in the offer's scope is the import summary; check whether it carries
  `reconciliation` (the store computes `reconcileStatement(...)` in `addStatementAsHistory`
  and carries it on the result — read `store.ts` around `addStatementAsHistory`'s return
  and the `summary` type used by BulkStatementLanding). If `summary.reconciliation` is NOT
  already threaded to this component, thread it via the smallest path (likely the
  `StatementClosingBalanceOffer` type in store.ts or the summary prop type).
- `apps/mobile/src/folio/lib/reconcileStatement.ts` — `status: 'ok' | 'mismatch' | ...`,
  `message` is prewritten honest copy (already lint-clean).

## Commands

From repo root; pnpm broken — direct binaries:
full suite `node node_modules/vitest/vitest.mjs run`;
typecheck from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`.

## Scope

**In scope**: `apps/mobile/src/folio/ui/BulkStatementLanding.tsx`; ONLY IF threading is
required: `apps/mobile/src/folio/store.ts` (the offer/summary type + its one construction
site) and `apps/mobile/src/folio/lib/bulkLanding.ts`.
**Out of scope**: `reconcileStatement.ts`, the write path (`addStatementAsHistory` logic),
the "Use it" handler's behavior (still allowed — warn, don't block).

## Git workflow

Conventional commit: `fix(import): surface the reconciliation mismatch on the closing-balance offer`. No push.

## Steps

1. Trace how `summary` reaches the offer render; thread `reconciliation` if absent
   (smallest diff). Verify: typecheck exit 0.
2. In the offer card, when `reconciliation?.status === 'mismatch'`, render the message line
   under the offer headline using the SAME style tokens as the preview's mismatch line
   (400-416). Verify: typecheck exit 0; full suite green.

## Done criteria

- [ ] Typecheck exit 0; full suite green.
- [ ] The offer card renders the mismatch message when status is 'mismatch' and nothing when 'ok'.
- [ ] Only in-scope files modified.

## STOP conditions

- The reconciliation result is structurally unavailable at the offer moment without
  touching the write path (report the chain).
- Excerpt mismatch (drift).

## Maintenance notes

- Deliberately warns without blocking — blocking a user from their own number is a
  product call this plan does not make.
