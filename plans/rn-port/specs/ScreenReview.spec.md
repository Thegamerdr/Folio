# RN Port Spec — ScreenReview (ReviewScreen)

Faithful React Native port spec for the single web component **`ScreenReview`**.

- **Web source:** `C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenReview.tsx`
- **RN target name:** `ReviewScreen` (per `@rn-screen`)
- **RN stack:** `Intake > Review` (per `@rn-stack`)

> This is a PORT SPEC, not code. It describes what to build, the exact strings, tokens, motions, moods, state branches, store contract, and the web→RN primitive substitutions. Where the web prototype is a frozen demo that lags the decided product (it shows a single hard-coded "Tesco £42" card and never actually writes a transaction), this spec ports the **intended** Review behaviour per `ENGINES.md` §0 (candidate-item contract, review-before-truth) and §6 (ignored transactions, category taxonomy). Each such gap is called out under **Fidelity risks**.

---

## 1. Verbatim `@rn-screen` doc block

Reproduced byte-for-byte from the top of the web source. The RN screen must carry an equivalent doc block (updated where the demo lagged — see notes):

```
/**
 * @rn-screen    ReviewScreen
 * @rn-stack     Intake > Review
 * @purpose      One-decision card per found item. Stamp animation on add. Nothing added until tapped.
 * @reads        —
 * @writes       addTransaction (per accept)
 * @opens-sheet  edit-item
 * @copy         FROZEN
 * @tokens       --surface --hairline --accent --positive --negative
 * @motion       stamp 600ms cubic-bezier(.34,1.56,.64,1) · slide-in-r
 * @notes        Calls nav.bumpReview() to re-key the screen on each accept.
 */
```

> Discrepancy to fix in RN (do not copy the demo bug): the doc block says `@opens-sheet edit-item`, but the web code actually calls `nav.openSheet("edit-txn")` for both the header `⋯` and the "Edit" button. For RN, the correct sheet to open from Review is the **edit-item / edit-candidate** flow (editing a *candidate* before it becomes truth), not `edit-txn` (which edits an already-posted transaction). See Fidelity risks. The RN doc block's `@reads` should also no longer be `—`: the real screen reads the candidate queue, the ignored-list, and the category map.

---

## 2. Purpose

One decision card per found money item. The reader (PDF / image / paste / CSV / TXT engine) produced a queue of `CandidateMoneyItem`s; Review presents them **one at a time** as a single, calm yes/no decision: "Is this your <merchant> payment?". The user sees the amount, the date, the source context ("from your statement"), and a live preview of what their balance becomes **if** they add it. The user picks a category, then either:

- **Add to my picture** → writes the item as a real transaction (stamp animation, advance to the next item / Today),
- **Edit** → opens the edit-candidate sheet to correct amount / category / date / merchant before adding, or
- **Ignore** → suppresses the item (writes an `ignored` fingerprint), it disappears from the main flow and is auditable in the Hidden list.

Core invariant (review-before-truth): **nothing is added to the money path until the user taps Add.** `@purpose`: "One-decision card per found item. Stamp animation on add. Nothing added until tapped."

---

## 3. Store reads

The web prototype's `@reads` is `—` because the demo is fully hard-coded. The **real RN screen** reads:

| Read | Source | Why |
|---|---|---|
| Current candidate item | Review/intake candidate queue (`CandidateMoneyItem[]` from the most recent reader run) | The card content (merchant, amount, date, source, suggested category, confidence, note). |
| Queue position | length + index of the candidate queue | The "1 of 3" counter. |
| `currentBalance.amount` (+ source label) | store `currentBalance` | The "from £325" base and the "If you add it, you'll have £…" preview math. Per `ENGINES.md` §6 "Starting balance" — no literal balances; read from store, carry the source label. |
| Ignored-list fingerprints | store `ignored` entries (merchant + amount + cadence signature) | So already-dismissed charges are never re-asked; also feeds the Hidden list. |
| Category map | `categoryMap` (friendly label ↔ store enum) | To render the friendly chips and translate the user's pick to the canonical enum on save. |

> The demo's `balance` (325 → 283) and `£42`/`£325`/`26 June`/`Tesco` are placeholders. RN must derive all of them from the candidate + `currentBalance`.

---

## 4. Store writes

| Write | When | Contract |
|---|---|---|
| `addTransaction(...)` | On **Add to my picture** (per accepted item) | `@writes addTransaction (per accept)`. Writes one `Transaction`. Spend is **negative** amount. `category` is the **store enum** mapped from the friendly chip (see §11 category map). `source` reflects the reader origin (in the store's `Transaction.source` model this is `"manual" | "melo" | "seed"`; RN should preserve true intake provenance — see Fidelity risks, as the current store enum can't express `pdf`/`image`/`paste`). After the write, advance the queue (the web demo re-keys via `nav.bumpReview()` and navigates to Today after ~900 ms). |
| `ignore` / suppress | On **Ignore** | Writes an `ignored` entry keyed by stable fingerprint (merchant + amount + cadence signature). Future intakes skip exact re-matches. Item moves to the Hidden list with a "show again" action. Per `ENGINES.md` §6 "Review — ignored transactions". The web demo's Ignore just calls `nav.back()` — this is a demo lag; RN must persist the suppression. |
| (via sheet) `removeTransaction` + `addTransaction` replacement, OR candidate edit | On **Edit → Save** | Web `SheetEditTxn` writes `removeTransaction + addTransaction (replacement)`. For Review, the correct flow is editing the **candidate** in place (amount/category/date/merchant/note) before it is ever posted, then Add writes the corrected transaction. See Fidelity risks. |

`addTransaction` signature (from `src/lib/store.ts`):

```ts
addTransaction(t: Omit<Transaction, "id" | "when"> & { id?: string; when?: string }): Transaction

type Transaction = {
  id: string;
  when: string;                  // ISO timestamp
  merchant: string;
  amount: number;                // negative = spend, positive = inflow
  category: "food" | "transport" | "fun" | "bills" | "shopping" | "income" | "other";
  source: "manual" | "melo" | "seed";
};
```

---

## 5. Sheets it opens

| Sheet id | Opened from | Notes |
|---|---|---|
| `edit-txn` (web demo) → **should be `edit-item`** in RN | Header `⋯` (More options) **and** the "Edit" button | The web code opens `edit-txn` from both; the doc block says `edit-item`. RN should open the **edit-candidate** sheet (`SheetId: "edit-item"`) so the user corrects a candidate before it becomes truth — `edit-txn` is for already-posted transactions. Use the shared `Sheet` shell (bottom sheet, scrim, grip). |

Sheet shell contract (from `Sheet.tsx` `@rn-port`): native bottom-sheet (`@gorhom/bottom-sheet` BottomSheetModal) — 40% ink scrim, 28px top radius, 4px hairline grip, spring curve `cubic-bezier(.16,1,.3,1)` 480ms (`sheet-rise`), scrim fade 320ms (`scrim-in`). Sheet body sits on `--paper` (not `--surface`).

---

## 6. Every visible string (COPY_DECK keys / exact literals)

`@copy FROZEN`. Note: `COPY_DECK.md` has **no dedicated Review section** — the Review screen's strings are currently inline literals in the prototype. RN must lift these into `COPY_DECK.md` under a new `Review` block before shipping (handoff checklist item: "All copy lives in COPY_DECK.md"). Exact strings as rendered today:

| Element | Exact string | Notes |
|---|---|---|
| Back button | `←` | `aria-label="Back"` |
| Counter | `1 of 3` | `aria-label="Item 1 of 3"`. RN: parameterize as `{i} of {n}` from queue. |
| More options | `⋯` | `aria-label="More options"` |
| Eyebrow | `Review` | Fraunces italic |
| Headline | `Is this your Tesco payment?` | `Tesco` is the one accent word (terracotta, `not-italic`). RN: `Is this your {merchant} payment?` with `{merchant}` accented. One-accent-word-per-headline rule. |
| Amount | `£42.00` | From candidate. `Money` size `xl`. |
| Direction tag | `out` | uppercase, tracked. (For income candidates this would read differently — demo only shows `out`.) |
| Source line | `26 June · from your statement` | `{date} · from your statement`. The "from your statement" phrasing is the required source-context per `ENGINES.md` §1. |
| Stamp badge | `Added` | Appears only after accept (uppercase, accent border). |
| Preview label | `If you add it, you'll have` | `aria-live="polite"` |
| Preview balance | `£{balance}` | Count-up target; e.g. `£283`. |
| Preview detail | `from £325 · drops by £42` | `from £{base} · drops by £{amount}`. |
| Category section label | `What kind of spend?` | uppercase, tracked. |
| Category chips | `Groceries` · `Transport` · `Bills` · `Eating out` · `Subscription` · `Shopping` · `Other` | Friendly labels, in this order. Source of truth: `CATEGORIES` const + `ENGINES.md` §6 taxonomy. |
| Melo line | `Take your time. You can change this later.` | mood `soft` (→ `calm` in RN; see §8). |
| Primary CTA (idle) | `Add to my picture` | |
| Primary CTA (after accept) | `Added to your picture` | disabled state. |
| Secondary — Edit | `Edit` | |
| Secondary — Ignore | `Ignore` | |

Banned-word check (all clear): none of `import`, `parse`, `extract`, `OCR`, `sync`, `rows`, `100%`, `bank-grade`, `AI-powered`, `smart`, etc. appear. Keep it that way — "from your statement", not "imported from your statement".

Voice notes carried: "Add a statement" / verbs over nouns; "you" address; money reads as money (tabular). No security/privacy claims.

---

## 7. Tokens used

`@tokens --surface --hairline --accent --positive --negative` (declared). Full set actually referenced in the JSX, all from `src/styles.css` `:root` — map to the RN theme object + `useTheme()`:

| Token | Hex (light) | Used for |
|---|---|---|
| `--surface` | `#FFFFFF` | Card background, chip (inactive) bg, Edit/Ignore button bg. |
| `--hairline` | `#ECE9E0` | Card border (`hairline` util), inner divider line, chip borders, button borders. |
| `--accent` | `#E0633A` | Accent merchant word, stamp border/text, active chip text, down-arrow glyph, primary CTA bg, CTA glow shadow. |
| `--accent-soft` | `#F5E4DB` | Down-arrow circle bg, active chip bg. |
| `--positive` | `#3E8E5A` | Declared in `@tokens`; not visibly used in current demo (reserved for income/positive verdict variants). |
| `--negative` | `#C5503E` | Declared in `@tokens`; not visibly used in current demo (reserved for over/short variants). |
| `--muted-ink` | `#6B6760` | Back/counter/⋯ chrome, eyebrow, source line, "out" tag, preview detail, section label, inactive chip text. |
| `--ink` | `#1A1815` | Default text (headline, preview balance). |
| `--radius-2xl` (32) / `rounded-2xl` (24) / `rounded-xl` (12) / `rounded-full` | — | Card 2xl, CTA 2xl, Edit/Ignore xl, chips full. RN: theme radius scale. |
| `--shadow-card` | `0 1px 0 …, 0 12px 28px -16px …` | Card elevation (inline `boxShadow: var(--shadow-card)`). |
| Custom CTA glow | `0 12px 24px -10px rgba(224,99,58,0.55)` | Primary CTA drop shadow (hard-coded rgba of accent). RN: derive from accent, don't introduce a new token. |

No hardcoded palette colours beyond the accent-derived CTA glow rgba. Fonts: Fraunces (`font-display`) for headline/eyebrow/preview balance/Money; system grotesque (Inter Tight → SF Pro / Roboto in RN) for body. `tabular` (tabular-nums) on all money + the counter.

---

## 8. Named motions

From `MOTION.md` + the screen's `@motion stamp · slide-in-r`:

| Motion | Where | Spec | RN implementation |
|---|---|---|---|
| `slide-in-r` | Whole screen root (`className="… slide-in-r"`) | 360ms `cubic-bezier(.16,1,.3,1)`, translateX 28→0 + fade. Forward intake navigation. | `withTiming(translateX 24→0, ~240–360ms)` reanimated. |
| `stamp` (`verdict-stamp` family) | "Added" badge, only when `stamped` | 600ms `cubic-bezier(.34,1.56,.64,1)` back-out; keyframes scale 1.6→0.95→1 with `rotate(-8deg)`, opacity 0→1. | `scale 1.1→1` (here with the −8° rotation preserved) + opacity via `withSpring({ damping: 14 })`. Fire exactly once per accept. |
| `count-up` | Preview balance (`useCountUp(stamped ? 283 : 325, 700)`) | 700ms cubic-out `1−(1−t)³`. Money values **never slide** — always count-up. | `useDerivedValue` + `interpolate` + `Animated.Text`, 700ms. RN target = derived new balance, base = current balance. |
| `press` | Back, ⋯, every chip, primary CTA, Edit, Ignore (`className="press"`) | 120ms ease, scale→0.97 on `:active`. | `Pressable` + scale 0.97 + `Haptics.selectionAsync()` (expo-haptics). |

Rules to honour: one motion per element; money never slides (count-up only); reduced motion = final state instantly (`AccessibilityInfo.isReduceMotionEnabled`), not a slower animation — the stamp, slide-in, and count-up all snap to resolved state.

Timing note for the accept sequence: web sets `stamped`, calls `nav.bumpReview()`, then `setTimeout(() => nav.go("today"), 900)`. RN: on accept, fire stamp (600ms) + count-up (700ms), keep the card on screen ~900ms, then advance to the next candidate (or Today if the queue is empty). Re-key the screen on advance (the `bumpReview` analogue) so the next card re-runs `slide-in-r`.

---

## 9. Melo mood(s)

- **Surface mood:** per `MELO_MOODS.md`, "Add entry — reading" = `curious`; "Add entry — success" = `cheer`. Review sits between reading and success. The only Melo instance currently on the screen is the inline `MeloLine` with `mood="soft"`.
- **`soft` is a legacy alias** → normalizes to `calm` (`kit.tsx` `normalizeMood`: `"soft" → "calm"`). **Do not carry the alias into RN** (`MELO_MOODS.md` / `kit.tsx` both say so). Use `mood="calm"` for the reassurance line ("Take your time…").
- **On accept**, if Melo is shown in the success transition, the mood shifts to `cheer` (success). Keep `celebrate` out of Review — it is reserved for cycle close (once per cycle, max).
- Mood is decorative reinforcement only; copy always carries the meaning (accessibility rule). No pose is required on this screen; if one were used it would be `check` (amber "glance at this") for a low-confidence candidate — but default `pose="none"`.

Mood transitions: 600ms cubic-bezier on tilt/fill, 500ms ease on mouth/eyes — never a hard swap.

---

## 10. All state branches (per `STATES.md`)

`STATES.md` matrix row **Review**: empty `n/a` · loading `n/a` · populated `✅ done` · error `"skip for now"` · offline `✅`. RN must render each branch as a distinct visual, not a spinner. Exact copy per branch:

### populated (the happy path — the only branch the prototype draws)
The full card described in §12. Real candidate data, category chips, preview, three actions. This is `✅ done`.

### empty — `n/a`
Review is never reached with zero candidates. The reader only routes to Review when it produced ≥1 `CandidateMoneyItem`. If the queue empties (last item accepted/ignored), **do not render an empty Review** — advance to Today (matches the web's `nav.go("today")` after the final accept). No empty-state copy needed for this screen. (The "nothing to check" surface lives on Today's "things still waiting to be checked" card, not here.)

### loading — `n/a`
Review itself does no async. The *reader* shows the loading state on the AddEntry/PdfSuccess surfaces ("Folio is reading…", Melo `curious`, max 4s before fallback) — by the time Review renders, candidates already exist. So Review has no loading branch; never show a spinner here.

### error — `"skip for now"`
If an individual candidate can't be acted on (e.g. the edit/save path fails, or a write errors), the honest recovery is a single **"skip for now"** action that moves past this item to the next candidate (or Today) without losing the rest of the queue. Copy: `skip for now`. One CTA, honest, refusal-friendly. Never "Error 500". (This mirrors `STATES.md` Review→error = "skip for now".) Do not fabricate other error copy; reuse `err.generic` = `Something didn't catch. Try once more?` only if a retry genuinely makes sense, otherwise prefer skip.

### offline — `✅` (same as populated)
Folio is local-first; Review is fully local (candidates already on device, writes are local). Offline is indistinguishable from populated — render the normal card, all three actions work. **Sync language is banned.** If a global offline banner exists app-wide, the relevant string is `err.offline` = `No connection. Folio works without one — try again when you're back.` — but Review does not need it; the screen functions offline unchanged.

---

## 11. JSX outline (to reproduce the layout in RN)

Full-height column, horizontal padding 28 (`px-7`), top padding 16 (`pt-4`), root entrance `slide-in-r`. Translate web → RN primitives in §13.

```
<Screen> (View, flex column, flex:1, px:28, pt:16, slide-in-r)

  ── Top bar (Row, space-between, center) ──
    Pressable(←)  aria/accessibilityLabel="Back"        → nav.back()        [muted-ink, 20px, press]
    Text "1 of 3" accessibilityLabel="Item 1 of 3"      [muted-ink, 12px, tabular]
    Pressable(⋯)  accessibilityLabel="More options"     → openSheet(edit-item) [muted-ink, 18px, press]

  ── Title block (mt:24) ──
    Text "Review"  [Fraunces italic, 13px, muted-ink]
    Heading "Is this your <Accent>Tesco</Accent> payment?"  [Fraunces, 28px, leading-tight, mt:4]
        (Accent = merchant word, color accent, not-italic)

  ── Decision card (relative, mt:24, bg surface, hairline border, radius 24, p:24, shadow-card) ──
    {stamped && Badge "Added"} (absolute top:16 right:16, radius full, 2px accent border,
        10px uppercase tracking, accent text, class "stamp")
    Row (baseline, space-between):
        <Money value="£42.00" size="xl" />
        Text "out" [12px uppercase tracking, muted-ink]
    Text "26 June · from your statement" [13px, muted-ink, mt:12]
    Divider (1px hairline, mt:24)
    Row (align-start, gap:12, mt:20, accessibilityLiveRegion="polite"):
        Circle(↓) 32x32 radius full, bg accent-soft, accent glyph [aria-hidden]
        Column(flex:1):
            Text "If you add it, you'll have" [13px]
            Text "£{balance}" [Fraunces, 28px, tabular, mt:2]   ← count-up
            Text "from £325 · drops by £42" [12px, muted-ink, tabular, mt:4]

  ── Category picker (mt:20) ──
    Text "What kind of spend?" [11px uppercase tracking, muted-ink, mb:8]
    Wrap (flex-wrap, gap:6):
      for each c in CATEGORIES:
        Pressable chip (press, px:12 py:6, radius full, 12px, hairline border,
            disabled when stamped, accessibilityState={selected: active})
            active  → bg accent-soft, text accent
            inactive→ bg surface, text muted-ink
            onPress → setCategory(c)

  ── Reassurance (mt:16) ──
    <MeloLine text="Take your time. You can change this later." mood="calm" />

  ── Spacer (flex:1) ──

  ── Primary CTA ──
    Pressable (press, full width, h:60, radius 24, bg accent, white 16px medium,
        disabled when stamped → opacity 0.7, shadow = accent glow)
        label = stamped ? "Added to your picture" : "Add to my picture"
        onPress → onAdd()  // set stamped, bumpReview, advance after ~900ms

  ── Secondary actions (mt:12, 2-col grid, gap:10) ──
    Pressable "Edit"    (press, h:48, radius 12, bg surface, hairline, 14px) → openSheet(edit-item)
    Pressable "Ignore"  (press, h:48, radius 12, bg surface, hairline, 14px) → ignore() / nav.back()

  ── Bottom spacer (h:16) ──
</Screen>
```

`onAdd` behaviour (per `@notes`): set `stamped = true` → fire stamp + count-up → `bumpReview()` (re-key for next card) → after ~900ms advance (`nav.go("today")` in the demo; in RN, next candidate or Today when queue empty).

---

## 12. Engines / data dependencies

Review is a **surface** over engine output; it owns no money logic. Dependencies:

- **Candidate items from readers** — `CandidateMoneyItem[]` produced by the statement/photo/text readers (`ENGINES.md` §0 contract, §1 statement reader). Review consumes normalised candidates (id, source, kind, merchant, amount, date, category, confidence, note) — never raw reader output. This is `@rn-engine` work the RN app must build; the prototype hard-codes one fake item.
- **Ignored-list** — the suppression store keyed by stable fingerprint (`ENGINES.md` §6 "Review — ignored transactions"). Review writes to it on Ignore and reads it to skip re-matches; the Hidden list (with "show again") reads it too.
- **Category map** — `categoryMap` (friendly UI label ↔ canonical store enum). The single place the two vocabularies touch (`ENGINES.md` §6 "Review/store — category taxonomy"). The web `categoryMap.ts` module referenced by ENGINES does **not** exist in this worktree — RN must create the matching module.
- **`currentBalance`** — for the "if you add it…" preview and the "from £X" base, read from the store with its source label (`ENGINES.md` §6 "Starting balance"). No literal balances.
- **`addTransaction` / store** — the write path (§4).
- **`recomputeRoute()`** (downstream) — accepting an item changes the money path; Today/path recompute after the write (same call as add/delete elsewhere).

The candidate `kind` (`income | spend | bill | subscription | debt-payment | transfer | unknown`) and `confidence` (`high | medium | low`) drive variants the demo doesn't show: income reads "in" not "out" and uses positive amount; low-confidence could surface the `check` pose / the `note` ("looks like a bill").

---

## 13. Web → RN primitive substitutions

Per `RN_PORT.md` component map + the prompt's reuse targets (`@/surfaces/pressureMap/kit` Sheet / type / action primitives). Note: the `pressureMap/kit` path named in the brief does **not exist in this design worktree** — the kit lives at `src/components/folio/kit.tsx` (Melo, MeloLine, Money, EmptyState, useCountUp) and the Sheet at `src/components/folio/sheets/Sheet.tsx`. In the RN repo (`folio-v2-greenfield`), reuse the established RN kit (the `pressureMap/` surface kit per the memory) for the Sheet, type, and action primitives rather than re-implementing.

| Web (this prototype) | React Native |
|---|---|
| Root `<div className="h-full flex flex-col …">` | `<View style={{ flex: 1 }}>` (+ `SafeAreaView` top inset for the back bar). |
| `<button className="press">` | `<Pressable>` with scale-0.97 press style + `Haptics.selectionAsync()`. |
| Header glyphs `←` `⋯` `↓` `×` | `lucide-react-native` (`ChevronLeft`, `MoreHorizontal`, `ArrowDown`) — same names, drop-in — or keep as accessible text. Provide `accessibilityLabel`. |
| `<Money value="£42.00" size="xl" />` | RN `Money` from kit: `<Text style={{ fontFamily: 'Fraunces', fontVariant: ['tabular-nums'] }}>`. |
| `useCountUp(target, 700)` (rAF) | `react-native-reanimated` `useDerivedValue` + `interpolate` + `Animated.Text`, 700ms cubic-out. |
| `<MeloLine text mood />` | RN `MeloLine` (Melo SVG via `react-native-svg` + reanimated breathe, Fraunces italic copy). mood `calm`. |
| CSS tokens `var(--surface)` etc. | Theme object + `useTheme()` hook (`kitTheme` / `makeStyles` pattern). |
| `hairline` util (1px border) | `StyleSheet.hairlineWidth` border. |
| `boxShadow: var(--shadow-card)` / CTA glow rgba | RN shadow props (iOS `shadow*`, Android `elevation`); approximate the accent glow, don't add a new token. |
| `rounded-2xl/xl/full` | theme radius scale (24 / 12 / 9999). |
| `.slide-in-r` / `.stamp` (CSS keyframes) | reanimated shared values + `withTiming` / `withSpring` per §8. |
| `nav.openSheet("edit-item")` | RN nav → present `@gorhom/bottom-sheet` BottomSheetModal hosting the edit-candidate sheet (reuse kit `Sheet`). |
| `nav.back()` / `nav.go("today")` / `nav.bumpReview()` | `@react-navigation/native` stack: `goBack()`, `navigate('Today')`, and a screen re-key / queue-advance for `bumpReview`. |
| `aria-label` / `aria-live="polite"` / `aria-pressed` / `aria-hidden` | `accessibilityLabel` / `accessibilityLiveRegion="polite"` / `accessibilityState={{ selected }}` / `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`. |
| `disabled` on chips/CTA after stamp | `disabled` prop + `accessibilityState={{ disabled: true }}` + opacity 0.7. |
| Category `CATEGORIES` const + `useState<Category>` | Same const; `useState`. On save, run through `categoryMap` to the store enum. |

---

## 14. Fidelity risks (must-watch)

1. **Review-before-truth gate (highest priority).** The whole point of Review is that **nothing is written until the user taps Add** (`@purpose`, `ENGINES.md` §0 steps 5–6). The web demo never actually calls `addTransaction` — `onAdd` just sets `stamped` and navigates. RN must (a) actually write on Add, (b) write **only** on Add, (c) advance the queue without writing on Ignore (instead writing the suppression). Getting this wrong silently mutates the money path and breaks the product's core honesty promise.

2. **Ignored items must be visible in a Hidden list.** Ignore is not a silent delete: it writes an `ignored` fingerprint, suppresses exact re-matches from future intakes, **and** surfaces the item in a "Hidden" section with a "show again" action (`ENGINES.md` §6). The web demo's Ignore = `nav.back()` (loses the item entirely). RN must persist + expose it. Silent loss violates the honesty rule.

3. **Category friendly-label ↔ enum mapping.** UI chips are friendly (`Groceries`, `Eating out`, `Subscription`, …); the store keeps `food | transport | fun | bills | shopping | income | other`. Mapping is 1:1 and lives in exactly one module (`categoryMap`). Both `Groceries` and `Eating out` → `food`; `Subscription` → `bills`. Income is never user-picked here (engine sets it from positive amount). Do not let any component hand-code either vocabulary, and make sure `addTransaction` receives the **enum**, not the label. The `categoryMap.ts` module is absent from this worktree — create it in RN.

4. **`edit-item` vs `edit-txn` sheet.** Doc block says `edit-item`; code opens `edit-txn`. Review edits a *candidate* (pre-truth), so RN should wire the edit-candidate sheet, not the posted-transaction editor. Wiring `edit-txn` here would let the user "edit" something that doesn't exist yet as a transaction.

5. **No literal balances.** The demo hard-codes `325`/`283`/`£42`/`Tesco`/`26 June`. Per `ENGINES.md` §6 "Starting balance", every balance reads from `currentBalance` with a source label; the card values all come from the candidate + store. Carry the source context ("from your statement") honestly.

6. **`Transaction.source` can't express intake provenance.** The store enum is `"manual" | "melo" | "seed"`, but a Review accept originates from `pdf | image | paste | csv | txt`. Preserving true provenance (for de-dupe and "from your statement" copy) needs either a wider `source` union or a separate provenance field in RN — flag for the store-migration work (`@rn-engine` candidate). Don't quietly tag reader output as `"manual"`.

7. **Counter + queue truth.** "1 of 3" is hard-coded. RN must drive it from the real candidate queue, and the final-item accept must advance to Today (not show an empty Review).

8. **Copy not yet in COPY_DECK.** Review strings are inline literals with no `Review` section in `COPY_DECK.md`. Lift them into the deck (parameterized: `{merchant}`, `{date}`, `{i} of {n}`, `{base}`, `{amount}`, `{balance}`) before shipping — handoff checklist requires all copy in the deck. Keep the banned-word and one-accent-word rules.

9. **Reduced motion.** Stamp, slide-in, and count-up must collapse to final state under `AccessibilityInfo.isReduceMotionEnabled` — the "Added" badge appears instantly, the balance shows its final figure with no tick. Don't ship "calm but on".

10. **`soft` mood alias.** Use `calm`, not `soft`, for the MeloLine — the alias is web-back-compat only and must not enter RN.
