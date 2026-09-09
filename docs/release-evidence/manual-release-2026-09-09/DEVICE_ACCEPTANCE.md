# Native acceptance — 9 September 2026

Root inspected the signed final APK from source `390574198dbdfca4706683428e37a8b53750cb75` on `emulator-5554`, using synthetic profile 10. The same APK installed and launched on the Galaxy S9; no financial figures were entered on that handset. Both installed `base.apk` files match SHA-256 `c313eb289213228f4442b650e6484bbd5eb116687f346b3f347409bd200a2d76`. Earlier candidate observations are retained below and explicitly dated by source.

## Final 39057419 artifact verification

`adb install -r` returned Success on both devices. The Galaxy S9 warm launch returned `Status: ok`, 4,082 ms. This final S9 pass verifies installation, package identity and launch; the earlier c74 pass also included visual inspection of its empty setup screen.

| Final APK action | Root-observed result | Evidence |
| --- | --- | --- |
| Open existing synthetic profile | Cash £1,780, safe £360; future income £1,800, rent/bills £950, buffer £200 | `completion-today-safe360.png` |
| Preview £50 Monthly extra | Saved safe £360; preview leaves £310; payoff 18 November 2026 | `completion-debt-monthly.png` |
| Preview £50 Once extra | Saved safe £360; preview leaves £310; payoff 18 December 2026 | `completion-debt-once.png` |
| Preview £50 Weekly extra | Three payments before income; preview leaves £210; payoff 7 October 2026 | `completion-debt-weekly.png` |
| Say “I spent £200 I wasn't supposed to” | Review card with confirmation; no cash write before confirmation | `completion-spend-proposal.png` |
| Confirm that spend | Cash £1,580, safe £160; saved unplanned spend £200 alongside repair £100 | `completion-spend-recorded.png`, `completion-safe160.png` |
| Force-stop and restart with airplane mode on, Wi-Fi/data off | `Status: ok`, cold launch 14,493 ms; cash £1,580/safe £160 retained, future income/bill/buffer unchanged | `completion-offline-safe160.png` |

The three previews retained Klarna's actual £320 balance and did not record a payment. Payoff dates are estimates using the known 0% APR fixture. The dated weekly reserve and separate one-off cadence were inspected on this exact final APK.

Fresh emulator profile 11 reached the empty name/manual-onboarding screen on the final APK, visually inspected by root (`completion-fresh-profile.png`). The activity wait timed out at 18,423 ms while Android initialized the profile; Melo's setup UI then loaded. This is a verified fresh-start screen, not a successful launch-time measurement or a repeat of the complete fixture entry already exercised in profile 10.

The emulator had limited free storage and Android system delays during this pass. Two update attempts failed for storage, then succeeded after disposable-cache trimming and temporarily reducing Android's reserved-storage percentage. The original unset threshold was restored. An Android “Process system isn't responding” dialog occurred while the earlier candidate was installed. Initial activity waits during installation/profile switching timed out; those are not counted as successful launch timings. No Melo crash was observed in the accepted final sequence above. Settings restoration is recorded below.

## Earlier c74/f13 financial sequence

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

The repair-edit Undo toast elapsed before the tap; no device Undo success is claimed. Store-level guarded undo is covered by the deterministic tests. Rent is absent from automatic pause recommendations (`final-rent-protected.png`). The intermediate “Can I afford 400” answer correctly reported a £20 shortfall without a transaction (`chat-afford400-short20.png`). The follow-up preserves that affordability contract and adds named-debt targeting and explicit extra-payment cadence; final source checks are in `completion-focused-tests.json`.

## Earlier c74 fresh profile and installation

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
| 20–21: close/reopen and retained correct state | PASS — final 39057419 offline screenshot shows £1,580 cash / £160 safe after the confirmed additional £200 spend. Earlier c74 restart evidence shows £1,780 / £360 before that spend. |

The target of approximately ten minutes to a useful plan was not measured as a user study. No crash was observed in the accepted manual sequence. No Android benchmark for a large imported statement corpus is claimed; see `PERFORMANCE_REVIEW.md`.

## Recorded QA incident

An earlier worker targeted a newly attached locked physical handset and tried one guessed PIN. It was rejected; root stopped the action and disclosed it to the owner. No financial state was saved. No further unlock attempts occurred. Root later used the unlocked handset solely for update installation and launch verification.
