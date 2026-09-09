# Galaxy S9 production data-hygiene acceptance

29 recorded assertions passed on 9 September 2026, using the signed 0.0.5/code 5 production APK on SM-G960F (`2af26a2c19017ece`). The device remains installed with the new APK and an empty profile ready for manual setup.

## Installation and clean launch

- Installed the replacement with `adb install -r`, then ran `adb shell pm clear com.folio.v2.greenfield` successfully to exercise a true fresh profile. No backup or imported financial file was restored.
- Read the installed package APK back and verified SHA-256 equals the delivered artifact: `21e46ad403a30002eadd5328c095117b2ca266bcfafab2e1b26c3ee47e5aa1c3`.
- Fresh onboarding had a blank name and zero numeric defaults. Skipping setup showed the first-picture Today screen, with no monetary calculation.
- Plan showed zero things still to leave and £0. What If requested setup rather than proposing a sample £40 spend. Review, Activity and Insights had no fixture history. Money sources showed no funded connection.
- Fresh-profile model tests separately verify every canonical financial collection, income and balances, including hydration/restart and all supported schema migrations. Native screen observations are not claimed to be a database dump. The neutral Main account structure remains at £0.

## Manually entered synthetic profile

All input went through normal production onboarding controls. No QA deep link, database write or capture fixture was used.

| Input | Entered value |
| --- | --- |
| Name | Hygiene |
| Mode | Survival |
| Monthly payday | 28 |
| Monthly income | £1,000 |
| Current account balance | £500 |
| Weekly essentials | £0, deliberately minimal for this acceptance calculation |
| Protected buffer | £50 |
| Recurring bill | Manual rent, £100 monthly on day 12 |
| Debts / pots / transactions | None added |

The onboarding pot ideas were left unselected. They are explicit optional choices, not populated financial records. Plan subsequently showed no pots and £0 held in pots.

Today displayed **£350.00 safe**, calculated from the entered £500 cash minus the £100 bill and £50 buffer. The path showed £400 at its low point and £1,400 after the entered £1,000 payday. Plan displayed **one** £100 outgoing and **£350** safe, with only Manual rent in the upcoming list. Debts showed no outstanding debts and £0 extra debt payment. These observations exclude the old Spotify/Netflix/Klarna examples.

## Offline restart and confirmed local clear

1. Disabled Wi-Fi and mobile data; verified both settings were 0. Force-stopped the production package and verified no matching process remained.
2. Cold-launched offline successfully: `TotalTime: 3501`, `WaitTime: 3510` milliseconds. Today remained £350.00 from £500; Plan retained exactly one £100 bill, Manual rent, and £350 safe.
3. Opened Data and privacy. Generated the synthetic profile export to the Android share sheet and cancelled sharing; no recipient or external service was selected. The entered data and screenshots were also preserved in this evidence.
4. Opened Clear local money & history, then cancelled its first confirmation. Today still showed £350 and £500, proving cancellation did not clear the profile.
5. Reopened clear and completed all three existing confirmations. The app reported Local data cleared, then returned to Start. No new destructive reset control or confirmation shortcut was introduced.
6. Opened See where you stand. Its guided balance was **£0**, with no £1,240 fallback. Left without entering or saving money. Today requested Add my numbers; Plan showed zero things still to leave and £0.
7. Force-stopped and cold-launched again while offline: `TotalTime: 2858`, `WaitTime: 2863` milliseconds. Today and Plan remained empty; neither the synthetic profile nor old samples returned.
8. Restored Wi-Fi, mobile data, clock-related settings and animation scales to their recorded original values. `s9-restored-settings.json` confirms every saved setting matches. The device clock was not shifted for this release's acceptance.

## Evidence and limits

- `s9-assertions.jsonl`: 29 timestamped assertions, all passing, with each required/excluded string recorded.
- Matching `s9-*.xml` hierarchy files and PNG screenshots record empty, manual, offline and reset states. `s9-final-empty-ready.png` shows the final handoff state after settings restoration.
- `s9-original-settings.json`, `s9-offline-state.json`, `s9-restored-settings.json`: before/offline/after device state.
- The first `am start -W` after clearing data timed out at roughly 10.7 seconds, although the app process/activity remained alive and the onboarding screen subsequently rendered. The two later offline cold launches completed normally as reported above. No startup timing guarantee is claimed.
- UIAutomator initially failed to reach idle with animated content. Animation scales were temporarily set to zero. The helper was corrected to delete old hierarchy output before every dump and require a successful fresh dump. Only assertions from successful fresh dumps are counted. Animation scales were restored to 1.0 afterwards.
- The crash buffer contained only earlier system dexoptanalyzer entries from 11:29, before this acceptance began after 16:23. No crash-buffer entries occurred during this acceptance; `s9-crash-check.json` records this observation. Unrelated old raw system stacks were omitted.
- This run covers the documented native flows, not every screen or all visual behavior. The three previous payday/overdue/payment-correction numbers were rerun in the current automated regression suite; this release does not claim another native reenactment of those three exact scenarios.

Result: **GO-WITH-LIMITATIONS for a fresh manual setup with version 0.0.5 today.** Fresh profile, manual calculation, offline persistence and confirmed reset all pass. Existing ambiguous, modified historical demo records require fresh setup or confirmed clear; their origin cannot safely be inferred.
