# Folio V2 Full App Usability Audit

Date: 2026-06-24
Pass: Cold User Usability Rescue

## Finding

A cold user previously landed in a product-rehearsal surface that exposed too much internal structure before they knew what Folio was. The app already had the right broad IA in code, but first launch, import copy, More, and several screen-reader labels still used implementation language.

## Current User Path

1. Start: choose one of four ways in.
2. Review: check rows before anything changes.
3. Today: see the current money picture from reviewed records.
4. More: find secondary views, data/privacy, settings and internal test mode.

## Primary IA

Primary navigation is now:

- Start
- Review
- Today
- More

More contains:

- Timeline
- Calendar
- Plans
- Review rows
- Data and privacy
- Melo
- Internal test mode
- Settings-style security/local storage controls

## Audit Results

Start is now understandable for a new user. It offers only:

- Use a bank statement
- Paste transactions
- Add a few numbers
- Try fake data

Review is now the gate for imported rows. CSV/text and pasted rows become rows to check; nothing is added until the user accepts rows. Unsupported files are added for manual review only, with no automatic reading claim.

Today remains the current picture. It carries the review state from the route summary so pending review rows are not silently treated as facts.

More now demotes secondary/product-deep surfaces and owner-only test mode. Dogfood wording is no longer primary user copy.

Data and privacy now reads as user ownership, export and clear, not as an operator console.

## Fixed Confusions

- Fresh/no-data launch no longer opens the old first-minute flow.
- Sample/fake data dismissal returns to Start.
- First launch no longer exposes Data Control or Talk to Melo buttons.
- Start no longer has screenshot/manual/OCR-ish promises.
- Review no longer says rows are already saved.
- Unsupported PDF/image/empty/too-large files no longer imply automatic reading.
- Data Control is renamed Data and privacy in user-facing surfaces.
- Dogfood Mode is renamed Internal test mode in user-facing surfaces.
- Route/source-record language was removed from key visible cold-user surfaces.

## Remaining Gaps

- The old first-minute rehearsal still exists as a hidden replay under More.
- Some deeper developer/internal names remain in code identifiers and tests.
- The evidence renderer is static HTML/XML proof, not an instrumented native tap recording.
- PDF/image files are review-only metadata records; there is still no OCR or bank-text understanding for them.
