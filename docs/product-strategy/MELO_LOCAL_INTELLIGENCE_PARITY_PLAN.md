# Melo local intelligence parity plan

Status: active implementation contract  
Date: 2026-07-16  
Authority: current Android product, reconciled with `PORT_BIBLE.md`, `MELO_BLUEPRINT.md`,
`MELO_ALIGNMENT_AUDIT.md`, and the read-only Lovable design source.

## Non-negotiable rule

Melo must not remove a remote-AI capability and call the smaller fallback complete. A remote path may
remain disabled for privacy, but the product capability is still open until its local replacement:

1. runs without document, prompt, ledger, workspace, or identity data leaving the device;
2. is tested on the same held-out inputs used to assess the former provider path;
3. meets or exceeds the former path on exactness, coverage, safety, and useful completion;
4. preserves review-before-truth and deterministic finance calculations; and
5. works on the supported Android floor, including the owner test device, or the release scope says
   exactly which devices are supported.

Privacy wording, a manual form, a fixed reply, or an “unavailable” state is not a replacement for a
capability that previously existed.

## Local architecture

### Document intelligence

The local reader is a pipeline, not one OCR call:

1. Android `PdfRenderer` or the original image supplies pixels locally.
2. Bundled ML Kit supplies text, page dimensions, lines, words, bounding boxes, language, and
   confidence locally.
3. A deterministic classifier separates statements, receipts, paid invoices, unpaid invoices, and
   unknown documents.
4. Layout-aware adapters interpret columns and labelled totals without flattening away evidence.
5. A local model resolves only the remaining ambiguous layout/language cases.
6. Deterministic date, sign, currency, balance, duplicate, and arithmetic checks gate model output.
7. Every extracted money fact remains a candidate until Review. Uncertainty never becomes a silent
   ledger write.

### Companion

The local Companion is also a pipeline:

1. A workspace-scoped snapshot exposes only the minimum local facts needed for the turn.
2. Deterministic tools own affordability, Safe Zone, routes, debts, goals, subscriptions, calendar,
   account selection, corrections, and every write.
3. A small on-device language model handles open phrasing, intent routing, natural explanation, and
   bounded follow-ups.
4. The model may propose a typed tool call; it cannot calculate authoritative money or mutate data.
5. Existing prompt-injection, crisis, debt-help, invalid-number, workspace-isolation, and
   review-before-write guards wrap the model path rather than being replaced by it.

The first runtime candidate is LiteRT-LM with a quantised small model, subject to an Android 10 / 4 GB
device benchmark. The Android adapter pins LiteRT-LM 0.10.2 behind one Java-only ABI boundary because
the published SDK artifacts carry Kotlin 2.3 metadata and Java 21 class files while Melo remains on
Expo's locked Kotlin 2.1 / Java 17 target. The boundary compiles with the Android Studio Java 21
toolchain while emitting Java 17 app bytecode; this does not make the runtime or a model release-ready.
Model delivery may be a signed one-time download, but inference and user data stay fully on-device.
The module AAR and Melo debug-app external dex merge both pass. No model/runtime is accepted until
an approved model pack, its licence, update path, memory ceiling, cold start, token speed, answer
quality, and the supported device floor are recorded.

## Capability register

| Capability                      | Current local state                                                                                                                                                                  | Parity state                       | Required completion                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| PDF/image OCR                   | Bundled ML Kit; first 15 PDF pages                                                                                                                                                   | Partial                            | Endurance, rotation, blur, multi-page and language corpus; remove or redesign page cap                                    |
| OCR layout evidence             | Page/line/word geometry, language and confidence retained across native bridge                                                                                                       | Implemented, needs device evidence | Capture real PDF/photo bridge evidence and regression fixtures                                                            |
| Bank statement rows             | Deterministic row parser, debit/credit column signing and Review                                                                                                                     | Partial                            | Layout adapters, bank-family corpus, full-page coverage and exact balance reconciliation                                  |
| Statement balances              | Explicit dated opening/closing balances now survive into Review                                                                                                                      | Partial                            | More source date/total forms and real statement evidence                                                                  |
| Receipts                        | Local receipt classifier and labelled-total parser; cash/change excluded                                                                                                             | Partial                            | Real-world corpus, rotated/blurred images, item/merchant/date variants and duplicate controls                             |
| Paid invoices                   | Locally classified; paid total can become a Review candidate                                                                                                                         | Partial                            | Payment-state corpus and invoice-specific evidence UI                                                                     |
| Unpaid invoices                 | Correctly prevented from becoming a completed spend                                                                                                                                  | Open                               | Dedicated receivable/payable review candidate with counterparty, due date, tax and payment state                          |
| Open-ended Companion language   | Deterministic finance remains authoritative; an installed local pack may classify unclear prompts and rephrase allowlisted answers behind invention/write/safety gates               | Partial                            | Held-out intent and useful-completion evaluation against the frozen provider baseline                                     |
| Local language runtime boundary | Private-file and SHA-256-gated LiteRT-LM runtime, exact Qwen2 0.5B pack manifest, atomic installer and bounded one-shot inference are wired without an Expo/Kotlin upgrade           | Partial                            | Install and benchmark on supported ARM64 devices; record memory, cold start, token speed, interruption and answer quality |
| Money answers                   | Deterministic local snapshot/calculation tools                                                                                                                                       | Strong, not final                  | Full intent/tool corpus, stale-source and invalid-value tests                                                             |
| Companion writes                | Explicit local suggestions with confirmation/undo                                                                                                                                    | Strong, not final                  | Model-proposed tool-call adversarial suite; zero unconfirmed writes                                                       |
| Business Companion              | Workspace-separated local snapshot and dedicated surface                                                                                                                             | Partial                            | Same open-language parity, business invoice/cash-flow tools and cross-workspace attack tests                              |
| Copy/tone selection             | Rule-driven safety/tone remains the fallback; eligible authoritative replies may be rephrased locally and are rejected if money facts, URLs, tool syntax or completion claims change | Partial                            | Natural-response corpus and long-session device evidence                                                                  |

## Acceptance suite

### Document reading

The certified corpus must include, at minimum:

- digital PDFs, scanned PDFs, screenshots, camera photos and online receipts;
- statement families from UK high-street banks, challengers, credit cards, payment processors,
  building societies, exported fintech CSV/PDF variants, and deliberately unseen layouts;
- multi-page, dense, rotated, skewed, low-contrast, folded, cropped, duplicated, non-GBP,
  debit/credit-column, running-balance, pending/posted and continuation-page cases;
- retail, hospitality, fuel, travel, emailed, marketplace and VAT receipts;
- paid and unpaid invoices, credit notes, refunds and mixed tax/total layouts; and
- adversarial documents containing instruction-like text, hidden text and misleading totals.

Release gates:

1. 100% amount/sign/date correctness on the certified release corpus.
2. 100% opening-to-closing arithmetic integrity whenever the source exposes both balances.
3. Zero missing/duplicate rows on every corpus statement marked supported.
4. Zero subtotal, cash-tendered, change, VAT-only, or unpaid-invoice values misposted as spend.
5. No unsupported or uncertain document may be described as successfully read.
6. Local coverage and exactness must meet or exceed the frozen former-provider baseline on the same
   inputs.
7. No document bytes, OCR text, layout data, filenames, or derived financial facts cross a network
   boundary during the test.

“100%” applies to the versioned certified corpus and supported document contract. The corpus must
keep expanding; Melo must never claim universal support for every document ever created without
evidence.

### Companion

The evaluation set must cover every supported intent with paraphrases, typos, slang, follow-ups,
account ambiguity, Business/Personal switches, hypotheticals, corrections, cancellation, source
questions, prompt injection, crisis language, debt distress and invalid local data.

Release gates:

1. 100% correct typed tool/intent selection on safety- and money-critical cases.
2. Zero unconfirmed writes and zero cross-workspace reads.
3. 100% numerical agreement with deterministic finance tools.
4. No invented balances, dates, merchants, transactions, savings or outcome claims.
5. Open-language useful-completion score meets or exceeds the frozen former-provider baseline.
6. Model failure, memory pressure or interruption cannot bypass the deterministic guards.
7. No prompt, transcript, snapshot, tool payload, model cache or generated reply leaves the device.

## Delivery order

1. Preserve structured OCR evidence and dated statement reconciliation.
2. Separate statement, receipt and invoice grammars.
3. Build the versioned real-document corpus and baseline harness.
4. Add layout-aware statement and receipt adapters, then close the page/language gaps.
5. Add the unpaid-invoice Business review flow.
6. Integrate and benchmark the on-device language runtime on the Android floor device.
7. Route model output only through the existing typed deterministic Companion tools.
8. Run the same evaluation set against local and frozen former-provider results.
9. Call parity complete only when every gate above has recorded evidence.

## UI reconciliation rule

Lovable remains the visual grammar for Melo: Warm Paper, compact Glance Stack, one dominant action,
the route as proof, and Melo as a primary companion. The current Android product remains the
functional authority for persistence, privacy, review, Business separation and real data. New
Business and local-intelligence surfaces must extend the same rhythm rather than introducing a
second generic dashboard system.
