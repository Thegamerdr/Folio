# PORT_BIBLE — condensed digest for the port fleet

Source: `C:/dev/folio-melo/.claude/worktrees/design-main` (read-only design repo, Lovable-connected).
Read THIS file, not the 17 source docs, unless you need verbatim wording for a specific rule.
If this digest and a source doc conflict, the source doc wins — flag it, don't silently pick.

---

## 1. Product direction (10 lines)

1. Folio answers one question: "will my money last to payday?" — Survival Mode is the shipped default; nine more Money Modes ("Lenses" in UI) generalize it to "you can spend this much without harming what matters most to you right now."
2. Audience = the "Sheets-returner": people who tried Monzo/Emma/YNAB/Snoop and went back to Google Sheets. Win by being Inspectable, Editable, Reversible, Owned — not by more features.
3. Melo is the emotional interface for the user's money — not a mascot bolted on. Screen shows numbers; Melo shows what they feel like and names one gentle next move.
4. Local-first. No cloud dependency in this design repo; RN app owns real engines, sync, and persistence.
5. Review-before-truth is the core honesty mechanic: readers (PDF/photo/paste/CSV/TXT) never write to the money path directly — they produce candidates, user confirms.
6. Manual entry is a fallback only — never substitute a real reader with a manual form as the main path.
7. Calendar is derived from money data (paydays, bills, subs, deadlines) — never a manual-event fallback for uploads.
8. Melo changes state only through named, validated tools (log_spend/log_income/log_invoice/log_refund/log_transfer, addToPot/borrowFromPot). No silent writes, no generic chatbot advice.
9. Pricing: 3 tiers (Free / Melo Plus / Melo Pro), 10 lenses gated 2/4/4. Never paywall the core path, export, or the user's own history.
10. Design system is frozen: one token set (`src/styles.css`), Fraunces + Inter Tight, terracotta accent, no new colours/fonts/spacing/radii/shadows without updating the design repo first.

---

## 2. RN_PORT.md — porting rules (condensed)

### `@rn-screen` doc-block contract (every Screen*/Sheet* opens with this — trust it, don't edit it)
```
@rn-screen    <Name>
@rn-stack     <nav path>
@purpose      one-line
@reads        store keys
@writes       store actions
@opens-sheet  sheet ids
@copy         FROZEN — every visible string ships verbatim
@tokens       css vars used
@motion       named motions
@melo-mood    (screens only)
@notes
```
If your port diverges from a field, fix the port — never edit the block.

### What ports 1:1 (design → RN, no new logic)
All 25 screens + 8 sheets (layout/copy/motion intent), type rhythm (Fraunces + 1 accent word), colour tokens, Melo character (5 moods, SVG), motion vocabulary, empty-state primitive, curated lucide icon subset, full copy deck, mood map.

### FROZEN — never edit without design-repo change first
- Any string marked `@copy FROZEN` in a doc block.
- Design tokens in `src/styles.css` (colours/fonts/spacing/radii/shadows/elevation).
- The phone frame / chapter rail / `src/routes/index.tsx` (web-only showcase chrome — don't "fix" it, don't port it).
- `HeroPhone`, `HeroLoop`, `Tokens`, `HandoffBoard` (web-only shell) — DO port `TabBar` as real bottom nav.

### Needs a real RN engine (prototype only shows the surface)
Money path engine · Cycle tracker · Statement reader (PDF) · Photo reader · Text/CSV/TXT reader · Subscription detector · Pot engine · Insights engine · Nudge scheduler · Local store+sync (SQLite/WatermelonDB) · optional Auth (only if backup enabled). Full new-engine list also in ENGINES.md (see §Engines below).

### Component map (web → RN)
| Web | RN |
|---|---|
| `<Sheet>` | `@gorhom/bottom-sheet` BottomSheetModal |
| `<EmptyState>` | same composition, RN primitives |
| `<Melo mood>` | `react-native-svg` + reanimated breathe |
| `<Money>` tabular | `<Text style={{fontVariant:['tabular-nums']}}>` |
| CSS tokens | theme object + `useTheme()` |
| `useCountUp` | reanimated `useDerivedValue`+interpolate |
| framer-motion | reanimated shared values (`withTiming`/`withSpring`) |
| lucide-react | lucide-react-native (drop-in) |
| `nav.go(...)` | `@react-navigation/native` stack |

### Store migration (mandatory before first public build)
Versioned `schemaVersion` + per-version `migrate_vN_to_vN+1(state)` run on load; unknown-newer blobs parked (never silently dropped) at `folio.state.v1.future.<n>`.

### Handoff checklist per screen
Doc block complete → copy lives in COPY_DECK.md → mood in MELO_MOODS.md → states covered per STATES.md → motions named per MOTION.md → no banned words → no hardcoded colours/fonts.

### Loop / scope discipline (applies to every porting agent)
Do the one named thing. No unsolicited lint/typecheck/build loops. No refactor-while-here. No new screens/tabs/sheets/routes/data-concepts/dependencies unless asked by name. New RN engine → must be added to ENGINES.md first, never slipped in silently. If a request conflicts with a resolved decision (ENGINES.md §6): stop and ask.

---

## 3. Lens model (10 lenses)

Engine name = **Money Mode**; user-facing name = **Lens** (UI-only rename, same identifiers/strategies).

| id | UI label | Tier | Safe Zone meaning (short) |
|---|---|---|---|
| survival | Make it to payday | Free | balance − pots − bills/subs/holds to payday − buffer |
| stability | Stay in control | Free | balance − cycle bills/subs/holds − buffer(£100) |
| growth | Build savings | Plus | balance − committed pot contributions − bills − buffer |
| reset | Get back on track | Plus | remainingBalance − remaining bills, spread over days left |
| optimizer | Cut waste | Plus | discretionaryTarget − discretionarySpendSoFar |
| planning | Plan a big purchase | Plus | balance − bills − pace-to-target − buffer |
| lowVis | Just see what's going on | Pro | no confident number — band + confidence caption |
| irregular | Handle irregular income | Pro | balance + p20(next 30d income) − fixed outgoings − buffer |
| debt | Pay down debt | Pro | balance − scheduled minimums − essential bills − buffer |
| household | Share bills with someone | Pro | balance − yourShare(shared bills) − personal bills − buffer |

Trigger surfaces per lens (hero panels): Today hero swaps per-lens metric (see ENGINES.md Appendix table — e.g. Debt shows leak-to-payoff delta, Irregular shows buffer weeks, Household shows your-share split). Onboarding intent step branches per lens. Payday Ritual steps branch per lens ("feed the cadence" / "kill a leak" / "top up buffer"...). Melo chat header/opener/tool-prefs tint per lens. Pots/Subs/Calendar show `ModeFramingBanner` headline per lens. Auto-detect (`suggest.ts`) proposes, never silently switches; switching to a paid lens shows trial CTA, never silent unlock across the paywall.

### Gating (PRICING.md / docs/LENSES.md — canonical, supersedes older "4 free / 6 Plus" note in HANDOFF_ADDENDUM.md, which is stale)
- **Free (2):** survival, stability.
- **Melo Plus (4):** growth, reset, optimizer, planning. £4.99/mo, £39.99/yr.
- **Melo Pro (+4, superset of Plus):** lowVis, irregular, debt, household. £8.99/mo, £69.99/yr.
- One-cycle free trial unlocks every paid lens (Plus+Pro together, no separate Pro trial). `lens.trialCycleId` set at activation, cleared at cycle close.
- **Paywall guard `canShowUpsell()`** (`src/lib/lens/paywall.ts`) — suppress ALL upsells when weather is `storm`/`rainy`/`fog`, OR Recovery active, OR Safe Zone negative, OR Quiet Mode on. Never sell during a bad money moment — product rule, not a growth lever.
- **Never paywall:** the core path/Today answer, Bills Shield, Before-You-Spend, 24-Hour Shelf, Recovery, export, edit, the user's own history. Downgrade never locks out data already on-device.

---

## 4. Melo emotional engine + moods + vitality

### State model
```ts
type MeloState = {
  mood: "calm"|"curious"|"cheer"|"concern"|"celebrate";
  pose: "none"|"safe"|"check"|"thinking"|"reading"|"mismatch"|"sealed";
  weather: "sunny"|"cloudy"|"rainy"|"storm"|"rainbow"|"night"|"alarm"; // +fog/windy/heatwave/freeze per-mode
  energy: "rested"|"steady"|"tired"|"neglected";   // RN-only (meloNeglect)
  tier: 1|2|3|4|5;                                  // RN-only (meloProgress)
  cosmetics: { archetype: ArchetypeId; equipped: Record<Slot, ItemId|null> }; // RN-only (meloCosmetics)
};
```
Only `mood`/`pose`/`weather` are prototyped on web (`src/lib/melo/state.ts`), pure & recomputed per render, no persistence. `energy`/`tier`/`cosmetics` are RN-scope engines — do not fake on web.

### Mood derivation
| Signal | Mood |
|---|---|
| tightest spare ≥ 40% monthly income | calm |
| 15–40%, or sub renewal ≤3d | curious |
| ritual done today / pot goal hit / tight point +£30 in a day | cheer |
| tightest spare <15%, or shortfall active, or unrecognised sub caught | concern |
| cycle just closed green (once/cycle, session-capped) | celebrate |

Transition: 600ms cubic-bezier, never hard swap. `celebrate` decays to `calm` after 8s. Max once per cycle — devalues if overused.

### Pose (decorative reinforcement only, never sole signal)
safe(route holds)/check(unfamiliar sub, unread nudge)/thinking(computing)/reading(mid-read)/mismatch(income mismatch)/sealed(cycle closed, paired w/ celebrate). Default `none`. Never pair `mismatch`+`cheer` or `safe`+`concern`.

### Weather (7 base states, shared vocabulary, mode-specific thresholds — see §5)
sunny/cloudy/rainy/storm/rainbow/night/alarm. Mode-extended: fog (low-vis), windy (irregular variance), heatwave (optimizer creep), freeze (spend-hold/recovery). `MeloWeatherGlyph.tsx` = 22×12 viewBox horizon strip; ink density = mood; only storm/rainbow/alarm carry terracotta; only `alarm` animates (2s opacity breath, reduced-motion = steady). Never add glyph to scene-scripted screens (Ritual/Shortfall/Pots/Subs — locally scripted moods already).

### Voice tint by mode (register only, never changes facts or unlocks tools)
Survival=fewest words, present tense · Stability=calm/specific, buffer-as-promise · Growth=encouraging, future-self framing · Debt=steady non-shaming, months not shame · Irregular=range-aware, never claims unconfirmed dates · Household=plural "we/you two", never takes sides · Planning=milestone countdown · Optimizer=precise/dry, numbers first · Reset=softest, never mentions the failure · Low-vis=honest uncertainty, "one number would help".

### Reactions (micro-moments, RN-scope queue: `meloReactions`)
Visual grammar = ONE shape: 8px hairline rule + Fraunces italic line, terracotta default / `--caution` gold for concern, no card/popover/quotes. Never chain 2 reactions same session — strongest wins. Examples: pot add→cheer/none/2s/60s cooldown "in the pot, quietly working"; pot goal hit→celebrate/sealed/6s/once-per-pot-per-cycle; sub paused→cheer/2s/30s; sub caught→concern/check/until-reviewed; payday landed→celebrate/sealed/6s/once-per-cycle; ritual finished→celebrate/8s/once-per-cycle; shortfall opened→concern/check/while-open; neglect wake-up (RN)→calm/one-time/3-day cooldown "hey. want to peek at where we are?".

### Progression tiers (RN-scope: `meloProgress`)
1 Scrappy → 2 Organised (default/baseline) → 3 Confident → 4 Wealth-builder → 5 Boss. Moves ±1/cycle max, never crashes on a bad cycle, purely decorative (every feature works at every tier). Web ships a preview-only `tier` prop on `<Melo>` in `kit.tsx`; RN owns real state.

### Archetypes (premium cosmetic skins, RN-scope: `meloCosmetics`)
Melo (folded document) = free default/canonical form. Gecko/Fox/Bear/Robot/Cat/Ghost = same state engine, different silhouette + voice tint only. Never unlock new tools/capabilities. One active at a time; swap = settings action, never mid-flow.

### Monetization ethics (non-negotiable)
Allowed: cosmetic packs, seasonal drops, archetype unlocks, voice tints, widget cosmetics. Forbidden: paywalling any mood/pose/weather/reaction/ritual/coaching line; pay-to-unlock via spend/streak/level; loot boxes; wealth-signalling cosmetics (gold chains etc.); premium prompts during concern/shortfall/ritual/payday.

### Care-not-punish (enforced copy law — see §6)
Melo never blames/shames/expresses disappointment. Trouble = fewer words, not more. Always names the next move, never the failure. Uses "we" for money moves, never "you should".

---

## 5. Weather thresholds table (canonical — update here + strategy file together)

| Mode | Metric | sunny | cloudy | rainy | storm | Notes |
|---|---|---|---|---|---|---|
| survival | tightestSpare / monthlyIncome | ≥0.40 | 0.15–0.40 | near renewal | <0 | alarm if bill>spare within ≤1d |
| stability | tightestSpare / bufferAmount | ≥1.00 | 0.5–1.0 | 0.25–0.5 | <0.25 | buffer default £100 |
| growth | freeToSave (£/mo) | ≥perWeek×4 | ≥perWeek×2 | >0 | ≤0 | vs goal pot pace |
| debt | days to next repayment | >14 | 8–14 | 4–7 | ≤3 | name-heuristic until RN debt store |
| irregular | runway (weeks bills covered) | ≥8 | 4–7 | 2–3 | <2 | never celebrates "payday" |
| household | yourShare exposure | ≥buffer | 0.5×buf–buf | <0.5×buffer | share<0 | 50/50 split heuristic |
| planning | pace = saved/goal | ≥0.5 | <0.5 | <0.5,<8w | <0.25,<4w | vs largest goal pot |
| optimizer | recoverable £/mo leaks | 0 | >0 | >0.1×income | >0.25×income | leak rank drives render |
| reset | daysCovered (essentials) | ≥14 | 7–13 | 3–6 | <3 | essentials≈40%income/30 |
| lowVis | signalCoverage (0–100) | ≥80 | 60–79 | — | — | else `fog` |

Special (all modes): `night`=local hour≥22 & weather is sunny/cloudy · `fog`=`currentBalance.source==="sample"` · `alarm`=survival-only today, other modes route near-term risk to `storm`.

---

## 6. Copy law (condensed)

### Banned strings (hard fail, case-insensitive)
`import · rows · parser/parse · extraction/extract · OCR · source record · provenance · indexed · sync · dashboard · analytics · users · 100% · bank-grade · military-grade · AI-powered · smart · encrypted at rest · stays on this device · zero-knowledge`

### Banned claim shapes (regex-checked — only allow if literally true today)
`we (never|don't) (see|store|read|sell|share) your…` / `your data (never|doesn't) leave…` / `runs entirely on (your) (device|phone)` / any `encrypt(ed|ion)` claim.

### Care-not-punish banned phrasings
`you failed / you're a failure / disappointed in you / you overspent / you exceeded / you're over budget / you missed [ritual/payday] / you skipped / you've been ignoring / you didn't cancel / you should have / you always/never` + regex `melo is (disappointed|worried about you|sad because)` / `you (failed|blew it|messed up)` / `(you|we) went over`.

### Preferred rewrites (sample — full table in COPY_LINT.md)
| Don't | Say |
|---|---|
| you're overspent | we're running hot this week |
| you skipped the ritual | no ritual yet — want to run it in two minutes? |
| you didn't cancel Netflix | netflix renews friday — still earning its place? |
| import a statement | add a statement |
| we parsed your file | here's what Folio found |
| bank-grade security | (delete — don't replace with a claim) |

### Voice rules
Calm/plain/short sentences, no hype/jargon. One terracotta accent word per headline (`<em>`). Money always tabular figures, never "12.3K". Address user as "you"; Melo speaks first-person sparingly ("I noticed…"), only in double-quoted italic Fraunces, one thought per line. "Add" not "save"; "Spare"/"Safe Zone" not "balance"; "Path" not "forecast"; "tight point"/"Danger Date" not "minimum balance".

### Mode-conditional payday phrasing
"Days to payday"/"spare until payday"/"make it to payday" = Survival-only vocabulary. Never bake into shared components — read `voice.spareLabel`/`voice.horizonLabel` from the active mode's strategy. Non-Survival modes may not show a payday concept at all.

### Vocabulary rename (UI-only, post PART-8 — engine names in `src/lib/modes/**` stay as-is)
| Old surface term | New user-facing term |
|---|---|
| spare / safe to spend | Safe Zone |
| tight point / runway low | Danger Date |
| subs/bills protection | Bills Shield |
| weather glyph | Money Weather |
| WhatIf park-it | 24-Hour Shelf |
| money modes | Money Lenses |

### `// CLAIM:` comment convention
Any copy asserting a backend property not yet shipped must carry `// CLAIM: requires <engine> to ship before this is true.` If the engine isn't shipped, reword to something actually true today.

---

## 7. States machine essentials

5 states per screen: **empty** (first run/no data) · **loading** (only for genuine async — PDF read, AI catch; Melo `curious` + one calm line, NEVER a spinner, max 4s before fallback) · **populated** (happy path) · **error** (honest plain-language copy, one clear recovery, never "Error 500") · **offline** (degrade gracefully, no visible difference — Folio is local-first; "sync" language banned).

Rules: empty ≠ broken — use `<EmptyState>` primitive (Melo + Fraunces line w/ 1 accent word + body + optional CTA). One CTA per state, two choices max, refusal always available. Full per-screen matrix lives in STATES.md — port it as separate visual branches per screen, not a spinner catch-all.

Calendar-specific: 3 planner views (Month/Week/Agenda) over same derived data, switching never reloads; past days de-emphasised (opacity ~0.45–0.55); hydration-gate spare-£ render until first client mount (SSR/client Date mismatch); bidirectional Route↔Calendar focus-date bridge (`setCalendarFocusDate`/`setRouteFocusDate`, consumed-once); every event dot pairs with `sr-only` kind label; sub rows get Pause + ±3d/±1d nudge buttons via `nudgeSub()` (clamped ±7d) with live preview caption before commit.

---

## 8. Motion spec essentials

All motion respects reduced-motion → collapses to final state instantly (never "slower", turn it off).

| Name | Duration | Easing | Purpose |
|---|---|---|---|
| route-draw | 2200ms | ease-out | draws path-to-payday line |
| count-up | 700ms | cubic-out | money values tick up (`useCountUp`) |
| pebble-breathe | 4000ms | ease-in-out loop | Melo idle breathing |
| pebble-breathe-fast | 2200ms | ease-in-out loop | Melo concerned rhythm |
| pebble-blink | 5000ms | step loop | Melo blink, ~5.4s offset L/R |
| sheet-rise | 480ms | cubic-bezier(.16,1,.3,1) | bottom sheet slide+fade in |
| scrim-in | 320ms | ease-out | sheet scrim to 45% ink |
| verdict-stamp | 600ms | back-out cubic-bezier(.34,1.56,.64,1) | ritual verdict appear, ONCE per visit |
| slide-in-r/l | 360ms | cubic-bezier(.16,1,.3,1) | forward/back nav |
| scale-in | 320ms | cubic-bezier(.16,1,.3,1) | tile/card entrance |
| fade-in | 220ms | cubic-bezier(.16,1,.3,1) | lightest entrance (text/hints) |
| pulse-ring | 1800ms | ease-out loop | single active-CTA halo |
| press | 120ms | ease on :active | all taps scale to 0.97 |

Rules: one motion per element (no combining scale-in+slide-in-r). Money values never slide — always count-up. Melo is the ONLY continuously-animating thing on a quiet screen — a second infinite loop breaks room tone. Sheets always sheet-rise+scrim-in. Verdicts stamp exactly once per visit.

RN mapping: reanimated shared values for count-up/breathe; `react-native-svg` + strokeDasharray/Dashoffset for route-draw (mirror 2.2s); no Lottie for Melo — the 5 SVG moods are the spec.

---

## 9. Pricing / gating rules (see also §3)

- 3 tiers: Free £0 / Melo Plus £4.99mo·£39.99yr / Melo Pro £8.99mo·£69.99yr (Pro = superset).
- Free forever, never paywalled: local data + sync of local data, Today/path/route, Review (all sources), Melo's logging tools, edit/delete on any item, full export (JSON+CSV), full access to own history regardless of plan state.
- Paywall guard `canShowUpsell()` — see §3. Suppressed during storm/rainy/fog weather, Recovery active, negative Safe Zone, Quiet Mode.
- One-cycle free trial unlocks all paid lenses together; `lens.trialCycleId`, cleared at cycle close ritual; no auto-renew.
- Downgrade rule: cancelling a paid layer never locks out data the user already has — no read-only-until-you-pay.
- **CONFLICT FLAG:** `HANDOFF_ADDENDUM.md` states "Four free (Survival, Stability, Growth, Reset). Six Plus (...)" — this is SUPERSEDED by `docs/PRICING.md` + `docs/LENSES.md`'s later 2-free/4-Plus/4-Pro split, which this bible treats as canonical. Confirm with owner before building the paywall gate if in doubt.

---

## 10. Open questions blocking porting

- **None of the 10 originally-open product decisions remain open** — all resolved into `ENGINES.md` §6 (pots-tied-to-cash, sub auto-resume, WhatIf persistence, pot borrow cap, path scrub preview+commit, band toggle as lens-only, path shape formula, "things to check" scope, sub-nudge clearing, calendar 35-day expansion, caught-sub single-confirm, recovery preview+commit, spend-hold engine, shortfall auto-close, ignored-item visibility, category taxonomy, ritual pot contributions, cycle-close actuals, "saved across all months", WhatIf days-this-would-last, Melo tool matching, pause-for-a-month semantics, starting-balance source+confidence, payday overflow/weekend/holiday rules, undo-window tiers, editing transactions, pot top-up cadence, export everything, import-from-sheet, pricing paywall rule, past-dated manual events, sub usage decay).
- **Pricing tier conflict** — see §9 CONFLICT FLAG. Resolve before wiring the paywall gate.
- **Insights observation compute timing** — cycle-close (recommended, cheap/stable) vs on-demand (richer, more compute): still an open call in ENGINES.md "Still open for RN" §.
- **Melo engine build order** — 4 of 6 Melo engines (`meloProgress`, `meloReactions`, `meloNeglect`, `meloCosmetics`) are RN-only and unbuilt; don't fake their state on web, don't skip scoping them as real engines before wiring UI that depends on tier/cosmetics/reactions/neglect.
- **Household shared workspace, Irregular income variance model, per-mode DesignTools overrides, mid-cycle mode auto-switch UX beyond the Undo toast** — explicitly flagged in ENGINES.md as "not yet expressed on the web, RN must build."
- **Purchase/restore flow (StoreKit/Play Billing), downgrade UI, grace period after failed renewal** — RN-scope, no web design surface exists yet (Tier billing section, ENGINES.md).
- **Auto-detect mode-switch rules** — "Rules TBD" per MONEY_MODES.md §3; do not build a concrete auto-switch threshold without checking OPEN_QUESTIONS.md is still current.
