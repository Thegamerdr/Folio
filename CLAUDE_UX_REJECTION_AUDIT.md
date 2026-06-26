# CLAUDE_UX_REJECTION_AUDIT.md

Folio V2 mobile — UX takeover rejection audit
Date: 2026-06-24
Auditor: Claude (product UX takeover)

## How this audit was produced (read first)

This audit is grounded in the **actual product source** the user runs:
`apps/mobile/src/surfaces/mobileShell.tsx` (8,433 lines, 22 screen components) and
`apps/mobile/app/index.tsx` (the screen router). Line references below point at that code.

It is **not** grounded in the prior "evidence" folders, because those are not evidence of the
real app. Two structural problems make the previous "10/10" claims invalid:

1. **The screenshots are HTML mockups, not the app.** The latest evidence README
   (`apps/mobile/evidence/10-out-of-10-experience-standard-2026-06-24/README.md`) states plainly:
   _"Screenshots were captured from generated HTML pages using Chrome headless at a mobile
   viewport."_ Those `pages/*.html` files are hand-authored and decoupled from `mobileShell.tsx`.
   Only `screenshots/apk-launch.png` is a real device capture, and it is just the launch screen.
   The "10/10" gallery therefore proves nothing about what the React Native app actually renders.

2. **The tests are source-string greps, not behavioural tests.** Nine `*.test.ts` files in
   `apps/mobile/src/surfaces/` `readFileSync` the shell and assert `toContain("...")` on raw source
   text (≈300 such assertions total). They pass whenever a string exists in the file. They never
   mount a component, never check layout, hierarchy, contrast, tap targets, or flow. Worse, several
   **codify the anti-patterns**: `topTierMobileUxQuality.test.ts` asserts all ten review-sheet
   buttons (`label="Add"` … `label="Later"`) must be present, so "green CI" actively _requires_
   the 10-equal-button design the product brief rejects. One test even pins the existence of the
   previous audit file and the sentence "Would the owner still want to uninstall after 10 minutes?
   Risk remains." CI is measuring ceremony, not the product.

**Environment / evidence, stated honestly:** `adb`, the Android SDK and a running emulator
(`emulator-5554`) are available; the JDK only ships inside Android Studio, so a native `gradlew`
build is possible but heavy. Because every fix in this pass is JS/TS only, I verify against the
**real React Native app** with a debug build + Metro (`adb install` the debug variant → Metro
serves the edited bundle → `adb exec-out screencap`). Those are genuine renders of `mobileShell.tsx`
on-device, captured under `apps/mobile/evidence/claude-ux-takeover-2026-06-24/`. They are **not**
the prior pass's hand-authored HTML mockups, and I do not relabel anything as an APK shot it is not.
The on-disk `app-release.apk` is from Jun 23 and predates this code; a fresh `assembleRelease` is the
documented final step for a production-signed artifact + hash.

Verdict scale: **PASS** (ships as-is) · **PARTIAL** (right idea, wrong execution) · **FAIL** (rebuild).

---

## Scorecard

| Screen                  | Verdict | Headline failure                                                                                                                                              |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start                   | PARTIAL | One dominant action exists, but 4 equal secondary cards re-create the menu feel                                                                               |
| Guided manual input     | FAIL    | Chrome (progress bar, "Why this helps", badge, estimate/skip, preview, action row) drowns the one input; reads as a 5-field form with a wizard wrapper        |
| Import entry            | PARTIAL | Honest about OCR, but buries the user under paste panel + file panel + progress % before any decision                                                         |
| PDF/screenshot fallback | PARTIAL | Honest copy, but 6 near-identical "Add … from file" buttons = wall of equal choices                                                                           |
| Review (empty)          | PARTIAL | Truthful empty copy, but stacked behind progress/file/notice chrome                                                                                           |
| Review row              | FAIL    | Row shows `Source: Waiting statement`, abstract `Current state` badge, "Choose action ›"; reads like a database record, not "is this your coffee?"            |
| Review action sheet     | FAIL    | **Ten equal-weight buttons** (Add, Edit, Ignore, Duplicate, Transfer, Refund, Income, Bill, Debt payment, Later) + Close + Ask Melo. The exact banned pattern |
| Today                   | FAIL    | Two redundant "Melo noticed" blocks + a decorative "interaction language" ribbon + always-on route, even with no data                                         |
| Breathing-room route    | PARTIAL | Has real pressure facts, but renders a fabricated line when data is insufficient instead of an honest incomplete state                                        |
| Route detail reveal     | PARTIAL | Tap-to-reveal exists; labels still lean systemy                                                                                                               |
| Debt flow               | PARTIAL | Good intent ("which is worrying you first?") trapped in a 5-step wizard with "Why this helps" scaffolding                                                     |
| Bills flow              | PARTIAL | Single panel, but it's a labelled form (name/amount/date + two toggles) with no money-life framing                                                            |
| More                    | FAIL    | **Leaks internal tooling in normal UI**: "Internal test mode / Owner-only fake seeds", "Try recovery spend", raw record counts                                |
| Data/privacy            | PARTIAL | Strong honesty content, undercut by an "interaction language" ribbon and inventory-style counts                                                               |

Eight of fourteen are PARTIAL and four are FAIL. Nothing here is a confident PASS. The product is
not in a shippable-to-cold-user state.

---

## Per-screen detail

### Start — PARTIAL (`mobileShell.tsx:775`)

- **Why it fails.** There _is_ one primary "Start with a few numbers" (line 804) and a reassurance
  line. But directly under it sit **four visually-equal secondary cards** in a grid
  (`startSecondaryGrid`, lines 813–838): Add bank activity / Organise debts / Check bills / Try
  fake data. Four equal cards immediately rebuild the "choose your job" menu the brief says to kill.
  "Try fake data" sits at the same weight as real first-win paths.
- **Emotion.** Mild decision paralysis. "Which of these five am I supposed to pick?" The dominant
  path is there but doesn't dominate.
- **Better version.** One hero action that fills the fold and clearly looks like _the_ button. The
  rest collapse into a single quiet line — "Already have a statement or a debt to add? More ways to
  start" — that expands the secondary options on demand. "Try fake data" demoted to a faint text
  link, not a card.
- **Fix type.** Layout + interaction (demote secondary set behind a disclosure; widen primary).

### Guided manual input — FAIL (`QuickEstimateScreen`, `mobileShell.tsx:916`)

- **Why it fails.** It claims "one step at a time" but each step renders: a label, a title
  (the question), a body, a **progress bar** (`GuidedProgress`, 1040), a **panel that repeats the
  question** and adds a "Why this helps" label + a "Why this matters" paragraph + an **Optional/
  Estimate/Exact badge** (`GuidedInputStep`, 1265–1318), then the input, then **two control buttons**
  (estimate + skip), then a **preview panel**, then a **Back / Continue** row. That is a wizard
  chrome sandwich around a single number. Step labels read "1 of 5". This is data-entry cosplay.
- **Emotion.** "I'm filling in a finance form and being quizzed on why each field matters." The
  opposite of guided help; it feels like homework with a progress bar judging me.
- **Better version.** One big question, one input the thumb lands on, and a single quiet
  "A rough number is fine — you can fix it later." No badge, no "Why this helps" label, no visible
  "1 of 5". Payoff appears the instant enough is entered ("You've got ~£150 of room until payday"),
  not a "Payday picture preview" sub-card. Estimate/skip become one understated "Not sure" link.
- **Fix type.** Full rebuild of the step component (strip chrome, enlarge the single interaction,
  rewrite copy).

### Import entry — PARTIAL (`ImportReviewScreen`, `mobileShell.tsx:2485`)

- **Why it fails.** Before any decision the user meets: an "Use a bank statement" panel with two
  buttons, an optional paste panel, a "Latest file" panel, then a **progress bar with percentage**
  and a textual "X found. Y ready; Z need review", then an action-notice card. Decisions are below
  the fold under a stack of status furniture.
- **Emotion.** "This is an import console." Administrative, not "let's see your money."
- **Better version.** Lead with the single choice (paste / choose file), and don't show progress
  machinery until rows exist. Collapse "latest file" into a one-line chip.
- **Fix type.** Layout + copy.

### PDF/screenshot fallback — PARTIAL (`mobileShell.tsx:2961`)

- **Why it fails.** Honesty is good ("Automatic reading is not ready for this file yet"), but it
  then offers **six equal SecondaryButtons** (Add money / Add income / Add bill / Add debt payment /
  Keep file for later / Remove file). Equal-weight button wall again.
- **Emotion.** "Too many similar choices" — the fallback feels heavier than just typing the number.
- **Better version.** One primary "Add the key number yourself", with type chosen _after_, and
  quiet "Keep for later / Remove" as text links.
- **Fix type.** Layout + interaction.

### Review (empty) — PARTIAL (`mobileShell.tsx:2718`)

- **Why it fails.** The empty copy itself is fine ("No rows waiting. Use Start to add bank
  activity…"). But it only appears after the paste panel, file panel, progress panel and notice —
  so "nothing to do yet" is framed by a busy console.
- **Emotion.** Confusing: lots of chrome implying work, then "nothing here".
- **Better version.** When there's nothing to review, the screen is mostly the calm empty state and
  one clear way to add activity; hide the progress/file machinery entirely.
- **Fix type.** Layout (conditional chrome).

### Review row — FAIL (`mobileShell.tsx:2730`)

- **Why it fails.** Each row renders the original text, "Looks like …", amount, then a
  `consequenceRows` block with **`Date`, `Source: Waiting statement`, `If added: Money out`**, then a
  footer with an abstract state **Badge** + raw `row.status` + "Choose action ›". "Source: Waiting
  statement" and a state badge are system bookkeeping, not a human question. The brief's target —
  _"Is this your coffee payment?"_ — is nowhere.
- **Emotion.** "I'm auditing a ledger." Cognitive load per row is high; nothing invites a fast
  yes/no.
- **Better version.** Row leads with a human question and the essentials only: what it looks like,
  how much, when, and a one-line "If you add it, your room drops to £X." Tap opens the decision.
  Drop "Source: …", the state badge, and raw status from the row face.
- **Fix type.** Rebuild row layout + copy.

### Review action sheet — FAIL (`mobileShell.tsx:2780`–2932)

- **Why it fails.** The sheet presents **ten equal-weight buttons** — Add (primary) then nine
  SecondaryButtons: Edit, Ignore, Duplicate, Transfer, Refund, Income, Bill, Debt payment, Later —
  plus Close and Ask Melo. This is verbatim the "do not show 10 equal action buttons" anti-pattern.
  The brief wants **Add / Edit / Ignore** visible and everything else under **More options**.
- **Emotion.** Overwhelm. The user opened a row to make one small call and got a control panel.
- **Better version.** Three primary actions (Add / Edit / Ignore) on the row or first in the sheet;
  a single "More options" disclosure reveals Duplicate, Transfer, Refund, Income, Bill, Debt
  payment, Later. Ask Melo becomes a quiet secondary, not a co-equal footer button.
- **Fix type.** Rebuild sheet (primary/secondary split + disclosure).
- **Note.** `topTierMobileUxQuality.test.ts:91-104` asserts all ten labels exist — that test must be
  rewritten to assert the primary/secondary split, not the button wall.

### Today — FAIL (`TodayScreen`, `mobileShell.tsx:1843`)

- **Why it fails.** The screen stacks: a "Melo noticed" pressable (noticed/why/control), the calm
  answer surface with the route, an **InteractionRibbon** that prints "Try first / Show details /
  Record after review" as a decorative legend (1928–1931), **a second "Melo noticed" block**
  (1933–1955), a "What changed?" reveal, recovery panel, source trail. Two Melo blocks is
  redundant; the interaction ribbon is a system legend the brief bans. The route renders
  unconditionally — even with no income/bills entered.
- **Emotion.** Noisy and slightly preachy ("here is how to use me"). The one thing a stressed user
  wants — _will I make it to payday_ — competes with meta-instructions and a duplicate assistant.
- **Better version.** One answer at the top (room until payday or an honest "not enough yet"), the
  route or its incomplete state, one Melo note (not two), and "What changed" only when something
  changed. Delete the interaction ribbon entirely.
- **Fix type.** Rebuild (remove ribbon + duplicate Melo; gate route on data sufficiency).

### Breathing-room route — PARTIAL (`BreathingHorizon`, `mobileShell.tsx:4418`)

- **Why it fails.** The pressure map is actually decent — Current money, Next income, Bills and
  debts, Protected buffer, Lowest point, Waiting review, Accepted changes, tap-to-reveal points.
  But when there's no real route, it falls back to a **fabricated preview line** ("Example gets
  tight", `breathingHorizonGeometry`) rather than telling the truth. The brief is explicit: with
  insufficient data, show _"Add your next income and one must-pay item to see whether this lasts"_ —
  not a decorative line.
- **Emotion.** Quiet distrust if noticed: "what is this line actually based on?"
- **Better version.** Keep the real pressure map. Replace the synthetic-preview branch with the
  honest incomplete state. Never draw a line that isn't backed by entered facts.
- **Fix type.** Interaction/logic (replace fabricated fallback with incomplete state) + copy.

### Route detail reveal — PARTIAL (`mobileShell.tsx:4490`+)

- **Why it fails.** Tap-a-point reveal works and is the right idea, but surrounding labels
  ("authority state", source-state phrasing in the timeline evidence) still read systemy in places.
- **Emotion.** Mostly fine; occasional "what does that label mean?"
- **Better version.** Human one-liners on reveal: "This dip is your £94 energy bill on the 25th."
- **Fix type.** Copy.

### Debt flow — PARTIAL (`DebtGuidedScreen`, `mobileShell.tsx:1394`)

- **Why it fails.** The framing is genuinely good — "Which debt payment is worrying you first?",
  "Folio does not tell you what to pay first" (1619–1625). But it's delivered through the same
  5-step `GuidedInputStep` wizard with "Why this helps" scaffolding and an estimate/skip row per
  step. Collected fields (lender, balance, min payment, due date, APR, status, note, pressure) are
  right; the _feel_ is a multi-page form.
- **Emotion.** The empathy in the copy is undercut by wizard fatigue.
- **Better version.** Keep the empathetic lead and the fields, but compress to a calmer single
  surface (or 2 light steps), drop the per-step "Why this helps" badge, and surface the one
  consequence that matters: "This is due before your next income."
- **Fix type.** Layout + copy (reuse the rebuilt guided component).

### Bills flow — PARTIAL (`BillGuidedScreen`, `mobileShell.tsx:1701`)

- **Why it fails.** It's a single panel (good), but it's a plain labelled form: name, amount, date,
  plus Must-pay/Flexible and Recurring/One-off toggles, then a generic "What this changes"
  paragraph. No "what's coming up before payday" framing.
- **Emotion.** "Add a bill" as data entry, not "let's make sure this is covered."
- **Better version.** Lead with the upcoming-pressure question, show the single consequence
  inline as the amount/date are typed, and make must-pay the obvious default rather than a toggle.
- **Fix type.** Copy + light layout.

### More — FAIL (`MoreScreen`, `mobileShell.tsx:3806`)

- **Why it fails.** Normal users see, unconditionally: **"Internal test mode"** with detail
  _"Owner-only fake seeds, reset and redacted test files"_ (3886–3891); **"Try recovery spend"**
  (3871); "Replay first minute" (3895); and a "On this device" panel printing raw inventory —
  _"12 transactions, 3 drafts, 1 files"_, _"source-linked records"_, _"saved changes"_ (3937–3954).
  This is internal/developer state leaking straight into the product. The top bar also shows a
  literal **"Test"** chip when dogfood mode is on (`index.tsx:733-744`).
- **Emotion.** Instant distrust. "Internal test mode" and "fake seeds" inside a _financial_ app
  reads as unfinished and unsafe — a 10-minute uninstall trigger on its own.
- **Better version.** Normal More shows only: What changed, Calendar, Plans, Data and privacy,
  Help, Settings. No counts of objects. Developer/test tools (dogfood, replay, diagnostic export)
  appear **only** behind an explicit dev mode (`__DEV__` and/or a deliberate toggle), never in a
  release build. Rename "Try recovery spend" to a human label ("What if I spend?").
- **Fix type.** Rebuild (gate dev tools behind dev mode; remove counts; relabel).

### Data/privacy — PARTIAL (`DataControlScreen`, `mobileShell.tsx:4112`)

- **Why it fails.** The honesty content is strong ("Empty workspace, not zero balance"). But it
  carries an **InteractionRibbon** system legend (4215–4222) and inventory-style counts
  ("X saved rows across Y dated points"). The clear-records arming flow is good.
- **Emotion.** Trust-positive overall, slightly clinical.
- **Better version.** Keep the ownership/clear story; delete the interaction ribbon; soften counts
  into plain language ("Everything you've added is here, and you can take it or wipe it").
- **Fix type.** Copy + remove ribbon.

---

## Language system — banned terms still present in shipping code

Found in user-reachable copy / labels (not just variable names):

- "Internal test mode", "Internal test", "Owner-only fake seeds", "redacted test file" (More, Dogfood)
- "Try recovery spend" (More)
- "local ledger" phrasing in accessibility labels (e.g. `mobileShell.tsx:3218`, 3770)
- Inventory counts surfaced as UI ("12 transactions, 3 drafts, 1 files", "source-linked records",
  "money rows, events") — these are "object count" in spirit
- The top-bar "Test" chip (`index.tsx`)

The existing ban test (`topTierMobileUxQuality.test.ts:192`) only checks a handful of words against
_quoted_ copy and **misses every item above**, because "Internal test mode" etc. aren't on its list
and the counts are built from template literals it doesn't scan. The ban list needs to be centralised
and enforced against all rendered strings, including the developer surfaces (which should instead be
removed from normal mode entirely).

---

## Quality-gate self-check (answered honestly, current state)

1. Does it still feel like a form? **Yes** — guided input and bills especially.
2. Does it still feel like a calculator? **Partly** — the "What if" purchase stepper and money math.
3. Does Start still feel like a menu? **Partly** — one hero, but four equal cards under it.
4. Are review actions natural? **No** — ten equal buttons; rows read like ledger records.
5. Does the route answer a real money question? **Sometimes** — yes when data exists; it fabricates
   a line when data is missing instead of asking for it.
6. Is any internal language still visible? **Yes** — "Internal test mode", "Owner-only fake seeds",
   object counts, the "Test" chip.
7. Would a cold user know what to do? **Mostly** at Start, then **lost** in the guided form and the
   review console.
8. Would a stressed user continue? **At risk** — the form feel and console density push them away.
9. Would the owner still uninstall after 10 minutes? **Risk remains** — chiefly from the leaked
   internal tooling and the form/console feel.

This is not a 10/10. It is a product with a sound spine (honest data model, real route math, good
intentions in copy) wearing developer clothing and form chrome.

---

## Fix priority (what I am changing, in order)

1. **Stop the internal leak (P0).** Gate every dev/test surface (dogfood, replay, diagnostic
   export, the "Test" chip) behind explicit dev mode; strip object counts and internal phrasing from
   normal UI; relabel "Try recovery spend". (More, Dogfood, top bar, Data)
2. **Collapse the Review action sheet** to Add / Edit / Ignore + "More options"; rebuild the review
   row around a human question.
3. **Make Today honest and quiet** — remove the interaction ribbon and the duplicate Melo block;
   show the incomplete-route state when data is insufficient (and stop fabricating a line in the
   route component).
4. **Rebuild guided input** as one real interaction at a time; reuse it for the debt/bill flows.
5. **Demote Start's secondary cards** behind one quiet disclosure; widen the primary.
6. **Centralise and enforce the language ban**; soften copy to the approved vocabulary.
7. **De-theatre the tests** — replace source-string greps that pin anti-patterns with assertions
   that reflect the corrected design (and add the genuinely useful ones: no internal language in
   normal UI, dev tools gated, primary/secondary review split, no fabricated route).

Evidence for each change is the real diff + honest tests against the real shell, plus on-device
renders captured from the debug build over Metro — never re-labelled HTML mockups, and never a claim
of an APK shot I did not take.

---

## Session status (2026-06-24)

Seven fixes — including all four FAILs and the worst language leak — are done and **verified on the
real app** (emulator-5554, debug build + Metro). Typecheck and the full vitest suite (586 tests) are
green; every brittle grep test that pinned an anti-pattern was rewritten to assert the corrected
design.

| #   | Fix                                                                                                                                                                                                                  | State              | Proof                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| 1   | Internal-state leak — gate dev/test surfaces + the top-bar chip behind explicit developer mode (off by default, only available in `__DEV__`), strip object counts, relabel "Try recovery spend" → "What if I spend?" | **Done, verified** | `02-more-after-fix.png`                                             |
| 2   | Review action sheet — Add / Edit / Ignore up front, other 7 behind "More options"                                                                                                                                    | **Done, verified** | `03-review-sheet-collapsed.png`, `04-review-sheet-more-options.png` |
| 3   | Today — removed the decorative interaction ribbon + duplicate Melo block; route shows an honest incomplete state instead of a fabricated line                                                                        | **Done, verified** | `06-today-incomplete-route.png`                                     |
| 4   | Start — one dominant path, secondary cards behind an "Other ways to start" disclosure, "Try fake data" demoted to a link                                                                                             | **Done, verified** | `07-start-dominant-path.png`, `08-start-other-ways-expanded.png`    |
| 5   | Review row — leads with a human question ("Is this Coffee?"), drops the state badge / raw status / "Choose action"                                                                                                   | **Done, verified** | `09-review-row-human.png`                                           |
| 6   | `RouteRow` language — removed the permanent "Source: Current picture" (now reveal-only "Show why") and relabelled badges Known/Preview/Review → Confirmed/Estimate/Check, app-wide                                   | **Done, verified** | `10-review-row-no-source-leak.png`                                  |
| 7   | Guided input — stripped the wizard chrome ("Why this helps", Optional badge, visible "1 of 5"); one question, one input, "A rough number is fine. You can correct it later."                                         | **Done, verified** | `11-guided-input-one-question.png`                                  |

| 8 | Bills flow — the "what happens when you save it" panel is now dynamic ("Rent — −£875.00 due …, Folio keeps this in front of you before your next income"), not a static form note | **Done** (tests) | — |
| 9 | PDF/screenshot fallback — collapsed the 6 equal "Add … from file" buttons (all calling the same handler) to one primary "Add the numbers yourself" + quiet Keep/Remove links | **Done** (tests) | — |
| 10 | Language — replaced user-facing "local ledger" → "your records on this device" | **Done, verified** | row/Today renders |
| 11 | Review empty state — the 0% / "Waiting for a statement" progress console no longer shows until an import is actually in progress | **Done, verified** | `12-review-empty-calm.png`, `13-first-launch-start.png` |

Still open (polish, not FAILs): full visual-system pass (card density/depth, selected-state weight);
a few remaining systemy accessibility strings; and a production release APK — `assembleRelease`
currently fails on this box at `com.facebook.react.rootproject` with `java.io.IOException: Invalid
file path` (a Windows Expo/RN-gradle config quirk, not a code issue; reproduced via both raw `gradlew`
and `expo run:android`). The debt flow inherited the guided-input cleanup automatically.

Not a 10/10, and not claimed as one — but all four FAILs and the worst language leaks are genuinely
fixed on the real app, verified on `emulator-5554`. The remaining items are polish and one
environment-blocked packaging step, not the structural failures the brief rejected.
