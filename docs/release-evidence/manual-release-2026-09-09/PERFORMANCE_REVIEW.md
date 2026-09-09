# G6 performance review — timeline and statement import

Date: 2026-09-09
Scope: bounded, read-only source audit of the native Timeline and statement import/parser/storage paths. No emulator measurement or source change was used for this review.

## Evidence

- Timeline rendering is page bounded. `TIMELINE_PAGE_SIZE` is 50 (`apps/mobile/src/folio/screens/TimelineScreen.tsx:113`); the screen derives `visibleRows` and `visibleTransactions` with `slice(0, visibleCount)` (`:294-314`), renders those arrays (`:452-465`), and exposes explicit “Load 50 more” / “Back to recent” controls (`:467-490`). Action-card grouping is memoized and appends into existing day buckets (`:573-591`). The previously known initial unbounded transaction render is therefore fixed at the JSX boundary.
- Timeline data is retained for correctness. `applyTransactionRetention` sorts by date but applies no row-count ceiling (`apps/mobile/src/folio/store.ts:4049-4078`); both single and batch writes use it (`:4092-4112`, `:4742-4778`). This keeps imported history available while the view renders a bounded window.
- Statement landing has one batch write and stable re-import dedup. `addStatementAsHistory` filters already-landed `imp-` ids, maps candidates, calls `addTransactionsBatch` once, then syncs cycles and logs the import (`apps/mobile/src/folio/store.ts:4950-5071`). Detector work is bounded to a two-year recent horizon (`:5073-5082`). The import log is capped at 200 entries (`:5153-5186`), and the review/read cache has separate candidate limits (`store.ts:5634`, `:5894` onward).
- The local sheet parser normalises the input once, detects a delimiter, maps rows, and produces candidates without fabricating missing required fields (`apps/mobile/src/folio/lib/importSheet.ts:419-489`). The model reader parser is pure, rejects malformed/non-finite rows, and keeps candidates review-only with low confidence (`apps/mobile/src/local/statementReaderParse.ts:1-9`, `:83-109`, `:151-195`). The legacy reader client fails closed with `no-provider` and does not upload/read files (`apps/mobile/src/local/statementReaderClient.ts:1-6`, `:66-81`).

## Focused check

`pnpm exec vitest run apps/mobile/src/folio/lib/importEndurance.test.ts` passed: **20 tests**, including the existing 100,000-row synthetic sheet parse, deterministic ids, malformed-row handling, and local OCR corpus cases. Elapsed parser assertion was under the test’s 30-second release budget (the suite reported 282 ms for test execution).

## Manual-path isolation

Manual onboarding and debt entry use the normal store/canonical state path and do not require statement parsing or a bank provider. A no-bank manual user therefore does not enter the import hot path; Timeline will still show the same bounded view if manual transactions are later recorded. This review did not exercise the Android UI or persistence encryption on device.

## Remaining limitation

The JSX list is bounded, but `rows` still calls `buildTimelineRows` and maps the entire merged ledger before `rows.slice(...)` (`TimelineScreen.tsx:294-310`), and the screen uses `ScrollView` (`:415-421`) rather than a virtualized list. A very large canonical ledger can therefore still consume CPU and memory during projection even though it cannot create an infinite initial card render. The current code review found no remaining crash-class issue in the inspected timeline/import path; this residual full-projection cost needs a device benchmark or a future windowed projection if large-corpus support becomes a release requirement.
