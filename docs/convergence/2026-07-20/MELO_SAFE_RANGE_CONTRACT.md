# Trusted Safe Range contract

Status: target contract replacing the old Safe Zone concept. This is not a simple rename.

Phase B executable interface: `TrustedSafeRangeResult` in `packages/domain/src/trustedCore.ts`.

## Product answer

Trusted Safe Range answers: "Given what Melo knows, what range is safe to rely on before the horizon, what could break it, and what is the smallest reversible move?"

## Answer model

```ts
type TrustedSafeRange = {
  workspaceId: 'personal';
  calculatedAt: string;
  horizonStartISO: string;
  horizonEndISO: string;
  currentKnownPositionMinor: number | null;
  knownCommittedFloorMinor: number | null;
  expectedSafeMinMinor: number | null;
  expectedSafeMaxMinor: number | null;
  conservativeBoundaryMinor: number | null;
  reliance: 'safe_to_rely' | 'use_caution' | 'provisional' | 'blocked';
  confidence: 'high' | 'medium' | 'low' | 'blocked';
  freshness: 'fresh' | 'ageing' | 'stale' | 'missing';
  missingMaterialInfo: string[];
  assumptions: string[];
  mainCauses: { label: string; amountMinor: number; dateISO?: string; sourceFactIds: string[] }[];
  wouldChangeIf: string[];
  sourceBreakdown: { factId: string; truthClass: string; label: string; capturedAt: string | null }[];
  forecastVersionId: string;
};
```

## Data contract

| Input | Required truth class | Current evidence |
| --- | --- | --- |
| Account/current position | Verified, user confirmed, or stale with penalty | `apps/mobile/src/folio/store.ts` account model and `setCurrentBalance` comments |
| Income/payday | User confirmed or inferred from confirmed recurrence | `packages/finance`, `apps/mobile/src/folio/store.ts`, `PaydayRitualScreen.tsx` |
| Bills/subscriptions/debts | User confirmed, verified, or inferred with review | `SubscriptionsScreen.tsx`, `PotsScreen.tsx`, `packages/finance`, `apps/mobile/src/folio/lib/modes/debtEngine.test.ts` |
| Calendar events | User confirmed or deterministic derivation | `CalendarScreen.tsx`, `apps/mobile/src/local/calendarIcs.ts` |
| Review candidates | Observed only until accepted | `ReviewScreen.tsx`, `EditTxnSheet.tsx` |
| Scenarios | Predicted/assumed; never committed facts | `WhatIfScreen.tsx`, `PlansScreen.tsx`, `packages/finance` |

## Calculation contract

- Deterministic engines calculate all numbers.
- The LLM never calculates current position, floor, Safe Range, forecast error, or material decision outcome.
- Every output inherits the weakest material truth class and freshness of its dependencies.
- Contradicted or missing material data blocks decisive reliance.
- Stale data can contribute only with visible stale penalty and conservative boundary.
- Estimated/assumed data must widen the range or reduce reliance.
- Sample/demo data is excluded from production user answers.

## UI contract

Every Safe Range surface must show:

- Range, not a single overconfident number, when uncertainty exists.
- Horizon.
- Confidence and freshness.
- Main causes.
- Missing material information.
- Assumptions.
- Source breakdown access.
- "What would change this" explanation.
- Reversible next move, if one exists.

Current surfaces to evolve: `TodayScreen.tsx`, `TodayAfterScreen.tsx`, `TodayModeScreen.tsx`, `MoneyPath.tsx`, `SafeZoneWidget.tsx`, `WhatIfScreen.tsx`, `RecoveryScreen.tsx`, `CalendarScreen.tsx`, and Lovable Today/Calendar/WhatIf designs.

## Required states

| State | Behaviour |
| --- | --- |
| Fresh/high-confidence | Show Safe Range as rely-able with source drawer. |
| Stale account | Show last known balance, stale badge, reduced reliance, refresh/manual confirm CTA. |
| Missing account | Block reliance; ask for current position or import. |
| Missing income/payday | Show provisional path only; ask the smallest payday/income question. |
| Contradiction | Show conflict, block reliance, route to Review/correction. |
| Negative/shortfall | Show protected commitments, shortfall date, recovery options requiring confirmation. |
| Low confidence | Show wider range and assumption chips; do not use decisive copy. |
| Demo/sample | Watermark and isolate; never affect real workspace. |

## Accessibility requirements

- Minimum 44px tap targets for source, assumption, correction and move controls.
- Range and confidence must be readable by screen readers as text, not only colour.
- Contrast: no paper/white text on accent. `--accent`/`t.calm` labels use ink (`t.accentInk`) unless the background is `t.ink`.
- Reduced motion must preserve causal explanation without animation.

## Test matrix

| Test | Acceptance |
| --- | --- |
| Source inheritance | Derived Safe Range reports all material source fact IDs. |
| Stale balance | Reliance downgrades and stale UI appears. |
| Missing account | Decisive Safe Range is blocked. |
| Estimated bill | Range widens or confidence lowers. |
| Contradicted fact | Answer blocks until review. |
| Review candidate | Candidate cannot influence committed floor until confirmed. |
| Scenario | Scenario output cannot mutate facts. |
| Melo explanation | Melo repeats engine output and source caveats, never invents numbers. |
