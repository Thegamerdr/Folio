# Financial behavior coverage

This matrix maps the brief's exact 30 required cases to focused assertions in the authoritative branch. “Partial” means the available assertion does not exercise the requested behavior exactly. The final core/adapter edge run passed 18/18; its machine-readable result is `financial-plan-focused-results.json`. Other focused runs and their counts are recorded in `RELEASE_REPORT.md`. Counts from overlapping runs must not be added together as distinct tests.

The compact fixtures are dated as follows:

- Fixture A: £1,000 current balance; receipts on 11 and 18 September; minimums of £50 due 10 September, £60 due 16 September, and £70 due 20 September; transport, insurance, and food obligations; £150 buffer. Safe-to-spend before the 11 September receipt is £800. A £300 one-off is affordable; a £120 unexpected outflow leaves £680.
- Fixture B core: £1,800 current balance; £950 rent and bills on 12 September; £190 essentials on 24 September; two known debts with £60 due 18 September and £20 due 20 September; £200 buffer; £1,800 receipt on 28 September. Safe-to-spend is £380. The AppState/native B adapter retains its single Klarna payment fixture for payment-flow coverage while preserving the same £80 total minimum.
- Fixture C: £700 current balance; receipts on 14 and 25 September; £250 childcare on 12 September and £120 food on 13 September; £100 buffer. Safe-to-spend before the first receipt is £230.

| # | Required behavioral case | Exact assertion / test | Result |
|---:|---|---|---|
| 1 | Enough cash and safe extra debt payment | apps/mobile/src/folio/lib/meloCalculations.test.ts — “requires a neutral debt order before modelling an extra, then uses the selected rule” asserts a validated extra and safe-after figure | PASS |
| 2 | Bank balance appears high but most money is committed | Core/adapter Fixture B tests assert £1,800 current cash but only £380 safe-to-spend after rent, essentials, minimum, and buffer | PASS |
| 3 | Insufficient money before payday | packages/finance-engine/test/financialPlan.test.ts — “reports the first shortage and its dated cause” | PASS |
| 4 | Unexpected expense after plan creation | Core test — “recalculates after an unexpected spend, buffer change, and unsafe affordability request” asserts £380 → £260; the live default-account lifecycle also verifies a real £120 spend changes cash/safe-to-spend £1,800/£380 → £1,680/£260 | PASS |
| 5 | Income lower than expected | apps/mobile/src/folio/meloReleaseBehaviorMatrix.test.ts — “corrects a lower actual receipt and projects the changed confirmed transaction” | PASS |
| 6 | Income higher than expected | Release matrix — “corrects a higher actual receipt without changing forecast-only income state” | PASS |
| 7 | Bundled housing/bills payment | Fixture B and release matrix — “saves a new dated bill and exposes it through the canonical adapter”; proposal parsing accepts “rent and bills” and target normalization matches the stored `Rent + bills` row | PASS |
| 8 | No car/transport obligation | Fixture B test title explicitly covers “no transport”; no invented transport commitment enters its plan | PASS |
| 9 | Manual debt balance correction | Release matrix — “applies a positive manual debt balance correction through the proposal and store”: Klarna £320 → £250, cash unchanged, safe-to-spend still £380 | PASS |
| 10 | Debt cleared | Release matrix — “keeps a balance-only debt closure distinct from a completed payment” | PASS |
| 11 | Minimum payment changes | Release matrix — “persists arrears and minimum-payment corrections” | PASS |
| 12 | Variable income | Core Fixture A — “handles weekly variable income and separately dated obligations” | PASS |
| 13 | One-off bonus | Release matrix — “corrects a higher actual receipt…” uses a transaction named bonus; no bonus forecast recurrence is inferred | PASS |
| 14 | Refund | Release matrix — “preserves real refund pairing without inventing a second cash event” | PASS |
| 15 | New bill | Release matrix — “saves a new dated bill and exposes it through the canonical adapter” | PASS |
| 16 | Cancelled bill | Release matrix — “cancels an existing bill through the store and removes its projected subscription”; rent-pause routing remains an explicit reversible subscription action | PASS |
| 17 | APR known | apps/mobile/src/folio/lib/meloCalculations.test.ts — “projects recorded debt minimums without exposing debt rows or names”; known 0% BNPL schedule is also asserted | PASS |
| 18 | APR unknown | packages/finance-engine/test/financialPlan.test.ts — “keeps unknown APR explicit and does not promise a payoff date or interest total” | PASS |
| 19 | 0% promotional debt | Release matrix — “preserves unknown APR and promotion expiry as explicit debt metadata”; core regression — “keeps debt due dates, promo uncertainty, and extra-payment cascade explicit” asserts missing post-promo rate stays unknown | PASS |
| 20 | Overdue/arrears obligation | Release matrix persists arrears; core regression “reserves an overdue commitment today and caps a minimum at remaining balance” asserts overdue reservation | PASS |
| 21 | Buffer reduced | Release matrix — “handles zero, upward and downward buffer changes with pence preserved” | PASS |
| 22 | Buffer increased | Same release-matrix assertion covers upward buffer change | PASS |
| 23 | £0 optional buffer by explicit choice | Release matrix — “handles zero, upward and downward buffer changes with pence preserved” asserts zero | PASS |
| 24 | Proposed extra payment that is unsafe | Core Fixture B affordability assertion rejects £400 with −£20 after-payment safe-to-spend; proposal tests keep questions unwritten | PASS |
| 25 | Safe extra payment | Fixture A asserts a £300 one-off is affordable; selected monthly extra is asserted in meloCalculations.test.ts | PASS |
| 26 | Debt cascade after payoff | Core — “rolls freed minimums into the selected cascade order” | PASS |
| 27 | Different prioritisation strategies | Core regression “honors explicit priority, promotional, and user-selected debt strategies” plus existing highest-rate-first and snowball assertions | PASS |
| 28 | User rejects recommendation | Release matrix — “leaves a rejected debt recommendation untouched, then applies the user-edited payment”: “Never mind” returns cancel; accounts, debts and transactions stay unchanged, safe-to-spend remains £380 | PASS |
| 29 | User manually changes proposed payment | Same release-matrix test changes the proposed completed payment from £40 to £25 before applying it: debt £295, ledger −£25, safe-to-spend £355 | PASS |
| 30 | Safe-to-spend recalculates after each change | Fixed-date `safeMinor()` assertions run after receipt corrections, bill changes/cancellation, buffer changes, debt payment/undo/closure/correction, refund and rejected/edited proposals. Core A/B/C, affordability and strategy assertions cover the remaining simulations | PASS |

## Additional finance-engine regression coverage

Final store/proposal matrix: **21/21 passed**, recorded in `melo-release-behavior-matrix-final.json`.
Examples include lower actual receipt → £7 safe; higher receipt → £530; new £35 bill → £345;
£95 minimum → £365; zero buffer → £580; a completed £400 payment that closes Klarna → £60;
undo → £380; balance-only closure → £460; and an edited £25 payment → £355. These are fixed
synthetic scenario assertions, not advice or figures for the owner's accounts.

These are focused engine/adapter edge regressions beyond the exact required cases above:

| Edge | Exact assertion / test | Result |
|---|---|---|
| Overdue bill reserved at asOf and capped minimum | packages/finance-engine/test/financialPlan.test.ts — “reserves an overdue commitment today and caps a minimum at remaining balance” | PASS |
| Day-31 monthly clamp and weekly recurring outflows | apps/mobile/src/folio/lib/financialPlan.test.ts — “uses corrected active cash once and keeps weekly/monthly renewal dates anchored” | PASS |
| Unknown post-promo rate | Core — “keeps debt due dates, promo uncertainty, and extra-payment cascade explicit” | PASS |
| Current balance/no replay and closed accounts | Adapter — “uses corrected active cash once and keeps weekly/monthly renewal dates anchored” | PASS |
| Distinct debt due dates and extra cascade | Core — “keeps debt due dates, promo uncertainty, and extra-payment cascade explicit” | PASS |

Additional exact support assertions are present in apps/mobile/src/folio/meloFinanceTools.test.ts (“records a completed debt payment against debt, cash and the ledger, with scoped undo”; “rejects an ambiguous debt target and protects against stale undo”; “persists pence and converts non-weekly essentials into the weekly engine input”; “updates an existing recurring commitment without changing its cadence”) and apps/mobile/src/local/financeProposal.test.ts (“proposes a named debt payment without writing it”; “keeps questions and income variance away from a false ledger inflow”; “asks for the clearance distinction before proposing a balance write”).

## Late cash-posting and conversation follow-up

The original 30-case mapping above remains intact. Additional focused evidence passed **20/20**
in `cash-posting-review-tests.json` and **1/1** in `live-cash-lifecycle-tests.json`. The real
default-account lifecycle verified £120 spend → £1,800/£380 to £1,680/£260, a £100 edit surviving
blob hydration, removal restoring £1,800/£380, and durable `financialAction` round-tripping
through canonical projection. `cash-posting-typecheck.txt` records the updated mobile cash-posting
type check.

The late 0fc4a6f2 native exercise found stale £380 after the real spend. Follow-up source work
adds the durable cash-posting path, rent-pause routing, bundled “rent and bills” grammar
proposal, and confirmation error handling. The signed handoff APK and native acceptance passed; see RELEASE_REPORT.md and DEVICE_ACCEPTANCE.md.
