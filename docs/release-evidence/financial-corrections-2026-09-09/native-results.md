# Galaxy S9 native acceptance — final Melo 0.0.4

**PASS for the scoped final native acceptance.** The coordinator installed the new signed `com.folio.v2.greenfield` APK, version 0.0.4/code 4, on the Galaxy S9. Its installed `base.apk` SHA-256 matches the delivered artifact: `967ba15e5e2e14648268db933f16d870800711b0a776dfa05cdefcb91f240f00`. APK source commit: `1d3dcdce7ca6ef7a70c865442796c717038b7be1`. See `ARTIFACT.json`, `s9-installed-apk.json` and `s9-final-install.txt`.

The synthetic manual Fixture B was entered through fresh onboarding on candidate 0.0.2, then retained through in-place upgrades to 0.0.3 and final 0.0.4. Final acceptance exercised the real app UI and persistence; it did not clear data or rerun fresh onboarding on 0.0.4. Earlier candidate captures remain under their `pre-final-*` directories and are not presented as final-build evidence.

## Exact final-build results

All 22 timestamped checks in `s9-final-assertions.jsonl` pass. Amount triples below are **cash / debt / safe-to-spend**.

| Scenario | Observed on final 0.0.4 | Evidence |
| --- | --- | --- |
| Fixture B baseline, Sep 9 | £1,800 / £320 / £380 | `s9-final-fixture-b-baseline.xml`, `s9-final-fixture-b-today.xml` |
| Manual payment £40 | £1,760 / £280 / £340; transaction posted | `s9-final-payment-created.xml`, `s9-final-payment-created.png` |
| Edit that payment to £100 | **£1,700 / £220 / £280**; ledger displays £100 | `s9-final-edit-review.xml`, `s9-final-edited-ledger.xml`, `s9-final-payment-edited.xml` |
| Corrected payment after offline restart | £1,700 / £220 / £280 unchanged | `s9-final-offline-restart.xml` |
| Offline Plan after correction | Two obligations: £950 rent/bills + £80 debt minimum = £1,030; £280 safe | `s9-final-offline-plan.xml` |
| Delete corrected payment | £1,800 / £320 / £380 | `s9-final-payment-deleted.xml` |
| Undo deletion | £1,700 / £220 / £280 restored | `s9-final-delete-undo.xml` |
| Melo proposal, confirm £40, Undo | Proposal says “Nothing changes until you confirm.” Confirmed payment leaves £280 debt; Undo restores £1,800 cash, £320 debt and £380 safe | `s9-final-melo-confirmation.xml`, `s9-final-melo-applied.xml`, `s9-final-melo-undone.xml`, `s9-final-debts-reconciled.xml` |
| Sep 13: £950 rent due Sep 12 still unpaid, debt set to £0 for isolated rent reproduction | **£500 safe**, £1,800 cash, 15 days to payday | `s9-final-overdue-rent.xml` |
| Sep 28: Sep 12 rent still unpaid and Oct 12 rent upcoming | Today £0 available / £600 projected shortfall, 30 days to next payday | `s9-final-payday-unpaid.xml` |
| Plan with those two rent cycles | Two separate £950 rows, overdue September and future October; £1,900 total and −£600 safe | `s9-final-plan-two-occurrences.xml`, `s9-final-plan-occurrence-list.xml` |
| Shortfall recovery for those two cycles | **£600 gap / £0 extra spending per day**; essentials remain included and copy states that zero extra spending does not close the gap | `s9-final-shortfall.xml` |
| What-if £40 in that shortfall | −£640; preview says the hold would not fit | `s9-final-shortfall-preview.xml` |
| Explicitly confirm September rent already paid | **£350 safe**, £1,800 cash, 30 days to next payday; no second cash deduction | `s9-final-paid-confirmation.xml`, `s9-final-payday-exact.xml` |
| Plan after that paid confirmation | One £950 October occurrence and £350 safe | `s9-final-plan-single-occurrence.xml` |
| Force-stop/no remaining PID, networks off, cold restart | 7,294 ms launch; one £950 occurrence and £350 safe retained | `s9-final-offline-cold-proof.json`, `s9-final-payday-offline-fresh.xml`, `s9-final-payday-offline-plan-fresh.xml`, `s9-final-assertions.jsonl` |

The payday £350 case has one £950 upcoming obligation and no outstanding September rent. Leaving both rent occurrences unpaid correctly produces the separate £600 shortfall; those are different states, not inconsistent outputs.

## Limits and restoration

- The already-paid confirmation's Undo toast expired before the final 0.0.4 retest. Its native Undo passed on 0.0.3 (`pre-final-0.0.3/s9-bill-paid-undo-shortfall.xml`) and source tests cover it. Payment deletion Undo and Melo payment Undo both passed on final 0.0.4.
- A future-date PNG capture limitation affected screenshot evidence. Future-date results therefore use native UI XML plus device-dated assertions; screenshots are not used to claim those states.
- Emulator supplementation was **BLOCKED by storage**. Its earlier 0.0.2 replacement install failed after cache-only trimming, and final 0.0.4 was not installed. Existing emulator profiles/data were preserved and user/settings restored; see `emulator/RESULT.md`. The real-device results above provide final-build finance acceptance.
- Original S9 settings were restored and verified in `s9-restored-settings.json`: real Sep 9 date, automatic time `1`, airplane mode `0`, Wi-Fi `1`, mobile data `1`, all three animation scales `1.0`, and stay-awake setting `7`.

These results support **GO-WITH-LIMITATIONS for fresh manual setup**, with accurate current cash/debt and explicit resolution of already-paid occurrences. Historical dates/effects discarded by older releases cannot be reconstructed; ambiguous legacy payment edits remain blocked. See `CORRECTION_REPORT.md` for complete source coverage, artifact details and release gates. Exact final local/remote Git SHAs are recorded in the delivered `GIT_HANDOFF.json`.
