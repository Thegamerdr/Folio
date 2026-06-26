# Documents, OCR and Voice

## Documents are optional context

A user can attach a photo or file in the simplest possible way. Folio extracts useful candidates, but the document remains evidence and the user remains in control.

Common document types:

- bank/card statements;
- receipts and invoices;
- payslips;
- bills and renewal notices;
- loan statements;
- contracts;
- tax evidence;
- letters related to unexpected changes.

## Storage

- Encrypted files live outside SQLite in app-private storage.
- SQLite stores metadata, hashes, links, extraction status and text index references.
- Use content-addressed deduplication within a workspace where safe.
- Personal and business documents use separate workspace keys.
- User controls original-file retention.

## Capture flow

```text
capture/select
→ local preview
→ crop/rotate/page selection
→ encrypted save
→ on-device OCR/table extraction
→ candidate fields highlighted
→ user review
→ link to transaction/event/plan/invoice
→ optional delete extracted text/original
```

The user sees progress immediately. OCR can continue in a background task when the platform permits, but the app must resume cleanly if suspended.

## OCR adapters

- iOS: Vision/VisionKit document scanning and text recognition.
- Android: ML Kit on-device text recognition/document scanner where available.
- Fallback: manual entry and optional cloud OCR with explicit consent.

Some Android models may download on first use; the UI must state when an “on-device” component is not yet installed and offer to continue later.

## Extraction rules

Candidate extraction may identify:

- date;
- total;
- currency;
- merchant/supplier;
- invoice number;
- tax amount;
- account/reference;
- period;
- line items where reliable.

Every candidate carries bounding/source reference and confidence. No extracted value becomes a tax or financial fact without review or deterministic reconciliation.

## Prompt-injection defense

Document text is untrusted content. Strings such as “ignore previous instructions” are evidence text, not instructions. Models receive document content in a clearly delimited data field and cannot invoke domain tools.

## Voice input

Voice is a fast alternative to typing, not passive surveillance.

- microphone starts only after an explicit tap;
- recording state is unmistakable;
- transcript appears before action;
- on-device speech recognition is preferred and capability-checked;
- cloud speech requires one-time and per-use clarity;
- no continuous background listening;
- user can delete audio immediately; default is not to retain raw audio.

Examples:

- “My car broke down and it will cost about £420 next Thursday.”
- “Mark that invoice paid.”
- “Move the holiday target to September.”

The transcript is parsed into a typed proposal and reviewed.

## Accessibility

Document and voice flows require non-camera/non-voice alternatives. OCR results must be readable by screen readers, and bounding-box-only interaction cannot be the sole way to correct data.

## Acceptance gates

- Documents never leave the device without explicit cloud-route consent.
- Extraction remains a proposal until accepted.
- A malicious document cannot alter prompts or records.
- Voice can be used and discarded without transcript history if selected.
- Search can find user-approved extracted text offline.
