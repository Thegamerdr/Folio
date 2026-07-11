# Implementation Plans

Two backlogs live here:

1. **Night-mode backlog (ACTIVE)** â€” plans `101+`, written 2026-07-11 against commit
   `5cea944` on `claude/melo-mvp` by the improve skill (full audit: product-logic truth,
   data-model truth, launch readiness, dead-code map). Execute in the order below.
2. **Legacy parity backlog (historical)** â€” the `01â€“13` table further down, written against
   `e52de55` on the old `claude/folio-web-parity` branch. Most of it audits the archived
   pressureMap surface; treat as record, not work queue, until reconciled.

Each executor: read the plan fully before starting, honor its STOP conditions, and do NOT
update this index (the reviewer maintains it).

## Night-mode execution order & status

Lanes may run in parallel; WITHIN a lane, strictly sequential (shared files).

| Plan | Title | Priority | Effort | Lane | Depends on | Status |
|------|-------|----------|--------|------|------------|--------|
| 101 | Hydration degraded path recovers from backup | P1 | M | A (store) | â€” | TODO |
| 102 | Persist recovery-matrix tests | P1 | M | A | 101 | TODO |
| 103 | Linked-debt payment/account sync | P2 | S | A | not-concurrent-with 101/104 | TODO |
| 104 | setCurrentBalance recomputes bank total | P2 | S | A | not-concurrent-with 101/103 | TODO |
| 106 | Trial-ended acknowledgement row | P1 | S | B (UI) | â€” | TODO |
| 107 | Truth micro-fixes (reset caption, rounding, guard formula, safeZone input) | P2 | S | B | 106 | TODO |
| 108 | De-payday mode-aware headers + shortfall nudge (D2) | P2 | M | B | 106, 107 | TODO |
| 105 | Reconciliation warning on closing-balance offer | P3 | S | B | â€” (disjoint file) | TODO |
| 109 | Root error boundary + Sentry capture + lane catches | P1 | S | C (shell) | â€” | TODO |
| 110 | Durable ProGuard rules + drop biometric permission | P2 | M | C | â€” | TODO |
| 111 | Release-docs refresh (store declarations etc.) | P2 | S | D (docs) | â€” | TODO |
| 112 | Dead-code excision stage 1 (~39k lines, enumerated) | P2 | M | E (last) | ALL above merged | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (reason) | REJECTED (rationale)

## Dependency notes

- Lane A plans all touch `store.ts`/`store.test.ts` â€” never run two concurrently.
- Lane B: 106â†’107â†’108 share the Today screens/TodayNudges; 105 touches only
  BulkStatementLanding and may run any time.
- 102 needs 101's `consumeLoadDegraded` seam.
- 110 needs the Android emulator (emulator-5554) for its release-build verification.

## Findings considered and rejected / deferred (don't re-audit)

- **Hero Â£0 floors** (survival/stability/debt Today heroes clamp negative spare to Â£0):
  KEPT BY DESIGN â€” calm doctrine; verdict copy carries the crisis. The INPUT clamp +
  widget context gap IS fixed (plan 107 step 4).
- **Four safe-zone accountings unification** (route vs safeZoneMath vs stability-hero vs
  paywall): REAL but L-effort and owner-taste on which number wins â€” DEFERRED to owner.
  Plan 107 fixes the paywall-guard input (the trust-critical piece) only.
- **Widget receiver `exported="false"`** (Android 12+ APPWIDGET_UPDATE delivery): library
  default, MED confidence â€” verify on-device during the next dogfood pass, not a code plan.
- **Melo chat length caps / schema validation / timeouts** (legacy backlog 05â€“07): the
  Melo client was rebuilt since; re-audit before planning.

## Legacy parity backlog (historical, `e52de55`, branch `claude/folio-web-parity`)

(unchanged record â€” see git history of this file for the original context)

| # | Finding | Cat | Effort | Leverage |
|---|---------|-----|--------|----------|
| 01 | useCountUp ignores reduced-motion (pressureMap surface â€” ARCHIVED) | a11y | S | superseded |
| 02 | Reallocation sheet primes state during render (pressureMap â€” ARCHIVED) | correctness | S | superseded |
| 03 | Buffer-pot regex on pot name (pressureMap â€” ARCHIVED) | product | M | superseded |
| 04 | Insights SVG a11y (pressureMap â€” ARCHIVED) | a11y | M | superseded |
| 05â€“07 | Melo chat hardening (client since rebuilt â€” re-audit) | security | S | re-audit |
| 08 | meloAiClient tests (partially superseded â€” meloAiClient.test.ts exists now) | tests | L | re-audit |
| 09 | Two no-op Melo suggestions | product | M | re-audit |
| 10â€“13 | Token/key/empty-state polish (pressureMap â€” ARCHIVED) | polish | S | superseded |
