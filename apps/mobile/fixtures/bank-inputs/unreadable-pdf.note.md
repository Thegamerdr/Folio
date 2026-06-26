# Unreadable / Scanned PDF case

This documents the fallback path for a PDF that the parser cannot read as text.

Real binary PDFs are **not** committed to this repo. This note stands in for the
scanned-PDF scenario so the pipeline's fallback branch can be exercised in tests.

## What this case represents

A bank statement delivered as a **scanned image inside a PDF wrapper** (no embedded
text layer). Examples: a photocopy saved to PDF, a fax-to-PDF, or an export where the
bank rasterised every page.

## Expected pipeline behaviour

1. Attempt text extraction from the PDF.
2. Extraction yields little or no usable text (no selectable text layer).
3. The intake pipeline should detect the empty/garbage text result and **not** treat
   it as a valid parse.
4. Fall back to the OCR path (see `screenshot-ocr.txt` / `camera-ocr.txt` for the kind
   of noisy text OCR produces), or surface a clear "couldn't read this PDF — try a
   photo or screenshot" message to the user.

## Test intent

The parser must fail **gracefully** here: no crash, no silent empty import, and a
user-facing prompt to use an alternative input method. All amounts are GBP (£) and
fully synthetic.
