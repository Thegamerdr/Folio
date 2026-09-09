# Debt payment correction evidence

Source baseline: `ce2fdcebad15996a04fe3fa47cd504ad28ebba9e`. No commits, builds, installations or remote mutations were performed by this worker.

## Root cause and invariant

The old payment creator reduced the cash account, debt and linked liability, but saved an ordinary unmarked transaction. The normal editor and deletion path only reversed transactions explicitly marked as live cash postings, so debt-payment edits changed the ledger amount without changing its original money effects.

New payments carry a canonical `FinancialAction` of `debt-payment`. It records the debt id, actual principal reduction in integer pence, original available principal, linked liability effects when present, and a durable posting order. Current cash already includes the posting. An edit reverses the prior recorded effects and applies the replacement exactly once. Deletion reverses the current effects; deletion undo restores the original posting and replays affected later principal caps. The selected row alone changes cash. Subsequent capped payments have their actual principal effects recalculated and persisted together, so their later deletion remains correct. Historical principal ceilings preserve unrelated manual debt adjustments. No display-specific overrides were added.

The monotonic posting counter is stored in the exact encrypted workspace partition, including when its last payment is deleted. Transaction markers round-trip through the existing canonical domain/SQLite projection. Metadata-only edits never replay money effects.

## Exact reproduction

Fixture B on 9 September 2026: cash £1,800, debt £320, minimum £80 due 18 September, rent/bills £950 due 12 September, monthly payday 28, essentials £70/week, buffer £200.

| Operation | Baseline actual | Corrected actual |
|---|---|---|
| Record £40 | £1,760 cash / £280 debt / £340 safe | Same |
| Correct £40 to £100 | £1,760 cash / £280 debt / £340 safe | **£1,700 cash / £220 debt / £280 safe** |
| Record £100 directly | £1,700 cash / £220 debt / £280 safe | Same |
| Delete edited payment | £1,760 cash / £280 debt / £340 safe | **£1,800 cash / £320 debt / £380 safe** |
| Undo deletion | Baseline already failed before this assertion | £1,700 cash / £220 debt / £280 safe |

The initial two regression tests failed against the unchanged baseline with the exact values above (14:05 local execution). They passed after the implementation.

## Validation

`debtPaymentLedger.test.ts`: 15 deterministic tests cover the exact fixture, direct versus corrected payment, repeated amount increases/decreases with pence, no-op edits, change of linked debt and liability account, creation undo, edit undo, delete/restore idempotency, invalid atomic rejection, overpayments, later independent cash entries, legacy uncertainty, blob hydration, canonical projection, downstream capped payment replay, and deletion/restart/new-payment/restoration ordering.

Independent reviewer added `lib/debtPaymentLedger.model.test.ts`: two conservation-model tests covering multiple capped payments with create/edit/delete/restore sequences.

At the final focused run, **396 tests passed across nine files**: the 15 ledger regressions, two independent model tests, store (264), native persistence recovery (54), canonical read projection (9), edit engine (19), edit sheet save (7), Melo finance tools (5), and release behavior matrix (21). Expected stderr from injected storage failures in recovery tests does not represent a run failure. Parent release verification performs the broad final test run and native verification.

## Files

- `apps/mobile/src/folio/lib/debtPaymentLedger.ts`: pure reversible transition and later-payment replay.
- `apps/mobile/src/folio/store.ts`: canonical create/edit/delete/restore; durable sequence; validation; also coordinated obligation fields, anchors, pause semantics and schedule hooks.
- `packages/domain/src/index.ts`: canonical payment action metadata and debt-id correction field (also contains obligation agent's metadata additions).
- `apps/mobile/src/folio/lib/editTxn.ts`: auditable linked-debt correction.
- `apps/mobile/src/folio/sheets/EditTxnSheet.tsx`: existing editor retains its fields and adds linked-debt selection for actual debt payments.
- `apps/mobile/src/folio/screens/today/TodayRecentTxns.tsx`: removal/restoration failures surface a readable alert.
- `apps/mobile/src/folio/lib/appStateAuthorityManifest.ts` and its test: exact encrypted authority for the monotonic counter.
- `apps/mobile/src/folio/debtPaymentLedger.test.ts` plus independent `lib/debtPaymentLedger.model.test.ts`.

## Limits

The unsafe release stored no structural effects for its older debt-payment rows, and its durable command history contains checksums rather than recoverable before/after balances. Merchant labels cannot prove the original debt or capped principal reduction. Such legacy monetary edits and deletion are blocked without mutating money; the UI tells the user to retain the history and explicitly confirm current cash in Accounts and outstanding balance in Debts. Nonmonetary history edits remain available. New payments on the replacement build support the complete reversible path. There is no speculative migration of unknown historical amounts.

An extra debt payment does not implicitly settle a scheduled minimum; this preserves Fixture B's £280 safe result. Minimum resolution is a separate explicit obligation action. Actual payments greater than outstanding debt reduce cash by the amount paid and clamp principal to zero; refund/credit treatment of any excess remains a separate real-world action.

Native device results, signed APK details, final Git SHAs and release recommendation belong to the parent correction report; this file does not claim source tests are device evidence.

## Follow-up audit of the visible payment sheet

Root identified an additional reachable entry point after the first candidate was built: Today → LogPaymentSheet called the older `logDebtPayment` API, which reduced debt without posting cash or a transaction. A new regression failed before the correction: logging £40 through that API returned **£1,800 cash / £280 debt / £380 safe**, rather than £1,760 / £280 / £340.

`logDebtPayment` now delegates to the same canonical payment command as the confirmed Melo route. The payment sheet checks whether the operation succeeded, uses its exact scoped undo, and offers a paying-account selection when more than one active cash account exists. Its overpayment copy now states that the full payment leaves cash while principal is capped. The regression proves the visible API creates an editable transaction; correcting it to £100 returns **£1,700 / £220 / £280**, and deletion returns **£1,800 / £320 / £380**. Additional tests cover full cash reversal on overpayment and ambiguous versus selected cash accounts.

The call-site audit also found `payCreditCardFromBank`, referenced only by tests, with its own non-ledger arithmetic. That API now delegates through the same canonical payment for its linked debt. The old `undoDebtPayment` API can only reverse one unambiguous recorded principal effect; it cannot invent a balance increase. Updated existing tests replace the unsafe contracts that previously required cash to stay untouched and allowed arbitrary undo amounts.

After this follow-up, **317 tests across six files passed**, including **18 targeted ledger regressions** and two independent model tests. Mobile typecheck passed. The changed files are store.ts, LogPaymentSheet.tsx, debtPaymentLedger.test.ts, store.test.ts and typedCommandBridge.wiring.test.ts. The first candidate APK is superseded and must be rebuilt before release acceptance.
