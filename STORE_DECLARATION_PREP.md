# Store Declaration Prep

Date: 2026-06-23

Do not submit store declarations from this file. This is a preparation checklist.

| Item                         | Status                     | Notes                                                                                                                  |
| ---------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| data collected               | decision needed            | Local mode currently does not require account/cloud collection; future cloud/AI/Open Banking changes must update this. |
| data stored locally          | ready for internal dogfood | Local canonical ledger and exports exist; public declaration needs binary review.                                      |
| data exported by user        | ready for internal dogfood | User export and dogfood diagnostic export are separate paths.                                                          |
| diagnostics                  | ready for internal dogfood | Dogfood diagnostics are redacted/local-only; external sharing policy needs review.                                     |
| crash logs                   | decision needed            | No production crash reporting route is declared in this pass.                                                          |
| account requirement          | not applicable yet         | No account/auth requirement for local dogfood.                                                                         |
| cloud sync status            | not applicable yet         | Cloud sync is not built in this pass.                                                                                  |
| AI usage status              | not applicable yet         | AI gateway/final runtime is not built in this pass.                                                                    |
| Open Banking status          | not applicable yet         | Open Banking is not built in this pass.                                                                                |
| subscriptions/billing status | not ready                  | Billing implementation and store credentials are intentionally absent.                                                 |
| financial advice boundary    | requires legal review      | Product boundary says clarity, not financial advice. Legal wording must approve.                                       |
| support/contact requirement  | decision needed            | Owner dogfood uses local bug template; external beta/public need official support path.                                |
| privacy policy requirement   | requires legal review      | Privacy policy URL/content not final.                                                                                  |
| SDK inventory                | not ready                  | Needs submitted-binary review before store declarations.                                                               |
| permission inventory         | not ready                  | Needs platform review against final binary.                                                                            |
| account deletion answers     | not applicable yet         | Becomes required if account creation is added.                                                                         |

## Next Store Prep Actions

1. Record final binary hash for any submitted build.
2. Compare Apple/Google privacy answers against the actual binary.
3. Review SDK and permission inventory.
4. Approve privacy policy and processor list.
5. Confirm financial advice boundary wording.
6. Keep billing and account deletion declarations blocked until those systems exist.
