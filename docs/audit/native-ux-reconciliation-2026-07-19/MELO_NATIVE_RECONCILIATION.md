# Melo native reconciliation — final working record

Date: 2026-07-19

Native target: `C:\dev\melo-native-ux`

Approved design source: `C:\dev\folio-melo-lovable-main`

Native branch: `codex/melo-native-ux`

## Verdict

This was a reconciliation and completion pass over the existing React Native app, not a rebuild from
the Lovable prototype. The native persistence, local readers, Personal/Business isolation, existing
four-tab shell and real empty states remain the product base.

The Android UI is coherent and release-quality at the tested phone sizes. There are no known P0 or
P1 UI defects in the audited Personal or Business shell. The remaining release blockers are mainly
external service/compliance work, plus a short list of genuinely unfinished device features recorded
below.

## Authority and conflict resolution

The Lovable source is approved. Its own documentation establishes this read order:

1. `docs/HANDOFF_FINAL.md`
2. root `HANDOFF.md` section 0
3. `docs/HANDOFF_REWORK.md`
4. `docs/HANDOFF_ADDENDUM.md`
5. `docs/HANDOFF_RATIONALE.md`
6. `docs/AUDIT_FINAL.md`
7. the feature specifications referenced by those files

`HANDOFF_FINAL.md` wins over the original handoff for the reworked design. However,
`HANDOFF_ADDENDUM.md` contains a later explicit Android exception: the shipped native app is
authoritative where a native divergence is listed. Those divergences are therefore approved
requirements, not drift:

- Keep the four primary tabs: **Today · Review · Melo · More**.
- Keep Melo as a full primary tab. It is a core companion surface, not a floating action.
- Keep the persistent Personal/Business workspace rail above the bar.
- Keep Personal and Business inside one app while isolating their records, documents, calendars,
  exports, encryption partitions and Melo context.
- Keep the native human-facing lens wording until a coordinated copy pass.
- Never seed sample balances, transactions, ghost cards or decorative figures into an empty state.

This resolves the apparent conflict with the web showcase’s three-tab/floating-Melo chrome. That
chrome is a design-source presentation device and is not the approved Android navigation.

## What changed in the native app

| Area                                 | Reconciled native result                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| State authority                      | Business operations round-trip losslessly through canonical schema v13 and encrypted workspace partitions.                                                                              |
| Workspace boundary                   | Personal and Business retain distinct records, files, SQLCipher keys, search, calendars, exports and Melo context.                                                                      |
| Shell                                | Four tabs and the persistent workspace rail remain. Review is a real Business destination.                                                                                              |
| Personal Today                       | Approved hierarchy, path preview/commit, one-move and real empty-state behaviour are preserved.                                                                                         |
| Melo                                 | Persistent memory, one ranked move, dismiss reasons, local workspace context and Business-specific actions are connected.                                                               |
| Recovery                             | Batch preview and single commit are retained.                                                                                                                                           |
| Ritual, Insights, Subs, Pots, WhatIf | Approved rework behaviour and persistence were reconciled without replacing the native data model.                                                                                      |
| Business Today                       | Real cash/invoice/tax state only; no sample figures.                                                                                                                                    |
| Business Review                      | Primary review surface for unconfirmed Business document candidates.                                                                                                                    |
| Business More                        | Full native route map for money, records, Limited Company, planning, filing and workspace tools.                                                                                        |
| Business money                       | Runway, obligations, invoices, recurring invoices, client records, aging and late-payment working figures.                                                                              |
| Business tax                         | Corporation Tax, Self Assessment, NI, student loans, payroll/Employment Allowance, dividends, DLA/s455, VAT boxes and reserve pots.                                                     |
| Business deductions                  | Mileage, pension/CIS adjustments, IR35 records and the approved annual Home Office method.                                                                                              |
| Home Office                          | Persisted per tax year; simplified bands or director flat rate versus apportioned actual household costs; never auto-switches.                                                          |
| VAT schemes                          | Local comparison of Standard, Flat Rate, Cash and Annual methods from reviewed VAT boxes; eligibility, limited-cost and first-year rules; choice changes only on explicit confirmation. |
| Filings                              | Local working copies and PDFs for VAT, SA, CT, payroll and Companies House records; external submission can be marked only after it happens elsewhere.                                  |
| Calendar                             | Derived Business deadlines and local ICS export; no fictional hosted `webcal` URL.                                                                                                      |
| Owner money                          | Paired Business/Personal owner transfer with rollback instead of an invisible cross-workspace row.                                                                                      |
| Documents                            | PDF, image, paste, CSV and text reading is local; receipt/statement candidates wait in Review before becoming ledger truth.                                                             |
| Sample data                          | The runtime stays empty until the user enters or confirms real records. The synthetic-data guard passes.                                                                                |

## Approved Business engine coverage

| Canonical handoff item                    | Native status                                         |
| ----------------------------------------- | ----------------------------------------------------- |
| Corporation Tax including marginal relief | Implemented and tested                                |
| VAT boxes and scheme comparison           | Implemented and tested                                |
| Payroll and Employment Allowance          | Implemented                                           |
| Dividends and allowance                   | Implemented                                           |
| Director’s Loan Account and s455 estimate | Implemented                                           |
| Self-employed NI Class 2/4                | Implemented                                           |
| Student loan plans 1/2/4/5/postgraduate   | Implemented and tested                                |
| Companies House CS01/deadlines            | Implemented as local preparation/export               |
| Mileage 45p/25p and other vehicle rates   | Implemented and tested                                |
| Home Office simplified/director/full      | Implemented and tested                                |
| IR35 record                               | Implemented; user records a real assessment result    |
| CIS deduction                             | Implemented as an itemised tax adjustment             |
| Pension contribution                      | Implemented as an itemised tax adjustment             |
| Statutory B2B late-payment working figure | Implemented and tested with the versioned policy pack |
| Recurring invoices                        | Implemented and tested                                |
| Client CRM light                          | Implemented                                           |
| Basis-period transition                   | Implemented and tested                                |

## Visual validation

Tested on:

- Physical Samsung Galaxy S9, Android, 1080×2220 physical pixels, approximately 360dp app width.
- Android x86_64 emulator, 1080×2400 physical pixels.

The physical device retained its existing encrypted data. No entity, balance, transaction or sample
record was added for screenshots.

Evidence:

- [Business Today](./01-phone-business-today.png)
- [Business Review](./02-phone-business-review.png)
- [Business Melo](./03-phone-business-melo.png)
- [Business More](./04-phone-business-more.png)
- [Business Deductions](./05-phone-business-deductions.png)
- [Home Office empty state](./06-phone-home-office-empty.png)
- [Home Office method sheet](./07-phone-home-office-sheet.png)
- [Standalone release · Business Today](./08-emulator-release-business-today.png)
- [Standalone release · Business Review](./09-emulator-release-business-review.png)
- [Standalone release · Business Melo](./10-emulator-release-business-melo.png)
- [Standalone release · Business More](./11-emulator-release-business-more.png)
- [Standalone release · Business Deductions](./12-emulator-release-business-deductions.png)
- [Standalone release · VAT empty state](./13-emulator-release-vat-empty.png)

The debug-only “Open debugger to view warnings” strip seen during hot reload is React Native
development chrome. It is absent from the standalone release build and is not part of the product
layout.

## UX assessment

The current Android work no longer reads like a generic SaaS dashboard. The paper surface, Fraunces
hierarchy, quiet colour system, tabular money, restrained borders and product-specific copy are
coherent between Personal and Business. Business screens are denser without adopting a separate
visual language.

No broad redesign is recommended. The correct next design work is targeted validation:

- verify the longest Business sheets with large text and TalkBack;
- validate real dense accounts, invoices and filing histories without introducing fixtures into
  shipped runtime;
- add screenshot regression coverage for the four-tab shell and workspace rail;
- run a final coordinated copy pass only where the approved docs explicitly leave vocabulary open.

## Genuine unfinished work

These items are not disguised as finished:

1. **Live Open Banking activation.** TrueLayer Data v3 is the approved primary provider and
   GoCardless Bank Account Data is the fallback. The checked-in provider boundary is not production
   configured. Procurement, regulatory route, DPA/DPIA, production credentials, supported-bank
   matrix and pilot approval remain owner/external gates. The present contract is transactions-only;
   it must not claim live balances until TrueLayer confirms and the sandbox proves a balance
   contract.
2. **Direct HMRC/MTD and Companies House submission.** The app prepares traceable working copies and
   records an external submission, but it does not transmit a filing. A real adapter requires the
   separate compliance and conformance programme.
3. **Flat Rate sector catalogue.** `VAT_SCHEME_CHOOSER.md` references a 55-sector
   `frsSectors.ts`, but that file is not present in the approved Lovable source. Native therefore
   accepts the user’s current HMRC sector percentage and handles limited-cost/first-year rules
   locally rather than inventing a sector table. Shipping an automatic sector picker requires a
   verified versioned table.
4. **Post-confirmation receipt attachment.** The intake reader can classify and read a receipt
   locally, retain its source and place the candidate in Business Review. A separate swipe action to
   attach an additional image to an already confirmed transaction is not yet a complete native
   flow.
5. **Physical feedback.** Centralised visual press feedback exists, but the approved real haptic and
   sound-bank pass is not complete.
6. **Release operations.** Store declarations, submitted-binary review, current privacy-policy
   URL, processor/SDK inventories, production Sentry organisation/project and source-map upload,
   accessibility sign-off, tax/legal sign-off and support runbooks remain release gates.
7. **iOS/Watch parity.** This pass validated Android. It does not constitute iOS, Apple Watch or
   Wear OS device proof.

## Verification record

- Mobile TypeScript build: passed.
- Business workspace TypeScript build: passed.
- Full repository suite: 2,550 tests passed, 0 failed.
- Focused regression suite: 343 tests passed.
- Business operations tests: 15 passed.
- Dependency-boundary check: passed.
- Canonical product, product-constitution and V1 boundary gates: passed.
- Synthetic/sample-data policy: passed.
- Android standalone release build: passed; production APK contains `arm64-v8a` only.
- Prettier check for touched files: passed.
- `git diff --check`: passed.

The release-foundation gate passes. The operations, public-release and store-declaration status
checks run successfully but remain blocked on the external/owner evidence listed above; they are not
currently green public-store approval.
