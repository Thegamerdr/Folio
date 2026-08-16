# Plan 003: Remove unsupported confidence claims and restore the canonical product gate

> **Executor instructions**: Execute after plans 001 and 002. This is a trust-contract migration, not
> a vocabulary-only search-and-replace. Run each verification gate and stop on semantic drift. Update
> `advisor-plans/README.md` when done unless a reviewer owns the index.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- packages/domain/src/trustedCore.ts packages/domain/test/trusted-core.test.ts apps/mobile/src/folio/lib/trustedSafeRange.ts apps/mobile/src/folio/lib/trustedSafeRange.test.ts apps/mobile/src/folio/lib/criticalJourneys.ts apps/mobile/src/folio/lib/criticalJourneys.test.ts apps/mobile/src/folio/lib/decisionLedger.ts apps/mobile/src/folio/lib/decisionLedger.test.ts apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx apps/mobile/src/folio/screens/FirstAnswerScreen.tsx apps/mobile/src/folio/screens/TodayScreen.tsx apps/mobile/src/folio/store.ts apps/mobile/src/folio/store.test.ts tooling/scripts/check-product-canonical-gates.mjs`
> Plans 001–002 are expected to change `store.ts`. Confirm the next schema version before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `advisor-plans/001-block-future-schema-overwrite.md`, `advisor-plans/002-stop-cross-workspace-melo-financial-state.md`
- **Category**: correctness, product trust, tooling, migration
- **Planned at**: commit `f7b91c7`, 2026-08-16

## Why this matters

The trusted-core model turns local source labels into `high`, `medium`, `low` and `blocked`
confidence, then shows those labels as reliance cues. That is not provider/source confidence metadata
and contradicts the approved rule that confidence appears only when real metadata exists. The same
model makes `pnpm run ci` fail, while the gate omits the live `apps/mobile/src/folio` UI that renders
the claim. The fix must preserve ranges, truth classes, freshness, missing inputs and explicit
reliance without inventing a replacement score.

## Current state

- `packages/domain/src/trustedCore.ts:39-41` defines `TrustedCoreConfidence` as
  `high | medium | low | blocked`; fields occur throughout trusted facts, safe ranges, decisions,
  forecast evaluations and provisional answers.
- `apps/mobile/src/folio/lib/trustedSafeRange.ts:206-210` maps `corrected` and `statement-derived`
  balance labels to `high` without provider confidence metadata.
- `apps/mobile/src/folio/lib/trustedSafeRange.ts:900-915` computes an aggregate confidence label from
  status and locally-authored reasons even though `status`, `truthClass`, `freshness`, `reliance`,
  `missingInputs` and `contradictions` already express the supported facts.
- `apps/mobile/src/folio/screens/FirstAnswerScreen.tsx:76-80,319-323` converts confidence into a user
  reliance statement and renders `<level> confidence`.
- `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx:60-69,107-114` renders confidence beside money and
  source rows.
- `tooling/scripts/check-product-canonical-gates.mjs:6-18` scans domain/local packages but not the
  shipping `apps/mobile/src/folio` trust surfaces. Its broad regex currently fails on domain model
  identifiers.
- `apps/mobile/src/folio/copy/copyLint.test.ts` is the exemplar for distinguishing user-facing claim
  checks from internal implementation terminology.
- Product rule to preserve: display the range, calculation window, inputs, exclusions, assumptions,
  correction route, truth class and freshness. Do not add confidence until genuine source metadata
  exists.

## Commands you will need

| Purpose            | Command                                                                                                                                                                                                                                   | Expected on success                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Trusted-core tests | `pnpm exec vitest run packages/domain/test/trusted-core.test.ts apps/mobile/src/folio/lib/trustedSafeRange.test.ts apps/mobile/src/folio/lib/criticalJourneys.test.ts apps/mobile/src/folio/lib/decisionLedger.test.ts --passWithNoTests` | exit 0                                            |
| Product gate       | `pnpm check:product-gates`                                                                                                                                                                                                                | exit 0; zero `canonical.fake_confidence` findings |
| Typecheck          | `pnpm typecheck`                                                                                                                                                                                                                          | exit 0                                            |
| Full tests         | `pnpm test`                                                                                                                                                                                                                               | exit 0                                            |
| Full CI            | `pnpm run ci`                                                                                                                                                                                                                             | exit 0 in an LF checkout                          |

## Scope

**In scope**:

- `packages/domain/src/trustedCore.ts`
- `packages/domain/test/trusted-core.test.ts`
- `apps/mobile/src/folio/lib/trustedSafeRange.ts`
- `apps/mobile/src/folio/lib/trustedSafeRange.test.ts`
- `apps/mobile/src/folio/lib/criticalJourneys.ts`
- `apps/mobile/src/folio/lib/criticalJourneys.test.ts`
- `apps/mobile/src/folio/lib/decisionLedger.ts`
- `apps/mobile/src/folio/lib/decisionLedger.test.ts`
- `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`
- `apps/mobile/src/folio/screens/FirstAnswerScreen.tsx`
- `apps/mobile/src/folio/screens/TodayScreen.tsx`
- `apps/mobile/src/folio/store.ts`
- `apps/mobile/src/folio/store.test.ts`
- `tooling/scripts/check-product-canonical-gates.mjs`
- A new focused gate test under `tooling/` if needed.

**Out of scope**:

- Renaming parser/matcher uncertainty fields such as `CandidateMoneyItem.confidence` when they are
  internal review signals and never presented as financial trust.
- Adding percentages, scores, stars, badges or a renamed confidence scale.
- Removing truth class, freshness, explicit reliance, ranges or missing-input disclosure.
- Rewriting the store or forecast engine.
- Adding provider metadata that does not actually exist.

## Git workflow

- Branch: `advisor/003-trust-without-confidence`, based on completed plans 001–002.
- Commit example: `fix(trust): remove unsupported confidence claims`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Remove aggregate confidence from the trusted-core contract

In `packages/domain/src/trustedCore.ts`:

- delete `trustedCoreConfidenceLevels` and `TrustedCoreConfidence`;
- remove aggregate `confidence` fields from trusted fact, provenance, source-breakdown, safe-range,
  decision, forecast-evaluation and provisional-answer types;
- rename `TrustedSafeRangeConfidenceReason` to a factual name such as
  `TrustedSafeRangeEvidenceNote`, with impacts `supports | limits | blocks`;
- rename `confidenceReasons` to `evidenceNotes`;
- rename decision/accountability fields such as `confidenceAtTheTime` and
  `confidenceWasJustified` to factual evidence/reliance terms, or delete them when existing
  `reliance` and source facts already cover the state;
- change `cashflow_confidence` priority vocabulary to a non-scoring phrase such as
  `cashflow_source_quality` only where it belongs to this trusted-core contract.

Do not introduce a replacement ordinal. Update domain tests to assert source facts, freshness,
reliance, evidence notes and blocked conditions directly.

**Verify**:
`pnpm exec vitest run packages/domain/test/trusted-core.test.ts --passWithNoTests`
→ exit 0.

### Step 2: Make the adapter derive only supported trust facts

In `trustedSafeRange.ts`:

- remove `balanceConfidence`, `confidenceFor` and any aggregate confidence calculation;
- convert confidence reasons into factual evidence notes without saying that an engine or source
  “raises” trust;
- retain the existing explicit `status`, `truthClass`, `freshnessDetail`, `missingInputs`,
  `contradictions`, `relianceDetail`, range basis and uncertainty sources;
- ensure low-information output widens or blocks the range through existing uncertainty/status logic,
  not through a label.

Update tests to make assertions on the resulting range and explicit reasons. Include cases for manual
rough balance, user-corrected balance, statement-derived balance without provider metadata, stale
data, contradictions and sample data. None may emit a confidence label.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/lib/trustedSafeRange.test.ts --passWithNoTests`
→ exit 0.

### Step 3: Migrate persisted trusted-core records

Plans 001–002 should leave the schema at version 19. Add the next sequential migration (expected
`19 -> 20`; stop if that assumption is false) that normalizes persisted provisional answers,
decision records, snapshots, evaluations and accountability records to the new field names/shapes.
Remove obsolete confidence properties rather than retaining dual authority.

The migration must be tolerant of missing arrays and already-normalized records, preserve money,
source IDs, truth/freshness/reliance and audit history, and be idempotent through serialize/hydrate.

Add a v19 fixture containing every affected nested shape and prove:

- money/source/audit values survive;
- unsupported confidence fields do not survive;
- the migrated state serializes and reloads identically;
- plan 001's future-schema interlock still rejects version 21+.

**Verify**: `pnpm exec vitest run apps/mobile/src/folio/store.test.ts --passWithNoTests` → exit 0.

### Step 4: Remove user-facing claims and update dependent journeys

Update `criticalJourneys.ts`, `decisionLedger.ts`, `TrustedCoreSurfaces.tsx`,
`FirstAnswerScreen.tsx`, and `TodayScreen.tsx` to consume the new factual contract.

User-visible output may say, for example, that a figure is user-entered, statement-derived, stale,
missing inputs, provisional, blocked, or safe only for the limited question. It must not display
`high/medium/low confidence` or use confidence as the reason the user may rely on a number.

Preserve correction links, ranges, freshness and source breakdown. Update focused tests; do not alter
unrelated navigation or visual design.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/lib/criticalJourneys.test.ts apps/mobile/src/folio/lib/decisionLedger.test.ts --passWithNoTests`
→ exit 0.

### Step 5: Repair the canonical gate so it checks the shipping boundary

Refactor `check-product-canonical-gates.mjs` so `canonical.fake_confidence` checks both:

1. trusted-core contract identifiers where aggregate confidence is prohibited; and
2. user-facing string/JSX/template claims under `apps/mobile/src/folio`.

Do not blanket-ban the word in internal parser/dedup code where it means extraction uncertainty. Use
an explicit distinction modeled on `copyLint.test.ts`, not a growing line-by-line allow-list. Add a
test fixture proving the gate catches `high confidence` rendered by a shipping screen and does not
flag a typed internal import-review classifier.

**Verify**: `pnpm check:product-gates` → exit 0 with zero findings.

### Step 6: Run the full baseline

Run the focused suite, typecheck, main tests, contract validation and `pnpm run ci`. If Windows CRLF
causes Prettier failures in untouched files, do not mass-format; verify all in-scope files separately
and report the baseline issue. The product gate itself must be green on every platform.

**Verify**: `git diff --check` → no whitespace errors.

## Test plan

- Domain contract tests for absence of aggregate confidence and presence of factual evidence notes.
- Adapter tests for range widening/blocking based on real missing/contradicted/stale inputs.
- v19-to-v20 migration and round-trip tests in `store.test.ts`.
- Journey/decision tests updated to rely on truth, freshness and reliance.
- A tooling regression test that plants a fake user-facing confidence claim and expects
  `canonical.fake_confidence`, while an internal parser-confidence fixture remains allowed.

## Done criteria

- [x] No `TrustedCoreConfidence` or trusted-core aggregate confidence field remains.
- [x] No shipping screen displays confidence-as-trust without real metadata.
- [x] Existing persisted trusted-core history migrates without losing money, sources or audits.
- [x] `pnpm check:product-gates` exits 0 and scans the live trust surfaces.
- [x] Parser uncertainty remains internal and review-gated.
- [x] Focused tests, `pnpm typecheck`, `pnpm test` and contract validation pass.

## Execution evidence

- The trusted contract, Safe Range adapter, Decision Ledger, critical journeys and shipping trust
  surfaces now expose truth, freshness, range basis, missing inputs, evidence notes and reliance
  without an aggregate confidence scale. Candidate import/parser confidence remains internal.
- Schema version 20 removes obsolete trusted-core confidence fields from every persisted journey
  slice, renames evidence-note fields and the cashflow source-quality priority, and preserves source
  confidence outside those slices. The v19 fixture proves money, source IDs and audit history survive
  and that a serialize/hydrate round trip is byte-identical.
- Focused contract, adapter, journey, ledger, migration and gate suites: 368 tests passed. The full
  root suite passed 236 Vitest files / 2,730 tests and all 45 companion Node tests.
- `pnpm check:product-gates`, `pnpm typecheck`, source-package contract validation, targeted Prettier
  and `git diff --check`: passed.
- `pnpm run ci` cleared every product gate, including the repaired confidence gate, then stopped at
  the known repository-wide Windows CRLF baseline: Prettier reported 1,124 untouched files. Per the
  plan, no unrelated mass-format was performed; plan 008 owns the line-ending policy correction.

## STOP conditions

- Plans 001–002 are not complete or the next schema version is not understood.
- Removing a field would discard money, provenance or audit history without a migration mapping.
- The proposed replacement is another ordinal or numeric trust score.
- The only way to green CI appears to be excluding trusted-core or shipping UI files.
- A provider confidence claim is proposed without a real provider field and timestamp.

## Maintenance notes

Future provider integrations may add provider-supplied source quality only through a separately
versioned domain field with provenance and freshness. That future field must not silently recreate an
aggregate financial trust score. Reviewers should search rendered copy as well as TypeScript names.
