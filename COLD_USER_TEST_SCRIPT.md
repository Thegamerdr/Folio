# Cold User Test Script

Date: 2026-06-24

## Flow 1: Fake Data

1. Fresh install opens Start.
2. Tap Try fake data.
3. Confirm the sample says it is fake/example data and nothing is saved.
4. Open Review.
5. Accept one sample/import row.
6. Ignore one duplicate or wrong row.
7. Open Today.
8. Open What changed.
9. Open More.
10. Open Data and privacy.

Expected result: Today only changes from accepted rows. Ignored rows remain separate. Data and privacy shows local ownership, export and clear controls.

## Flow 2: Add A Few Numbers

1. Fresh install opens Start.
2. Tap Add a few numbers.
3. Enter money now, next income and one payment.
4. Save quick estimate.
5. Land on Today.
6. Open More.
7. Open Data and privacy.

Expected result: the user reaches a first money picture without account, cloud, Open Banking or AI.

## Flow 3: Bank Statement Or Pasted Rows

1. Fresh install opens Start.
2. Tap Use a bank statement or Paste transactions.
3. Add CSV/text or paste statement rows.
4. Confirm Review says rows were found and nothing has been added yet.
5. Accept salary.
6. Accept bill.
7. Ignore duplicate.
8. Leave unclear row waiting.
9. Open Today.
10. Open Timeline.

Expected result: Today and Timeline update only from accepted rows. The unclear row stays in Review. Ignored duplicate is retained outside the money picture.

## Flow 4: Unsupported File Truth

1. Fresh install opens Start.
2. Tap Use a bank statement.
3. Choose PDF, image, empty file or too-large file.
4. Confirm message: "File added for review. Automatic reading is not ready for this file yet. You can still add the important numbers manually."
5. Open Review and Data and privacy.

Expected result: file metadata is visible for review. No money rows are created automatically.
