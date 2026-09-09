# Native acceptance — 9 September 2026

Root inspected signed APKs on `emulator-5554`, using synthetic profile 10. Final source is `c74daf58c9c1f0c7c231d4a85c557ee60764c7d1`. Its only difference from the f13 financial QA build is the confirmation wording “received income”. The final APK also installed and launched on the Galaxy S9; no financial figures were entered on that handset.

## Actual financial sequence

All values below are pounds. Starting fixture: cash 1,800; monthly income 1,800 on Sep 28; Rent + bills 950 due Sep 12; essentials 70/week; buffer 200; Klarna 320 at known 0% APR, minimum 80 due Sep 18; no car or bank connection.

| Action, in order | Observed cash / safe-to-spend | Evidence |
| --- | --- | --- |
| Manual fixture ready | 1,800 / 380 | `final-today-380.png` |
| Log unexpected repair 120 | 1,680 / 260; Today, Plan and Debts agree | `final-today-spend260.png`, `final-plan-spend260.png`, `final-debts-spend260.png` |
| Confirm rent/bills 950 → 1,000 | 1,680 / 210; one bill, no duplicate | `final-bill-confirmation.png`, `final-bill-updated1000.png`, `final-bill-increase-safe210.png` |
| Confirm rent/bills back to 950 | 1,680 / 260 | Restored bill retained in subsequent screenshots |
| Confirm income receipt 100 from Test salary | 1,780 / 360 | `final-income-confirmation.png`, `final-income-safe360.png` |
| Home/foreground, then force-stop/restart | 1,780 / 360; cold launch 4,967 ms | `f13-restart-safe360.png` |
| Review and confirm saved repair 120 → 100 after restart | 1,800 / 380 | `f13-persisted-spend-edit-safe380.png` |
| Offline force-stop/restart | 1,800 / 380; cold launch 13,634 ms | `f13-offline-restart.png` |
| Confirm “My actual pay was 80” | Recorded receipt 100 → 80; cash 1,780 / safe 360; future income remains 1,800 | `f13-actual-pay-applied.png`, `f13-income-corrected-safe360.png` |
| Install final c74 APK and cold launch | 1,780 / 360; 4,857 ms, Status ok | `handoff-restart-safe360.png` |
| Inspect final corrected confirmation copy, then dismiss | “Correct received income”; no new write | `handoff-received-pay-confirmation.png` |
| Final APK offline force-stop/restart | 1,780 / 360; 9,179 ms, Status ok | `handoff-offline-safe360.png` |

The repair-edit Undo toast elapsed before the tap; no device Undo success is claimed. Store-level guarded undo is covered by the deterministic tests. Rent is absent from automatic pause recommendations (`final-rent-protected.png`). The intermediate “Can I afford 400” answer correctly reported a £20 shortfall without a transaction (`chat-afford400-short20.png`); its numerical and conversational code is unchanged in the final build.

## Fresh profile and installation

Final c74 APK: `adb install -r` returned Success on emulator and Galaxy S9. The physical handset launch returned Status ok, warm launch 3,956 ms, and root saw the empty name/manual-onboarding screen. Its existing installation was updated without uninstall or data clear. A pre-install financial-state comparison was not performed on the phone.

Fresh emulator user 11 reached empty manual setup in the final APK (`handoff-fresh-profile.png`). Android initially returned activity-not-found while switching/initializing the new user, then an activity wait timeout during system startup. After initialization root visually confirmed Melo's actual fresh setup screen. These transient OS results are not reported as successful launch timings. This additional fresh-profile check did not repeat the complete financial fixture already exercised in user 10.

Offline QA disabled Wi-Fi and mobile data with airplane mode enabled. At completion root restored airplane mode **0**, Wi-Fi **1**, mobile data **1**, stay-on **1**, animation scale **1**, emulator AC **off**, and owner profile **0**. Synthetic profiles were retained. No owner's data was cleared.

## Requested acceptance coverage

| Brief items | Result and basis |
| --- | --- |
| 1: install/launch | PASS — signed final APK on both architectures; UI inspected. |
| 2–9: manual setup, monthly income, bundled bill, no car, debt, essentials, buffer | PASS — synthetic Fixture B completed using native manual setup and returning editor, without Open Banking. |
| 10–11: safe amount and protected commitments | PASS — exact native values above and bill/buffer presentation. |
| 12–13: debt strategy and payoff trajectory | PASS — native Debts exposes Balanced and alternatives, safe extra, and known-0% minimum-only payoff on 18 December 2026. |
| 14–15: natural-language affordability using deterministic state | PASS — £400 query reports the exact £20 shortfall, with no payment recorded. |
| 16–17: unexpected expense and recalculation | PASS — live £120 spend changes cash and all three core plan surfaces. |
| 18–19: actual payday income correction and recalculation | PASS — confirmed receipt £100 → £80 changes cash by −£20 while preserving the future income schedule. |
| 20–21: close/reopen and retained correct state | PASS — final restart and offline screenshots show £1,780 cash / £360 safe. |

The target of approximately ten minutes to a useful plan was not measured as a user study. No crash was observed in the accepted manual sequence. No Android benchmark for a large imported statement corpus is claimed; see `PERFORMANCE_REVIEW.md`.

## Recorded QA incident

An earlier worker targeted a newly attached locked physical handset and tried one guessed PIN. It was rejected; root stopped the action and disclosed it to the owner. No financial state was saved. No further unlock attempts occurred. Root later used the unlocked handset solely for update installation and launch verification.