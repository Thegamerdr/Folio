# C13 Business Workspace

## Phase / task IDs

Phase 13. Primary task range: T169 through T182.

## Result

Phase 13 is complete for pure business-workspace contracts and a synthetic-labelled Expo Today
shell. It is not complete for release claims requiring signed UK tax/legal review, official guidance
verification, billing entitlement, business support operations, independent accessibility review,
direct filing, real business data capture, accountant collaboration or beta readiness.

Business remains optional. The personal workspace remains the default, and business creation is not
shown as an onboarding requirement.

## What was built

- Added pure `@folio/business-workspace` package for Phase 13 contracts.
- Business workspace switcher contract with persistent label, distinct navigation, large-text
  protection and no personal onboarding pressure.
- Business-only account and transaction query scope with personal leakage checks.
- Client and invoice lifecycle state with open, overdue and expected cash-flow evidence.
- Payment matching proposals with ambiguous matches review-only and Open Banking not required.
- Receipt/document workflow with retained evidence and tax review queue.
- Tax period and reserve estimate state with policy pack, source evidence, unresolved queue,
  assumptions and no final-bill wording.
- Business calendar, business Melo context, export/report, mileage, tax/legal review, isolation
  suite and beta gate contracts.
- `apps/mobile/src/phase13` mobile evidence adapter and integrated Expo Today section.

## Task coverage

| Task                                  | Status                  | Evidence                                                                  |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| T169 Business workspace switcher      | Implemented and tested  | Persistent label, navigation context, optional creation and no setup push |
| T170 Business accounts/transactions   | Implemented and tested  | Accounts and transactions are business-scoped only                        |
| T171 Clients/invoice lifecycle        | Implemented and tested  | Client records, invoice events and expected cash flow are generated       |
| T172 Payment matching                 | Implemented and tested  | Proposals created; ambiguous matches require review                       |
| T173 Receipt/document workflow        | Implemented and tested  | Retained evidence and tax review queue are modelled                       |
| T174 Tax-period records               | Implemented and tested  | Jurisdiction, policy pack, source evidence and unresolved queue visible   |
| T175 Tax reserve estimate             | Implemented and tested  | Assumptions and uncertainty shown; final-bill wording false               |
| T176 Business calendar/planner        | Implemented as contract | Business items separated from personal; native alerts still need proof    |
| T177 Business briefing/Melo context   | Implemented and tested  | Cash flow, invoices and deadlines exclude personal memory/content         |
| T178 Business reports and exports     | Implemented and tested  | Workspace, period, policy version and unresolved items are labelled       |
| T179 Mileage records                  | Implemented and tested  | Manual business-only trip purpose/distance records are export-ready       |
| T180 Tax/legal review                 | Blocked for release     | UK tax/business claims, MTD, guidance and legal signoff remain incomplete |
| T181 Workspace isolation attack suite | Passed                  | IDs, search, sync, AI, export and calendar surfaces show zero leakage     |
| T182 Business beta gate               | Blocked for release     | Tax/legal, entitlement, support and accessibility gates remain blocked    |

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm --filter @folio/business-workspace typecheck`: passed.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm exec vitest run packages/business-workspace/test/business-workspace.test.ts apps/mobile/src/phase13/businessWorkspaceEvidence.test.ts --passWithNoTests`: passed, 2 files and 22 tests.

Full gates completed on 2026-06-21:

- `pnpm run ci`: passed; includes lint, typecheck, 32 test files and 299 tests, and
  contract validation.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 32 files and 299 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks,
  18 forecast vectors, 15 import vectors and 14 independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.
- `pnpm check:v1-boundary`: passed; 129 authored V2 runtime/package files checked against
  859 unique V1 freeze hashes.
- Phase 13 PNG evidence decode check: passed; Figma render is `1260x1688`, Android captures
  are `1080x2400`.
- Non-ASCII scan of 21 touched text files: passed, no matches.

## Android live preview evidence

The Phase 13 mobile shell is integrated into `apps/mobile/app/index.tsx`. Android development-client
preview was verified on `emulator-5554` using the installed dev client's stale Metro port `8082`.
An attempted launch on `8091` bundled successfully but the installed dev client continued to request
`10.0.2.2:8082`; the live capture therefore used `8082`.

Actual artifacts:

- `docs/release-evidence/metro-phase13-live-preview-lan.log`
- `docs/release-evidence/metro-phase13-live-preview-devclient-8082.log`
- `docs/release-evidence/metro-phase13-live-preview-devclient-8082-rerun.log`
- `docs/release-evidence/android-live-preview-phase13-business.png`
- `docs/release-evidence/android-window-phase13-business.xml`
- `docs/release-evidence/android-live-preview-phase13-invoices-tax.png`
- `docs/release-evidence/android-window-phase13-invoices-tax.xml`
- `docs/release-evidence/android-live-preview-phase13-receipts-tax.png`
- `docs/release-evidence/android-window-phase13-receipts-tax.xml`
- `docs/release-evidence/android-live-preview-phase13-tax-prep.png`
- `docs/release-evidence/android-window-phase13-tax-prep.xml`
- `docs/release-evidence/android-live-preview-phase13-export-isolation.png`
- `docs/release-evidence/android-window-phase13-export-isolation.xml`
- `docs/release-evidence/android-live-preview-phase13-blockers.png`
- `docs/release-evidence/android-window-phase13-blockers.xml`
- `docs/release-evidence/android-live-preview-phase13-gate-start.png`
- `docs/release-evidence/android-window-phase13-gate-start.xml`
- `docs/release-evidence/android-live-preview-phase13-gate-top.png`
- `docs/release-evidence/android-window-phase13-gate-top.xml`
- `docs/release-evidence/android-live-preview-phase13-gate.png`
- `docs/release-evidence/android-window-phase13-gate.xml`
- `docs/release-evidence/android-live-preview-phase13-gate-bottom.png`
- `docs/release-evidence/android-window-phase13-gate-bottom.xml`

The Metro `8082` log records `Android Bundled 1195ms node_modules\expo-router\entry.js (1706
modules)`. The rerun log records `Android Bundled 2188ms node_modules\expo-router\entry.js (1682
modules)` after the payment-summary spacing fix. PNG captures decode as valid `1080x2400` images.

UI tree proof:

- Business overview confirms synthetic-only copy, Northstar Studio workspace identity, personal
  default preserved, business-only transactions and no personal query leakage.
- Invoice/payment viewport confirms 4 invoices, overdue invoice `invoice_2`, expected cash flow,
  4 payment proposals, 3 ambiguous matches and 3 review-required matches.
- Receipts/tax viewport confirms tax period records, source/policy labels, unresolved item count,
  reserve estimate, final-bill wording false, retained evidence and review queue.
- Export/calendar viewport confirms business calendar/Melo rows, personal context none, export
  records, policy version, direct filing disabled and mileage records.
- Isolation/Huashu viewport confirms isolation suite passed, tax/legal signoff blocked, entitlement
  and support blocked, and Huashu function/hierarchy/craft/anti-slop rows.
- Blockers viewport confirms beta blockers plus 12 implemented or reviewable rows and 2 blocked
  rows.
- Gate viewports confirm T169 through T182, with T180 and T182 still blocked.

The preview proves only that the synthetic Phase 13 shell renders in the Android development
client. It does not prove real business onboarding, billing, native capture, tax filing, live legal
review, accountant collaboration, real export correctness or beta readiness.

## Figma evidence

Editable Figma evidence was created from the Phase 13 repo contracts and mobile shell.

Figma board:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=18-2`

Local rendered board:

- `docs/release-evidence/figma-phase13-evidence.png` (`1260x1688`)

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- Business identity appears before invoices, tax, exports and blockers.
- Personal default, optional creation, no setup pressure and no personal data leakage are visible.
- Tax prep is framed as assumptions and evidence, not a final bill or filing success.
- The UI avoids fake HMRC/accountant marks, revenue hero theatre, fake compliance confidence and
  decorative business dashboard tropes.
- Release blockers remain visible in the same flow as business workspace evidence.

Issues carried forward:

- Native alert scheduling still needs device proof before calendar notification claims.
- Manual TalkBack/VoiceOver, large text and reduced-motion review remains required.
- UK tax/business claims, MTD readiness, recordkeeping and official guidance require signed review.
- Billing entitlement, support runbook and business beta operations remain release blockers.

## Boundary conclusion

Phase 13 is complete for deterministic business workspace boundaries, clients/invoices, receipt/tax
prep, export/mileage, isolation attack proof, Huashu review and synthetic mobile shell evidence. It
remains blocked for live business release until tax/legal, entitlement, support, accessibility,
native proof and beta operations close. No V1 donor runtime code or assets were used.
