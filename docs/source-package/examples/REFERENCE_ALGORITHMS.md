# Reference Algorithms

These are normative pseudocode contracts. Production code may use different structures, but it must preserve the behavior and pass the supplied vectors.

## 1. Forecast construction

```text
buildForecast(workspaceId, asOf, horizon, mode):
  assert workspace accessible
  facts = load accepted posted transactions, confirmed balance observations,
          accepted calendar events and explicit user adjustments
  expectations = expand obligations, income streams, recurring rules,
                 debt minimums, budget reservations and accepted plan commitments
  replacements = reconcile pending→posted, reversals, refunds and superseded expectations

  startingPosition = choose latest confirmed balance per included account at/before asOf
  events = normalise facts + surviving expectations + scenario changes
  events = filter by workspace, horizon, account inclusion and certainty mode
  events = sort by:
      effective instant/local-date policy,
      fact precedence,
      protected-outflow precedence,
      stable event id

  position = startingPosition
  for event in events:
      position += signed amount converted only when a confirmed rate exists
      append point(position, event, provenance, certainty)

  calculate protected obligations, lowest projected position, risk dates,
            budget remaining, debt/plan effects and explanatory ledger
  persist only as derived snapshot with input revision hash
  return immutable forecast
```

### Forecast modes

- **Confirmed:** posted/confirmed facts only.
- **Expected:** confirmed plus accepted recurring expectations and conservative income.
- **Planning:** expected plus user-selected plan commitments.
- **Scenario:** planning plus temporary hypothetical changes; never committed by default.

Never blend modes without a visible label.

## 2. Actual-versus-expected reconciliation

```text
reconcileActual(transaction):
  candidates = expectations in same workspace/account/date window
  score candidates by explicit provider reference, user rule, amount proximity,
                      normalized counterparty/reference and recurrence date
  if one high-confidence candidate:
      link transaction to expectation
      mark occurrence satisfied by actual; do not mutate recurring template
      if amount differs materially:
          create bounded clarification proposal:
            one-off | fee/late payment | new recurring amount | wrong match
  else:
      create review candidate; never silently merge tax-relevant/business rows
```

The posted transaction remains the truth even if the user keeps the old recurring expectation for future periods.

## 3. Safe discretionary boundary

“Safe-to-spend” is a calculation label, not permission or advice.

```text
maxDiscretionarySpend(baseForecast, proposedDate, protectedFloor):
  low = 0
  high = liquid funds available under selected account policy
  while high - low > 1 minor unit:
      mid = floor((low + high) / 2)
      trial = insert hypothetical outflow(mid, proposedDate)
      if all protected obligations remain funded and
         minimum projected position >= protectedFloor:
          low = mid
      else:
          high = mid - 1
  return low with binding constraint, date, assumptions and uncertainty
```

It must show which obligation/floor becomes binding. Unconfirmed income does not rescue a conservative result unless the user explicitly selects a scenario containing it.

## 4. Payday allocation preview

```text
previewAllocation(incomeEvent, userRules):
  buckets = ordered by user-approved rules, never product recommendation:
    arrears/negative account risks
    protected obligations before next reliable income
    essential variable allowance
    minimum debt obligations
    chosen reserve floor
    sinking funds/annual obligations
    optional plan contributions
    unallocated remainder
  allocate while preserving account/date constraints
  return comparison and editable proposal
```

The user can change the order or amounts. Melo explains consequences, not a “best” choice.

## 5. Plan rebase

```text
rebasePlan(plan, changedFacts):
  oldVersion = current accepted plan version
  recompute available contributions from the new forecast
  apply user rules: minimum contribution, protected floor, deadline rigidity,
                    priority, pause behavior and accountability tone
  calculate new dates/milestones
  create proposed plan version with diff:
      what changed
      why it changed
      what remains unchanged
      new path/range
  require review for material changes; auto-refresh non-material display projections
  never mark the person as failed
```

## 6. Unexpected event cascade

```text
acceptUnexpectedEvent(event):
  atomic command:
    store event/fact and audit entry
    invalidate affected forecast/budget/plan/calendar/briefing projections
  rebuild in dependency order
  generate recovery briefing:
    fact
    immediate effect
    protected items still covered
    changed dates/amounts
    reviewable options or updated plan proposal
```

## 7. Melo intervention ranking

```text
rankCandidates(candidates, userPreferences, currentContext):
  discard suppressed, stale, duplicate, low-confidence or quiet-hour candidates
  score = urgency + financial consequence + user-requested relevance
          + active-plan relevance + novelty + confidence
          - anxiety cost - repetition - interruption cost
  apply caps per day and per topic
  prefer one clear intervention over a stack of cards
  if no candidate clears threshold: remain quiet
```

Tone preference can change wording and accountability intensity, never calculations or truth.

## 8. Bounded Melo questioning

```text
runIntent(intent):
  define endGoal, requiredSlots, optionalSlots, maxQuestions(default 3)
  use existing confirmed data first
  ask one high-information question only when it unlocks the endGoal
  after maxQuestions or user stop:
      produce best partial result with visible unknowns
      offer structured manual review
  never start an unrelated discovery thread
```

## 9. Import atomicity

```text
importFile(file):
  hash original bytes
  if exact source already committed: show duplicate result
  create staging job
  parse/normalise rows streaming; retain source lineage
  run malicious content guards, locale/date/sign checks, dedupe and reconciliation
  present questions/review summary
  on user commit:
      one atomic transaction writes accepted rows, provenance, audit and outbox
  on crash/cancel:
      authoritative ledger remains unchanged; staging resumes or is discarded
```

## 10. Transfer detection

A transfer proposal requires opposite signs, matching currency/amount (or explicit FX evidence), compatible dates and accounts controlled by the same user/workspace. It is never automatically treated as spending. Auto-link only when provider IDs or an accepted rule make the match deterministic.

## 11. Debt projection

Debt schedules use integer minor units and rate periods with explicit effective dates. Interest, fees, promotional rates, minimum formulas, statement/due dates and payment allocation order are separate inputs. Unknown lender behavior is labelled rather than guessed. The engine compares scenarios; it does not choose a repayment strategy for the user.

## 12. Search answer grounding

```text
answerSearch(query, workspace):
  parse filters locally
  retrieve only workspace-scoped records and snippets
  return records first
  optional Melo summary cites local record IDs/dates/amounts
  if evidence is insufficient, say so and offer filters
```

## 13. Sync conflict policy

- immutable facts coexist unless proven duplicate/replacement;
- scalar preferences use field-level revision rules and preserve conflict history;
- plans/events edited concurrently create reviewable versions;
- deletes are tombstones;
- financial facts are never silently overwritten by last-write-wins;
- projections rebuild locally after merged accepted facts.

## 14. Workspace isolation

Every command/query requires a workspace ID and authorization scope. Repository APIs have no unscoped list method. Export/search/Melo retrieval fail closed when scope is absent. Cross-workspace movement creates a new record or explicit link; it never changes scope invisibly.
