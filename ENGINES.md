# ENGINES.md — Folio V2 engine-behaviour decisions

> **Updated 2026-06-30 (evening) — commits eb6e0a0/3783c9c/a3f81c9.** Faithful-port engine work
> landed the route/pressure/calendar contracts D1 and D5 lean on: real route totals + derived Melo
> pressure replace the hardcoded Today figures, and the demo bill/tax seed is now gated behind the
> `sample` regime. See the implementation note below and the per-decision impl notes on D1 and D5.

> Status: decision spec, not an implementation patch. It records resolved engine-level product
> decisions so they stop living as open questions.
>
> Authority (highest first): owner testing on a real build → `FOLIO_V2_PRODUCT_UX_DECISION.md` →
> review-before-truth → local-first / private-by-default → this file. Where this file and a higher
> authority disagree, the higher authority wins; raise the conflict rather than silently diverge.
>
> Companion registers: `docs/source-package/27_DECISION_LOG_AND_OPEN_SIGNOFFS.md` (decision /
> open-signoff register) and `tooling/config/release-blockers.json` (native/release gate). The eight
> decisions below were product-decision blockers, not native blockers, so they are recorded here and
> in `27_DECISION_LOG`, not in `release-blockers.json`.
>
> Implementation note (2026-06-30 evening, commits eb6e0a0/3783c9c/a3f81c9 on the
> `apps/mobile/src/folio/` faithful-port surface): the faithful-port engines now expose the
> route/pressure/calendar contracts these decisions rely on. App-wide Melo pressure is derived from
> the real route via `derivePressure(tightSpare)`
> (`apps/mobile/src/folio/screens/today/pressure.ts`), so an empty/cleared app stays neutral.
> `RouteResult.incomingTotal` / `RouteResult.outgoingTotal`
> (`apps/mobile/src/folio/lib/moneyPath.ts`, populated in `storeRoute.ts`) feed the Today summary
> trio from real route totals instead of hardcoded figures (D1). And `deriveCalendarEvents(...)`
> (`apps/mobile/src/folio/lib/calendarEvents.ts`) takes an `includeSampleBills` param that gates the
> demo `RECURRING_BILLS` and example review/tax rows behind the demo regime
> (`currentBalance.source==='sample'`) — keeping fabricated outflows out of a cleared/real app, per
> invariant §2.4 "no hidden authority".

## 1. Purpose

The eight items in §6 were "red" because they were undecided, not because they were hard. Leaving
them open let stub behaviour and seed values stand in for product intent (a hardcoded £720 position,
a hardcoded Friday cadence, a stubbed edit sheet). This file fixes the intent. Implementation then
follows the §7 map; §6 is the contract the implementation and its tests must satisfy.

## 2. Invariants every decision below must preserve

These are not negotiable and no decision here weakens them:

1. **Review before truth.** Staged/waiting items never move Today, the route, the timeline, or any
   balance until the user accepts them (`FOLIO_V2_PRODUCT_UX_DECISION.md §8`, ADR-0006).
2. **Posted fact vs expectation.** An accepted item is a posted fact; a future-dated item is an
   expectation/commitment and is never relabelled into a past fact (`27_DECISION_LOG`: "Actual
   posted transaction is truth; expectations remain separate").
3. **Ownership is never paywalled.** History, export, local data, the basic Today/route, review,
   manual input, correction and start-fresh are always in the free local core (D8).
4. **No hidden authority.** Every number Today shows can name where it came from; nothing important
   is rendered from an unlabelled seed (D1).
5. **Language gate.** User-visible copy obeys `FOLIO_V2_PRODUCT_UX_DECISION.md §11` (no "canonical",
   "provenance", "source record", "manual entry", "user confirmed", scores, advice). Internal model
   field names in this file (e.g. `sourceType`, `authority`) are implementation terms and must not
   leak into the UI.

## 3. Scope guardrails

This file **encodes decisions and engine contracts.** It does not redesign UI, reopen product
scope, invent pricing, or authorise building the §16 "not yet" surfaces (Open Banking, OCR, cloud
sync, business). Decisions D6 (export) and D7 (sheet import) are recorded as **decided** and scoped
to the local core; D7 extends the already-in-scope CSV/text import path and does not add bank
connections. The two research items (§8) are research only — producing them builds nothing.

## 4. How to read each decision

Each entry has: **Decision** (what is now true) · **Model** (the engine contract) · **Acceptance**
(how we know it holds — these become tests) · **Affected code** (where it lands) · **Status**
(`decided` = recorded here + register; `impl-pending` = code/tests still to be written to satisfy
acceptance).

---

## 6. Engine decisions (D1–D8)

> Numbered §6 per the unblock brief; §5 is intentionally folded into §4 above.

### D1 — Current-position source hierarchy (no hidden hardcoded balance)

**Decision.** Today/route must never anchor to a hardcoded value such as £720. Every current
position is sourced, dated, labelled, and carries an authority state and a reviewed flag.

**Model.**
```
CurrentPosition = {
  amount: Money,                 // minor units + currency
  at: ISODateTime,               // when this position is true as-of
  sourceType:
    | 'user_entered'             // 1. guided input
    | 'statement_reviewed'       // 2. reviewed statement balance
    | 'ocr_reviewed'             // 3. OCR/PDF-derived, only after user review
    | 'corrected'                // 4. manual correction
    | 'sample',                  // 5. demo/sample seed — sample mode ONLY
  sourceLabel: string,           // short human label for the UI line
  authority: 'rough' | 'statement-derived' | 'corrected' | 'sample',
  reviewedByUser: boolean,
}
```
Resolution order when more than one exists: `statement_reviewed` > `ocr_reviewed` > `corrected` >
`user_entered` > `sample`. A `sample` position is selectable only while the app is in sample mode
and can never be promoted into real user state.

User-facing source line (approved copy): "Based on what you entered" · "From your statement" ·
"Corrected by you" · "Sample data".

**Acceptance.**
- Today/route cannot render from a hidden hardcoded balance; the rendered position always resolves
  to a `CurrentPosition` with a `sourceType` and a visible source line.
- A `sample` position cannot leak into real user state (no code path promotes `sourceType:'sample'`
  to any other value).
- Changing the current position (new entry, statement, correction) recomputes Today/route.

**Affected code.**
- `apps/mobile/src/phase4/firstMinuteFlow.ts` — `defaultQuickStartInput.availableNow: '720.00'` is a
  demo seed; it stays as a **sample** value but must flow in as `sourceType:'sample'` /
  `authority:'sample'`, never as an unlabelled anchor.
- `apps/mobile/src/phase6/shellEvidence.ts` — `phase6SyntheticPosition` (`72000`) is sample evidence;
  same labelling, sample-mode only.
- Position render path: `apps/mobile/src/surfaces/pressureMap/` (Today/`todayPath`/`MoneyPath`) +
  `apps/mobile/src/local/localLedger.ts` (`buildLocalRouteSummary`) — must read `CurrentPosition`,
  not a literal.
- Tests: `firstMinuteFlow.test.ts`, `phase6/shellEvidence.test.ts` keep the `720.00` expectations as
  *sample* assertions; **add** a test that real Today refuses to render a position without a
  `sourceType`, and that a `sample` position never resolves over real user data.

> **Impl note (2026-06-30, `eb6e0a0`):** in the `folio` surface this sample-gate is realized by the
> route builder exposing real totals — `RouteResult.incomingTotal` / `RouteResult.outgoingTotal`
> (`apps/mobile/src/folio/lib/storeRoute.ts`) — which Today's summary trio and money-path chart now
> read instead of hardcoded figures. App-wide pressure is derived from that real route via
> `derivePressure(tightSpare)` (`apps/mobile/src/folio/screens/today/pressure.ts`), gated on a real
> money picture so a cleared/empty app stays neutral. Demo data stays gated on
> `currentBalance.source === 'sample'` (the D1 `sample` authority).

**Status.** decided · impl-pending.

---

### D2 — Payday overflow and weekend policy

**Decision.** Invalid payday dates clamp to the last valid day of the month. Weekend default is the
previous working day, overridable per income source.

**Model.**
```
resolvePayday(rule: PaydayRule, month: YearMonth) -> ISODate
  // 1. clamp day-of-month to lastDayOf(month):  31 in Feb -> 28/29
  // 2. apply weekendPolicy if the clamped date falls on Sat/Sun:
  //    'previous_working_day' (default) | 'next_working_day' | 'exact_calendar_date'
PaydayRule = { dayOfMonth: 1..31, weekendPolicy, ... }
```
Public holidays are out of scope for now (future enhancement); weekends are supported and explained.

**Acceptance.**
- "Feb 31" resolves to Feb 28/29 and never silently rolls into March 3.
- The weekend shift is visible/explainable on the route, not silent.
- A user can override the weekend policy per income source.

**Affected code.**
- Payday/income scheduling used by the route — `apps/mobile/src/local/localLedger.ts` and the
  Today/route builder (and any `today-engine` package date logic). The existing `Friday`-labelled
  route strings in `surfaces/pressureMap/todayPath.tsx` and the evidence in
  `phase8/planRecoveryEvidence.ts` must not hardcode a weekday (see D5).
- Tests: add clamp cases (Jan-31 → Feb-28/29, 30th in Feb), weekend-shift cases for each policy.

**Status.** decided · impl-pending. *(Confirm the exact payday-resolution module during
implementation; it was not isolated in grounding.)*

---

### D3 — Layered undo / recovery

**Decision.** Undo is layered: an immediate undo for normal actions, time-boxed recovery for
ignored items and removed files, and a guarded, non-fake "start fresh".

**Model.**
- Normal actions (Add / Edit / Ignore / Remove): immediate undo snackbar/banner, **≥ 30s**.
- Recoverable history: ignored items recoverable **7 days**; removed files recoverable **7 days** if
  storage allows; edited items keep original source + correction history (see D4).
- Start fresh: destructive, **double confirmation**, export warning before wipe (D6), and **no fake
  undo** after a confirmed wipe.

**Acceptance.**
- Add/Edit/Ignore/Remove each have an undo or recovery path.
- An edit never destroys the original source (D4).
- Start fresh cannot happen accidentally (two explicit confirmations + export offer).

**Affected code.**
- Review/action layer: `apps/mobile/src/surfaces/pressureMap/reviewDecision.tsx`,
  `foundItems.tsx`, `Sheet.tsx`; a recovery store in `apps/mobile/src/local/`.
- Start-fresh flow: Data/privacy surface (`FOLIO_V2_PRODUCT_UX_DECISION.md §15`).

**Status.** decided · impl-pending.

---

### D4 — Real editing of existing items (no edit stub)

**Decision.** Editing an already-added item is real (the `SheetEditTxn`-equivalent must not stay a
stub). Editing creates a correction record; it never destroys the original source/extracted item.

**Model.**
Editable fields: name/description · amount · date · type (`spending` | `income` | `bill` |
`debt_payment` | `transfer` | `refund`) · note · source link (if any). An edit appends an immutable
correction entry (`{ field, from, to, at }`) and preserves the original. Today/route recompute
immediately after an edit. No duplicate counting (the edited item replaces, it does not add).

**Acceptance.**
- A user can edit an already-added item; the change reflects in Today/route immediately.
- The original source remains inspectable; an audit/correction history exists.
- No duplicate counting after an edit.

**Affected code.**
- The row/edit action sheet under `apps/mobile/src/surfaces/pressureMap/` (`reviewDecision.tsx` /
  `foundItems.tsx` — the "Edit" action behind "More" in `FOLIO_V2_PRODUCT_UX_DECISION.md §10`).
- Item model + correction history in `apps/mobile/src/local/localLedger.ts`.
- Tests: edit changes route; original preserved; correction history present; no double count.

**Status.** decided · impl-pending.

---

### D5 — Pot / protected-money top-up cadence (no hardcoded Friday)

**Decision.** No hardcoded Friday cadence. Default cadence is "after income arrives".

**Model.**
```
PotCadence =
  | 'after_each_payday'   // default
  | { weekly: Weekday }
  | { monthly: 1..31 }    // clamped per D2
  | 'custom'
  | 'one_off'
```
If no income/payday is known, ask the user; do not assume a weekday. The route explains when the
top-up happens.

**Acceptance.**
- Friday is not hardcoded anywhere a pot/protected contribution is scheduled.
- A pot contribution can attach to payday (`after_each_payday`).
- The route explains the top-up timing; the user can change cadence.

**Affected code.**
- `apps/mobile/src/surfaces/pressureMap/paydayRitualLogic.ts`, `pots.tsx`, and the "Friday dip"
  labels in `todayPath.tsx` — derive the dip label and timing from the configured cadence, not the
  literal string "Friday". (`apps/mobile/src/local/calendarEvents.ts` already documents that the V1
  static Friday seed was deliberately not ported — keep it that way.)

> **Impl note (2026-06-30, `eb6e0a0`):** in the `folio` surface the recurring-bill seed
> (`RECURRING_BILLS`: Octopus / Council Tax / Rent / BT) and the generic UK tax deadlines are now
> gated behind a demo-regime flag — `deriveCalendarEvents(...)` takes an `includeSampleBills` param
> (`apps/mobile/src/folio/lib/calendarEvents.ts`, default `true`, set from
> `currentBalance.source === 'sample'` in `storeRoute.ts`) — so a cleared/real app shows only the
> user's own outflows instead of the seeded cadence.
- Tests: `surfaces/pressureMap/paydayRitual*.test.ts` — assert label/timing follow cadence; add a
  payday-attached case and a no-income "ask the user" case.

**Status.** decided · impl-pending.

---

### D6 — Export everything (never paywalled)

**Decision.** Export is non-negotiable and always in the free local core.

**Model.** Export includes: added money items · waiting items · ignored items · files/source
metadata · notes · edits/corrections (D4) · route assumptions · payday/income rules (D2) · bill /
debt / pot rules (D5) · calendar/expectations · decisions/audit history · app settings. MVP formats:
**JSON + CSV**. Later: PDF human report, ZIP with files.

**Acceptance.**
- A user can leave Folio with their data; export lives in the free/local core and is never blocked
  by subscription (cross-checked by D8).
- Exported data is complete and understandable enough to rebuild the picture outside Folio.

**Affected code.**
- New export module in `apps/mobile/src/local/` reading from the local vault/ledger; entry point on
  the Data/privacy surface (`§15` notes "export later" — D6 promotes it to in-scope for the local
  core, still without cloud).
- Tests: round-trip completeness (every listed category present in JSON/CSV); export available with
  no entitlement.

**Status.** decided · impl-pending. *(Scope note: this is the local export contract only; it does
not enable cloud/sync, which remain §16 "not yet".)*

---

### D7 — Import from a sheet (the spreadsheet-returner wedge)

**Decision.** Yes — CSV/TSV upload and paste from Google Sheets/Excel, with an optional Folio
template. Imported sheet rows are claims, never auto-counted.

**Model.** Expected columns: date · description · amount · type · account/source · note. Flow:
sheet/paste → Folio reads what it can → "Check what Folio found" → user edits/ignores/adds → Today/
route update **only after Add**. Bad/missing columns produce honest fix prompts. No lock-in (pairs
with D6 export).

**Acceptance.**
- Imported sheet data never auto-counts (review-before-truth).
- The review visualiser handles sheet rows; the user can correct columns/types.
- Missing/bad columns produce honest fix prompts, not silent guesses.

**Affected code.**
- Extends the existing CSV/text import path: `apps/mobile/src/surfaces/pressureMap/foundItems.tsx`
  and the import/intake logic (`ownerFileIntake*`, import engine). Adds TSV + paste + column mapping.
- Tests: paste→staged (not counted); column-mapping correction; missing-column fix prompt.

**Status.** decided · impl-pending. *(In scope: this is the same review-staged import as CSV/text,
not Open Banking.)*

---

### D8 — Pricing model: never paywall ownership

**Decision.** Ownership is never paywalled. Exact price points remain a founder decision (kept
"deliberately not locked" in `27_DECISION_LOG`); the **guardrail** is locked here.

**Model.**
- **Never paywalled:** access to existing history · export (D6) · local data · basic Today/route ·
  review · manual input · correction/editing (D4) · start fresh (D3) · user-owned files/source.
- **Possible paid layers (later, when evidence exists):** encrypted sync/backup · multi-device ·
  couple/shared workspace · business/sole-trader workspace · accountant/tax export packs · advanced
  automations · optional cloud processing · premium support · advanced Melo/AI (if added).

**Acceptance.**
- Pricing cannot recreate the spreadsheet-returner churn trigger (a user never feels their history
  is hostage).
- The basic path/ritual is never behind payment.
- (Implementation seam) an entitlement check can never gate any "never paywalled" capability above.

**Affected code.** No engine code today — this is a decision + an entitlement seam constraint. The
exact free/paid mapping stays open in `27_DECISION_LOG` ("precise free/paid entitlement mapping").

**Status.** decided. *(No implementation pending — guardrail only; do not invent prices.)*
---

## 7. Affected-code & implementation map

| Decision | Primary files | Tests to add/update |
| --- | --- | --- |
| D1 position source | `phase4/firstMinuteFlow.ts`, `phase6/shellEvidence.ts`, `local/localLedger.ts`, `surfaces/pressureMap/todayPath.tsx` | label seeds as `sample`; assert no unlabelled anchor; sample never overrides real |
| D2 payday clamp/weekend | payday resolver in `local/localLedger.ts` / `today-engine` | Feb-31 clamp; weekend policies; per-income override |
| D3 layered undo | `surfaces/pressureMap/reviewDecision.tsx`, `foundItems.tsx`, `Sheet.tsx`, `local/` recovery store | 30s undo; 7-day recovery; guarded start-fresh |
| D4 real edit | `surfaces/pressureMap/reviewDecision.tsx`/`foundItems.tsx`, `local/localLedger.ts` | edit→route recompute; original preserved; no double count |
| D5 pot cadence | `surfaces/pressureMap/paydayRitualLogic.ts`, `pots.tsx`, `todayPath.tsx` | cadence-driven label/timing; payday-attached; no-income ask |
| D6 export | new `local/export*`, Data/privacy surface | round-trip completeness; no entitlement gate |
| D7 sheet import | `surfaces/pressureMap/foundItems.tsx`, `ownerFileIntake*`, import engine | paste→staged; column mapping; fix prompts |
| D8 pricing guardrail | entitlement seam only | guardrail test: ownership capabilities un-gateable |

## 8. Open items — external research only

These remain open and are *research*, not build. Deliverables (in `docs/source-package/research/`):

- **Past-dated manual events & de-dupe** → `OPEN_BANKING_DEDUPE_RESEARCH.md`. Policy seed: a manual
  item stays user-added; a similar later import is *proposed* ("This looks like something you already
  added.") with Link / Keep both / Ignore imported / Edit before linking. Never auto-merge.
- **Subscription usage decay** → `SUBSCRIPTION_SIGNAL_RESEARCH.md`. Boundary: bank data proves
  payment recurrence, not product usage; allowed vs banned claims enumerated in the doc.

## 9. Unblock status

The eight product-decision blockers (D1–D8) are **resolved and recorded** — the RN port is unblocked
at the decision level; nothing here is waiting on a founder answer except the exact price points
(D8), which were intentionally left open and do not block the port. **Technical blockers remain:**
D1–D7 carry `impl-pending` code/test work per §7. "RN PORT UNBLOCKED" is true for *decisions*; it is
not yet true for *implementation* until §7 lands and its acceptance tests pass.

> **Progress (2026-06-30 evening, commits eb6e0a0/3783c9c/a3f81c9):** on the `apps/mobile/src/folio/`
> faithful-port surface the D1 and D5 *sample/hardcoded-anchor* concerns are now satisfied — Today's
> money-path chart, summary trio and low-point tile read real route totals (`RouteResult.incomingTotal`
> / `outgoingTotal`), app-wide Melo pressure is derived from the real route (`derivePressure`), and the
> demo bill/tax cadence is gated behind the `sample` regime (`includeSampleBills` on
> `deriveCalendarEvents`). This closes the "no hidden hardcoded balance" / "no hardcoded Friday" part
> of D1/D5 for the shipping surface. It does **not** complete the full §7 acceptance-test matrix
> (clamp/weekend cases, layered-undo, real-edit history, export round-trip, sheet import), so the
> overall `impl-pending` status above still stands.
