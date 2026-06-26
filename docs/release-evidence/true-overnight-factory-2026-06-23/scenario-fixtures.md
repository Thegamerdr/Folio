# Scenario Fixtures

The deterministic fixture source is `apps/mobile/src/local/productExperienceFixtures.ts`.

| Fixture                      | State                                  | Evidence focus                                   |
| ---------------------------- | -------------------------------------- | ------------------------------------------------ |
| `empty_first_launch`         | Fresh local workspace.                 | First minute creates no financial records.       |
| `sample_briefing`            | Sample-only copy.                      | Example content stays out of records and export. |
| `minimal_manual_user`        | Three-fact manual route.               | Today, Timeline, Calendar and Plans update.      |
| `one_upcoming_bill`          | One protected commitment.              | Calendar and plan projection.                    |
| `rejected_import`            | Import rejected as duplicate.          | Non-financial evidence only.                     |
| `duplicate_rejected_import`  | Same row staged after rejection.       | Prior rejection appears before confirmation.     |
| `accepted_import`            | Reviewed import accepted.              | Transaction, provenance and audit evidence.      |
| `edited_import`              | User-corrected staged import.          | Original source plus correction.                 |
| `active_plan`                | Protected future commitment.           | Plan projection and linked records.              |
| `bad_month_recovery_preview` | Hypothetical recovery scenario.        | Preview does not mutate records.                 |
| `accepted_recovery`          | Recorded recovery spend.               | Scenario, decision and audit evidence.           |
| `document_attachment`        | Local source file staged.              | Document/source evidence.                        |
| `calendar_planner_items`     | Planner item plus import review task.  | Money-aware calendar rows.                       |
| `data_control_export`        | Accepted, rejected and source records. | Export and ownership surface.                    |

All fixtures are synthetic and marked as non-user data.
