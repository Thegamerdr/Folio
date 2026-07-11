# Plan 111: Refresh the release-readiness docs to match the shipped binary

> **Executor instructions**: Follow step by step; STOP conditions binding. Do NOT update
> `plans/README.md`. This is a DOCS-ONLY plan — zero source-code changes.
>
> **Drift check (run first)**: `git log --oneline -1 -- STORE_DECLARATION_PREP.md RELEASE_BLOCKER_REGISTER.md ENGINES.md MELO_ALIGNMENT_AUDIT.md`
> If any was touched after commit `5cea944`, read the touched file first and merge, don't clobber.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (docs only)
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

`STORE_DECLARATION_PREP.md` gates what goes into Play's Data Safety Form — and it currently
says the AI gateway "is not built" (it is LIVE in production), crash reporting is "decision
needed" (Sentry landed 2026-07-05 with a real DSN), and billing is "intentionally absent"
(a full billing/entitlement engine shipped 2026-07-10/11). Submitting declarations off this
text would under-declare data egress (statement photos/PDFs leave the device to the AI
reader) and telemetry. Two more docs carry stale rows, and the alignment audit still
describes two already-fixed defects as open.

## Current state — the exact stale claims and today's reality

1. `STORE_DECLARATION_PREP.md:16` — "AI usage status: not applicable yet — AI gateway/final
   runtime is not built in this pass." REALITY: the gateway is deployed and metered
   (services/ai-gateway; worker live at folio-ai-gateway.tgdroppin.workers.dev; statement
   photos/PDFs are sent to it when the user initiates a read; disclosed in-app on
   PrivacyScreen).
2. `STORE_DECLARATION_PREP.md:13` — "crash logs: decision needed — No production crash
   reporting route is declared." REALITY: Sentry live since 147c226 (privacy-tuned;
   DSN in app.config.ts).
3. `STORE_DECLARATION_PREP.md:18` — "subscriptions/billing status: not ready — Billing
   implementation... intentionally absent." REALITY: implemented
   (lib/billing/{iap,entitlements,entitlementsLogic,ctaMode,readAllowance}.ts +
   PaywallScreen; deliberately non-completable until a Play listing exists; prices
   owner-confirmed 2026-07-11: Full £29.99 one-time, Live £2.99/mo–£24.99/yr).
4. `RELEASE_BLOCKER_REGISTER.md:66` — billing row "blocked... until billing scope is
   approved and implemented" → update to: implemented + owner-approved; remaining gate =
   Play Console listing + SKUs.
5. `RELEASE_BLOCKER_REGISTER.md:58` — privacy row "foundation only" → update: in-app
   disclosure copy + PRIVACY_POLICY.md draft landed 2026-07-05 (82bab68, 050b3af); still
   pending legal sign-off.
6. `ENGINES.md` D8 ("No engine code today... guardrail only") → one added sentence pointing
   at the real billing code + MONEY_MODEL.md §8.
7. `MELO_ALIGNMENT_AUDIT.md` §3.D/§5.6 — "Melo chat fed a hardcoded quantized tightPoint
   table" → mark FIXED (meloSnapshot.ts now uses the real route.tightPoint.amount).
   §2/§4.1/§5.4 — "SafeZoneSheet/AffordCheckSheet zero openers" → mark FIXED (both wired
   from all Today surfaces since bc50cad).

## Commands

None required beyond git. Do not run builds/tests (docs only) — but running the full suite
is harmless if you want a sanity gate.

## Scope

**In scope**: `STORE_DECLARATION_PREP.md`, `RELEASE_BLOCKER_REGISTER.md`, `ENGINES.md`
(D8 note only), `MELO_ALIGNMENT_AUDIT.md` (staleness annotations only).
**Out of scope**: every source file; PRIVACY_POLICY.md; MONEY_MODEL.md (already current).

## Git workflow

Conventional commit: `docs: release-readiness docs match the shipped binary`. No push.

## Steps

1. Apply updates 1–3 (STORE_DECLARATION_PREP.md): rewrite each stale row to the REALITY
   text above, each stamped "(updated 2026-07-11)". Keep the doc's own table/format style.
2. Apply 4–5 (RELEASE_BLOCKER_REGISTER.md), same stamping.
3. Apply 6 (ENGINES.md D8) — add, don't rewrite.
4. Apply 7 (MELO_ALIGNMENT_AUDIT.md) — add "FIXED <date/commit>" annotations inline at the
   cited sections; do not delete the original text (it's the record).

## Done criteria

- [ ] All 7 updates present; `git diff --stat` shows only the four in-scope docs.
- [ ] No source files touched.

## STOP conditions

- A doc's live text materially differs from the quoted stale claim (drift — report).

## Maintenance notes

- Add-to-process note included in STORE_DECLARATION_PREP.md: "update this doc in the same
  PR as any change to data egress, telemetry, or billing scope."
