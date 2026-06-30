# Decision Log and Open Sign-offs

## Locked product decisions

- Greenfield V2; V1 is donor material only.
- Mobile-first.
- Personal workspace default; business workspace distinctly separated and architected from the start.
- Debt-focused first segment; broader personal/business use grows from the same engines.
- Local-first, cloud-enhanced; local vault is authoritative.
- User owns data; Folio provides optional services.
- No mandatory account, Open Banking, cloud AI or internet for core.
- Hybrid Today briefing, Melo, timeline, calendar/planner and visual progress.
- Melo is a mandatory personality/presence, not mandatory chat.
- Melo proactivity target 6–8/10 with user controls and bounded questions.
- Actual posted transaction is truth; expectations remain separate.
- Plans are optional, configurable and dynamically rebased.
- Calendar/planner has medium scope and may include non-financial life events.
- Business records/tax/calendar/Melo context never mix with personal presentation.
- No financial advice; consequence simulation and explanation only.
- No fake universal score, shame, guilt streak or dashboard-first experience.
- Fun/retention follows real progress, confidence and user-specific motivation.
- Bad months receive truth, context and path forward.
- AI is optional and cannot write domain records directly.

## Resolved engine-behaviour decisions (2026-06-29 — full contracts in `../../ENGINES.md` §6)

Previously open "red" product questions, now decided. These were product-decision blockers, not
native release-gate blockers, so they are recorded here and in `ENGINES.md`, not in
`tooling/config/release-blockers.json`.

- D1 Current position is sourced, dated and labelled with an authority state; Today never anchors to
  a hidden hardcoded balance (the £720 seed is sample-only and cannot leak into real state).
- D2 Invalid paydays clamp to the last valid day of the month; weekend default is the previous
  working day, overridable per income source (public holidays are a later enhancement).
- D3 Layered undo: ≥30s immediate undo on Add/Edit/Ignore/Remove; 7-day recovery for ignored items
  and removed files; start-fresh is double-confirmed with an export warning and no fake undo.
- D4 Editing an added item is real and append-only: it creates a correction record, preserves the
  original source, recomputes Today/route immediately, and never double-counts.
- D5 No hardcoded Friday cadence; pots/protected money default to "after income arrives", with
  weekly / monthly / custom / one-off options; ask the user when no payday is known.
- D6 Export everything (JSON + CSV at MVP) is always in the free local core and never paywalled.
- D7 Sheet import (CSV/TSV/paste, optional template) is in scope as review-staged claims — never
  auto-counted; honest fix prompts for bad/missing columns.
- D8 Ownership is never paywalled (history, export, local data, basic Today/route, review, manual
  input, correction, start-fresh, own files). Exact price points remain a founder decision (below).

Status (updated 2026-07-01): the release-kill implementation has LANDED on the shipping
`apps/mobile/src/folio/` surface (commit 7d8b70d + follow-up): D1 no-hidden-anchor, D2 payday
clamp/weekend engine, D3 30s undo + triple-gated start-fresh (no fake post-wipe undo), D4 real
money-field edits with correction records, D5 cadence-derived pot dips, D6 real export, D7
review-staged sheet import, plus the subscription-honesty de-claim. Verified: tsc 0, folio suite
325/325, independent 7-blocker re-audit PASS. Remaining (tracked in `ENGINES.md §7/§9`, NOT
release-kill): D3 7-day recoverable soft-delete UI wiring, D2 per-income weekend-override UI, and
de-dupe Review-UI integration (Link / Keep both / Ignore / unlink). The two external research
deliverables are now written and partly realized in code: `research/OPEN_BANKING_DEDUPE_RESEARCH.md`
→ the pure `apps/mobile/src/folio/lib/dedupe.ts` `proposeMatches` engine + F1–F10 fixtures (engine
only; Review-UI wiring pending), and `research/SUBSCRIPTION_SIGNAL_RESEARCH.md` → the honest
`subSignals.ts` detector + the subscription-surface de-claim.

## Locked implementation direction

- Expo/React Native TypeScript mobile stack with development builds.
- Encrypted SQLite + FTS5 behind an abstraction, proven by spike.
- Pure deterministic engines.
- Typed command/proposal architecture.
- Local internal calendar and notifications.
- On-device OCR where possible.
- Provider abstractions for AI, Open Banking, cloud storage and database.
- Separate authentication and vault-key recovery.
- Store opaque encrypted cloud payloads where practical.
- Business/tax direct filing is a later compliance programme.

## Deliberately not locked

These require evidence or founder decision, not agent invention:

- final brand/tagline;
- exact navigation labels and visual style beyond the experience principles;
- exact pricing/business model (the never-paywall-ownership guardrail is now locked — `ENGINES.md`
  D8 — but the price points are not);
- which regulated Open Banking provider;
- which cloud infrastructure vendor;
- exact AI provider/model at launch;
- launch countries after UK;
- whether/when business mode ships in the first public binary;
- precise free/paid entitlement mapping;
- full planner/project-management expansion;
- household collaboration model;
- direct HMRC filing timing.

## Required founder sign-offs before build commitment

1. Approve the product constitution and advice boundary.
2. Approve first-60-second experience prototypes.
3. Approve Today navigation/home hierarchy.
4. Approve Melo tone modes and intervention examples.
5. Approve personal/business visual separation.
6. Approve local-only versus cloud copy and recovery trade-off.
7. Approve the database/crypto spike result.
8. Approve the beta scope and business module timing.
9. Approve the monetisation experiment when evidence exists.

## Research/revalidation triggers

Re-run targeted research when:

- store policies change;
- a new SDK/database/model is selected;
- UK regulatory/tax scope changes;
- Open Banking provider changes;
- adding investments, credit recommendations, payments or lending;
- adding children/households/collaboration;
- entering a new jurisdiction;
- cloud provider begins using data for model/product training;
- encrypted sync design changes.

## Rule for agents

An unresolved sign-off does not permit silent invention. Implement an interface/configuration seam, use a clearly marked development default and record the decision required.
