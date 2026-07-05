# DATA_INTELLIGENCE.md — Folio Data-Intelligence Build Program

Status: ACTIVE. Owner-ordered 2026-07-05: **"go with 1, do them all in order."**
Scope: income cadence, auto-detection, historic backfill, compounding prediction —
the four analyst axes below, executed as one continuous program, phases ①→⑥.

This document is the single source of truth for the program. It is written so a
fresh session can execute any phase **without re-running analysis** — every claim
carries its file:line evidence from the four source audits (income-rhythm,
auto-detection, historic-backfill, compounding), preserved verbatim where it matters.

---

## 0. DECISION (recorded)

**All program work targets the LIVE folio spine**, not the reference packages:

```
apps/mobile/src/folio/lib/*
apps/mobile/src/folio/store.ts
apps/mobile/src/folio/lib/storeRoute.ts
apps/mobile/src/folio/lib/calendarEvents.ts   (deriveCalendarEvents choke point)
```

**REFERENCE ONLY, do not wire directly, until a deliberate consolidation pass:**

- `packages/melo-engine/src/*` (dangerDate.ts, spend.ts, safeZone.ts, cycles.ts,
  statement.ts, moneyMode.ts) — declared as a workspace dep in
  `apps/mobile/package.json:40` but has **zero import sites** anywhere in
  `apps/mobile/src`. Confirmed dead code from the shipping app's point of view.
  Its docstrings (danger-date, run-rate, safe-zone formulas, `detectBills`
  recurring-bill detector, `cadence: 'monthly'|'weekly'` field) are a clean
  **design reference**, not shippable code.
- `packages/finance-engine`, `packages/today-engine`, `packages/calendar-engine`,
  `packages/import-engine`, `packages/storage` (canonical repository:
  `balanceObservations`, `availablePositionSnapshots`, `forecastSnapshots`,
  `sourceRecords`, `provenance` tables) — real, wired-adjacent infrastructure
  used by `apps/mobile/src/local/*` (canonicalLedgerStore, statementIntake,
  recurringChargeDetection). Treat as a second stack; do not merge into the
  folio spine mid-program.

**Multi-stack drift risk — verbatim from the compounding report:**

> "Architecture reality check first (this changes the roadmap): there are two
> parallel, unreconciled engine stacks in this repo. `packages/melo-engine/src/*`
> (dangerDate.ts, spend.ts, safeZone.ts, cycles.ts, statement.ts, moneyMode.ts) is
> declared as a workspace dep in `apps/mobile/package.json:40` but **has zero
> import sites anywhere in `apps/mobile/src`** — it's fully dead code from the
> shipping app's point of view (confirmed via grep across the whole app tree).
> The real, wired engines are `packages/finance-engine/src/index.ts` (731 lines,
> `buildForecast`), `packages/today-engine/src/index.ts` (1646 lines),
> `packages/calendar-engine`, `packages/import-engine/src/index.ts`, plus a
> large `apps/mobile/src/local/*` adapter layer (canonicalLedgerStore,
> statementIntake, recurringChargeDetection, etc.) backed by `packages/storage`
> (a real canonical-repository with `balanceObservations`,
> `availablePositionSnapshots`, `forecastSnapshots`, `sourceRecords`,
> `provenance` entity tables already in the schema). Any roadmap work should
> target the real stack, not `melo-engine`, unless the plan is explicitly to
> retire the dead stack or wire it in."

Also flagged (compounding report, item 6 of the ranked sweep): `melo-engine` and
`apps/mobile/src/local/recurringChargeDetection.ts` are **two competing
implementations of the same recurring-charge heuristic** with different tuning
constants (±15% vs ±10% amount tolerance, differing min-occurrence rules) — this
is tech debt regardless of program sequencing and should be retired, not extended,
once phase ③/⑤ land.

Second duplicate-detector pairing also flagged (auto-detection report, item 2):
`apps/mobile/src/local/recurringChargeDetection.ts:46` and the live
`subSignals.ts`/`caughtSubs.ts` path both solve "is this a recurring charge" with
different constants — worth a consolidation decision before or during phase ⑤,
not silently duplicated further.

---

## 1. Program phases (owner-ordered, execute in sequence)

| Phase | Name | One-line target |
|---|---|---|
| ① | Income-source cadence model | `incomeSources[]` at the `deriveCalendarEvents`/`routeFromStore` choke point — replace day-of-month-only payday with real cadence (weekly/fortnightly/4-weekly/monthly) |
| ② | Salary inference from statement credits | Detect recurring income from statement credit clustering (mirrors existing debit-clustering engine) |
| ③ | Merchant→category memory | Persist user category corrections so re-imports stop re-asking the same question |
| ④ | Historic cycle synthesis + transaction-cap lift | Reconstruct `CycleRecord`-shaped history from bulk-imported transactions; remove the silent 200-row cap that currently destroys bulk backfills |
| ⑤ | Caught-bills + weekly-cadence unlock | Extend the shipped `caughtSubs.ts` pattern to bills, and un-hardcode `SHEET_CADENCE` so weekly-cadence detections aren't thrown away |
| ⑥ | History-fed forecasts | Irregular-mode percentile math, category spend baselines, bill-drift detection — all fed by accumulated history instead of single-snapshot state |

Each phase carries a **STANDING DISCOVERY lane**: while implementing, actively
watch for and log any new gap the analyst reports didn't anticipate (schema
surprises, additional dead code, additional drift between the two stacks). Log
these in the Status Log (§7) under the phase they were found in — do not let
them silently expand scope without a decision note.

Status: phase ① launched 2026-07-05 (see §7).

---

## 2. PHASE ① — Income-source cadence model

### What exists today (the choke point)

The entire app reads income off a single onboarding field:

```
store.ts:188-193 — Onboarding type: { done, name, payday: number /* day of month */, monthlyIncome }
store.ts:524     — default payday: 25
```

No cadence field exists anywhere. Every downstream consumer assumes exactly one
monthly income event:

- **`calendarEvents.ts:146-166`** — unconditionally computes
  `firstPaydayIso = nextDayOfMonth(now, onboarding.payday || 25)` and injects one
  `+monthlyIncome` "in" event per calendar month. No branch checks `moneyMode` or
  any cadence field.
- **`storeRoute.ts:129,148,165-171`** (`routeFromStore`) — consumes the same
  derived timeline for `daysToPayday`/`spare`/the whole Today path curve; falls
  back to `resolvePayday({dayOfMonth: paydayDom}, ...)` directly when no payday
  event is found.
- **`lens.ts:92-99,140`** — trial-cycle-end math also calls
  `nextPaydayDate(today, paydayDom||25)`.
- **`payday.ts`** (whole file) — the actual date-resolution engine. Cadence-correct
  in isolation (clamps month-overflow Feb 31→28/29, shifts weekends via
  `previous`/`next`/`exact`), but its contract
  (`PaydayRule = { dayOfMonth: number; weekendRule? }`, `payday.ts:32-37`) has
  **no notion of week-based cadences**. Cannot express "every Friday," "every
  other Friday," or "every 4 weeks from an anchor date" — these need a different
  rule shape (weekday + interval + anchor date), not an extension of `dayOfMonth`.
- **`OnboardingSheet.tsx:264-266`** — payday step is a slider,
  `PAYDAY_MIN=1 / PAYDAY_MAX=31 / PAYDAY_STEP=1` (step 3 render at
  `OnboardingSheet.tsx:652-668`). Forces every user, regardless of declared mode,
  through a day-of-month picker.
- **`OnboardingSheet.tsx:177-186`** — choosing `irregular` mode only adds a
  "worst month £ floor" question at step 3; it does **not** change or skip the
  day-of-month payday slider at step 4. Self-declared irregular earners still get
  `onboarding.payday`/`monthlyIncome` populated with the same forced-monthly value.
- **`store.ts:1638-1639,1674-1675`** — migration code carries a **dead
  `paydayLastWorkingDay` field**, "read but has no destination." Evidence this
  was scoped once and dropped — reusable prior art for the last-working-day case.

### Net effect (why this is phase ①, first)

A weekly-paid user's onboarding-declared payday collapses their 4-5 real
paydays/month into one calendar event. Runway, tight-point, "days to payday" all
read as if paid once a month. This is upstream of every other phase — auto-
detection (②) has nowhere to write a detected cadence until this model exists;
historic backfill (④) needs a cadence-aware anchor to reconstruct cycles;
forecasts (⑥) need real cadence to compute percentiles correctly.

### UK cadence prevalence (ranking basis)

Monthly salaried ~70-75%, weekly-paid ~15-20% (retail/trades/hourly), fortnightly
~5-8% (public sector/agency), 4-weekly ~3-5% (retail/local-authority payroll,
often mistaken for monthly), irregular/self-employed ~10-15% (overlaps other
buckets).

### Build plan, in value order

1. **Weekly cadence (highest value, ~15-20% of UK workers).** New rule shape:
   `{ kind: 'weekly'; weekday: number; amountPerPeriod: number }`, generalized to
   "same weekday every N weeks" so fortnightly/4-weekly reuse it. Requires:
   - `OnboardingSheet.tsx` step-3 branch: weekday+interval picker instead of the
     day-of-month slider when the user isn't monthly (today's step order
     hardcodes the slider for everyone — `OnboardingSheet.tsx:264-272,388,432,652-668`).
   - `calendarEvents.ts:146-166` branches on cadence kind, emits N income events
     per window instead of one.
   - `storeRoute.ts`'s payday fallback + `lens.ts`'s trial-cycle-end math need a
     cadence-aware "next income date" instead of `resolvePayday({dayOfMonth})`.
2. **Fortnightly + 4-weekly as the same generalized weekly-cadence engine
   (~10-13% combined).** Once (1)'s weekday+interval rule exists: fortnightly =
   interval 2, 4-weekly = interval 4. Near-zero marginal engine cost. **4-weekly
   is the sneaky bug case** — drifts against calendar months (13 paydays/year,
   not 12), so a naive day-of-month mental model actively misleads these users
   into believing they're paid monthly when the date creeps.
3. **Wire `irregular` mode strategy to actually consume income (~10-15% of
   users who self-declare it).** `irregular.ts`
   (`apps/mobile/src/folio/lib/modes/strategies/irregular.ts:24-82`) is real and
   wired (registered `modes/index.ts:32`, invoked via `deriveModeState` from
   TodayScreen/TodayModeScreen/TodayStabilityScreen/notifyState.ts/widgetSnapshot.ts).
   Its `ModeInputs` (`currentBalance`, `subs`, `subPaused`, `pots`, `hour`,
   `ritualCompletedRecently`) **never includes income at all** — only counts
   outflow. The documented formula in `MONEY_MODES.md` §2.5
   (`currentBalance + p20(next 30-day income) − Σ fixed outgoings − buffer`) is
   NOT what's implemented; shipped code only does the outflow-runway half.
   `MONEY_MODES.md` §6 marks `incomeStream` (multi-source, variance, p20
   forecasting) as `RN-scope` — explicitly not yet built. Fix: implement the
   documented p20 formula, and make `deriveCalendarEvents`/`routeFromStore` skip
   fixed monthly-payday injection when `moneyMode === 'irregular'` (or when no
   fixed cadence is declared) so the shared curve stops contradicting the mode's
   own premise. Cheap because mode-registry plumbing (`getStrategy`/
   `deriveModeState`) already exists — gap is purely in the two curve-building
   functions plus the missing income-side math.
4. **Last-working-day-of-month rule (smaller population).** `payday.ts`'s
   existing weekend-shift logic (`shiftForWeekend`, `previous` rule) is 90% of
   what's needed — expressible today as `dayOfMonth: 31` + clamp +
   `weekendRule: previous`. Low build cost. The dead `paydayLastWorkingDay`
   migration field (`store.ts:1638-1639,1674-1675`) confirms this was scoped
   once, not unconsidered.

### Non-negotiable constraint (carries into phase ②)

Per `MONEY_MODES.md`: mode/cadence is **user-declared or user-confirmed, never
silently switched**. Any auto-detected cadence (phase ②) must be propose-and-
confirm, never a silent overwrite of onboarding.

### File:line hooks (phase ①)

```
apps/mobile/src/folio/store.ts                          188-193 (Onboarding type), 524 (default), 1621-1706 (migration), 1638-1639/1674-1675 (dead paydayLastWorkingDay)
apps/mobile/src/folio/sheets/OnboardingSheet.tsx         264-272 (slider consts), 177-186 (mode-extra step), 388, 432, 652-668 (step-3 render)
apps/mobile/src/folio/lib/payday.ts                      whole file — needs sibling weekly-cadence resolver (32-37 PaydayRule contract), 136 resolvePayday
apps/mobile/src/folio/lib/calendarEvents.ts              146-166 (payday-injection loop), 93-98 (RECURRING_BILLS hardcoded demo)
apps/mobile/src/folio/lib/storeRoute.ts                  37, 129, 148, 160-171 (fallback payday resolution)
apps/mobile/src/folio/lib/lens.ts                        92-99, 140 (trial-cycle payday math)
apps/mobile/src/folio/lib/modes/strategies/irregular.ts  whole file — missing income input, 24-82
apps/mobile/src/folio/lib/importSheet.ts                 income classification only (145-149, 345, 354), no recurrence
folio-melo design SoT: MONEY_MODES.md                    §2.5 (p20 formula spec), §6 (incomeStream marked RN-scope)
```

---

## 3. PHASE ② — Salary inference from statement credits

### What exists today

`detectRecurring` (`apps/mobile/src/folio/lib/subSignals.ts:240`) is the live,
wired recurring-detection engine: groups confirmed `transactions` by merchant,
clusters by amount, classifies cadence (weekly/fortnightly/monthly/quarterly/
yearly via `CADENCE_DAYS` at line 109) with published minimum-occurrence
thresholds (`CADENCE_MIN_OCCURRENCES`, line 118 — weekly needs 8 occurrences,
monthly needs 3).

**The engine structurally cannot detect income today — not a tuning gap, an
architecture gap.** `Charge` type accepts positive amounts (`amount: number` at
`subSignals.ts:35`; `credits` bucket populated at `groupByMerchant`,
lines 273-275). But `buildSignalsForGroup` (line 295) only calls
`clusterByAmount(group.out)` (line 302 — **debits only**) to build series.
`group.credits` is only ever consulted for `computePaymentReturned` (refund
detection, line 492) — **the credits path never reaches `buildSignalForCluster`**.

### Fix

Mirror the debit clustering for `group.credits`: a `clusterByAmount(group.credits)`
→ `buildSignalForCluster` call, same function, credits already carry positive
`.amount` so magnitude/cadence math is identical. Let a new consumer
(`detectIncomeCandidate` or similar) surface the result. Effort: ~20 lines, same
function reused. This is the exact shape needed for the STAFFLINE-type
giro/payroll credit case the owner referenced — same code path as bill
detection, just never invoked on credits.

### Where the detected signal lands

Per phase ① constraint: propose-and-confirm, never silent-write. Detected income
cadence should feed a confirmation UI (parallel to `SubCaughtSheet`'s pattern —
see phase ⑤) that offers to **promote** a detected pattern into the user's
declared `Onboarding` cadence field (built in phase ①), not silently override it.

### Orphaned prior art (do not wire directly — reference only)

`packages/melo-engine/src/statement.ts:330` (`detectBills`) is a real, tested
recurring-bill detector (merchant-group by normalized description, ±15% amount
tolerance, monthly 25-35 day / weekly 6-8 day cadence classification,
`AMOUNT_TOLERANCE = 0.15` at line 263). Exported from
`packages/melo-engine/src/index.ts:79-85`, covered by `statement.test.ts`. **Zero
import sites** in `apps/mobile/src` — confirmed dead. Its `cadence: 'monthly' |
'weekly'` field (`statement.ts:24`) and merchant-grouping heuristic are useful
design reference for phase ② and ⑤, but do not import it directly; the live path
is `subSignals.ts`.

### File:line hooks (phase ②)

```
apps/mobile/src/folio/lib/subSignals.ts        35 (Charge type), 240 (detectRecurring), 273-275 (groupByMerchant credits bucket), 295 (buildSignalsForGroup), 302 (clusterByAmount debits-only call), 492 (computePaymentReturned, credits' only current consumer), 109 (CADENCE_DAYS), 118 (CADENCE_MIN_OCCURRENCES)
apps/mobile/src/folio/lib/payday.ts            136 (resolvePayday — target for a new inferPaydayFromDeposits(history) companion function per compounding report AXIS 4.2 item 4)
packages/melo-engine/src/statement.ts          330 (detectBills, reference only), 24 (cadence field), 263 (AMOUNT_TOLERANCE)
packages/melo-engine/src/index.ts              79-85 (export site, reference only)
```

---

## 4. PHASE ③ — Merchant→category memory

### What exists today — confirmed absent

`statementReaderClient`/`parseCandidatesFromModelJson`
(`apps/mobile/src/local/statementReaderParse.ts:70-114`) emits a `category`
guess per candidate straight from the model's JSON, always tagged
`confidence: 'low'`. In `ReviewScreen.tsx`, the user picks a category chip
(`CATEGORIES`, line 124) mapped via `categoryFor()` (line 164) into the posted
`Transaction.category`.

**Nothing reads that correction back.** No store field, no lookup table, no
per-merchant category memory anywhere in `store.ts` — confirmed via grep, zero
hits. Every future statement re-import re-asks the model the same category
question for the same merchant, at the same low confidence, forever. This is
**the most concrete "every upload should compound" gap** — the infrastructure
for merchant→category memory doesn't exist, not even a stub.

### Build plan

New store slice: a merchant→category map (normalized merchant key → last-
confirmed category + confidence), written whenever `ReviewScreen.tsx`'s
`categoryFor()` path posts a user-selected category. On future imports,
`statementReaderClient`/`parseCandidatesFromModelJson` should consult this map
before falling back to the model's low-confidence guess — same propose-then-
confirm discipline (surface the remembered category as a pre-filled/high-
confidence suggestion, not a silent auto-post).

### File:line hooks (phase ③)

```
apps/mobile/src/local/statementReaderParse.ts   70-114 (category guess emission, always confidence:'low')
apps/mobile/src/folio/screens/ReviewScreen.tsx  124 (CATEGORIES), 164 (categoryFor()), 367 (referenced in auto-detection report as second hook)
apps/mobile/src/folio/store.ts                  target for new merchant-category-map slice (no existing field — greenfield addition)
```

---

## 5. PHASE ④ — Historic cycle synthesis + transaction-cap lift

### (A) The 200-row cap — silently destroys bulk backfill

`store.ts:1303`: `setPartial({ transactions: [full, ...state.transactions].slice(0, 200) })`.
Hard, silent, unconditional cap on every `addTransaction` call, oldest-evicted-
first. 6 months of a moderately active account (15-20 txns/week) = 400-500 rows.
A bulk import pushing rows through `addTransaction` one at a time **silently
discards everything past the 200 most recent** — no toast, no count, no warning.
Also flagged: `edits[]`/`timelineEvents[]` share the same `.slice(0,200)` pattern
(line ~1325); `reviewQueue` caps at 60, `calendarEvents` at 100, `cycles` at 24.
`edits[]` itself has no cap (grows unbounded).

Also flagged (perf, not correctness): `addTransaction` is one-row-at-a-time with
no batch variant — a bulk importer looping it does 200+ individual `setPartial`
(full state reserialize + persist() + emit()) cycles. Real IO cost the API
wasn't shaped for.

**Fix:** raise/redesign the cap for bulk import — imported historical rows need
their own array (uncapped or a much higher cap, e.g. 5,000, since they're
historical facts not a live rolling window), separate from the live 200-slot
rolling window.

### (B) Cycle reconstruction — does not exist; two disconnected cycle models

`packages/melo-engine/src/cycles.ts` defines a `CycleRecord`
(endedISO/endedPositive/closingSafeZonePence) with `closeCycle()` and
`deriveCycleState()`. **Never imported by the app.** `apps/mobile/src/folio/store.ts`
defines its own, incompatible `CycleRecord` (store.ts:177:
closedAt/label/spare/tightPoint/setAside/note — flat "ritual summary," no
relation to the engine's model). Not interchangeable, no adapter.

Only two writers of the app's real `cycles[]`:
- `PaydayRitualScreen.tsx:880` — `addCycle(...)`, fires once at the end of a
  **live, walked-through** ritual. Forward-only, one record per completion.
- `fastForwardMonth()` (`store.ts:1769-1799`) — debug-only synthetic-cycle
  generator (random values), used to demo Insights without waiting a month.

**Zero path today from "N months of imported transaction history" to N
synthesized `CycleRecord`s.** A user importing 6 months of statement rows gets 0
cycles created — Insights stays in empty state
(`InsightsScreen.tsx:214-245`, "Nothing wrapped up yet") regardless of
transaction volume, because it reads only `cycles.length`, never
`transactions.length`.

**What the three screens actually read (confirms the blast radius):**
- **InsightsScreen** (`InsightsScreen.tsx:159-197`) — reads `cycles`, `pots`,
  `subPaused`, `moneyMode`, `transactions`, `tinyWins`. All headline figures
  (avgTight, stat tiles, 6-point trend chart, "notes from past you") aggregate
  from `cycles[]` only. `transactions` used for exactly one thing: a trailing-
  7-days weekly digest (lines 185-194). Bulk-imported historical rows: weekly
  digest picks up at most the last 7 days; the chart/tiles/notes show nothing.
- **CalendarScreen** (`CalendarScreen.tsx:283-364`) — does **not** read
  `transactions` at all. All in/out events derived forward from
  `onboarding.payday` + `RECURRING_BILLS` (hardcoded demo) + live `subs`,
  windowed 35 days from now. Month/Week view can navigate to past months
  (`offset` state, lines 1120,913) but past-date cells only show forward-
  projected recurring items, never actual historical transactions. **Bulk-
  imported past rows are entirely invisible on Calendar.**
- **TimelineScreen** (`TimelineScreen.tsx:262-283`) — the only screen that reads
  `transactions` directly (merged with `edits`+`timelineEvents` via
  `buildTimelineRows`, newest-first). **The only screen where imported
  historical rows actually show up** — as flat "Added" log rows, correctly
  dated. No aggregation; flat log only.

### Build plan

**Minimal shape, new separate store slice** (does not touch live `cycles[]`/
`transactions[]`, preserves the ritual-sealed guarantee):

```
importedHistory: {
  source: 'statement-import',
  importedAt: ISODateTime,
  transactions: Transaction[],                      // own array, NOT merged into capped 200-slot live transactions[]
  reconstructedCycles: ReconstructedCycleRecord[],   // distinct type, tagged estimated
  acceptedSigs: string[],                            // merchant|amountCents|date — persisted dedupe set
}
```

`ReconstructedCycleRecord` = superset of live `CycleRecord` + `confidence:
'estimated' | 'statement-derived'` + `source: 'backfill'` tag, so Insights can
distinguish "lived-through, ritual-sealed" cycles from "inferred from a CSV."
Union point: `cycles.concat(importedHistory.reconstructedCycles)` — explicit,
not a silent overwrite.

`reconstructCyclesFromHistory(transactions, onboarding, opts) -> CycleRecord[]`:
anchors cycle boundaries on detected income events (phase ② output), not
`onboarding.payday` alone. Aggregates per inter-anchor window: total spend,
tightPoint (needs an opening-balance anchor per cycle — realistically only
approximable unless statement rows carry `balancePence`, cf.
`StatementRow.balancePence` in `statement.ts:17`), setAside (pot-linked
transfers if identifiable, else 0/unknown).

Calendar past-month rendering needs a **second derivation path**:
`deriveHistoricalCalendarEvents(transactions, monthAnchor)` mapping real
transaction rows onto day cells for months before "now" — separate from the
existing forward projection. `MonthView`'s `offset` state and grid-cell
rendering (`CalendarScreen.tsx:1098-1334`) already supports arbitrary-month
navigation; only the past-month data source is missing, not the UI shell.

### (C) Idempotent repeat uploads — the actively-harmful gap, fix first within phase ④

Two dedupe mechanisms exist, both scoped to the **Review queue only**, not to
posted `transactions`:
- `reviewCandidateSig(merchant, amount, date) = "merchant|amountCents|date"`
  (`store.ts:1412-1414`).
- `enqueueReviewItems` (`store.ts:1460-1488`) skips a candidate if its sig is in
  `ignoredReviewSigs[]`, or an identical triple already sits unresolved in
  `reviewQueue`.

**Gap:** once a candidate is accepted into a real `Transaction` via
`addTransaction`, no persisted signature check runs against **existing
transactions**. `resolveReviewItem` (line 1512) just filters the item out of the
queue. Re-importing the same statement twice: first import's candidates get
accepted into `transactions`; second import re-parses into candidates with
identical sigs; `enqueueReviewItems` checks `ignoredReviewSigs` and the
**current** `reviewQueue` (now empty, since first batch was resolved) — **does
NOT check accepted transactions**, because accepting was never recorded as a
signature anywhere. Net effect: **duplicate transactions get created** on
re-import with no protection. The 14-day TTL (`REVIEW_TTL_MS`, line 1447) only
ages out unresolved queue items, doesn't help.

**Fix (highest-leverage, do first in this phase):** on accept — wherever the
Review surface calls `addTransaction` + `resolveReviewItem` together — also
write `merchant|amountCents|date` into a new accepted-signatures set (separate
from `ignoredReviewSigs`, or extend its semantics to "seen" rather than only
"user-declined"), and have `enqueueReviewItems` check that set too.

### Ranked build order within phase ④

1. Fix accepted-transaction dedupe gap (C) — currently actively harmful
   (duplicates); cheapest fix; unblocks "every upload compounds" as a *safe*
   operation at all.
2. Raise/redesign the transaction cap (A) — currently silently destroys the
   majority of any real 6-month backfill.
3. Cycle reconstruction from history (B) — makes Insights show anything for a
   backfilled user; without it, Insights is permanently empty regardless of
   import volume.
4. Calendar past-month real-data rendering — lowest urgency of the four;
   Insights/Timeline already carry most of the "did my import work" feedback.

### File:line hooks (phase ④)

```
apps/mobile/src/folio/store.ts                    1303 (200-cap slice), ~1325 (edits/timelineEvents cap), 1412-1414 (reviewCandidateSig), 1447 (REVIEW_TTL_MS), 1460-1488 (enqueueReviewItems), 1512 (resolveReviewItem), 177 (app's own CycleRecord shape), 1769-1799 (fastForwardMonth debug generator)
apps/mobile/src/folio/screens/InsightsScreen.tsx  159-197 (reads cycles[] only), 168-197 (chart/tiles), 185-194 (7-day transactions digest), 214-245 (empty state)
apps/mobile/src/folio/screens/CalendarScreen.tsx  283-364 (no transactions read), 1098-1334 (MonthView offset/grid — UI shell already supports past months), 1120,913 (offset state)
apps/mobile/src/folio/screens/TimelineScreen.tsx  262-283 (buildTimelineRows, only screen reading transactions directly), 154-169 (relativeWhen fallback formatting)
apps/mobile/src/folio/screens/PaydayRitualScreen.tsx  880 (addCycle, sole live writer)
packages/melo-engine/src/cycles.ts                13-17 (CycleRecord shape, reference only — unimported), 42 (HISTORY_CAP=24, separate/unused)
packages/melo-engine/src/statement.ts             17 (StatementRow.balancePence, reference for opening-balance anchor problem)
apps/mobile/src/local/localLedger.ts               43 (LocalLedgerTransaction — date/amountMinor/source:'import', no retention cap the way melo-engine has)
```

---

## 6. PHASE ⑤ — Caught-bills + weekly-cadence unlock

### What's wired today — `subSignals.ts` → `caughtSubs.ts` → SubCaughtSheet

`detectRecurring` (`subSignals.ts:240`, described in phase ②) already classifies
weekly/fortnightly/monthly/quarterly/yearly cadence generically. `findCaughtSubs`
(`caughtSubs.ts:131`) filters that down to `status === 'series' && cadence ===
'monthly'` **only** (`SHEET_CADENCE = 'monthly'` at line 48), and excludes
merchants already in the sub catalog. `useCaughtSubs` (`caughtSubs.ts:162`) wires
it live off `useAppStore(transactions, subs)`, feeding `SubCaughtSheet.tsx`.

**Weekly/fortnightly/quarterly/yearly detection already exists in the engine but
is thrown away at the sheet boundary** — `SHEET_CADENCE` hardcodes `'monthly'`,
so e.g. a weekly-charged subscription is detected by `detectRecurring` but
silently dropped by `findCaughtSubs`'s filter. **This is a one-line-constraint
fix**, not a build-from-scratch problem. But today it only ever suggests
*subscriptions*, never *bills* or *income*, and only sources from already-
confirmed transactions, never candidates sitting in Review.

### Build plan

**A. Un-hardcode `SHEET_CADENCE`.** Widen `findCaughtSubs`'s filter to accept
weekly/fortnightly cadences alongside monthly. Cheapest fix in the whole
program; do this first within phase ⑤.

**B. New `caughtBills.ts`**, mirroring `caughtSubs.ts` line-for-line, running the
same `detectRecurring` engine but: (a) not filtered to `cadence === 'monthly'`
only, (b) excluding by bill-catalog (`Bill` type in `melo-engine/safeZone.ts`,
reference only) membership instead of sub-catalog, (c) surfacing as a "this
looks like a recurring bill" prompt analogous to `SubCaughtSheet`. Hook: new
file `apps/mobile/src/folio/lib/caughtBills.ts`, feeding a new `BillCaughtSheet`
(or extend `SubCaughtSheet` to a shared "recurring payment caught" sheet with a
bill/sub toggle).

**C. Auto-suggest discipline — replicate, don't invent.** `SubCaughtSheet`'s
pattern (candidate surfaced, user confirms/dismisses, never auto-added) is the
template for (B) and for income candidates from phase ②. The honesty discipline
(`RecurringSignal` structurally cannot carry a "cancel"/"waste" verdict,
`subSignals.ts:70-94`) carries over: a detected bill candidate carries cadence +
amount + occurrences only, never a "you don't need this" judgment.

### Duplicate-detector cleanup (do during this phase, not after)

`apps/mobile/src/local/recurringChargeDetection.ts:46`
(`detectRecurringChargeCandidate`) is a second, simpler, monthly-only
implementation (`MIN_MONTHLY_GAP_DAYS`/`MAX_MONTHLY_GAP_DAYS`, lines 33-34),
single-best-candidate return, feeding
`apps/mobile/src/surfaces/pressureMap/sheets/subCaught.tsx` and
`apps/mobile/src/folio/sheets/SubCaughtSheet.tsx`. Two competing
implementations of the same heuristic with different tuning constants (±10% vs
±15%, 3 vs varying min-occurrences). Confirm whether `pressureMap` (legacy
surface) still ships before deciding which detector survives — resolve this
before extending either further in phase ⑤/⑥.

### File:line hooks (phase ⑤)

```
apps/mobile/src/folio/lib/subSignals.ts           70-94 (RecurringSignal — no cancel/waste verdict, honesty discipline), 240 (detectRecurring)
apps/mobile/src/folio/lib/caughtSubs.ts           48 (SHEET_CADENCE hardcode), 131 (findCaughtSubs filter), 162 (useCaughtSubs live wiring)
apps/mobile/src/folio/sheets/SubCaughtSheet.tsx   template to mirror/extend
apps/mobile/src/local/recurringChargeDetection.ts 33-34 (MIN/MAX_MONTHLY_GAP_DAYS), 46 (detectRecurringChargeCandidate), 129 (median calc, reused in phase ⑥ bill-drift)
apps/mobile/src/surfaces/pressureMap/sheets/subCaught.tsx  consumer of the duplicate detector — confirm live/dead before consolidating
packages/melo-engine/src/safeZone.ts              Bill type + BillKind (reference only; 'bnpl' kind already reserved, unpopulated — see phase ⑥ item 5)
```

---

## 7. PHASE ⑥ — History-fed forecasts

### What predictions exist today — all single-cycle, current-snapshot only

None reads multi-cycle history. Confirmed via grep: `percentile` returns **zero
hits** across `apps/mobile/src` and `packages` — the owner's reference to
"irregular mode's percentile math" describes a feature that does not exist yet.

- **`buildForecast`** (`packages/finance-engine/src/index.ts:158`) — given
  current balances + known future `occurrences`/`expectations`, walks forward
  to closing balance/lowest point/income+spend totals. Entirely forward-looking;
  nothing about past cycles informs it.
- **`calculateScenarioOutflowBoundary`/`runScenario`** (same file, 284-335) —
  binary-search/what-if variants of the same forward-only forecast. No history.
- **`irregularStrategy.derive`** (`irregular.ts:24`) — runway =
  `available / weeklyBills`, `weeklyBills` from active subs due in next 30 days
  only, `Math.max(20, upcoming/4.33)` floor. No income-volatility measurement.
- **`detectRecurringChargeCandidate`** (`recurringChargeDetection.ts:46`) — does
  look across the full transaction list unwindowed, requiring ≥3 occurrences,
  ±10% tolerance, 25-35 day spacing. Produces a single subscription-catch
  suggestion, not a general "expected next charge" prediction.
- **`melo-engine`** equivalents (`dangerDate.ts:22` `projectDangerDate`,
  `spend.ts:25` `observedRunRatePence` — hardcoded 7-day trailing window,
  `safeZone.ts:60` `computeSafeZone`) — unwired dead code; even they only use a
  7-day window, never 6-18 months.

### What history unlocks — named functions, ranked

1. **`irregularStrategy.derive`** (`irregular.ts:24`) — replace the fixed
   `Math.max(20, upcoming/4.33)` floor with p10/p50 of trailing monthly income
   deposits from history. **Single highest-value history hook in the codebase**
   — directly answers "what if paid weekly," since irregular/weekly earners are
   exactly this mode's target and it currently has zero income-shape awareness.
2. **`buildForecast`** (`finance-engine/src/index.ts:158`) — add
   `historicalMonthlySpend: readonly ForecastOccurrence[]` (or a summarized
   seasonal baseline) so unscheduled/discretionary spend projects from trailing
   averages instead of an implicit zero between now and the next known bill.
   This is what would let danger-date-style projections exist in the real
   stack — today only *known* future outflows count.
3. **`detectRecurringChargeCandidate`** (`recurringChargeDetection.ts:46`) —
   add a bill-drift detector: for merchants already confirmed as bills/subs,
   compare latest amount against the trailing median (function already computes
   `median` at line 129) and flag deviations >X%. Small delta on an existing
   function; feed it `history` explicitly (currently unwindowed, whatever's in
   the live ledger) and output "expected £X, charged £Y."
4. **`payday.ts`'s `resolvePayday`** (`payday.ts:136`) — currently trusts a
   single user-entered `dayOfMonth`. With history, an
   `inferPaydayFromDeposits(history)` companion function becomes possible (this
   is the phase ② output feeding back here) — new function fed by history, not
   a modification. Directly targets "understand what payments are automatic."
5. **`OnboardingSheet`'s `MODE_EXTRA` capture**
   (`OnboardingSheet.tsx:116-217`) — every mode-extra field (buffer thin-point,
   comfort line, debt owed, etc.) is a one-time hand-entered guess, copy
   literally reading "Captured for when X mode ships fully" (lines 145, 155,
   165, 175, 185, 195, 205, 215). Once history exists, these guessed numbers
   should be silently upgraded by observed behavior (e.g. essentials/day derived
   from confirmed spend, not a slider guess). Clearest "every upload compounds"
   moment; currently no mechanism exists to revisit a guessed value.

### Overlooked sweep — additional items, ranked (compounding report AXIS 4.3)

1. **Payday cadence inference** — folded into phase ① + ②; listed here as the
   critical-value anchor for everything else in this phase.
2. **Balance reconstruction/verification from statement running balances** —
   value: high (trust/accuracy moat). Effort: S — infrastructure already exists
   unused: `import-engine/src/index.ts` already parses
   `runningBalanceText`/`runningBalance` per row (lines 118, 131, 189), has
   `reconcileImportedBalances` (lines 707, 783) plus opening/closing balance
   tracking. `packages/storage`'s canonical schema already has dedicated
   `BalanceObservation` and `AvailablePositionSnapshot` entity tables
   (`canonical-repository.ts:43,46,79,82`) sitting empty/unused. Hook: populate
   those tables on each import; expose a "does Folio's tracked balance match
   your statement's running balance" drift-alert. Provenance the codebase was
   built to support and never finished wiring.
3. **Duplicate-account/duplicate-import detection** — value: high (data
   integrity; overlapping-month re-upload silently doubles spend). Effort: M.
   `LocalLedgerTransaction` has no cross-statement fingerprint;
   `provenanceHash`/`sourceDocumentId` fields exist (`localLedger.ts:52,57`) but
   nothing diffs a new import's date-range+total against existing
   `sourceRecords`. Hook: `statementIntake.ts`'s `readAddedStatement` result
   path — run an overlap check before staging.
4. **Spending-category baselines → "unusual month" framing** — value: high
   (flagship "you spent 40% more on X" moment). Effort: M.
   `Transaction.category` exists but nothing aggregates trailing months per
   category. Hook: new pure function
   `categoryBaselines(history, category) -> {p50, thisMonth}` feeding
   `moneyMode.ts`/mode copy and Melo chat context (`chatContext.ts`).
5. **BNPL/debt detection** (Klarna/Clearpay/etc.) — value: medium-high (safety-
   relevant; `safeZone.ts:11`'s `BillKind` already reserves a `'bnpl'` kind,
   unpopulated). Effort: S — `detectBills`-style merchant grouping in
   `statement.ts:330` (unwired reference) already has the pattern; port into
   `recurringChargeDetection.ts` with a merchant-name allowlist (Klarna,
   Clearpay, Laybuy, PayPal Pay in 3).
6. **Subscription price-rise alerts** — value: medium, same mechanism as
   bill-drift (item 3 above), scoped to `Sub` rows. Effort: S once bill-drift
   lands.
7. **Gateway cost/privacy budget per upload** — value: medium (cost control,
   not prediction). Effort: S. `statementIntake.ts`/`statementExtraction.ts`
   call a multimodal AI reader per upload with no visible token/cost accounting
   layer (`statementIntake.ts:83-130`).
8. **Cold-start-to-compounding moat narrative** ("N statements uploaded, here's
   what sharpened") — value: medium (retention/story). Effort: S, mostly copy +
   a counter — no engine to hook into until items 1-5 above exist (nothing
   currently tracks "this onboarding guess was later corrected by real data").
   Natural user-facing wrapper once phase ⑥ items land; no standalone value.

### File:line hooks (phase ⑥)

```
packages/finance-engine/src/index.ts                     158 (buildForecast), 284-335 (calculateScenarioOutflowBoundary/runScenario)
apps/mobile/src/folio/lib/modes/strategies/irregular.ts   24 (derive — target for p10/p50 income-volatility replacement)
apps/mobile/src/local/recurringChargeDetection.ts         46 (detectRecurringChargeCandidate), 129 (median calc — bill-drift hook)
apps/mobile/src/folio/lib/payday.ts                       136 (resolvePayday — inferPaydayFromDeposits(history) companion target)
apps/mobile/src/folio/sheets/OnboardingSheet.tsx          116-217 (MODE_EXTRA fields), 145,155,165,175,185,195,205,215 (explicit "not shipped" copy lines)
packages/import-engine/src/index.ts                       118,131,189 (runningBalanceText/runningBalance parsing), 707,783 (reconcileImportedBalances)
packages/storage (canonical-repository.ts)                43,46,79,82 (BalanceObservation, AvailablePositionSnapshot tables — empty/unused)
apps/mobile/src/local/localLedger.ts                       52,57 (provenanceHash, sourceDocumentId — exist, unused for dup-import diffing)
apps/mobile/src/local/statementIntake.ts                   readAddedStatement (overlap-check hook), 83-130 (per-upload AI reader, no cost accounting)
packages/melo-engine/src/safeZone.ts                       11 (BillKind, 'bnpl' reserved unpopulated)
packages/melo-engine/src/statement.ts                      330 (detectBills merchant grouping, reference for BNPL allowlist port)
apps/mobile/src/folio/store.ts                             Transaction.category (existing field, target for categoryBaselines consumer)
chatContext.ts                                             target consumer for categoryBaselines output
```

---

## 8. Status Log (append-only — add newest entry at bottom)

**2026-07-05 — Phase ① launched.**
Owner directive received: "go with 1, do them all in order." Program document
(this file) written from the 4-analyst audit
(`w937zlscq.output`: income-rhythm, auto-detection, historic-backfill,
compounding). Decision recorded: live folio spine is the only work target;
`melo-engine`/`finance-engine`/`today-engine`/`calendar-engine`/`import-engine`/
`storage` stay reference-only pending a deliberate consolidation pass. Phase ①
(income-source cadence model) begins execution next session against
`store.ts` Onboarding type, `payday.ts`, `calendarEvents.ts`,
`storeRoute.ts`, `lens.ts`, `OnboardingSheet.tsx`.
- 07-05/06: PHASE 1 SHIPPED + OTA'd (income cadence model, 1057 tests). Discovery hardening: weekend shift for week-based paydays, ritual once/calendar-month, trial 21-day floor. Discovery lesson: run discovery AFTER verify (raced the build lanes, one stale false positive). Phase 2 (salary inference) launched.
- 07-06: PHASE 2 SHIPPED + OTA'd (salary inference, 1094 tests). Discovery: CRITICAL double-count fixed pre-ship (same-income update-not-append); drift re-check folded into phase 6 scope; benefits-as-income = correct behavior, copy nuance noted. Machine restart mid-phase: workflow journal resume worked (cached lanes replayed, 92s). Phase 3 (merchant memory) launched.
- 07-06: PHASE 3 SHIPPED + OTA'd (merchant memory + flip-threshold hardening, 1136 tests). Discovery: taxonomy-mismatch worry disproven by trace; export/wipe already correct; fuzzy merchant aliasing logged as future enhancement.
