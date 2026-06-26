# Bank Input Fixtures

Synthetic-only bank inputs for the whole-app UX and import truth pass.

These files are not personal bank data. They are designed to prove the review-first chain:

source text or file -> staged rows -> reviewed transactions -> accepted money movements -> possible meanings -> Today/Timeline/Plans.

## Fixture List

- `clean.csv` - clean CSV export.
- `messy.csv` - messy CSV export with formula-like text and ambiguous date ordering.
- `pasted-statement.txt` - bank with no CSV; pasted statement text.
- `duplicate-rows.csv` - duplicate transaction rows.
- `transfer-current.csv` and `transfer-savings.csv` - transfer between accounts.
- `salary-income.csv` - salary/income row.
- `rent-bill.csv` - rent/bill row.
- `supermarket-card-spending.csv` - card spending row that should stay a transaction, not an event.
- `refund.csv` - refund/correction row.
- `subscription.csv` - subscription row.
- `unclear-merchant.csv` - unclear merchant row that must remain review-only.
- `balance-mismatch.txt` - opening/closing balance mismatch case.

Expected rule: staged rows are not saved transactions until the user accepts them.

## Parser/Pipeline Fixtures (Date,Description,Amount schema)

Additional synthetic-only fixtures for exercising the intake parser/pipeline across
formats and intake methods. All data is **made up** (invented merchant names and
amounts, GBP £); there is **no real owner data and no real bank data** here. These
use the simpler `Date,Description,Amount` header (no Transaction ID column).

Format / delimiter variants:

- `semicolon.csv` - semicolon-delimited `Date;Description;Amount`.
- `tab.txt` - tab-separated date/description/amount.
- `pasted.txt` - pasted bank lines (e.g. `25 Jun Tesco -42.00`).

Intake-method variants (text the upstream step would yield):

- `text-pdf-extracted.txt` - plain text a text-based PDF statement would yield.
- `unreadable-pdf.note.md` - note describing the scanned/unreadable-PDF fallback (no
  binary PDF committed).
- `screenshot-ocr.txt` - text an OCR pass over a banking-app screenshot would yield (noisy).
- `camera-ocr.txt` - text an OCR pass over a camera photo of a paper statement would yield (noisier).

Classification / edge-case variants:

- `duplicate-row.csv` - a duplicated transaction (same date/amount/desc twice).
- `transfer.csv` - an internal transfer ("Transfer to savings").
- `income.csv` - an income/salary credit.
- `bill.csv` - rent/utility bill debits.
- `debt-payment.csv` - loan / credit-card payment debits.
- `balance-mismatch.csv` - a running-balance column whose balances do NOT reconcile
  with the amounts.

OCR fixtures deliberately include realistic noise (`0`/`O` and `1`/`l` substitutions,
a stray comma in a decimal, spurious lines). Do not add real statements here; keep this
folder synthetic.
