# Route And Surface Evidence

The canonical route evidence is implemented in `apps/mobile/src/local/productExperienceEvidence.ts` and verified in `apps/mobile/src/local/canonicalProductExperienceLoop.test.ts`.

| Capture                      | Route                                                | Surface                         | Primary proof                                                                      |
| ---------------------------- | ---------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| Empty first launch           | `firstMinute`                                        | `FirstMinuteScreen`             | Value statement, local/no account/no AI copy, three starting actions.              |
| Sample briefing              | `sampleBriefing`                                     | `SampleBriefingScreen`          | `Example only`, `Not your data`, `Nothing saved`; no canonical write.              |
| Import entry                 | `import`                                             | `ImportReviewScreen entry`      | Staging explanation and review-before-record copy.                                 |
| Staged import review         | `import`                                             | `ImportReviewScreen row review` | Source, amount, date, source quality, interpretation, review state and actions.    |
| Accepted import              | `import -> today -> timeline`                        | Accept action                   | Creates confirmed transaction with provenance, decision and audit evidence.        |
| Edited import                | `import`                                             | Edit modal                      | Preserves original wording and records user correction before confirmation.        |
| Rejected import              | `data`                                               | Data evidence search            | Rejected/excluded rows remain searchable non-financial evidence.                   |
| Rejected duplicate detection | `import`                                             | Duplicate review                | Future duplicate import flags prior rejection and remains review-only.             |
| Minimal manual entry         | `quickEstimate`                                      | `QuickEstimateScreen`           | Three facts create the first real briefing.                                        |
| First real Today briefing    | `today`                                              | `TodayScreen`                   | Position, changes, review items and source access.                                 |
| Timeline                     | `timeline`                                           | `TimelineScreen`                | Facts, expectations, review rows, decisions and audit changes.                     |
| Calendar                     | `calendar`                                           | `CalendarScreen`                | Commitments, review tasks, plan deadlines, contributions and recovery follow-ups.  |
| Plans                        | `plans`                                              | `PlansScreen`                   | Repository-backed plan rows and plan impact movement.                              |
| Recovery preview             | `recovery`                                           | `RecoveryScreen`                | Preview shows affected items and protected items before mutation.                  |
| Accepted recovery            | `recovery -> today -> timeline -> plans -> calendar` | Record action                   | Creates scenario, decision and audit records.                                      |
| Data Control                 | `data`                                               | `DataControlScreen`             | Local storage, staged rows, accepted records, rejected evidence, export and clear. |
| Melo surface                 | `melo`                                               | `MeloScreen`                    | Policy-gated interpretation, source records and review-required actions.           |

## Policy Gates Active

- Melo rendering goes through `@folio/melo-policy`.
- Product code is scanned for fake score/confidence language.
- Import acceptance requires review state and user confirmation state.
- Product screen writes route through canonical repository mutation wrappers.
- Scenario previews remain hypothetical until user acceptance.
