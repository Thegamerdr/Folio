## UPDATE — 2026-06-30 (evening): items resolved

This section is a forward-pointer added on top of the original 2026-06-24 audit below. The
audit body is left exactly as written; nothing in it has been rewritten or removed. The points
here record which of its findings were closed in the 2026-06-30 evening session on branch
`claude/folio-rn-faithful-port` (commits `eb6e0a0`, `3783c9c`, `a3f81c9`; doc commit `7147884`).
Verification that session: 0 typecheck errors, 306 folio tests green, visible fixes confirmed
on-device by screenshot.

### Resolved

The audit's core finding — a cold user landing in a product-rehearsal surface where fabricated
structure appears before they know what Folio is — is materially closed. The session enforced a
single rule: nothing fabricated is present 24/7; a cleared or real app shows only the user's own
data, and demo/illustrative data is gated behind the demo regime (`currentBalance.source === 'sample'`).
Concretely:

- The Today money picture is no longer staged. The money-path chart was previously hardcoded SVG
  geometry (a "salary rise +£2,180 / bill drop −£875 / 7 Jul" scene) and now plots from the real
  `route.points` daily series; the "Coming in / Going out" summary trio and the low-point week tile
  now read from real route totals instead of fixed copy.
- The "Fresh/no-data launch no longer opens the old first-minute flow" fixed-confusion is now
  enforced end to end at the data layer, not just in entry copy: the Calendar agenda's hardcoded
  "Check Klarna · 2 of 3" review, the generic UK tax-deadline rows, and the recurring-bill set
  (Octopus / Council Tax / Rent / BT) are all gated behind the demo regime rather than shown on a
  cold open.
- The reader and edit surfaces no longer fabricate rows. Visualizer / Review / Paste / Image,
  SubCaughtSheet, and the edit sheets used to fall back to sample rows or a fake
  "Tesco · £42 · 26 Jun" on a cold open; they now present honest empty doorways and blank forms.
  RouteDetailSheet's last Octopus/Rent placeholder was dropped, and the chart's "breathing room ·
  £100" label is now just "breathing room".
- The "Sample/fake data dismissal returns to Start" intent is reinforced: More → "Start fresh"
  previously called `resetAll`, which reseeded the demo ("it all came back"); it now calls
  `resetToEmpty` behind a one-tap confirm, so clearing actually leaves the app empty.

Beyond the original audit's scope, the same session also wired the Melo mood (previously a no-op)
to pressure derived from the real route and gated on a real money picture so an empty app stays
neutral, fixed an invisible-on-dark TimelineScreen headline/subhead (missing text color), wrapped
five fixed-height screens (Privacy/Subscriptions/PaydayRitual/Check-in/Start) in a ScrollView so
below-the-fold content like Privacy's "Clear to empty" is reachable, made imported transactions
keep their real statement date instead of "today", and split AI cost (chat → cheap
`gemini-2.5-flash-lite`; vision `gemini-2.5-flash` reserved for PDF/photo extraction, with a
gateway model allow-list).

### Still open from this audit

- "The old first-minute rehearsal still exists as a hidden replay under More." Not closed. The
  session removed the demo from cold-open surfaces and stopped reset from reseeding it, but did not
  remove the hidden replay itself.
- "Some deeper developer/internal names remain in code identifiers and tests." Not addressed in
  this session.
- "The evidence renderer is static HTML/XML proof, not an instrumented native tap recording."
  Unchanged.
- "PDF/image files are review-only metadata records; there is still no OCR or bank-text
  understanding for them." Partially relieved but not claimed closed. The vision model is now
  reserved for PDF/photo extraction as part of the AI cost split, but this audit's gap should be
  treated as still open until the extraction path is verified end to end. Note this depends on
  owner/QA follow-ups that are outside the code: a gateway redeploy (`wrangler deploy`) plus an
  OpenRouter spend cap.

Other open items that are owner/QA work, not RN bugs: an exhaustive per-screen dark-mode and
cross-device visual pass on an emulator, and iOS (needs a Mac/EAS; unbuildable on the Windows dev box).

---

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
