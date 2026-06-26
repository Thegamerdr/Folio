# Folio V2 — Master Product / UX Decision Artifact

> Status: decision artifact, not an implementation patch. It governs the next implementation.
> Authority order (highest first): owner Android testing → real APK screenshots/video → V2 money-clarity world model → review-before-truth → local-first/private-by-default. Donor V1 logic and old "10/10" docs are reference, not authority.
> Honesty rule, applied throughout:
>
> **We have validated many failures. We have not yet validated the final solution. The next design is a high-confidence hypothesis that must be tested with cold users.**
>
> A 10/10 Folio is proven by behaviour, not by documents.

---

## 1. Executive verdict

**Current state.** The core path (Start → guided input → Today → Review) was rebuilt this session and verified on a real Android build (emulator-5554), not on mockups. Today no longer contradicts itself (it showed "needs attention" + £1,250 + jargon _next to_ "£325 to spare"; it now shows one verdict, one number, one human source line). The guided flow no longer reads as a form. The Review action sheet collapsed from a ~10-button wall to one primary + "More". Language is human across Start/Today/graph. Typecheck and the full test suite are green. So the spine is sound and the worst failures are closed.

**Why it (still) fails the bar.** The app was originally organised around the data model, not around the user's decision — and residue remains. Specifically: the Review screen still stacks too much vertically (paste panel + latest-file + progress + rows + reveals). The route drill-down panel ("what's happening here") repeats a "Confirmed" badge and "Show why" on every line and surfaces engine copy ("£875 is protected before bills before optional spending"). There is no distinctive identity — it is clean but could be any finance app. And, most importantly: **none of this has been put in front of a cold user.** We fixed what we could observe; we have not proven the fixes land.

**What is salvageable.** Almost everything. One money model, the route engine, review-before-truth staging, the near-flat paper system, the coherent Today, the de-tedied guided flow, and the collapsed review sheet are all keepers. There is no reason to rewrite the product.

**What must change.** (a) Cold-user validation, before more building. (b) Density and engine-copy on Review and the route drill-down. (c) First-class debt/bill/income flows (currently the guided flow only seeds money/income/one-bill). (d) A real identity. (e) The 8,400-line `mobileShell.tsx` monolith must eventually be split — it makes every change risky.

**Ready for cold-user retest?** **Yes — for the core path now.** It is good enough to learn from. Treat the retest as the next gate, not as a launch.

---

## 2. Final current product definition

> **Folio is a private, local-first money-clarity app for people who need to know where they stand, what's coming, what needs checking, and whether their money will last to payday.**

Operational reading: Folio takes what you already have (a rough number, a bank statement, a debt, a bill), keeps it on your device, and turns it into one calm answer — _do I make it to payday, and what's pressing before then_ — that you can inspect and trust. Nothing counts until you say so.

---

## 3. Product non-goals (not building now)

- Not a generic life-admin app.
- Not a productivity / task / Motion / Ledger app.
- Not business accounting.
- Not tax filing.
- Not financial advice ("you should…", "best decision", recommendations).
- Not a bank dashboard (no live balance feed worship, no transaction-stream-as-product).
- Not a spreadsheet/budget-grid clone.
- Not an AI chatbot (Melo proposes, it is not the product).
- Not a generic budgeting app (envelopes/categories are not the spine).
- Not a career/portfolio "proof" artifact.

These are donor material or future expansions. They do not get to weaken money clarity before the core works.

---

## 4. Validated vs unvalidated

### Validated failures (observed — these are real, not hypotheses)

- Cold user froze and handed the phone back (owner testing).
- App felt tedious / form-like / calculator-like.
- PDF/screenshot import was not useful (no OCR; weak fallback).
- Row review felt mechanical / unnatural (wall of equal actions).
- Graph/route read weak / cartoonish in its earlier state.
- Language was system-like / jargon-leaking ("manual entry", "user confirmed", "not required", source/authority tokens).
- Internal/test surfaces leaked into the product.
- Start read like a menu, not a first action.
- Today contradicted itself (false alarm + wrong number + jargon beside the real answer).
- The app did not create desire to continue.

### Not yet validated (these are open hypotheses — do not assert them)

- The lens/mental-model entry model.
- The exact route visual design.
- The exact review interaction (sheet vs inline; "Add to my money" wording).
- The exact language system as a whole.
- The exact manual input stepper.
- The exact import fallback for unreadable files.
- Retention / repeat usage / does anyone come back.
- Trust with **real** money data (we tested with seeded/typed data only).
- Real bank-file coverage (no fixture gauntlet yet; CSV/text only, and only lightly).
- Whether the warmer voice actually reduces anxiety or reads as twee.

---

## 5. User mental models

Folio must serve these. Each entry: the user's question / what they fear / what they need first / what the screen should prioritise / what to hide / language that helps.

**1. Payday survival** — _"Will I make it to payday?"_ Fears: running out, an unexpected bill, an overdraft. Needs first: one yes/no answer with the spare/shortfall amount. Prioritise: the route verdict + the lowest point. Hide: categories, history, settings. Language: "make it to payday", "to spare", "you're short", "tightest day".

**2. Debt clarity** — _"How bad is my debt and what's due?"_ Fears: judgement, a number too big to look at, missing a payment. Needs first: a calm list of who/how much/when, and what it leaves them to live on. Prioritise: debt items + their pressure on the route. Hide: APR math, optimisation advice. Language: "organise debts", "minimum payment", "due", consequence-only.

**3. Bills calendar** — _"What's coming up and can I cover it?"_ Fears: a bill landing before payday. Needs first: bills in date order with must-pay flagged. Prioritise: upcoming must-pays vs available money. Hide: paid history, flexible spend. Language: "coming up", "must-pay", "before payday".

**4. Bank activity review** — _"What happened / what's this charge?"_ Fears: fraud, a forgotten subscription, being overwhelmed by rows. Needs first: a short, scannable list of rows to check — nothing auto-applied. Prioritise: rows waiting, one obvious action each. Hide: anything already settled and irrelevant. Language: "what needs checking", "added", "ignored", "from your statement".

**5. Current position** — _"How much do I actually have right now?"_ Fears: the real number being worse than they think. Needs first: one big honest figure with where it came from. Prioritise: available-now + source line. Hide: projections, breakdowns (behind a reveal). Language: "where you stand", "from the money you entered", "left to spend".

**6. Avoidance / anxiety / "guide me"** — _"I don't want to deal with this; just tell me what to do first."_ Fears: being judged, doing it wrong, a wall of inputs. Needs first: one tap, a rough number accepted, visible progress. Prioritise: a single guided step + reassurance. Hide: everything else. Language: "a rough guess is fine", "you can correct it later", "one thing at a time".

**7. Control / inspect mode** — _"I want to see exactly why this number is what it is."_ Fears: a black box, the app being wrong. Needs first: every number explains itself on demand. Prioritise: show-why reveals, point detail. Hide nothing — but keep it behind taps, never default. Language: "show why", "based on what you added", "waiting for review".

---

## 6. 10/10 experience principles (hypothesis, to be proven by cold users)

1. One obvious next step on every screen.
2. First real value in under 60 seconds.
3. Mental-model-first, not dashboard-first.
4. Review before anything counts — staged items never move the answer until accepted.
5. Gentle reveal for stressful information; bad news gets truth + context + a path, never red shame.
6. Manual input feels like building a picture, not filling a form.
7. Import is honest, not magical — it never claims to read what it can't.
8. Debt, bills, income, and pressure are first-class, not afterthoughts.
9. Every number can explain itself (show-why), but explanation is never the default surface.
10. The route answers a real question, not "here is a chart".
11. Melo guides the next action; it is not the product.
12. Advanced control exists but is never the default path.
13. No internal/system language anywhere a user can see.
14. No shame, no advice, no fake certainty.
15. Screens are judged by whether users continue — not by feature count.

---

## 7. Screen-by-screen target spec

Format per screen: **Purpose · Primary · Secondary · Show · Hide · Language · Fails if · Acceptance.**

**1. Start** — Purpose: pick the one job that brings the user in. Primary: "See where you stand" (guided money picture). Secondary (behind a "Start another way" reveal): use a bank statement, sort out a debt, check a bill; quiet tertiary "example numbers first". Show: one dominant card + reassurance ("Nothing's saved until you say so"). Hide: lens jargon, dashboards, counts. Language: plain job verbs. Fails if: it reads like a menu of equals or a stressed user can't pick. Acceptance: cold user taps the primary without help in <5s. _(Current build: meets this; verified.)_

**2. Guided manual input** — Purpose: build the first picture in a few taps. Primary: "Next" / "Save first picture". Secondary: "Rough estimate", "Skip for now", "Back". Show: "STEP n of 4", a progress bar from frame one, one question, an encouraging line, a compact live preview. Hide: all other steps; any precision/"exact or rough" question. Language: "a rough guess is fine", "you can correct it later". Fails if: more than one question on screen, or the action falls below the fold. Acceptance: completes in <60s; the answer appears before scrolling. _(Current build: meets this; verified — redundant "exact/rough" step removed.)_

**3. Payday flow** — Purpose: the default outcome of guided input — the make-it-to-payday answer. Primary: review/accept the picture → Today. Secondary: edit a number. Show: the route verdict + spare/shortfall. Hide: advanced route controls. Language: payday survival. Fails if: it shows a chart before it shows the answer. Acceptance: user can state "yes/no, with £X" after one read.

**4. Debt flow** — Purpose: capture a debt as a first-class pressure. Primary: "Save debt". Secondary: mark urgent, add note. Show fields: lender/name, balance, minimum payment, due date, APR (optional), status, note. Hide: payoff strategy/advice. Language: consequence-only ("this leaves you £X to live on"). Fails if: it advises, or treats debt as a generic expense. Acceptance: a saved debt visibly changes the route's pressure. _(Current build: `DebtGuidedScreen` exists but is thin — needs the full field set + status.)_

**5. Bills flow** — Purpose: capture an upcoming bill. Primary: "Save bill". Secondary: mark must-pay, set repeat. Show fields: name, amount, due date, repeats, must-pay/flexible, paid/unpaid. Hide: category taxonomies. Language: "coming up", "must-pay". Fails if: bills can't be flagged must-pay or dated. Acceptance: a must-pay bill before payday shows on the route as a drop.

**6. Add bank activity** — Purpose: get rows in to review. Primary: "Choose CSV/TXT file". Secondary: "Paste statement text". Show: what's supported plainly + the honesty line about PDFs/screenshots. Hide: parser/format internals. Language: "add bank activity", "rows to check". Fails if: it implies it can read anything, or buries the supported path. Acceptance: a valid CSV produces staged rows, nothing added.

**7. PDF/screenshot fallback** — Purpose: be honest when a file can't be read. Primary: "Add the numbers yourself". Secondary: "Keep for later", "Remove file". Show: this panel at the **top**, as the first thing, with the manual path. Hide: any pretence of auto-reading. Language: "We can't read this file automatically yet. You choose what to keep." Fails if: it reads as a dead end or is buried at the bottom. Acceptance: user reaches the manual path in one tap; never thinks the app "failed". _(Current build: panel hoisted to top; verified.)_

**8. CSV/text import review** — Purpose: turn a file into checkable rows. Primary: open a row. Secondary: paste box, supported-format note. Show: rows as flat scannable lines (what / how much / date / "Add to my money"). Hide: dense per-row control panels. Language: "from your statement", "worth a look". Fails if: rows look like a spreadsheet or auto-apply. Acceptance: nothing reaches Today until accepted. _(Current build: rows flattened; verified.)_

**9. Review queue** — Purpose: the place waiting items live. Primary: work through rows. Secondary: filters later (not now). Show: one calm empty state ("No statement yet"), then rows. Hide: progress/instrumentation clutter; collapse the supporting panels. Language: "waiting for review", "nothing added yet". Fails if: it stacks five panels above the first row. Acceptance: the first row is visible without scrolling past instrumentation. _(Current build: empty state done; **density still too high — fix this**.)_

**10. Row action sheet** — Purpose: decide one row naturally. Primary: "Add to my money" (single dominant action). Secondary (behind one "More"): Edit, Ignore, Duplicate, Transfer, Refund, Income, Bill, Debt payment, Later. Show: the row, its money-in/out consequence, "nothing changes until you do". Hide: all secondary actions until "More". Language: plain verbs, no "decision consequences" header. Fails if: more than one action competes as primary. Acceptance: a user adds a row in one tap, or finds the right label behind "More" in two. _(Current build: collapsed to one primary + More; verified.)_

**11. Today** — Purpose: the home answer — where you stand and whether you make it. Primary: "Show the breakdown" / open a point. Secondary: Melo note, what-changed. Show: one human headline, one huge tabular number, the route, the verdict. Hide: settings, history, internal state. Language: "You make it to payday — £X to spare". Fails if: two numbers disagree, or jargon appears, or it shows a false alarm. Acceptance: one read tells the user yes/no + £X; no contradiction. _(Current build: coherent; verified.)_

**12. Breathing-room route** — Purpose: prove the payday answer visually. Primary: tap a point to see why. Secondary: toggle breakdown. Show: today, available, next income, bills, debt payments, protected buffer, lowest point, waiting items, accepted changes, estimates. Hide: decorative flourish. Language: "lowest after bills", "set aside for bills". Fails if: it's decorative, or draws a line the data can't support. Acceptance: the line, the lowest point, and the verdict agree. _(Current build: twin-stroke green route, area fill, marked low point, incomplete-state guard; verified. Amber when items await review — correct.)_

**13. Route detail reveal** — Purpose: explain one point. Primary: read the cause. Secondary: none. Show: when, balance after, what caused it, whether it's counted yet, what's still to check. Hide: repeated badges, repeated "Show why" on every line, raw engine phrasing. Language: "what's happening here", "left after this", "what caused it". Fails if: it reads engineery or repeats itself. Acceptance: a user can explain one drop in their own words. _(Current build: labels humanised; **density + engine copy still need a pass — fix this**.)_

**14. What changed** — Purpose: since-last-time delta. Primary: review changes. Secondary: open a change. Show: what moved and why. Hide: full history. Language: "what changed", "added", "ignored". Fails if: it's a raw log. Acceptance: user sees only meaningful changes.

**15. Data/privacy** — Purpose: prove local-first control. Primary: see what's stored / start fresh. Secondary: export later (not now). Show: "on this device", what's kept, how to wipe. Hide: cloud/sync promises (out of scope). Language: "private", "on this device", "you control this". Fails if: it implies cloud. Acceptance: user believes their data is local and theirs.

**16. More** — Purpose: everything non-core, demoted. Primary: none dominant. Secondary: data/privacy, help, the few real extras. Show: a short list. Hide: **all** internal/test/dev tools unless `__DEV__`. Language: plain. Fails if: a tester sees "internal test mode", object counts, replay, or a "Test" chip. Acceptance: nothing internal is visible in a normal build. _(Current build: dev surfaces gated behind `developerModeEnabled`; verify again in the retest build.)_

**17. Melo / help** — Purpose: guide the next action, on request. Primary: "show why" / suggest a label. Secondary: ask a question (≤3). Show: a proposal the user accepts or ignores. Hide: any direct write; any "I fixed your finances". Language: proposes, never commands; no advice. Fails if: Melo writes anything itself or becomes the main surface. Acceptance: Melo only ever proposes; the user always decides.

---

## 8. Import / review truth model

The non-negotiable contract (consistent with ADR-003 and review-before-truth):

- Bank-file rows are **claims, not events**. Parsing a file creates **staged/waiting** items.
- **Nothing affects Today, the route, the timeline, or any balance until the user accepts it.** An empty baseline is not a confirmed zero.
- When the user accepts a row, it becomes a money movement (a posted fact / transaction) — never before.
- A meaning/category is only set when the user confirms it **or** a deterministic, unambiguous rule applies. Folio never silently re-interprets.
- A future-dated item never becomes a past "fact" — future money is an expectation/commitment, surfaced as such.
- PDF/screenshot **without OCR is manual fallback only**. Never claim to have read it.
- CSV/text support must be **tested with fixtures before it is claimed**. (Today it is only lightly exercised.)
- Real bank files require a **fixture gauntlet** (multiple banks/formats) before "import works" is true.

### Required review actions and their effect

| Action           | Effect on Today / route / timeline                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| **Add**          | Accept the row → becomes a money movement; now affects available money, the route, and the lowest point. |
| **Edit**         | Change amount/date/meaning while it stays **waiting**; no effect until added.                            |
| **Ignore**       | Remove from the queue; never affects anything; no saved record changes.                                  |
| **Duplicate**    | Mark as a duplicate; excluded; no effect.                                                                |
| **Transfer**     | Mark as an internal transfer/movement; excluded from spend/income; no net effect on position.            |
| **Refund**       | Mark as money **in**; stays waiting until added, then increases available money.                         |
| **Income**       | Label as income (money in); stays waiting; when added, raises the route and may move payday.             |
| **Bill**         | Label as a must-pay out; stays waiting; when added, shows as a drop before payday.                       |
| **Debt payment** | Label as a debt outflow; stays waiting; when added, reduces available and feeds debt pressure.           |
| **Later**        | Leave waiting, unchanged; it stays visible in Review but changes nothing.                                |

(Owner instruction in this brief sets the verb set as Add/Ignore/… — this supersedes the older canonical "Accept/Reject" wording in the voice doc. Pick **one** vocabulary and use it everywhere; this artifact uses Add/Ignore.)

---

## 9. Debt / bill / income model (all first-class, consequence language only)

**Debt** — lender/name · balance · minimum payment · due date · APR (if known) · status (current / behind / arrangement / unknown) · note · pressure (how much it tightens the route). No payoff advice; show only "this leaves you £X before payday".

**Bill** — name · amount · due date · repeats · must-pay vs flexible · paid/unpaid. Must-pay bills before payday appear as route drops.

**Income** — source · amount · date · repeats · confirmed vs expected. Expected income is labelled as such on the route; it never masquerades as money already in.

Rule for all three: **fact → assumptions → consequence → user choice.** Never "you should". Never a score.

---

## 10. Breathing-room route — target

The route must answer, in this order:

```
Will I make it to payday?
When do I run tight?
What causes the drop?
What improves the picture?
What still needs review?
```

It must show: today · available money · next income · bills · debt payments · protected buffer · lowest point · waiting-review items · accepted changes · estimates (labelled). Every plotted point is tappable and explains its cause. It is never decorative, and it never draws a line the data cannot support.

Incomplete state (when there isn't enough to answer):

```
Add your next income and one must-pay item to see whether this lasts.
```

Complete state must make the verdict, the lowest point, and the line agree. Items awaiting review tint the route to signal "not final" — they do not move it.

---

## 11. Language system

**Banned / risky (never visible):** canonical · parser · provenance · indexed · financial reality · make real · event graph · object count · diagnostic · local ledger · source record · already real · confirmed local calculation · confidence score · recovery scenario · reviewed meaning · staged locally · manual entry · user confirmed · not required · "you should" · best decision · guaranteed · "your score is".

**Preferred:** what needs checking · added · ignored · saved · coming up · what changed · make it to payday · organise debts · check bills · add bank activity · try fake data · show why · a rough number is fine · you can correct it later · based on what you added · waiting for review · where you stand · to spare · you're short · nothing changes until you do.

**Tone:** calm, plain, adult, serious, non-judgemental. Not childish, not corporate, not technical. Speak to a stressed competent adult, briefly.

---

## 12. Visual / product quality bar (market-grade)

**Reject:** card walls · form stacks · documentation/explainer panels as default · weak grey text doing important work · too many equal actions · cartoon graphs · fake dashboards · internal chips/counters · design-system-demo feel · drop-shadow "depth" (out of spec) · custom font pairings (out of spec) · any colour outside the paper/ink/green/amber/coral system.

**Require:** one dominant action per screen · strong hierarchy via scale contrast (system fonts: weight + tight tracking + scale, tabular-nums on money) · row-specific actions · a serious route visual · clear state (waiting/added/estimate) · readable contrast · mobile-native interaction (sheets, taps) · 44–48dp tap targets · near-flat elevation (hairline borders + tinted fills) · emotional calm.

---

## 13. Implementation plan (strict, in order)

Each step lists likely files and acceptance. The 8,400-line `apps/mobile/src/surfaces/mobileShell.tsx` holds every screen — splitting it is a prerequisite for safe sustained work and is folded into the steps where it hurts most.

1. **Remove internal/test leakage.** Files: `mobileShell.tsx` (More, top-bar chips), `app/index.tsx`. Accept: a normal (non-`__DEV__`) build shows zero internal tools/counters/test chips — verified by screenshot.
2. **Start: one dominant first path.** Files: `mobileShell.tsx` (`StartScreen`), `productExperienceStandard.ts`. Accept: cold user taps the primary in <5s, no help. _(Largely done — confirm in retest.)_
3. **Guided input as a real stepper.** Files: `mobileShell.tsx` (`QuickEstimateScreen`, `GuidedInputStep`/`GuidedProgress`). Accept: one question per screen, progress from step one, answer above the fold, <60s. _(Done — confirm in retest.)_
4. **Review row + action sheet.** Files: `mobileShell.tsx` (`ImportReviewScreen`), `productExperienceLoop.ts`. Accept: flat rows, one primary "Add to my money", everything else behind "More"; **and** thin the queue so the first row sits above instrumentation. _(Sheet done; density still open.)_
5. **Route incomplete/complete states.** Files: `mobileShell.tsx` (`BreathingHorizon`), `localLedger.ts` (`buildLocalRouteSummary`), `packages/today-engine`. Accept: verdict, lowest point, and line agree; incomplete state asks for exactly what's missing; **rewrite the detail-reveal density and engine copy** ("protected before bills before optional spending").
6. **Debt / bill / income flows.** Files: `mobileShell.tsx` (`DebtGuidedScreen`, bill/income screens), `localLedger.ts`. Accept: full field sets (§9); a saved debt/bill visibly changes route pressure.
7. **Clean More.** Files: `mobileShell.tsx`. Accept: short, plain, no internal tools.
8. **Apply the language gate.** Files: all surfaces + a test that greps visible strings against §11. Accept: zero banned terms in visible copy; the test enforces it.
9. **Generate APK evidence.** Unblock release build first (`apps/mobile/android/local.properties` `sdk.dir` must use forward slashes / `ANDROID_HOME`). Accept: a real APK + the §14 screenshot/video set.
10. **Cold-user retest.** Accept: §15 pass criteria met, or a documented failure list to feed the next iteration.

---

## 14. Evidence plan (real APK, not static renders)

Prior "evidence" was headless-Chrome renders of hand-authored HTML mockups — that is theatre and is not acceptable. Required, from a real build on a real device:

- **Screenshots:** Start · guided step 1 · guided after a value · Review queue · row action sheet · "More" expanded · PDF/unreadable fallback · Today incomplete route · Today complete route · route detail reveal · debt flow · More (no internal tools) · Data/privacy.
- **A tap-through video** of the full core path.
- **CI result** (typecheck + full suite green) and the **APK hash**.
- **Cold-user test result** (§15) — the only evidence that actually proves improvement.

No claim of "fixed" or "10/10" without the screenshot and the cold-user result behind it.

---

## 15. Cold-user test script

Hand the unlocked phone to someone unfamiliar, say nothing beyond "have a look", and observe.

Record: what they think the app does · their first tap · where they hesitate · where they stop · whether they understand fake vs pending vs added data · whether they understand that review doesn't change anything until they accept · whether they understand the payday route · whether they'd keep using it.

**Pass** (all must hold):

- Understands it's about money/payday within ~10s, unprompted.
- First meaningful tap within ~5s, no help.
- Reaches first real value in <60s.
- Correctly says a pending/example item "hasn't been added yet".
- Reviews one row and predicts what "Add" will do.
- States, in their words, whether they make it to payday and roughly by how much.
- Says they'd continue, and does not report feeling judged or like they're filling a finance form.

**Fail** = any of: freezes, hands the phone back, asks "what do I do", thinks pending data is real, can't tell if money lasts, or says it feels like a form/test. Any fail feeds the next iteration; it does not get explained away.

---

## 16. What not to build yet

Business UI · cloud sync · Open Banking · AI gateway · billing · OCR automation · final Melo runtime · broader life admin · public-release work · any business/tax/career direction. None of these get touched until the core money-clarity path passes a cold-user retest.

---

## 17. Final recommendation

**Proceed to implementation under this spec — but the immediate next action is a cold-user retest of the current build, not more building.**

Rationale, stated plainly: the spine is sound and the worst failures are already fixed and verified on a real device, so a scope rewrite is wrong and a step backward. Pausing for mockups is also wrong — mockups are exactly the theatre that produced the last false "10/10"; the app is real and testable today. We have validated many failures; we have not validated the solution. The only honest way to convert this hypothesis into a 10/10 is to put the current build in front of a cold user, then implement §13 steps 4–8 against what that test actually exposes. Build, but let behaviour — not this document — decide what's done.
