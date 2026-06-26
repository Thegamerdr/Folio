# Android Owner Dogfood Script

Date: 2026-06-23

Purpose: run Folio V2 on a real Android phone and collect useful feedback quickly. This is an internal/test flow. Do not enter real financial data unless you intentionally choose to.

## Before You Start

- Build or obtain the APK from `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- Install using `ANDROID_INSTALL_FOR_OWNER.md`.
- Keep a notes file open with `DOGFOOD_BUG_REPORT_TEMPLATE.md`.
- Use `More -> Dogfood mode` for reset, scenario seeds, object counts and diagnostic export.

## Script

| Step                          | What to tap                                                                   | What should happen                                                           | Screenshot                                     | Counts as a bug                                                          | Emotional question                         |
| ----------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| 1. Install APK                | Install the APK, then open Folio.                                             | App launches without account, cloud, AI or Open Banking.                     | Launcher and first visible Folio screen.       | App will not install, crashes, or asks for account/cloud.                | Did this feel safe to start?               |
| 2. Open clean app             | If needed: `More -> Dogfood mode -> Reset local data`, then close and reopen. | First Minute appears with an empty local baseline, not a zero-bank claim.    | First Minute top.                              | Clean state shows private records or implies a confirmed zero balance.   | Did I understand what Folio knows?         |
| 3. Record first reaction      | Do not tap yet. Write the first emotional reaction.                           | Notes capture the feeling before analysis.                                   | Optional.                                      | The first screen feels alarming, salesy or unclear.                      | What did I feel in the first 10 seconds?   |
| 4. Run empty first launch     | First Minute: step through the intro.                                         | It explains where you stand, what changed, what happens next.                | Each First Minute step if anything jars.       | Copy feels technical, pushy or misleading.                               | Did I feel safe using this?                |
| 5. Try sample briefing        | First Minute or More: `Sample briefing`.                                      | Example-only briefing opens and nothing is saved.                            | Sample briefing screen.                        | Sample looks like real user data or changes Today.                       | Did I understand this was only an example? |
| 6. Reset                      | `More -> Dogfood mode -> Reset local data`.                                   | Dogfood counts return to empty local data.                                   | Dogfood counts after reset.                    | Counts do not clear or Data Control still shows records.                 | Did reset feel trustworthy?                |
| 7. Run minimal manual path    | Dogfood: `Minimal manual user`.                                               | Today opens from synthetic current money, next income and protected payment. | Today top and source reveal.                   | No Dogfood label, unclear synthetic state, or route missing.             | Would I trust this with my own money?      |
| 8. Restart app                | Close Folio fully and reopen.                                                 | Minimal manual state persists locally on the device.                         | Today after restart.                           | State disappears unexpectedly or duplicates.                             | Did persistence feel predictable?          |
| 9. Run import review scenario | Dogfood: `Accepted import`, then repeat with `Rejected import`.               | Import review opens with staged or reviewed synthetic rows.                  | Import review top and row actions.             | Import changes money before acceptance, or rejected row affects reality. | Did I understand review vs reality?        |
| 10. Accept/edit/reject        | On Import review, tap Accept, Edit or Reject where available.                 | User action changes state only after review.                                 | Row before and after.                          | One tap silently commits the wrong thing or loses source wording.        | Did I feel in control?                     |
| 11. Check Today               | Bottom nav: `Today`.                                                          | Today reflects only accepted canonical records.                              | Today headline and source reveal.              | Rejected evidence appears as real money.                                 | Did Today answer "am I okay?" clearly?     |
| 12. Check Timeline            | Bottom nav: `Timeline`.                                                       | Timeline shows accepted, adjusted and review events from canonical records.  | Timeline rows and evidence reveal.             | Timeline invents events or omits accepted actions.                       | Did I understand what changed?             |
| 13. Check Calendar            | Bottom nav: `Calendar`.                                                       | Plan deadlines, commitments and review items are visible.                    | Calendar week and selected day.                | Dates missing, duplicated or mixed with rejected evidence.               | Did the calendar feel money-aware?         |
| 14. Check Plans/Recovery      | Dogfood: `Active plan`, then `Bad-month recovery preview`.                    | Plans show protected item; recovery preview does not mutate records.         | Plans and Recovery preview.                    | Preview is saved without acceptance or hides protected items.            | Did I understand what was real vs preview? |
| 15. Accept recovery           | Dogfood: `Accepted recovery` or Recovery: save a recovery spend.              | Decision, scenario and audit evidence appear after acceptance.               | Recovery confirmation and Timeline.            | Accepted recovery lacks decision/audit evidence.                         | Did recovery feel no-shame and practical?  |
| 16. Check Data Control        | More: `Data control`.                                                         | Accepted, staged and rejected records are separate.                          | Data Control counts and record reveal.         | Export/clear copy is unclear or records are mixed together.              | Did I trust data ownership?                |
| 17. Export diagnostic bundle  | More: `Dogfood mode -> Export diagnostic`.                                    | Redacted JSON and Markdown files are written locally.                        | Dogfood diagnostic message.                    | Bundle includes raw financial rows, source text or personal identifiers. | Would I send this bundle to a developer?   |
| 18. Record bugs               | Fill `DOGFOOD_BUG_REPORT_TEMPLATE.md`.                                        | Each issue has scenario, severity, screenshot and diagnostic path.           | Screenshot or screen recording for each issue. | Report cannot be reproduced from notes.                                  | Did anything feel confusing or stressful?  |

## Stop Conditions

Stop and report immediately if:

- accepted reality changes without an explicit user action;
- rejected evidence affects Today, Timeline reality or Plans;
- Dogfood Mode uploads anything;
- diagnostic export contains raw source text, account details or personal identifiers;
- copy creates pressure, shame or a false certainty.
