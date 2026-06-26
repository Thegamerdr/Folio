# Android Dogfood Scenarios

Date: 2026-06-23

Use these as owner dogfood scripts. Do not rush. Capture screenshots/XML when something feels
wrong, confusing or emotionally sharp.

## Seed Data

Use this manual seed for repeatable tests:

- Current money: `1190.47`
- Next income title: `Payday`
- Next income amount: `1840.00`
- Next income date: next payday or `2026-06-30` in the emulator fixture
- Next commitment title: `Rent`
- Next commitment amount: `875.00`
- Next commitment date: tomorrow or the next rent date

Use these statement rows for import review:

```text
2026-06-21, Tesco, -42.18
2026-06-22, Salary, 1840.00
2026-06-23, Duplicate old gym, -19.99
```

Use this recovery seed:

- Recovery title: `Tyre`
- Recovery amount: `125.00`

## Scenario 1 - Empty First Launch

1. Clear local data.
2. Open Folio.
3. Verify no account is required.
4. Verify no cloud is required.
5. Verify no AI is required.
6. Open the sample briefing.
7. Leave the sample.
8. Confirm the sample is labelled example-only and does not persist as owner data.

Pass criteria:

- The first screen opens without sign-in.
- Sample data is clearly labelled and does not appear as saved owner data after leaving it.

## Scenario 2 - Minimal Manual Path

1. Clear local data.
2. Open `Add what I know`.
3. Enter the seed current money.
4. Enter the seed next income.
5. Enter the seed next commitment.
6. Review the route preview.
7. Tap `Save quick estimate`.
8. Check Today.
9. Check Timeline.
10. Force stop and relaunch the app.
11. Confirm the saved route persists.

Pass criteria:

- Today shows a route based on saved local facts.
- Timeline shows local evidence.
- Relaunch returns to saved state, not the first-minute clean screen.

## Scenario 3 - Import Review

1. Open `More -> Import review`.
2. Paste or import the statement rows above.
3. Confirm rows are staged for review.
4. Accept one row.
5. Edit one row before accepting.
6. Reject one row.
7. Check Today and Timeline.
8. Confirm rejected evidence does not affect money.

Pass criteria:

- Nothing becomes financial reality before review.
- Accepted/edited rows affect Today and Timeline.
- Rejected rows remain evidence only.

## Scenario 4 - Duplicate Rejected Import

1. Complete Scenario 3 with a rejected row.
2. Re-import the rejected row.
3. Confirm Folio recognises prior rejection or duplicate-like evidence.
4. Confirm the owner can still override if the prior rejection was wrong.

Pass criteria:

- Prior rejection is visible.
- Override remains owner-controlled.
- Duplicate rejected evidence does not silently affect money.

## Scenario 5 - Recovery Preview

1. Create or keep a shortfall/pressure situation.
2. Open `More -> Try recovery spend`.
3. Enter recovery seed title and amount.
4. Confirm preview changes the route.
5. Confirm nothing changes before acceptance.
6. Tap `Record locally`.
7. Confirm the `Recovery saved` confirmation appears.
8. Check Timeline for decision/audit evidence.
9. Check Today/Timeline/Plans for updates.

Pass criteria:

- Preview is explicitly not saved.
- Acceptance creates decision/audit evidence.
- Today and Timeline rebuild from confirmed records.

## Scenario 6 - Data Control

1. Open `More -> Data control`.
2. Inspect local data counts.
3. Prepare export.
4. Record the export filename.
5. Confirm sample data is not exported as owner data.
6. Arm clear.
7. Clear local data.
8. Confirm cleared state is not confused with a confirmed zero balance.

Pass criteria:

- Export is owner-owned and visible.
- Clear is two-step.
- Empty baseline is explicitly not a confirmed bank balance.

## Scenario 7 - Offline Use

1. Turn on airplane mode or disable Wi-Fi/mobile data.
2. Open Folio.
3. Use Today.
4. Use Timeline.
5. Use Data Control.
6. Re-enable network.

Pass criteria:

- Core local surfaces still open.
- No cloud/AI/Open Banking failure blocks the product.

## Scenario 8 - Stress / Bad Month

1. Create a shortfall with a recovery spend or commitment.
2. Read Today, Melo note and Recovery copy.
3. Check whether language feels shaming, advisory, fake-certain or score-like.
4. Confirm a path forward is visible: inspect, review, accept, edit or clear.

Pass criteria:

- No shame language.
- No financial advice language.
- No fake scores or confidence percentages.
- The owner sees a next action without being pushed into one.

## Capture Names

Use this pattern:

```text
S##_step##_short-name.png
S##_step##_short-name.xml
S##_step##_short-name-logcat.txt
```

Example:

```text
S02_03_today-after-save.png
```
