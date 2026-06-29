# Engine contracts

```json
{
  "crossCutting": "CROSS-CUTTING INVARIANTS (apply to every engine; encoded from web ENGINES.md §0 + RN ENGINES.md §2 + RN_PORT.md + the two research docs). Sources: C:/dev/folio-melo/.claude/worktrees/design-main/ENGINES.md, C:/dev/folio-v2-greenfield/ENGINES.md.\n\n1. REVIEW-BEFORE-TRUTH (non-negotiable, RN §2.1, web §0). Reader/import/detector output is a CANDIDATE only. Nothing moves Today, the route/path, the timeline, any balance, or cycle math until the user explicitly accepts it. Accept is the ONLY mutation. Default no-op for de-dupe proposals = \"Keep both\". Greenfield enforces this via TransactionReviewStatus='proposed'|'needs_review'|'accepted'|'rejected', import-engine.commitPreview.caveat='preview_only_requires_review_command', and ImportMeaningProposal.affectsTodayOnlyAfterAcceptance.\n\n2. POSTED FACT vs EXPECTATION (RN §2.2). An accepted item is a posted fact; a future-dated item is an expectation/commitment and is never relabelled into a past fact. Greenfield: finance-engine reconcileOccurrences separates occurrences(facts) from expectations; AuthorityState/TransactionCertainty carries this. Refunds link to original (no inflated money-in); transfers net to zero.\n\n3. CANDIDATE-ITEM CONTRACT (web §0). Every reader (pdf/image/paste/csv/txt) emits normalised CandidateMoneyItem[] — NEVER raw reader output — to Review: { id; source:\"pdf\"|\"image\"|\"paste\"|\"csv\"|\"txt\"|\"manual\"; kind:\"income\"|\"spend\"|\"bill\"|\"subscription\"|\"debt-payment\"|\"transfer\"|\"unknown\"; merchant; amount(GBP, spend negative); date?(ISO); category?; confidence:\"high\"|\"medium\"|\"low\"; note? }. Greenfield analogue = import-engine CanonicalImportRow + ImportReviewRowSummary with provenance, fieldEvidence, reviewState; the RN port must map readers to this contract. Carry source context for Review copy (\"from your statement\").\n\n4. ENGINE-NOT-A-FORM (web §0, RN_PORT \"What this prototype must NEVER do\"). If the user picks PDF/image/paste/CSV/TXT, the matching reader MUST run and produce candidates. Manual entry is failure-only/last-resort, never the main path, never mixed into upload success. Failure state: primary action \"Try another file/photo\", secondary \"Add one thing myself\". Calendar is NOT the upload fallback (derived from money data only; manual events are explicit user-added).\n\n5. NO HIDDEN AUTHORITY / SOURCED BALANCES (RN §2.4, D1). Every number Today shows can name its source; nothing important renders from an unlabelled seed. No literal balances in render code. `sample` source is the ONLY source allowed in demo mode and can NEVER be promoted to real user state. Resolution order: statement_reviewed > ocr_reviewed > corrected > user_entered > sample.\n\n6. OWNERSHIP NEVER PAYWALLED (RN §2.3, D8, web Pricing). History, export, local data, basic Today/route, review, manual input, correction/editing, start-fresh are always in the free local core. An entitlement check can never gate any of these. Downgrade keeps every core feature working on existing data.\n\n7. LANGUAGE GATE / BANNED VOCAB (RN §2.5, web COPY_DECK, research docs). User-visible copy must NOT contain: \"canonical\", \"provenance\", \"source record\", \"manual entry\", \"user confirmed\", \"reconcile\", \"merged\"/\"duplicate removed\"/\"we cleaned this up\", scores, advice/verdicts, shame language (\"failed\",\"lazy\",\"irresponsible\",\"bad with money\"), manipulative retention (\"streak is dying\",\"lose progress\",\"open now\",\"come back now\"). Subscription surface must never say \"you are not using this\"/\"cancel this\"/\"wasted £X\"/\"usage declining\"/\"we saved you £X\". Internal field names (sourceType, authority, certainty) are implementation terms and must never leak into UI. A visible-string build-gate scan must FAIL the build if any banned phrase appears (greenfield melo-policy classifyAdviceLanguage + plan-engine runPhase8EmotionalSafetyReview already implement this pattern).\n\n8. NO-SILENT-WRONG-THING (web Melo matching, de-dupe research). Deterministic normalisation only (lowercase+trim+collapse whitespace+strip punctuation); exactly-one match resolves, zero/2+ returns {applied:false, reason, candidates} and re-asks. No fuzzy/edit-distance for Melo entity match. De-dupe never auto-merges manual↔import; it proposes (Link · Keep both · Ignore imported · Edit before linking) and every link is visible + reversible (unlink restores two rows; append-only, original preserved). Fingerprint = normalised merchant + amount(±£0.50) + date(±3–7d).\n\n9. DETERMINISTIC PURE ENGINES. Every engine is a pure, vitest-testable module with no RN/native/UI/DB imports (greenfield packages assert this via *Boundary consts: deterministic:true, importsNativeOrUiRuntime:false). Money is integer minor units; never float-compare; clamp day-of-month math; ties resolve to earliest day.\n\n10. SCHEMA INTEGRITY. Never widen the persisted shape without bumping schemaVersion + adding a migration step; future-newer blobs are parked, never silently dropped; any new *kind* of data needs an @rn-engine:NEW flag.\n\nGAP SUMMARY for the RN build: greenfield already implements money-path (today-engine), finance forecast, calendar recurrence, import/dedupe pipeline, plan/budget/ritual, melo language policy, storage migrations + portable-vault export, and a UserCorrection domain model. MISSING as dedicated packages: a recurring-series / subscription-signal engine (sub-signals), a pot/protected-money engine with borrow/repay ledger (pot-engine), a nudge-scheduler native adapter, the WhatIf/SpendHold engine, and the cycle-tracker/closeCycle+observations(insights) engine. The reader candidate-contract bridge (statement/photo/text → CandidateMoneyItem) and the manual↔import propose-link surface are decided/researched but not built. CONFLICT to resolve: Tier-1 undo duration web=6s vs greenfield D3=>=30s.",
  "engines": [
    {
      "id": "edit-txn",
      "decision": "Editing an already-added item is a real flow (SheetEditTxn must not stay a stub). An edit creates an append-only correction record; the original source/extracted payload is preserved, never overwritten. Imported items keep their original source payload so re-imports compare against source, not the edited surface. Path/Today recompute immediately on save. Melo-logged txns editable on same terms (Melo Tier-1 undo covers original write only).",
      "model": "Editable fields: amount, date, name/merchant, type/category, note, source link. Type enum: spending|income|bill|debt_payment|transfer|refund. Write a TxnEdit/UserCorrection { txnId, field, before/from, after/to, at, by:'user'|'melo' } per change; row shows latest values, history auditable from txn detail. Edit REPLACES (does not add) -> no duplicate counting. recomputeRoute() fires on save (same call as add/delete). Greenfield domain already models this as UserCorrection (kind: data-correction|status-change|relationship-change|manual-correction; authorityState:'user-confirmed') but today-engine.buildTransactionRow emits correction:{ placeholder:true, canCreateMutation:false, blockedReason:'requires_transaction_write_adapter' } -> the write path is unbuilt.",
      "acceptance": [
        "A user can edit an already-added item; the change reflects in Today/route immediately (recompute fires).",
        "The original source/extracted payload remains inspectable after edit; a correction/audit history (before->after, at, by) exists.",
        "No duplicate counting after an edit (edit replaces, not appends).",
        "An edited merchant name does NOT break import de-dupe (re-import compares against original source payload).",
        "Melo-logged transactions are editable; the Melo undo window applies to the original write, not subsequent edits."
      ],
      "bannedClaims": [
        "Never overwrite or destroy the original source/extracted item.",
        "Never let an edit silently create a duplicate row.",
        "UI must not show internal field names (sourceType, authority, certainty)."
      ],
      "existingRnPackage": "@folio/domain (UserCorrection type + correction kinds) + @folio/today-engine (buildTransactionDetailView surfaces correction placeholders). Write adapter is NOT built.",
      "status": "partial"
    },
    {
      "id": "pot-cadence",
      "decision": "No hardcoded Friday cadence. Default pot/protected top-up cadence is 'after income arrives' (after-payday). Per-pot override; ask the user if no payday known; the route explains when the top-up happens.",
      "model": "Per-pot cadence union (web store.ts PotCadence already matches): { kind:'after-payday' } (default) | { kind:'weekly', weekday:0..6 } | { kind:'monthly', dayOfMonth:1..31 } (clamped per payday rule: Feb 31 -> Feb 28/29) | { kind:'custom', nextDate:ISO }. Greenfield D5 PotCadence: 'after_each_payday'|{weekly:Weekday}|{monthly:1..31}|'custom'|'one_off'. Overdraw rule: if a scheduled top-up would push spare below £0 (or below tightPointGoal when set), surface a ritual prompt ('Top up Buffer £25? Spare drops to -£8') -> never auto-skip, never silent. The calendar/dip label derives from configured cadence, not the literal 'Friday'.",
      "acceptance": [
        "Friday is not hardcoded anywhere a pot/protected contribution is scheduled (current bug: deriveCalendarEvents emits a Friday top-up per pot, ignoring pot.cadence).",
        "A pot contribution can attach to payday (after-payday) and recompute the route.",
        "The route/calendar explains the top-up timing; the user can change cadence per pot.",
        "monthly cadence uses the same day-of-month clamp as payday (Feb 31 -> Feb 28/29).",
        "A top-up that would breach floor surfaces a ritual prompt; it is never auto-skipped silently."
      ],
      "bannedClaims": [
        "Never assume a weekday when payday is unknown.",
        "Never silently skip an overdrawing top-up.",
        "Never label a dip 'Friday' when the cadence is not weekly-Friday."
      ],
      "existingRnPackage": "NONE (no @folio/pot-engine). Web prototype has the PotCadence type in src/lib/store.ts but calendar-events.ts still hardcodes Friday. @folio/calendar-engine RRULE expansion could back cadence.",
      "status": "not-built"
    },
    {
      "id": "payday-clamp",
      "decision": "Invalid payday dates clamp to the last valid day of the month (never overflow to next month). Weekend default is the previous working day (UK payroll convention), overridable per income source. Public holidays out of MVP scope -> wire isBusinessDay(date) hook now.",
      "model": "resolvePayday(rule, month) -> ISODate: (1) clamp dayOfMonth to lastDayOf(month): 31 in Feb -> 28/29; (2) if clamped date is Sat/Sun apply weekendPolicy. PaydayRule = { dayOfMonth:1..31, weekendPolicy }. weekendRule/weekendPolicy: 'previous'/'previous_working_day' (default) | 'next'/'next_working_day' | 'exact'/'exact_calendar_date'. Applies to: income/payday, recurring bills, subs with dayOfMonth cadence, scheduled pot top-ups. Weekend shift must be visible/explainable on the route, not silent. Greenfield finance-engine/today-engine/calendar-engine already implement correct month-clamp arithmetic (addMonthsToLocalDate uses Math.min(anchorDay, daysInMonth)); the dedicated payday resolver + weekend policy is not yet isolated.",
      "acceptance": [
        "'Feb 31' resolves to Feb 28/29 and never silently rolls into March 3 (web calendar-events.ts nextPayday currently relies on JS Date and overflows - the bug to fix).",
        "Weekend shift is visible/explained on the route, not silent.",
        "A user can override weekend policy per income source.",
        "Clamp + weekend cases tested: Jan-31->Feb-28/29, 30th in Feb, each weekend policy.",
        "isBusinessDay(date) hook exists for later UK bank-holiday lookup."
      ],
      "bannedClaims": [
        "Never let an invalid day-of-month overflow into the next month.",
        "Never shift a weekend payday silently."
      ],
      "existingRnPackage": "PARTIAL - @folio/finance-engine, @folio/today-engine, @folio/calendar-engine all clamp month arithmetic correctly; no dedicated payday-resolution module / weekend-policy yet (greenfield D2: 'confirm exact module during implementation').",
      "status": "partial"
    },
    {
      "id": "undo-policy",
      "decision": "Three-tier undo. Tier-1 immediate undo snackbar for normal actions (unify duration, replacing the 3.5/4.5/5/8s mix). Tier-2 7-day recoverable history for ignored/removed items (soft-delete + removedAt + 'Recently removed' per surface, hard-delete on next sweep after 7 days). Tier-3 'Start fresh' double-confirm + export warning, never one-tap, no fake undo after a confirmed wipe.",
      "model": "Tier-1 covers: log spend/income, pause sub, move between pots, edit txn, dismiss nudge, accept Melo move. DURATION CONFLICT to resolve: web spec=6s vs greenfield D3=>=30s -> RN must pick ONE constant and apply uniformly. Tier-2 covers: ignored review items, removed subs/bills/pots/manual events -> soft-deleted with removedAt timestamp, surfaced in 'Recently removed' (Subs/Pots/Calendar/Review-Hidden), hard-delete on the next sweep after 7 days. Tier-3 Start fresh requires: (1) typed confirmation, (2) explicit 'I've exported my data' checkbox with one-tap export shortcut (ties to export engine), (3) final confirm.",
      "acceptance": [
        "Every normal destructive action (Add/Edit/Ignore/Remove, pause sub, move pots, accept Melo) has a single immediate undo with one consistent duration.",
        "Ignored items and removed subs/bills/pots/manual events are recoverable for 7 days via a 'Recently removed' list, then hard-delete on sweep.",
        "An edit never destroys the original source (ties to edit-txn).",
        "Start fresh cannot happen accidentally: two explicit confirmations + export offer; no fake undo after a confirmed wipe."
      ],
      "bannedClaims": [
        "Never present a fake undo after a confirmed start-fresh wipe.",
        "Never hard-delete a recoverable item before its 7-day window elapses.",
        "UI copy for declines/removals must avoid banned vocab."
      ],
      "existingRnPackage": "NONE dedicated (greenfield D3 names a future recovery store under apps/mobile/src/local/). Web store has ad-hoc per-surface timers only.",
      "status": "not-built"
    },
    {
      "id": "export",
      "decision": "Export everything, free, day-one, never paywalled. Single tap, full data out. Machine formats first (one JSON of full AppState + per-surface CSVs), delivered as a zip via RN share-sheet. Human-readable PDF summary post-MVP.",
      "model": "Bundle includes: all transactions + edits/corrections, pots (incl. ledger), subs (incl. paused/cancelled history), bills, income, waiting/ignored review items, file/source metadata for every imported item, route assumptions (currentBalance source, payday rule, hold rules), Melo decisions/audit log, settings, calendar/expectations (derived events for next 35 days). v1 formats: one JSON file of full AppState + CSVs (transactions.csv, subs.csv, pots.csv, cycles.csv, ledger.csv, edits.csv). Greenfield has @folio/storage createPortableVault (folio.portable_vault format v1: schema checksum + migrations manifest + per-table checksummed JSON rows + blob manifest) - the structural export primitive; the CSV projection + Data-surface entry point + zip share are not built.",
      "acceptance": [
        "A user can export their full data in one action; export lives in the free/local core and is never blocked by entitlement (cross-checked by pricing guardrail).",
        "Round-trip completeness: every listed category present in JSON and CSV.",
        "Exported data is complete enough to rebuild the picture outside Folio.",
        "Export is reachable from More->Data and surfaced once in onboarding and once in cycle-close ritual.",
        "Portable vault tables carry per-table checksums (greenfield createPortableVaultTable)."
      ],
      "bannedClaims": [
        "Never move export behind a paywall.",
        "Never silently omit a data category from the bundle.",
        "UI must not use 'provenance'/'canonical' for source metadata."
      ],
      "existingRnPackage": "PARTIAL - @folio/storage (createPortableVault/validatePortableVault, JSON + checksums + migrations manifest). CSV projection, Data-surface entry, zip/share, and full AppState->vault mapping NOT built.",
      "status": "partial"
    },
    {
      "id": "import-sheet",
      "decision": "Yes - CSV/TSV upload + paste from Google Sheets/Excel, with an optional Folio template, flowing through a visualizer (column mapping, preview rows, confidence flags) to Review. Imported sheet rows are claims, never auto-counted. Onboarding adds a 'Bringing a sheet across?' path (copy avoids 'import' - say 'bring my sheet across').",
      "model": "Columns: date, description/merchant, amount, type/kind, account/source, note. Flow: paste/upload -> reader parses what it can -> 'Check what Folio found' visualizer (column mapping + preview + confidence flags) -> Review -> Today/route update ONLY after Add (individually or bulk). Same CandidateMoneyItem contract as PDF/OCR. Historical rows may pre-date the active cycle (written with original date, visible in Insights history, not the active path). Bad/missing columns produce honest fix prompts, not silent guesses. De-dupe against existing items via OPEN_BANKING_DEDUPE_RESEARCH rules (propose-link, never silent merge). Greenfield @folio/import-engine ALREADY implements CSV/text/OFX/QIF parsing, deterministic column mapping (inferCsvMapping), evidence levels, sanitizeSpreadsheetText (formula-injection guard), findDuplicateCandidates, findTransferCandidates, bounded review-question plan (cap=3) and commitPreview('preview_only_requires_review_command') - strong coverage; missing pieces are TSV + paste + the column-mapping correction UI + the onboarding wedge surface.",
      "acceptance": [
        "Imported sheet data never auto-counts (staged until Add).",
        "Visualizer handles sheet rows; user can correct columns/types.",
        "Missing/bad columns produce honest fix prompts, not silent guesses.",
        "Pasted text and uploaded CSV/TSV both reach the visualizer.",
        "Historical pre-cycle rows write with original date and appear in Insights history, not the active path.",
        "Formula-like cells are neutralised (leading =,+,-,@ prefixed) before staging."
      ],
      "bannedClaims": [
        "Never auto-count imported rows.",
        "Never silently guess a missing column.",
        "Onboarding/UI copy must not use the word 'import' (say 'bring my sheet across').",
        "Never silently merge a sheet row with an existing item."
      ],
      "existingRnPackage": "@folio/import-engine (csv/text/ofx/qif parse, mapping, dedupe, transfer detection, review packet, spreadsheet-formula sanitizer). MISSING: TSV + paste intake, column-mapping correction UI, Folio template, onboarding 'bring my sheet across' path.",
      "status": "partial"
    },
    {
      "id": "sub-signals",
      "decision": "Surface payment FACTS only; the user owns the 'is this still worth it?' judgment. Banking/statement data proves a payment RECURS, never that a product was USED. No automatic usage decay. Detection runs only over imported/accepted rows (Moneyhub: detection 'will not work with manual accounts'). Static data lags reality - speak about what the statement SHOWED, not current truth.",
      "model": "Pure deterministic RecurringSeries detection (grounded in Moneyhub thresholds): (1) Group accepted out-transactions by normalised merchant + direction. (2) Confirm a series when frequency+description+amount coincide using MIN sample counts: Weekly 8, Fortnightly 6, Monthly 3, Quarterly 4, Yearly 3 occurrences. Fewer = a 'candidate' (surfaced quietly, never asserted). (3) Date tolerance: Direct Debit up to 4 working days, card within 3 working days -> predicted next date carries a tolerance band, not a fixed day. (4) Amount: predict next value with upper/lower bound for variable bills; a sustained step = priceChanged{ fromMinor, toMinor, atDate }. (5) Missed/returned: expected charge not seen -> gaps -> wentQuiet (a fact, scoped to the statement); returnedPayments -> paymentReturned (likely insufficient funds). (6) Duplicates: >=2 series same merchant -> possibleDuplicate. (7) Output is DESCRIPTIVE ONLY - the type has NO usage/value/cancel field; the user sets an `important` flag; importance/usage/cancel are never inferred (unsafe claim unrepresentable by construction). Web lifecycle layer on top: SubStatus = active|paused-cycle|paused-indefinite|cancelled; caught->paused->cancelled; 'pause for a month' = skip next scheduled occurrence then auto-resume on first scan strictly after the skipped date; paused-cycle auto-resumes at cycle close with a default ritual prompt (per-sub autoResume:'prompt'|'silent', default 'prompt'); cancelled soft-deletes but still counts in the savings tally for its cancellation cycle. The web Sub fields usesPerMonth/lastUsedDaysAgo become USER-OWNED (editable, default null, never inferred). Review copy is question-shaped ('Still using Disney+?'), never verdict-shaped. Test fixtures S1-S8 from SUBSCRIPTION_SIGNAL_RESEARCH.",
      "acceptance": [
        "The RecurringSeries type has NO usage/value/cancel field (build-gate assertion).",
        "A series is confirmed only at/above the Moneyhub sample count for its cadence (Weekly 8 / Fortnightly 6 / Monthly 3 / Quarterly 4 / Yearly 3); below = candidate, surfaced quietly.",
        "Predicted next date carries a tolerance band (DD<=4 working days, card<=3 working days); an in-tolerance late DD stays in-series (not 'missed').",
        "A sustained amount step emits priceChanged{from,to,at}; variable bills emit an upper/lower bound, not a fixed-amount false negative.",
        "Two series to the same merchant emit possibleDuplicate.",
        "Detection runs only over imported/accepted rows, never manual-only entries.",
        "usesPerMonth/lastUsedDaysAgo are null by default and only ever written by the user.",
        "A visible-string scan of the subscription surface contains NONE of the banned phrases (build-gate)."
      ],
      "bannedClaims": [
        "'You are not using this.'",
        "'Cancel this.' / 'You should cancel this.'",
        "'This is wasted money.' / 'You're wasting £X.'",
        "'Usage is declining.' / 'You haven't used this in N days.'",
        "'We saved you £X' (Folio takes no such action).",
        "Any usagePerMonth/lastUsedDaysAgo/decay-score INFERENCE, value judgement, predicted decision, shame framing, or red-alert treatment."
      ],
      "existingRnPackage": "NONE. @folio/import-engine has only ImportMeaningKind:'recurring_commitment' as a single-row label (not a multi-cycle series detector). No usage/decay fields exist anywhere (correctly). The deterministic RecurringSeries module + the sub lifecycle state machine must be built.",
      "status": "not-built"
    },
    {
      "id": "hosted-calendar",
      "decision": "Calendar is a forecast derived from money data (never the upload fallback). Every actual recurring occurrence inside the 35-day window renders (no collapsing duplicates). The path engine reads the same expanded list so curve and visible list never disagree. ICS export of the timeline is supported.",
      "model": "deriveCalendarEvents walks each recurring item (bill, sub, income/payday, pot top-up) day-by-day across today->today+windowDays(35) and emits an event for every date the cadence lands on (rent on day 1 AND day 32 -> both; payday twice in a 5-week month -> both). Sub-nudge: stores { subId, originalDate, nudgedDate } where nudgedDate = original +/-N clamped to +/-7; override stays live through nudgedDate; the first scan whose 'today' is strictly AFTER nudgedDate consumes+deletes the nudge (clearing on originalDate would erase the bump prematurely). Manual past-dated events: in manual mode they deduct from the path (today's reality); under a future bank feed the manual item stays canonical and the feed item links via linkedManualId (path counts each pair once). ICS: minimal RFC 5545 VCALENDAR/VEVENT serializer (VALUE=DATE, CRLF), RN swaps browser download for a native share intent. Greenfield @folio/calendar-engine provides RRULE expansion (FREQ DAILY/WEEKLY/MONTHLY, COUNT/INTERVAL/UNTIL, RDATE/EXDATE, bounded materialisation, TZ-correct UTC) and @folio/today-engine builds internal calendar/timeline/week/month views - strong primitives; the bill/sub/payday/pot -> RRULE wiring + nudge-override store + linkedManualId de-dup-link are the gaps.",
      "acceptance": [
        "Every actual occurrence of a recurring item inside the 35-day window renders (no de-dup collapse); 5-week-month double payday both appear.",
        "The path engine and the visible calendar list read the same expanded occurrence list (never disagree).",
        "A sub-nudge stays visible through nudgedDate and is consumed only on the first scan strictly after nudgedDate.",
        "Manual past-dated events deduct from the path in manual mode.",
        "ICS export emits one VEVENT per derived event with correct DTSTART;VALUE=DATE and CRLF line endings.",
        "Recurring expansion is bounded and TZ-correct."
      ],
      "bannedClaims": [
        "Never collapse duplicate occurrences inside the window (hides money events).",
        "Never clear a sub-nudge on originalDate (premature).",
        "Never auto-add manual calendar events as the statement-upload fallback.",
        "Never let the curve and the visible calendar list disagree."
      ],
      "existingRnPackage": "PARTIAL - @folio/calendar-engine (RRULE expand, RDATE/EXDATE, TZ->UTC) + @folio/today-engine (buildInternalCalendarViews/buildTimelineRows) + ics.ts (web ICS serializer to port). MISSING: recurring-item->RRULE wiring, sub-nudge override store, linkedManualId pairing.",
      "status": "partial"
    },
    {
      "id": "statement-reader",
      "decision": "Real RN engine: PDF -> candidate money items for Review. The web prototype only shows success/failure design states. Manual entry is failure-only, never the main path.",
      "model": "Read text from bank PDFs; detect transaction-like lines, bill-like recurring payments, income, debt payments, transfers, subscriptions; normalise to CandidateMoneyItem[] with confidence + source context ('from your statement'); send to Review; add nothing until accepted. Failure (unreadable/encrypted/image-only/unsupported/too messy): show failure state, primary 'try another file/clearer source', secondary 'add one thing myself'. Never add directly to the money path; never route to manual Calendar events after upload. Greenfield import-engine explicitly BLOCKS pdf-image-ocr ('Requires on-device OCR or document capture runtime; this package only accepts text') - so a native PDF text-extraction adapter feeding the import-engine text/csv pipeline (then producing the CandidateMoneyItem contract) is the build.",
      "acceptance": [
        "Choosing PDF runs the PDF reader and produces candidate items for Review (never routes straight to manual).",
        "Detected items carry confidence + 'from your statement' source context.",
        "Nothing reaches Today/path until the user accepts a candidate.",
        "An unreadable/encrypted/image-only PDF shows the failure state with 'try another file' primary and 'add one thing myself' secondary.",
        "Statement upload never sends the user to manual Calendar events."
      ],
      "bannedClaims": [
        "Never present manual entry as equivalent to reading the PDF.",
        "Never add read items directly to the money path before Review.",
        "Never assert current truth from a static statement (speak to what it SHOWED - static-data limit)."
      ],
      "existingRnPackage": "NONE for PDF extraction (import-engine explicitly blocks pdf-image-ocr; accepts text only). Native PDF-text adapter + CandidateMoneyItem bridge must be built; downstream normalisation can reuse @folio/import-engine.",
      "status": "not-built"
    },
    {
      "id": "photo-reader",
      "decision": "Real RN engine: screenshot/photo image -> candidate money items for Review. Try the image reader first; manual typing is failure-only.",
      "model": "Read the image (OCR), produce candidate money items with confidence + source context, send to Review, add nothing until accepted. Same CandidateMoneyItem contract and same failure UX as the statement reader. Greenfield import-engine blocks pdf-image-ocr (owner: native/ocr-adapter) - a native OCR adapter feeding the normalisation pipeline is the build.",
      "acceptance": [
        "Choosing screenshot/photo runs the image reader (does not ask the user to type the image contents by default).",
        "Detected items carry confidence + source context and go to Review.",
        "Nothing reaches Today/path until accepted.",
        "A failed image read shows the failure state with 'try another photo' primary and 'add one thing myself' secondary."
      ],
      "bannedClaims": [
        "Never default to asking the user to type image contents.",
        "Never add read items directly to the money path before Review."
      ],
      "existingRnPackage": "NONE (import-engine blocks pdf-image-ocr; native OCR adapter required). Downstream normalisation can reuse @folio/import-engine.",
      "status": "not-built"
    },
    {
      "id": "text-reader",
      "decision": "Real RN engine: paste / CSV / TXT -> candidate money items for Review. Heuristic with a Review step; do not route to blank manual entry.",
      "model": "Read the text/file, produce CandidateMoneyItem[] with confidence, send to Review, add nothing until accepted. Same failure UX. Greenfield @folio/import-engine ALREADY implements this: parseTextImport (line-based plain statement: date+description+amount, opening/closing balance lines for reconciliation), parseCsvImport (RFC-style CSV with quoted cells + delimiter detection + header inference + sanitizeSpreadsheetText), detectImportFormat, evidence levels, review packet. Strongest-covered reader. RN gaps: paste intake wiring + mapping the canonical rows to the web CandidateMoneyItem shape for the shared Review surface.",
      "acceptance": [
        "Choosing paste/CSV/TXT runs the text reader and produces candidates for Review (not blank manual entry).",
        "CSV with quoted/embedded-delimiter cells parses correctly; delimiter auto-detected.",
        "Formula-like cells are neutralised before staging (sanitizeSpreadsheetText).",
        "Opening/closing balance lines drive a reconciliation warning, not a transaction.",
        "Nothing reaches Today/path until accepted."
      ],
      "bannedClaims": [
        "Never treat the text path as blank manual entry.",
        "Never auto-count parsed rows before Review."
      ],
      "existingRnPackage": "@folio/import-engine (parseTextImport, parseCsvImport, parseOfxImport, parseQifImport, buildImportReviewPacket). Built; needs paste intake + CandidateMoneyItem bridge.",
      "status": "built-verify"
    },
    {
      "id": "money-path",
      "decision": "Core deterministic local engine: computes 'will I make it to payday' verdict + the route shape. x = days from today to payday; y = projected balance after that day. Tight point = min(y); the headline low is the cycle low and does not change when the Today band toggles (band is a viewing lens, not a recompute). Draw the curve from BALANCE (the number the user can verify against their bank), never from spare.",
      "model": "Sample once per calendar day today->payday. y(day) = balance + sum(income up to & incl. day) - sum(bills, subs, logged spend, active holds up to & incl. day) - sum(pots.saved deltas) (pots tie to cash). Tight point = min(y); date label = the day the min lands on; ties resolve to earliest. Spare and 'days remaining' are read-outs derived from this curve, not separate calculations. Pots-tie-to-cash: spendable = balance - sum(pots.saved) + sum(open-borrows); route drawn against spare - sum(pots.saved); recomputeRoute() must account for pots. Today path-scrub = preview + explicit commit (no silent write-back; 'Log £X spend' commits via normal logSpend). 'Things to check' count = number of Review items with status 'candidate' from the latest intake only (caught subs / Melo nudges / ritual prompts are separate surfaces). Greenfield @folio/today-engine.buildMoneyTimelineProjection + buildPositionSummary already implement this in integer minor units (opening balance, per-cashflow projection, lowestMinor + lowestLocalDate, protected floor, availableBeforeNextIncome, riskDetected, same-day protected outflows applied first) and @folio/finance-engine.buildForecast/calculateScenarioOutflowBoundary back the verdict/scenario math.",
      "acceptance": [
        "Today/route never renders from a hidden hardcoded balance; the position resolves to a sourced CurrentPosition (ties to balance-source invariant 5).",
        "Tight point = min projected balance across the full cycle; toggling the Today band does NOT change the headline low.",
        "The curve is computed from balance, not from spare; spare is derived downstream.",
        "Pots reduce drawn spendable (spendable = balance - sum pots.saved + sum open-borrows); recompute accounts for pots.",
        "Path scrub previews only; nothing is written until an explicit commit.",
        "'Things to check' equals only unreviewed latest-intake candidates; clears to zero when Review is empty.",
        "Same-day protected outflows are applied before other movements (greenfield projection rule)."
      ],
      "bannedClaims": [
        "Never draw the path from spare instead of balance.",
        "Never recompute a per-band low (two competing 'lows' invites optimising the wrong window).",
        "Never write state on a path scrub without explicit commit.",
        "Never show earmarked pot money as spendable."
      ],
      "existingRnPackage": "@folio/today-engine (buildMoneyTimelineProjection, buildPositionSummary) + @folio/finance-engine (buildForecast, runScenario, calculateScenarioOutflowBoundary). Built; needs pots-tie-to-cash wiring + path-scrub preview/commit + 'things to check' count source.",
      "status": "built-verify"
    },
    {
      "id": "cycle-tracker",
      "decision": "Detects payday landed, closes the prior cycle, triggers the ritual + insights. closeCycle()/addCycle is a PURE RETROSPECTIVE - actuals only, no projections leak into the closed CycleRecord.",
      "model": "On close, addCycle writes: spare = real balance at the moment of close (from the transaction ledger, NOT projected spare); tightPoint = actual lowest balance observed during the cycle, computed by walking the ledger day-by-day (date label = day of the min; ties earliest); setAside = sum of pot top-ups committed during the cycle PLUS spend-holds that ran to completion without cancellation. Ritual contributions: Step-2 suggestions are EDITABLE rows; addToPot fires only on explicit 'Save these contributions' (one batch); 'Skip' advances without writes but records Step-2 reached. Ritual note (Step-4) is user input -> nextYouNote ('No note this cycle.' when blank); addCycle reads the typed value and clears nextYouNote. closeCycle clears all WhatIf + spend holds. Greenfield @folio/plan-engine provides ritual scaffolding (buildRitualPlan: payday_review|weekly_reflection|month_close, calculateBudgetRollover, runPhase8EmotionalSafetyReview) but NOT the payday-landed detector or the actuals-from-ledger close math.",
      "acceptance": [
        "addCycle's spare/tightPoint/setAside are computed from the actual ledger, never from projected numbers.",
        "tightPoint is the ledger-walked observed low with the correct date label (ties earliest).",
        "setAside = committed pot deposits in the cycle window + completed (uncancelled) spend-holds.",
        "Ritual Step-2 contributions write only on explicit Save (batch), never silently; Skip records reached without writing.",
        "Ritual note persists to nextYouNote and is cleared by addCycle once consumed.",
        "Closing the cycle clears all WhatIf + spend holds."
      ],
      "bannedClaims": [
        "No projected numbers leak into CycleRecord (Insights must not argue with the bank).",
        "Never silently write pot contributions during the ritual.",
        "Never compute setAside from perWeek x 4."
      ],
      "existingRnPackage": "PARTIAL - @folio/plan-engine (buildRitualPlan, calculateBudgetRollover, emotional-safety review). Payday-landed detector + ledger-walk actuals close math NOT built.",
      "status": "partial"
    },
    {
      "id": "insights",
      "decision": "Closed-cycle aggregates computed once at cycle close and stored on the cycle row (recommendation: cycle-close, not view-time). Insights reads stored observations; nothing recomputed at view time. 'Saved across all months' = cumulative setAside (money moved into pots), explicitly distinct from close-day spare and never added to it.",
      "model": "closeCycle() writes a small observations array per cycle: quietest-week (7-day stretch with lowest spend + the headline merchant the user did NOT swipe to), near-cancel (a sub paused then resumed inside one cycle - names the wobble without judgment), biggest-swing (day with the largest change in spare), sub-savings (sum of paused.cost x cycles paused - the 'still working in your favour' tally). CycleObservation union: {kind:'quietest-week',weekStart,spend} | {kind:'near-cancel',subName,pausedAt,resumedAt} | {kind:'biggest-swing',date,deltaSpare} | {kind:'sub-savings',total,subs[]}. 'Saved across all months' = sum(setAside) across closed cycles; CycleRecord.spare is the close-day snapshot used for 'finished with £X left', NOT the saved total - the two are never summed. The savings tally reads cycle-by-cycle from the sub lifecycle, not current paused booleans.",
      "acceptance": [
        "Observations are computed at cycle close and stored on the cycle row; Insights does not recompute at view time.",
        "'Saved across all months' sums setAside only; it never includes close-day spare.",
        "quietest-week / near-cancel / biggest-swing / sub-savings each produce the documented shape.",
        "The sub-savings tally derives from the cycle-by-cycle lifecycle, not live paused booleans."
      ],
      "bannedClaims": [
        "Never add setAside and spare into one 'saved' number.",
        "Never recompute closed-cycle observations from projections.",
        "Never present an Insights number that argues with the user's bank."
      ],
      "existingRnPackage": "NONE dedicated (RN_PORT lists 'Insights engine' as needing a real engine). @folio/plan-engine momentum/budget pieces are adjacent but do not compute these per-cycle observations.",
      "status": "not-built"
    },
    {
      "id": "pot-engine",
      "decision": "Pots tie to real cash with a borrow-back escape. A pot's saved amount is subtracted from Today's spare and the route is drawn against spare - sum(pots.saved) (moving money into a pot visibly lowers the path - intentional). Shortfall can borrow from any pot (lifts the path, writes a borrow ledger entry, next ritual prompts to repay). Borrow is hard-capped to pot.saved by default (per-pot allowNegative override). Auto-top-up on payday is a real rule confirmed in the ritual.",
      "model": "PotLedgerEntry { potId, cycleId, kind:'deposit'|'borrow'|'repay'|'withdraw', amount(positive £, sign implied by kind), at } - one row per mutation. Pot health (derived) = saved + sum(open-borrows) (Pots screen shows the gap subtly; a borrowed-from pot reads honestly). Today header: spendable = balance - sum(pots.saved) + sum(open-borrows). Borrow cap: clamped to pot.saved (UI shows 'max £X available from Buffer', disables past it) unless per-pot allowNegative:true (default false) -> may go negative, surfaced as an honest '-£42 to repay' line (no alarm colour). Auto-top-up: perWeek becomes a real per-cycle rule run at cycle close, shown as a ritual confirm step ('Pots take £42 this cycle - ok?'). Shortfall borrow auto-closes: on confirm the borrow writes immediately, spare re-derives, and if spare>=0 Shortfall auto-dismisses to a green Today (no success modal); partial close keeps Shortfall open with residual gap. setAside (ritual) sums deposit entries in the cycle window - never perWeek x 4.",
      "acceptance": [
        "A pot's saved reduces drawn spendable and recomputeRoute() accounts for it.",
        "Borrow lifts the path by the borrowed amount and writes a borrow ledger entry; the next ritual prompts to repay.",
        "Borrow is clamped to pot.saved by default; allowNegative:true permits a negative pot surfaced honestly.",
        "Pot health = saved + sum(open-borrows) is shown on the Pots screen.",
        "Auto-top-up runs at cycle close as a ritual confirm step, never a silent write.",
        "Shortfall borrow auto-dismisses to a green Today the moment spare>=0; partial close keeps it open with the residual."
      ],
      "bannedClaims": [
        "Never show earmarked pot money as spendable.",
        "Never let a pot go negative when allowNegative is false.",
        "Never auto-write a pot top-up without ritual confirmation.",
        "Never read pot health as if borrowed money is still in the pot.",
        "No celebratory success modal between Shortfall and Today (calm, not celebratory)."
      ],
      "existingRnPackage": "NONE dedicated (no @folio/pot-engine). Web store.ts has PotLedgerEntry + addToPot + a migration backfill, but no borrow/repay/health/cap/auto-top-up engine. @folio/plan-engine protectedFloor concepts are adjacent only.",
      "status": "not-built"
    },
    {
      "id": "nudge-scheduler",
      "decision": "Local notifications, max 1/day, mood-aware (iOS UNUserNotificationCenter / Android WorkManager). The ranking/selection of what to nudge is a pure engine; the actual OS scheduling is a native adapter that the pure layer only REQUESTS, never performs.",
      "model": "Greenfield @folio/today-engine already provides the pure ranking + a blocked scheduling boundary: rankBriefingCandidates (urgency split, max nonurgent items default 3, fatigue penalty per repeat + recency decay, uncertainty/evidence penalty, pinned/overdue/due-today/due-soon deltas, deterministic tie-breakers) and planTasksAndReminders -> NotificationScheduleRequest { blocked:true, blockedReason:'notification_scheduling_blocked_until_runtime_adapter' } (scheduleMutationsCreated:false). The missing piece is the native notification adapter (UNUserNotificationCenter/WorkManager) consuming those requests + the 1/day cap + mood/quiet-hours gating (plan-engine buildRitualPlan already models quietHours + notificationClassesEnabled; runPhase8EmotionalSafetyReview blocks manipulative-retention copy).",
      "acceptance": [
        "At most one nudge per day is delivered; the ranking selects deterministically with documented tie-breakers.",
        "Nudge selection respects mood/quiet-hours and a fatigue penalty for recently-repeated items.",
        "The pure layer only emits NotificationScheduleRequest objects; it never performs OS scheduling (blocked boundary).",
        "Nudge copy passes the manipulative-retention language gate (no 'streak is dying' / 'open now')."
      ],
      "bannedClaims": [
        "Never use manipulative-retention copy ('streak is dying','lose progress','open now','come back now').",
        "Never schedule more than one nudge per day.",
        "The pure engine must never claim to have scheduled an OS notification."
      ],
      "existingRnPackage": "PARTIAL - @folio/today-engine (rankBriefingCandidates + planTasksAndReminders blocked scheduling) + @folio/plan-engine (buildRitualPlan quiet-hours/notification classes, runPhase8EmotionalSafetyReview). MISSING: native UNUserNotificationCenter/WorkManager adapter + 1/day cap enforcement.",
      "status": "partial"
    },
    {
      "id": "store-migration",
      "decision": "Versioned schema with per-version upgrade functions run on load when persisted version < code version, plus a safe-failure mode when persisted state is NEWER than the binary (warn, keep the raw blob, offer reset) - never silently drop fields. Never widen the persisted shape without bumping schemaVersion + adding a migration step.",
      "model": "AppState.schemaVersion + a MIGRATIONS map run on every load(). Web prototype: CURRENT_SCHEMA_VERSION=2; v1->v2 added currentBalance, potLedger, nextYouNote (and backfills potLedger from existing pot.saved as one synthetic 'backfill' deposit dated 30 days ago); future-newer blobs parked under folio.state.v1.future.<n> and DEFAULTS loaded. RN target (greenfield @folio/storage) is the production-grade version: SQL migrations with strictly-increasing versions, checksummed (checksumMigration/defineMigration), validateMigrationOrder (no duplicates, no gaps), planMigrations (rejects unknown applied versions + history gaps + name/checksum drift), applyMigrations in a transaction with a schema_migrations table; portable-vault carries the applied-migration manifest for export/restore. RN must keep the same pattern - no silent default-fallback for missing fields, no shape-widening without a version bump.",
      "acceptance": [
        "A persisted blob older than the code version upgrades through each per-version step on load.",
        "A persisted blob NEWER than the binary triggers safe-failure: warn, park the raw blob, offer reset - never silently drop fields.",
        "Adding any field requires a schemaVersion bump + a migration step (no parsed.field ?? default masking missing-vs-old).",
        "Migrations are strictly increasing, checksummed, and reject duplicates / gaps / name or checksum drift (greenfield validateMigrationOrder/planMigrations).",
        "Applied migrations are recorded transactionally and surface in the portable-vault manifest."
      ],
      "bannedClaims": [
        "Never silently drop fields from a newer-than-code blob.",
        "Never widen AppState without bumping schemaVersion + adding a migration.",
        "Never mask missing-vs-old-version with a silent default fallback."
      ],
      "existingRnPackage": "@folio/storage (defineMigration, checksumMigration, validateMigrationOrder, planMigrations, applyMigrations, ensureMigrationTable, createPortableVault with migration manifest). Built; needs the concrete Folio domain migration set + safe-failure 'newer than binary' path wired into app load.",
      "status": "built-verify"
    }
  ]
}
```
