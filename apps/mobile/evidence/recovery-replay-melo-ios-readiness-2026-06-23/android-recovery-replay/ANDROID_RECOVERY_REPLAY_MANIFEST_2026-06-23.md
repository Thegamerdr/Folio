# Android Accepted Recovery Replay Manifest

Date: 2026-06-23

Device: Android emulator `emulator-5554`

Package: `com.folio.v2.greenfield`

## Flow Captured

1. First Minute compact Melo note visible.
2. Quick Estimate route created from user-entered facts.
3. Today rebuilt from quick estimate.
4. Recovery preview opened.
5. Recovery preview captured before any accepted write.
6. Repair spend preview entered.
7. Preview impact captured with `preview only`, hypothetical source, negative route consequence, protected item and draft plan projection.
8. `Record locally` action captured after "Nothing is saved yet" guard.
9. Accepted recovery returned to Today.
10. Timeline, Plans, Calendar and Data Control captured after acceptance.
11. Data Control record list captured with `recovery recorded` audit row and accepted `Repair` transaction.

## Screenshot Inventory

- `screenshots/00-current-before-replay.png`: First Minute compact Melo note.
- `screenshots/01-quick-estimate-filled.png`: user route facts filled.
- `screenshots/02-quick-estimate-save-ready.png`: quick estimate route preview.
- `screenshots/03-quick-estimate-save-button.png`: save quick estimate action.
- `screenshots/04-today-after-quick-estimate.png`: Today after saved quick estimate.
- `screenshots/05-more-before-recovery.png`: More lower state before recovery.
- `screenshots/06-more-top-before-recovery.png`: More controls scroll state.
- `screenshots/07-more-recovery-entry-visible.png`: Recovery entry visible.
- `screenshots/08-recovery-preview-before-input.png`: recovery preview before input.
- `screenshots/09-recovery-preview-filled-before-acceptance.png`: Repair preview filled.
- `screenshots/10-recovery-preview-impact-before-acceptance.png`: preview impact, hypothetical source, draft plan projection.
- `screenshots/11-recovery-record-locally-action.png`: preview chart and review-before-saving state.
- `screenshots/12-recovery-record-locally-button-visible.png`: `Record locally` acceptance target.
- `screenshots/13-today-after-accepted-recovery.png`: Today after accepted recovery.
- `screenshots/14-timeline-after-accepted-recovery.png`: Timeline after accepted recovery.
- `screenshots/15-plans-after-accepted-recovery.png`: Plans after accepted recovery.
- `screenshots/16-calendar-after-accepted-recovery.png`: Calendar route after accepted recovery.
- `screenshots/17-calendar-agenda-after-accepted-recovery.png`: Calendar selected-day Repair event after accepted recovery.
- `screenshots/18-more-data-control-entry.png`: Data Control entry visible.
- `screenshots/19-data-control-after-accepted-recovery.png`: Data Control counts and compact Melo note.
- `screenshots/20-data-control-records-after-accepted-recovery.png`: Find-record section.
- `screenshots/21-data-control-record-list-expanded.png`: record list expanded.
- `screenshots/22-data-control-record-rows-after-accepted-recovery.png`: audit row and accepted Repair row.

Matching XML files are in `xml/` with the same numeric prefixes.

## Key XML Evidence

- Preview before acceptance:
  - `Melo noticed: This recovery item is still a preview`
  - `Your control: Review the preview, then record locally or go back`
  - `Source: hypothetical`
  - `Scenario preview`
  - `Plan projections`
  - `1 draft`
  - `Nothing is saved yet`
  - `Record locally`

- After acceptance:
  - `4 changes are visible`
  - `not a verdict`
  - `Repair recorded from recovery preview`
  - `Scenario decision recorded`
  - `hypothetical - accepted`
  - `Protect Rent`
  - `2 linked local records`
  - `Repair`
  - `Money event`
  - `3 records`
  - `2 audit items`
  - `recovery recorded`

## Result

Accepted Recovery replay is proven on Android emulator for this route:

- Preview did not present itself as saved reality.
- Acceptance required the `Record locally` user action.
- Accepted recovery rebuilt Today, Timeline, Plans, Calendar and Data Control.
- Audit/history evidence is visible.
- Captured wording avoids shame/advice/fake-score language checked by tests.
