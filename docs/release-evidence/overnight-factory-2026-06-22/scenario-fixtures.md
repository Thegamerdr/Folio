# Scenario Fixtures

The deterministic fixtures are implemented in `apps/mobile/src/local/productExperienceFixtures.ts` and verified in `apps/mobile/src/local/productExperienceFixtures.test.ts`.

All fixtures are synthetic and non-user data.

| Fixture                      | Purpose                           | Canonical expectation                                       |
| ---------------------------- | --------------------------------- | ----------------------------------------------------------- |
| `empty_first_launch`         | Fresh local workspace.            | No transactions, plans, imports or scenarios.               |
| `sample_briefing`            | Labelled sample-only experience.  | No sample financial records are written.                    |
| `minimal_manual_user`        | Three-fact manual path.           | Source, provenance, audit, timeline and Today output exist. |
| `one_upcoming_bill`          | One protected future commitment.  | Plan and calendar deadline are derived.                     |
| `rejected_import`            | Duplicate rejected import.        | Non-financial evidence only; no transaction.                |
| `accepted_import`            | Reviewed import acceptance.       | Confirmed transaction, provenance and audit evidence.       |
| `edited_import`              | User-corrected staged import.     | User correction exists; no transaction until confirmation.  |
| `active_plan`                | Plan from protected commitment.   | Repository-backed plan and calendar rows exist.             |
| `bad_month_recovery_preview` | Hypothetical recovery preview.    | Scenario preview does not mutate canonical records.         |
| `accepted_recovery`          | Recovery accepted by user action. | Scenario, decision and audit evidence exist.                |
| `document_attachment`        | Local statement document.         | Document/source attachment exists.                          |
| `calendar_planner_items`     | Planner and date surfaces.        | Calendar rows and import review task exist.                 |

## Fixture Rules

- Synthetic only.
- No account, cloud, AI or Open Banking dependency.
- No direct Melo writes.
- No unreviewed import affects reality.
- Rejected evidence is retained but excluded from financial reality.
- Scenario previews do not mutate plans or records.
