# Phase E.1 material-change writer matrix

Canonical capture seam: `beginMaterialWrite` / `completeMaterialWrite` in `apps/mobile/src/folio/store.ts`

User-facing rows: `MaterialChangeCard` in `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`

## Capture rule

For eligible Personal writes, the store captures:

1. pre-write Trusted Safe Range snapshot;
2. authorised mutation;
3. post-write Trusted Safe Range snapshot;
4. deterministic materiality;
5. primary cause;
6. affected Decision Ledger entries;
7. idempotent `MaterialFinancialChange` row.

Cold-load hydration is not a restore. Explicit user backup restore uses `restoreBackupFromBlob`.

## Writer coverage

| Approved writer                      | RN path inspected                                                                     | Phase E.1 status                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Transaction add                      | `addTransaction`                                                                      | Wired                                                                                   |
| Transaction edit                     | `editTransaction`                                                                     | Wired, correction impact recorded                                                       |
| Transaction remove                   | `removeTransaction`                                                                   | Wired                                                                                   |
| Current balance correction           | `setCurrentBalance`, `setAccountBalance`                                              | Wired                                                                                   |
| Income add/edit/remove               | `setIncomeSources`, `upsertIncomeSource`, `removeIncomeSource`, income transactions   | Wired                                                                                   |
| Bill add/edit/remove                 | recurring obligations through subs/calendar paths                                     | Wired where current RN stores bills                                                     |
| Bill date shift                      | `nudgeSub`, `resetSubOverrides`                                                       | Wired                                                                                   |
| Subscription add/pause/resume/remove | `setSubs`, `togglePaused`, `pauseMany`, `removeSub`, `restoreSub`                     | Wired                                                                                   |
| Debt add/edit/payment                | `addDebt`, `removeDebt`, `logDebtPayment`, `undoDebtPayment`, `payCreditCardFromBank` | Wired                                                                                   |
| Pot contribution                     | `addToPot`                                                                            | Wired                                                                                   |
| Pot borrow/repay                     | `borrowFromPot`, `repayToPot`                                                         | Wired                                                                                   |
| What If hold commit/remove           | `addWhatIfHold`, `removeWhatIfHold`, `clearWhatIfHolds`                               | Wired                                                                                   |
| Recovery hold                        | `setSpendHold`, recovery bundle suppresses per-move receipt                           | Wired                                                                                   |
| Statement review acceptance          | `addTransactionsBatch`, review acceptance paths                                       | Wired through batch transaction/review writes                                           |
| Duplicate/reconciliation resolution  | review ignore/resolve paths and transaction edit/remove                               | Partial; capture attached to financial consequences, not every cosmetic queue operation |
| Backup restore                       | `restoreBackupFromBlob`, `applyRestore`                                               | Wired; relaunch hydration does not duplicate                                            |
| Provider freshness changes           | `deleteBankImportedHistory`, provider stale type                                      | Partial; explicit stale-provider event remains bounded to current provider paths        |
| Payday cycle close                   | `addCycle`, Payday Ritual receipt path                                                | Wired                                                                                   |
| Confirmed Melo material tool actions | `applyMeloTool` via transaction/decision writers                                      | Wired through underlying confirmed tool actions                                         |

## Transitional non-atomic paths

- The financial write and material-change record are currently adjacent synchronous store publishes, not a single SQL transaction.
- If recording the material-change row fails, `recordCriticalJourneyContinuity` writes a recoverable blocker instead of failing silently.
- Sample/demo baseline writes do not start capture unless review-required or forced, because no trustworthy previous Safe Range exists.
