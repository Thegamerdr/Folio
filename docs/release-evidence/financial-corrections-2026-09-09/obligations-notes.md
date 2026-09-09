# Unpaid obligations correction evidence

## Root causes and invariants

The mobile adapter called `reanchorRenewals`, which replaced an overdue subscription's due date with the next recurrence before sending it to the shared engine. Store hydration/foreground also persisted that rolled date. The engine's existing overdue test therefore could not catch the mobile loss of the unpaid occurrence. Debt minimums similarly used `nextMonthlyDay(today, dueDom)`, so yesterday's unpaid minimum became next month's schedule without evidence of payment.

The correction separates a durable first tracked occurrence from the next date used for display. Every tracked occurrence stays protected until explicitly paid, settled, cancelled, or covered by a partial payment. A resolution is keyed by the nominal occurrence date; changing a displayed bill date does not resurrect a paid cycle. Cash amounts are current balances that already include recorded payments: marking an occurrence already paid changes reserved money only and does not subtract cash a second time.

Monthly/weekly/custom-day occurrence expansion and remaining-amount calculation live in the shared finance engine. The adapter supplies explicit outstanding debt minimum occurrences, including accrued dates, while the engine caps their aggregate amount at outstanding debt principal. Changing a debt due day or minimum retains accrued dates and original amounts, then starts the new future cadence without charging a second minimum in the current cycle. Pausing skips a prospective cycle explicitly; overdue/due-today bills remain protected. Undo before the skipped date restores it, while resuming after it does not resurrect the cancelled occurrence.

## Exact before/after reproduction

Input: £1,800 current cash; £1,800 monthly salary on the 28th; £950 monthly rent/bills anchored 12 September 2026; £70 weekly essentials; £200 buffer; no debts or other commitments. Calculate on 13 September.

| Case | Unsafe release before | Corrected after |
|---|---:|---:|
| Unpaid rent, direct mobile adapter | £1,450 safe | £500 safe |
| Same unpaid rent after hydration/date roll | £1,450 safe | £500 safe |
| £80 minimum due 12 September, calculated 13 September | £0 minimum protected | £80 minimum protected |

The first three regression tests were added before modifying adapter/renewal logic and all three failed with those observed before values. After correction all three pass. The rent result reserves £950 rent + £150 essentials before payday + £200 buffer = £1,300, leaving £500.

## Files and verification

- Shared: `packages/finance-engine/src/obligations.ts`, finance-engine exports, `packages/domain/src/index.ts` occurrence metadata. Explicit debt occurrence handling in shared `financialPlan.ts` was integrated by the payday worker.
- Mobile: `lib/financialPlan.ts`, `lib/renewalMath.ts`, `lib/obligationState.ts`, `lib/canonicalStateProjection.ts`, `lib/canonicalAppStateReadProjection.ts`.
- Store hooks: persistent minimum anchors on load/create; prospective minimum schedule edits; skipped subscription cycle resolutions; local calendar-day handling for the new anchors.
- Existing UI: `screens/SubscriptionsScreen.tsx` and `sheets/AddDebtSheet.tsx` expose due occurrence confirmations, explain that cash/debt balances must already reflect payment, and offer Undo.
- Tests: 6 shared occurrence cases and 15 mobile obligation cases. Coverage includes exact reproductions, overdue cycles, distinct recurring dates, partial/paid/settled/cancelled/deleted cases, amount caps, calendar events, one-cycle pause/resume/undo, changed due days/minimums, idempotent confirmation, and canonical repository serialization/readback. Confirming an occurrence freezes its original amount, so later schedule changes cannot reduce the amount reinstated by Undo.
- A canonical roundtrip serializes/deserializes the repository snapshot, reads it at a later date, and proves that Sub/Debt/Calendar resolution metadata and safe/protected totals survive unchanged.
- Finance/domain builds passed. The focused shared finance/adapter/renewal/canonical run passed 111 tests before the final added cases. After final review, the shared/mobile obligation suite passes 21 tests and the broader obligation/store/persistence suite passes 339 tests. The release coordinator records the final complete suite and final typecheck.

## Limits and native handoff

Source and canonical roundtrip tests are not native-device verification; the release coordinator must append actual APK/device evidence. Partial payments are supported by the canonical occurrence API and tests; the new compact UI confirms the whole remaining occurrence as already paid.

An older unsafe build may already have discarded historical subscription dates. Those unknown earlier occurrences cannot be reconstructed from a rolled future date. Tracking starts from the earliest persisted subscription anchor. Legacy debt rows lacking a due-date anchor begin tracking the current month's due date conservatively; the app does not invent older arrears. Existing users must review any earlier unpaid obligations explicitly when upgrading. New records retain all future accrued occurrences durably.
