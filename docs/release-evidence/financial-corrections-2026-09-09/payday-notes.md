# Payday correctness closure

## Root cause and invariant

The mobile adapter mixed an inclusive `nextIncomeDate` helper (which returns today on payday) with strictly future projected dates. The shared engine treated that explicit today value as a null boundary and did not search the future events. Independently, it credited scheduled income dated today even though current cash could already include the salary. This inflated safe spending and removed the intended next-payday protection window.

The canonical contract is now explicit:

- Account balances are the current cash snapshot and include posted movements through the as-of day, including today.
- `kind: 'actual'` cashflows dated today or earlier are history and are not replayed.
- Scheduled income dated today or earlier never increases current cash. Receipt must update the current account snapshot explicitly. This also applies to `kind: 'income'` events supplied through the cashflows input.
- A today/past explicit next-income date falls back to the first strictly future positive dated receipt. Safe spending protects dates from today inclusive to that receipt date exclusive. The boundary receipt remains visible exactly once in the forecast, but contributes no cash to the pre-income safe amount.
- Untagged cashflows retain their existing contract as explicit hypothetical changes to the snapshot. They must not be used to replay posted transaction history.

This is cadence independent. The engine uses dated occurrences for monthly, weekly, and irregular receipts; the mobile adapter's inclusive helper no longer overrides them.

## Changes

- `packages/finance-engine/src/financialPlan.ts`: documented and implemented the cash snapshot/actual/scheduled invariant; fallback to future income after a stale explicit boundary; applies income semantics through either input collection. Also implements `FinancialDebt.minimumOccurrences` requested by the obligation closure: explicitly outstanding dated minimums, duplicate date validation, chronological allocation, and no inferred additional minima when supplied. Aggregate principal caps apply only when interest is explicitly zero through the horizon; overdue/current protection is capped at current liability, while future positive/unknown-interest schedules retain declared minimums conservatively.
- `apps/mobile/src/folio/lib/financialPlan.ts` (integrated by the obligation worker): chooses only strictly future income events for the financial horizon.
- `packages/finance-engine/test/financialPlan.payday.test.ts`: 17 deterministic regressions covering exact numeric case, before/on/after monthly payday, weekly and irregular dates, confirmed actual vs unreceived scheduled pay, historical and today posted cashflows, alternate cashflow income inputs, duplicate IDs, independent receipts on the same date, hypothetical deltas, and boundary inclusion.
- `apps/mobile/src/folio/lib/financialPlan.payday.test.ts`: 6 mobile adapter regressions covering exact release case, onboarding fallback, unreceived pay, weekly owner-style income, irregular manually dated income, and route safety with income beyond the chart window.
- `apps/mobile/src/folio/lib/storeRoute.ts`: keeps its 35-day visual chart but uses the same full financial planning horizon as Today/Debts/Plan. The previous 35-day input discarded later pre-payday obligations for irregular income.
- `packages/finance-engine/test/financialPlan.minimumInterest.test.ts`: 3 regressions prevent future minimum protection ending prematurely at principal when interest is positive, unknown, or post-promo unknown.
- `apps/mobile/src/folio/lib/notifyState.test.ts`: corrected the claimed no-obligation warning fixture to explicitly clear seeded debts/income; their real minimums otherwise correctly make tiny cash negative.

## Before and after

The first 13 new assertions ran against the unchanged release engine and adapter before edits: **11 failed / 2 passed**. Both shared and mobile exact reproductions returned **160000 minor (£1,600)** where **35000 (£350)** was required. See `payday-before.txt`.

| Scenario | Before | After |
| --- | ---: | ---: |
| Sep 28, £1,800 current cash, Oct 28 next pay, £950 bills, £70/week essentials, £200 buffer | £1,600 safe | **£350 safe** |
| Same setup with £200 cash and today's salary still unreceived | £0 safe | **-£1,250 safe** |
| Sep 27, same future bills/current cash | £1,590 safe | **£1,590 safe**, next Sep 28 |
| Sep 29, stale explicit Sep 28 date | Next-income boundary null | **£360 safe**, next Oct 28 |
| Irregular Nov 17 receipt, Sep 28 as-of, £950 Nov 12 bill and same £1,800/£70/£200 inputs | Route £1,250 safe vs full plan £150 | **Both £150 safe** |

The exact fixed £350 is £1,800 - £950 - £300 (30 days of essentials) - £200. Confirmed actual salary is already in the £1,800 balance and is not added a second time.

After rebuilding finance-engine dist, all **91 tests passed** across the complete existing finance-engine tests, original mobile financial plan suite, both new payday suites, route and widget suites. Existing A/B/C, shortfall, affordability/recovery, due-date, APR, and debt cascade coverage passed. See `payday-after.txt`. `pnpm --filter @folio/finance-engine build` also passed.

These are source/test-runner results. Native APK, real-device and release evidence are owned by the coordinating release task and must be reported separately.
